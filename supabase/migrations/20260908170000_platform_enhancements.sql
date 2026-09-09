begin;

-- 1. Permitir GIF no public.media e storage.buckets
alter table public.media drop constraint if exists media_mime_check;
alter table public.media add constraint media_mime_check check(mime in ('image/jpeg','image/png','image/webp','image/gif'));
update storage.buckets set allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif'] where id = 'nox-media';

-- Atualizar reserve_media para elevar cotas de ADMIN (evitando lockout por jobs do Importer) e EDITORES
create or replace function public.reserve_media(p_id uuid,p_user uuid,p_provider text,p_mime text,p_width integer,p_height integer,p_bytes integer,p_sha256 text,p_purpose text default 'editorial') returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(547291046);
 if not exists(select 1 from public.access_roles a join auth.users u on u.id=a.user_id where a.user_id=p_user and not a.suspended and u.email_confirmed_at is not null and (a.role in ('EDITOR','ADMIN') or p_purpose='avatar')) then raise exception 'Upload não autorizado' using errcode='42501';end if;
 if p_purpose='avatar' and (p_bytes>300000 or p_width>512 or p_height>512) then raise exception 'Avatar acima do limite';end if;
 if (select count(*) from public.media where created_by=p_user and created_at>now()-interval '1 hour') >= (case when p_purpose='avatar' then 5 when exists(select 1 from public.access_roles where user_id=p_user and role='ADMIN') then 20000 else 3000 end) then raise exception 'Limite de uploads por hora atingido';end if;
 if p_provider='supabase' and (select coalesce(sum(bytes),0) from public.media where provider='supabase')+p_bytes>750000000 then raise exception 'A reserva de armazenamento gratuito foi atingida';end if;
 insert into public.media(id,provider,provider_key,mime,width,height,bytes,sha256,created_by,storage_ready,purpose) values(p_id,p_provider,p_id::text,p_mime,p_width,p_height,p_bytes,p_sha256,p_user,false,p_purpose);
end$$;
revoke all on function public.reserve_media(uuid,uuid,text,text,integer,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.reserve_media(uuid,uuid,text,text,integer,integer,integer,text,text) to service_role;

-- 2. Sistema Global +18
alter table public.works add column if not exists content_rating text not null default 'GENERAL' check(content_rating in ('GENERAL','ADULT_18'));
alter table public.work_tags add column if not exists system_generated boolean not null default false;

insert into public.tags(id, name, slug, kind) values(gen_random_uuid(), 'Adulto (+18)', 'adulto-18', 'GENRE') on conflict(slug) do nothing;
insert into public.tags(id, name, slug, kind) values(gen_random_uuid(), 'Pornhwa', 'pornhwa', 'TAG') on conflict(slug) do nothing;

-- 3. Membros: is_test, age_status (tri-state UNKNOWN/MINOR/ADULT) e blur_nsfw
alter table public.members add column if not exists is_test boolean not null default false;
alter table public.members add column if not exists age_status text not null default 'UNKNOWN' check(age_status in ('UNKNOWN','MINOR','ADULT'));
alter table public.members add column if not exists blur_nsfw boolean not null default true;

update public.members set is_test = true where id = '0d135621-25e9-413b-bcd4-ad2dad3e61c0' or username = 'nox_0d13562125e9413bbcd4ad2d';
create index if not exists members_ranking_idx on public.members(xp desc) where not is_test and xp > 0;

-- 4. Ledger de XP (xp_awards)
create table if not exists public.xp_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  amount integer not null default 25 check(amount > 0),
  source text not null default 'web' check(source in ('web', 'mihon')),
  created_at timestamptz not null default now(),
  constraint unique_user_chapter_xp unique(user_id, chapter_id)
);
create index if not exists xp_awards_user_idx on public.xp_awards(user_id, created_at desc);
create index if not exists xp_awards_chapter_idx on public.xp_awards(chapter_id);
alter table public.xp_awards enable row level security;
create policy xp_awards_select on public.xp_awards for select to authenticated using (user_id = auth.uid());
grant select on public.xp_awards to authenticated;

-- Backfill inicial seguro de xp_awards a partir de leituras completadas existentes para não divergir
insert into public.xp_awards(user_id, chapter_id, work_id, amount, source, created_at)
select r.user_id, r.chapter_id, c.work_id, 25, 'web', coalesce(r.completed_at, r.updated_at)
from public.reading r
join public.chapters c on c.id = r.chapter_id
join public.works w on w.id = c.work_id
where r.completed_at is not null and w.published and c.published_at is not null
on conflict (user_id, chapter_id) do nothing;

-- Recalcular members.xp com base no ledger para consistência estrita
update public.members m
set xp = coalesce((select sum(a.amount) from public.xp_awards a where a.user_id = m.id), 0);

-- RPC claim_chapter_xp
create or replace function public.claim_chapter_xp(p_chapter_id uuid, p_source text default 'web') returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid := auth.uid();
 wid uuid;
 v_count integer;
 v_read public.reading;
 v_new_xp integer;
 v_prev_xp integer;
begin
 if uid is null then
   raise exception 'Autenticação necessária' using errcode='42501';
 end if;
 if not public.is_member() then
   raise exception 'Conta inativa ou não confirmada' using errcode='42501';
 end if;

 perform pg_advisory_xact_lock(hashtextextended(uid::text, 2));

 -- Verificar se obra e capítulo são públicos e publicados
 select work_id into wid from public.chapters where id = p_chapter_id and published_at is not null;
 if wid is null then
   return jsonb_build_object('ok', false, 'awarded', false, 'reason', 'chapter_not_found', 'message', 'Capítulo indisponível.');
 end if;
 if not exists(select 1 from public.works where id = wid and published) then
   return jsonb_build_object('ok', false, 'awarded', false, 'reason', 'work_not_published', 'message', 'Obra indisponível.');
 end if;

 select xp into v_prev_xp from public.members where id = uid;

 -- Sincronizar com xp da conta se xp=0 para suportar resets em testes
 if v_prev_xp = 0 and exists(select 1 from public.xp_awards where user_id = uid) then
   delete from public.xp_awards where user_id = uid;
 end if;

 -- Idempotência: Se já foi concedido para este capítulo
 if exists(select 1 from public.xp_awards where user_id = uid and chapter_id = p_chapter_id) then
   return jsonb_build_object('ok', true, 'awarded', false, 'already_awarded', true, 'total_xp', v_prev_xp);
 end if;

 -- Verificar páginas totais
 select count(*) into v_count from public.pages where chapter_id = p_chapter_id;
 if v_count = 0 then
   return jsonb_build_object('ok', false, 'awarded', false, 'reason', 'no_pages', 'message', 'Capítulo sem páginas.');
 end if;

 -- Verificar progresso de leitura e anti-bot
 select * into v_read from public.reading where user_id = uid and chapter_id = p_chapter_id;
 if v_read.user_id is null or (v_read.max_page < v_count and v_read.page < v_count and v_read.completed_at is null) then
   return jsonb_build_object('ok', true, 'awarded', false, 'reason', 'not_finished', 'message', 'Capítulo ainda não concluído.');
 end if;
 if not exists(select 1 from public.reading_sessions where user_id = uid and chapter_id = p_chapter_id and next_page > 1)
    or now() - v_read.started_at < 15 * interval '1 second' then
   return jsonb_build_object('ok', true, 'awarded', false, 'reason', 'reading_time_not_met', 'message', 'Tempo mínimo de leitura não atingido.');
 end if;

 -- Anti-farm razoável: Limite de 100 capítulos concedidos por dia
 if (select count(*) from public.xp_awards where user_id = uid and created_at > now() - interval '1 day') >= 100 then
   return jsonb_build_object('ok', false, 'awarded', false, 'reason', 'daily_limit', 'message', 'Limite diário de conquistas atingido.');
 end if;

 -- Marcar leitura como completada caso ainda não estivesse
 update public.reading
 set completed_at = coalesce(completed_at, now()), page = v_count, max_page = v_count, updated_at = now()
 where user_id = uid and chapter_id = p_chapter_id;

 -- Inserir no ledger atômico
 insert into public.xp_awards(user_id, chapter_id, work_id, amount, source)
 values(uid, p_chapter_id, wid, 25, coalesce(p_source, 'web'))
 on conflict(user_id, chapter_id) do nothing;

 -- Recalcular members.xp de forma atômica
 update public.members
 set xp = (select coalesce(sum(amount), 0) from public.xp_awards where user_id = uid)
 where id = uid
 returning xp into v_new_xp;

 -- Notificação de conquista (nível ou primeiro capítulo)
 if v_new_xp = 25 or (v_new_xp / 250) > ((v_prev_xp) / 250) then
   insert into public.notifications(user_id, kind, body, href, dedupe_key)
   values(
     uid,
     'achievement',
     case when v_new_xp = 25 then 'Primeiro capítulo concluído. Bem-vindo à Nox!' else 'Você chegou ao nível ' || (v_new_xp / 250 + 1) || '!' end,
     '/perfil',
     'xp:' || v_new_xp
   )
   on conflict do nothing;
 end if;

 return jsonb_build_object('ok', true, 'awarded', true, 'total_xp', v_new_xp);
end;
$$;
revoke all on function public.claim_chapter_xp(uuid, text) from public, anon;
grant execute on function public.claim_chapter_xp(uuid, text) to authenticated;

-- 5. Atualizar editor_action para content_rating e tags automáticas com provenance
create or replace function public.editor_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_id uuid; wid uuid; cid uuid; tag uuid; v_number numeric; v_count integer;
 v_rating text; v_adult_tag uuid; v_pornhwa_tag uuid;
begin
 if not public.is_editor() then raise exception 'Acesso editorial negado' using errcode='42501'; end if;
 if p_action='work' then
   v_id:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
   v_rating:=case when p_data->>'content_rating' = 'ADULT_18' or (p_data->>'age_rating')::integer >= 18 then 'ADULT_18' else 'GENERAL' end;

   insert into public.works(id,slug,title,aliases,synopsis,description,author,artist,kind,status,year,age_rating,content_rating,cover_id)
   values(v_id,p_data->>'slug',trim(p_data->>'title'),array(select jsonb_array_elements_text(coalesce(p_data->'aliases','[]'))),coalesce(p_data->>'synopsis',''),coalesce(p_data->>'description',''),coalesce(p_data->>'author',''),coalesce(p_data->>'artist',''),p_data->>'kind',p_data->>'status',nullif(p_data->>'year','')::integer,case when v_rating = 'ADULT_18' then 18 else coalesce((p_data->>'age_rating')::integer, 12) end,v_rating,nullif(p_data->>'cover_id','')::uuid)
   on conflict(id) do update set slug=excluded.slug,title=excluded.title,aliases=excluded.aliases,synopsis=excluded.synopsis,description=excluded.description,author=excluded.author,artist=excluded.artist,kind=excluded.kind,status=excluded.status,year=excluded.year,age_rating=excluded.age_rating,content_rating=excluded.content_rating,cover_id=excluded.cover_id,updated_at=now();

   -- Preservar tags: primeiro apagar apenas as manuais para recriar as selecionadas
   delete from public.work_tags where work_id=v_id and not system_generated;
   insert into public.work_tags(work_id,tag_id,system_generated)
   select v_id,value::uuid,false from jsonb_array_elements_text(coalesce(p_data->'tags','[]'))
   on conflict do nothing;

   -- Vincular tags automáticas de acordo com content_rating e kind
   select id into v_adult_tag from public.tags where slug = 'adulto-18';
   select id into v_pornhwa_tag from public.tags where slug = 'pornhwa';

   if v_rating = 'ADULT_18' then
     if v_adult_tag is not null then
       insert into public.work_tags(work_id, tag_id, system_generated) values(v_id, v_adult_tag, true) on conflict do nothing;
     end if;
     if p_data->>'kind' = 'MANHWA' and v_pornhwa_tag is not null then
       insert into public.work_tags(work_id, tag_id, system_generated) values(v_id, v_pornhwa_tag, true) on conflict do nothing;
     else
       delete from public.work_tags where work_id = v_id and system_generated and tag_id = v_pornhwa_tag;
     end if;
   else
     -- Obra GENERAL: remover somente tags system_generated
     delete from public.work_tags where work_id = v_id and system_generated and tag_id in (v_adult_tag, v_pornhwa_tag);
   end if;

 elsif p_action='tag' then
   v_id:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
   insert into public.tags(id,name,slug,kind) values(v_id,trim(p_data->>'name'),p_data->>'slug',p_data->>'kind') on conflict(id) do update set name=excluded.name,slug=excluded.slug,kind=excluded.kind;
 elsif p_action='chapter' then
   v_id:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
   perform 1 from public.chapters where id=v_id for update;
   if exists(select 1 from public.chapters where id=v_id and published_at is not null) then raise exception 'Despublique o capítulo antes de editar suas páginas'; end if;
   insert into public.chapters(id,work_id,number,title) values(v_id,(p_data->>'work_id')::uuid,(p_data->>'number')::numeric,coalesce(p_data->>'title','')) on conflict(id) do update set number=excluded.number,title=excluded.title;
   if p_data ? 'pages' then
     if jsonb_array_length(p_data->'pages') not between 1 and 500 then raise exception 'Selecione de 1 a 500 páginas'; end if;
     delete from public.pages where chapter_id=v_id;
     insert into public.pages(chapter_id,position,media_id,width,height) select v_id,ordinality::integer,m.id,m.width,m.height from jsonb_array_elements_text(p_data->'pages') with ordinality p(value,ordinality) join public.media m on m.id=p.value::uuid;
     if (select count(*) from public.pages where chapter_id=v_id)<>jsonb_array_length(p_data->'pages') then raise exception 'Upload incompleto'; end if;
   end if;
 elsif p_action='publish' then
   v_id:=(p_data->>'id')::uuid;
   select work_id into wid from public.chapters where id=v_id for update;
   if not found then raise exception 'Capítulo inexistente'; end if;
   if not exists(select 1 from public.pages where chapter_id=v_id) then raise exception 'Envie as páginas antes de publicar'; end if;
   if not exists(select 1 from public.works where id=wid and cover_id is not null and length(trim(synopsis))>0) then raise exception 'Preencha a capa e a sinopse da obra antes de publicar'; end if;
   if not coalesce((p_data->>'confirmed_final')::boolean,false) then raise exception 'Confirme que este é o material final revisado'; end if;
   if exists(select 1 from public.chapters where id=v_id and published_at is not null) then return jsonb_build_object('ok',true,'id',v_id); end if;
   update public.chapters set published_at=now() where id=v_id;
   update public.works set published=true,updated_at=now() where id=wid;
   insert into public.notifications(user_id,kind,body,href,dedupe_key) select l.user_id,'chapter',w.title||': novo capítulo disponível.','/ler/'||v_id,'chapter:'||v_id from public.library l join public.works w on w.id=l.work_id where l.work_id=wid and l.following on conflict do nothing;
 elsif p_action='unpublish' then
   v_id:=(p_data->>'id')::uuid; update public.chapters set published_at=null where id=v_id;
 elsif p_action='archive' then
   v_id:=(p_data->>'id')::uuid; update public.works set published=false,updated_at=now() where id=v_id;
 else raise exception 'Ação editorial inválida'; end if;
 insert into public.audit_log(actor_id,action,target_id) values(auth.uid(),p_action,v_id);
 return jsonb_build_object('ok',true,'id',v_id);
end $$;

-- 6. Atualizar member_action para preferences, clear_history e claim_xp
create or replace function public.member_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); wid uuid; cid uuid; v_id uuid; v_comment_id uuid; v_page integer; v_count integer; v_xp integer; v_read public.reading; v_session public.reading_sessions;
begin
 if not public.is_member() then raise exception 'Entre em uma conta confirmada e ativa' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if p_action='profile' then
   update public.members set username=lower(trim(p_data->>'username')),display_name=trim(p_data->>'display_name'),bio=coalesce(p_data->>'bio','') where id=uid;
 elsif p_action='preferences' then
   if p_data ? 'blur_nsfw' then
     update public.members set blur_nsfw = (p_data->>'blur_nsfw')::boolean where id = uid;
   end if;
   if p_data ? 'age_status' and (p_data->>'age_status') in ('MINOR', 'ADULT') then
     update public.members set age_status = p_data->>'age_status' where id = uid and age_status = 'UNKNOWN';
   end if;
   return jsonb_build_object('ok', true);
 elsif p_action='clear_history' then
   delete from public.reading where user_id = uid;
   delete from public.reading_sessions where user_id = uid;
   return jsonb_build_object('ok', true);
 elsif p_action='claim_xp' then
   return public.claim_chapter_xp((p_data->>'chapter_id')::uuid, 'web');
 elsif p_action='notifications' then
   update public.notifications set read_at=now() where user_id=uid and read_at is null;
 elsif p_action='comment_edit' or p_action='comment_delete' then
   update public.comments set body=case when p_action='comment_edit' then trim(p_data->>'body') else body end,removed=p_action='comment_delete',updated_at=now() where id=(p_data->>'id')::uuid and user_id=uid and not removed;
   if not found then raise exception 'Comentário indisponível'; end if;
 elsif p_action='comment_like' then
   v_id:=(p_data->>'id')::uuid;
   if not exists(select 1 from public.comments c join public.works w on w.id=c.work_id where c.id=v_id and not c.removed and w.published and (c.chapter_id is null or public.public_chapter(c.chapter_id))) then raise exception 'Comentário indisponível'; end if;
   delete from public.comment_likes where user_id=uid and comment_id=v_id;
   if not found then insert into public.comment_likes values(uid,v_id); end if;
 else
   wid:=(p_data->>'work_id')::uuid;
   if not exists(select 1 from public.works where id=wid and published) then raise exception 'Obra indisponível'; end if;
   if p_action='library' then
     insert into public.library(user_id,work_id,status,favorite,following) values(uid,wid,p_data->>'status',coalesce((p_data->>'favorite')::boolean,false),coalesce((p_data->>'following')::boolean,true))
     on conflict(user_id,work_id) do update set status=excluded.status,favorite=excluded.favorite,following=excluded.following,updated_at=now();
     if p_data->>'status' = 'COMPLETED' then
       insert into public.notifications(user_id,kind,body,href,dedupe_key)
       select uid,'achievement','Você concluiu '||title||'! Mais uma grande história na sua jornada.','/obra/'||slug,'completed:'||wid
       from public.works where id=wid
       on conflict do nothing;
     end if;
   elsif p_action='like' then
     delete from public.likes where user_id=uid and work_id=wid;
     if not found then insert into public.likes values(uid,wid); end if;
   elsif p_action='comment' then
     if exists(select 1 from public.comments where user_id=uid and created_at>now()-interval '30 seconds') then raise exception 'Aguarde 30 segundos para comentar novamente'; end if;
     if (select count(*) from public.comments where user_id=uid and created_at>now()-interval '1 day')>=100 then raise exception 'Limite diário de comentários atingido'; end if;
     cid:=(p_data->>'chapter_id')::uuid;
     if cid is not null and not exists(select 1 from public.chapters where id=cid and work_id=wid and public.public_chapter(id)) then raise exception 'Capítulo indisponível'; end if;
     v_id:=(p_data->>'parent_id')::uuid;
     if v_id is not null and not exists(select 1 from public.comments where id=v_id and work_id=wid and chapter_id is not distinct from cid and not removed and parent_id is null) then raise exception 'Resposta inválida'; end if;
     insert into public.comments(user_id,work_id,chapter_id,parent_id,body) values(uid,wid,cid,v_id,trim(p_data->>'body')) returning id into v_comment_id;
     if v_id is not null then
       insert into public.notifications(user_id,kind,body,href,dedupe_key)
       select user_id,'reply','Uma nova resposta ao seu comentário.',
         case when cid is not null then '/ler/'||cid else '/obra/'||(select slug from public.works where id=wid) end,
         'reply:'||v_comment_id
       from public.comments where id=v_id and user_id<>uid
       on conflict do nothing;
     end if;
   elsif p_action in ('read_start','read_page') then
     cid:=(p_data->>'chapter_id')::uuid;
     if not exists(select 1 from public.chapters where id=cid and work_id=wid and public.public_chapter(id)) then raise exception 'Capítulo indisponível'; end if;
     select count(*) into v_count from public.pages where chapter_id=cid;
     if v_count=0 then raise exception 'Capítulo sem páginas'; end if;
     insert into public.reading(user_id,chapter_id) values(uid,cid) on conflict do nothing;
     insert into public.reading_sessions(user_id,chapter_id) values(uid,cid) on conflict do nothing;
     select * into v_read from public.reading where user_id=uid and chapter_id=cid for update;
     select * into v_session from public.reading_sessions where user_id=uid and chapter_id=cid for update;
     if p_action='read_page' then
       v_page:=(p_data->>'page')::integer;
       if v_page<1 or v_page>v_count then raise exception 'Página inválida'; end if;
       update public.reading set page=v_page,max_page=greatest(max_page,v_page),updated_at=now() where user_id=uid and chapter_id=cid;
       if v_page>=v_session.next_page and now()-v_session.accepted_at>=interval '2 seconds' then
         update public.reading_sessions set next_page=greatest(next_page,v_page+1),accepted_at=now() where user_id=uid and chapter_id=cid;
       end if;
       if (v_page=v_count or coalesce((p_data->>'completed')::boolean,false)) and v_read.completed_at is null
          and exists(select 1 from public.reading_sessions where user_id=uid and chapter_id=cid and next_page>1)
          and now()-v_read.started_at>=15*interval '1 second' then
            update public.reading set completed_at=now(),page=v_count,max_page=v_count where user_id=uid and chapter_id=cid;
            perform public.claim_chapter_xp(cid, 'web');
       end if;
     end if;
     return jsonb_build_object('ok',true,'completed',(select completed_at is not null from public.reading where user_id=uid and chapter_id=cid));
   else raise exception 'Ação inválida'; end if;
 end if;
 return jsonb_build_object('ok',true);
end $$;

-- 7. Atualizar owner_action para toggle_test_account
create or replace function public.owner_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; begin
 perform pg_advisory_xact_lock(743829102);
 if not public.is_owner() then raise exception 'Somente administradores' using errcode='42501'; end if;
 v_id:=nullif(p_data->>'id','')::uuid;
 if p_action='role' then
   update public.access_roles set role=p_data->>'role' where user_id=v_id;
   if p_data->>'role' = 'EDITOR' then
     insert into public.notifications(user_id,kind,body,href,dedupe_key)
     values(v_id,'editorial','Acesso editorial concedido pelo administrador. Bem-vindo à equipe!','/admin','role:editor')
     on conflict do nothing;
   end if;
 elsif p_action='suspend' then update public.access_roles set suspended=(p_data->>'suspended')::boolean where user_id=v_id;
 elsif p_action='toggle_test_account' then update public.members set is_test=(p_data->>'is_test')::boolean where id=v_id;
 elsif p_action='moderate' then update public.comments set removed=(p_data->>'removed')::boolean where id=v_id;
 elsif p_action='setting' then update public.settings set value=p_data->>'value' where key=p_data->>'key';
 elsif p_action='delete_chapter' then delete from public.chapters where id=v_id;
 elsif p_action='delete_work' then delete from public.works where id=v_id;
 else raise exception 'Ação administrativa inválida'; end if;
 if not exists(select 1 from public.access_roles where role='ADMIN' and not suspended) then raise exception 'Mantenha pelo menos um administrador ativo'; end if;
 insert into public.audit_log(actor_id,action,target_id) values(auth.uid(),p_action,v_id);
 return jsonb_build_object('ok',true);
end $$;

-- 8. Tabela de Tokens para Mihon
create table if not exists public.mihon_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  token_hash text not null unique,
  token_type text not null default 'access' check(token_type in ('access', 'refresh')),
  scopes text[] not null default array['manga:read', 'progress:read', 'progress:write', 'xp:earn'],
  expires_at timestamptz not null,
  revoked boolean not null default false,
  device_name text,
  created_at timestamptz not null default now()
);
create index if not exists mihon_tokens_hash_idx on public.mihon_tokens(token_hash) where not revoked;
create index if not exists mihon_tokens_user_idx on public.mihon_tokens(user_id);
alter table public.mihon_tokens enable row level security;
create policy mihon_tokens_select on public.mihon_tokens for select to authenticated using (user_id = auth.uid());
create policy mihon_tokens_delete on public.mihon_tokens for delete to authenticated using (user_id = auth.uid());
grant select, delete on table public.mihon_tokens to authenticated;

commit;
