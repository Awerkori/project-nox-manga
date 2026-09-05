begin;
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table public.members (
 id uuid primary key references auth.users on delete cascade,
 username text not null unique check(username ~ '^[a-z0-9_]{3,30}$'),
 display_name text not null check(length(display_name) between 1 and 60),
 bio text not null default '' check(length(bio)<=500),
 avatar_id uuid, xp integer not null default 0 check(xp>=0),
 created_at timestamptz not null default now()
);
create table public.access_roles (
 user_id uuid primary key references public.members on delete cascade,
 role text not null default 'USER' check(role in ('USER','EDITOR','ADMIN')),
 suspended boolean not null default false
);
create table public.works (
 id uuid primary key default gen_random_uuid(), slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 title text not null check(length(title) between 1 and 200), aliases text[] not null default '{}',
 synopsis text not null default '' check(length(synopsis)<=5000), description text not null default '' check(length(description)<=10000),
 author text not null default '', artist text not null default '',
 kind text not null default 'MANHWA' check(kind in ('MANGA','MANHWA','MANHUA','WEBTOON')),
 status text not null default 'ONGOING' check(status in ('ONGOING','COMPLETED','HIATUS','CANCELLED')),
 year integer check(year between 1900 and 2200), age_rating integer not null default 12 check(age_rating in (0,10,12,14,16,18)),
 published boolean not null default false, featured boolean not null default false,
 cover_id uuid, source_id uuid unique, updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.tags (
 id uuid primary key default gen_random_uuid(), name text not null unique check(length(name) between 1 and 40),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), kind text not null default 'TAG' check(kind in ('TAG','GENRE'))
);
create table public.work_tags (work_id uuid references public.works on delete cascade, tag_id uuid references public.tags on delete cascade, primary key(work_id,tag_id));
create table public.chapters (
 id uuid primary key default gen_random_uuid(), work_id uuid not null references public.works on delete cascade,
 number numeric(8,2) not null check(number>=0), title text not null default '' check(length(title)<=200),
 published_at timestamptz, source_id uuid unique, created_at timestamptz not null default now(), unique(work_id,number)
);
create table public.media (
 id uuid primary key default gen_random_uuid(), provider text not null check(provider in ('supabase','telegram')),
 provider_key text not null, mime text not null check(mime in ('image/jpeg','image/png','image/webp')),
 width integer not null check(width between 1 and 10000), height integer not null check(height between 1 and 40000),
 bytes integer not null check(bytes between 1 and 19000000), sha256 text not null,
 created_by uuid not null references public.members, created_at timestamptz not null default now()
);
alter table public.works add foreign key(cover_id) references public.media;
alter table public.members add foreign key(avatar_id) references public.media;
create table public.pages (
 chapter_id uuid references public.chapters on delete cascade, position integer check(position between 1 and 500),
 media_id uuid not null references public.media, width integer not null, height integer not null,
 primary key(chapter_id,position), unique(chapter_id,media_id)
);
create table public.library (
 user_id uuid references public.members on delete cascade, work_id uuid references public.works on delete cascade,
 status text not null default 'READING' check(status in ('READING','PLANNED','COMPLETED')),
 favorite boolean not null default false, following boolean not null default true,
 updated_at timestamptz not null default now(), primary key(user_id,work_id)
);
create table public.reading (
 user_id uuid references public.members on delete cascade, chapter_id uuid references public.chapters on delete cascade,
 page integer not null default 1, max_page integer not null default 1, completed_at timestamptz,
 started_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(user_id,chapter_id)
);
create table public.reading_sessions (
 user_id uuid references public.members on delete cascade, chapter_id uuid references public.chapters on delete cascade,
 next_page integer not null default 1, accepted_at timestamptz not null default now(), primary key(user_id,chapter_id)
);
create table public.comments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.members on delete cascade,
 work_id uuid not null references public.works on delete cascade, chapter_id uuid references public.chapters on delete cascade,
 parent_id uuid references public.comments on delete cascade,
 body text not null check(length(trim(body)) between 1 and 2000), removed boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.likes (
 user_id uuid references public.members on delete cascade, work_id uuid references public.works on delete cascade,
 primary key(user_id,work_id)
);
create table public.comment_likes (
 user_id uuid references public.members on delete cascade, comment_id uuid references public.comments on delete cascade,
 primary key(user_id,comment_id)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.members on delete cascade,
 kind text not null, body text not null, href text not null check(href ~ '^/'), dedupe_key text not null,
 read_at timestamptz, created_at timestamptz not null default now(), unique(user_id,dedupe_key)
);
create table public.audit_log (
 id bigint generated always as identity primary key, actor_id uuid references public.members,
 action text not null, target_id uuid, created_at timestamptz not null default now()
);
create table public.settings (key text primary key, value text not null check(length(value)<=2000));
insert into public.settings values ('site_name','Project Nox'),('description','Histórias que ficam com você.'),('contact','');

create index works_search_idx on public.works using gin(title gin_trgm_ops);
create index works_published_idx on public.works(published,updated_at desc);
create index chapters_work_idx on public.chapters(work_id,published_at,number);
create index work_tags_tag_idx on public.work_tags(tag_id);
create index comments_work_idx on public.comments(work_id,created_at desc);
create index comments_parent_idx on public.comments(parent_id);
create index library_work_idx on public.library(work_id,following);
create index reading_recent_idx on public.reading(user_id,updated_at desc);
create index notifications_recent_idx on public.notifications(user_id,created_at desc);
create index pages_media_idx on public.pages(media_id);

create function public.current_role() returns text language sql stable security definer set search_path='' as $$
 select a.role from public.access_roles a join auth.users u on u.id=a.user_id
 where a.user_id=auth.uid() and not a.suspended and u.email_confirmed_at is not null
$$;
create function public.is_editor() returns boolean language sql stable as $$ select coalesce(public.current_role() in ('ADMIN','EDITOR'),false) $$;
create function public.is_owner() returns boolean language sql stable as $$ select coalesce(public.current_role()='ADMIN',false) $$;
create function public.is_member() returns boolean language sql stable as $$ select public.current_role() is not null $$;
create function public.public_chapter(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.chapters c join public.works w on w.id=c.work_id where c.id=p_id and c.published_at is not null and w.published)
$$;
create function public.new_member() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.members(id,username,display_name) values(new.id,'leitor_'||replace(new.id::text,'-',''),'Leitor Nox');
 insert into public.access_roles(user_id) values(new.id);
 return new;
end $$;
-- UUID suffix is shortened to keep the generated username within its maximum length.
create or replace function public.new_member() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.members(id,username,display_name) values(new.id,'nox_'||substr(replace(new.id::text,'-',''),1,24),'Leitor Nox');
 insert into public.access_roles(user_id) values(new.id);
 return new;
end $$;
create trigger new_auth_member after insert on auth.users for each row execute function public.new_member();

do $$ declare t text; begin
 foreach t in array array['members','access_roles','works','tags','work_tags','chapters','media','pages','library','reading','reading_sessions','comments','likes','comment_likes','notifications','audit_log','settings'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 end loop;
end $$;
grant select on public.members,public.works,public.tags,public.work_tags,public.chapters,public.pages,public.comments,public.likes,public.comment_likes to anon,authenticated;
grant select on public.access_roles,public.library,public.reading,public.notifications,public.audit_log,public.settings to authenticated;
create policy profiles_public on public.members for select using(true);
create policy roles_self on public.access_roles for select using(user_id=auth.uid() or public.is_owner());
create policy works_public on public.works for select using(published or public.is_editor());
create policy tags_public on public.tags for select using(true);
create policy work_tags_public on public.work_tags for select using(exists(select 1 from public.works where id=work_id));
create policy chapters_public on public.chapters for select using(public.public_chapter(id) or public.is_editor());
create policy pages_public on public.pages for select using(public.public_chapter(chapter_id) or public.is_editor());
create policy library_self on public.library for select using(user_id=auth.uid());
create policy reading_self on public.reading for select using(user_id=auth.uid());
create policy comments_public on public.comments for select using((not removed and exists(select 1 from public.works w where w.id=work_id and w.published) and (chapter_id is null or public.public_chapter(chapter_id))) or public.is_owner());
create policy likes_public on public.likes for select using(exists(select 1 from public.works w where w.id=work_id and w.published));
create policy comment_likes_public on public.comment_likes for select using(exists(select 1 from public.comments c where c.id=comment_id));
create policy notifications_self on public.notifications for select using(user_id=auth.uid());
create policy audit_owner on public.audit_log for select using(public.is_owner());
create policy settings_owner on public.settings for select using(public.is_owner());

create function public.member_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); wid uuid; cid uuid; v_id uuid; v_page integer; v_count integer; v_xp integer; v_read public.reading; v_session public.reading_sessions;
begin
 if not public.is_member() then raise exception 'Entre em uma conta confirmada e ativa' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if p_action='profile' then
   update public.members set username=lower(trim(p_data->>'username')),display_name=trim(p_data->>'display_name'),bio=coalesce(p_data->>'bio','') where id=uid;
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
     insert into public.comments(user_id,work_id,chapter_id,parent_id,body) values(uid,wid,cid,v_id,trim(p_data->>'body')) returning id into cid;
     if v_id is not null then insert into public.notifications(user_id,kind,body,href,dedupe_key) select user_id,'reply','Uma nova resposta ao seu comentário.','/obra/'||(select slug from public.works where id=wid),'reply:'||cid from public.comments where id=v_id and user_id<>uid on conflict do nothing; end if;
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
       update public.reading set page=v_page,updated_at=now() where user_id=uid and chapter_id=cid;
       if v_page=v_session.next_page and now()-v_session.accepted_at>=interval '3 seconds' then
         update public.reading_sessions set next_page=v_page+1,accepted_at=now() where user_id=uid and chapter_id=cid;
         update public.reading set max_page=greatest(max_page,v_page) where user_id=uid and chapter_id=cid;
         if v_page=v_count and v_read.completed_at is null and now()-v_read.started_at>=greatest(15,v_count*3)*interval '1 second' then
           update public.reading set completed_at=now() where user_id=uid and chapter_id=cid;
           if (select count(*) from public.reading where user_id=uid and completed_at>now()-interval '1 day')<=50 then
             update public.members set xp=xp+25 where id=uid returning xp into v_xp;
             if v_xp=25 or v_xp%250=0 then insert into public.notifications(user_id,kind,body,href,dedupe_key) values(uid,'achievement',case when v_xp=25 then 'Primeiro capítulo concluído. Bem-vindo à Nox!' else 'Você chegou ao nível '||(v_xp/250+1)||'!' end,'/perfil','xp:'||v_xp) on conflict do nothing; end if;
           end if;
         end if;
       end if;
     end if;
     return jsonb_build_object('ok',true,'next_page',(select next_page from public.reading_sessions where user_id=uid and chapter_id=cid));
   else raise exception 'Ação inválida'; end if;
 end if;
 return jsonb_build_object('ok',true);
end $$;

create function public.editor_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; wid uuid; cid uuid; tag uuid; v_number numeric; v_count integer;
begin
 if not public.is_editor() then raise exception 'Acesso editorial negado' using errcode='42501'; end if;
 if p_action='work' then
   v_id:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
   insert into public.works(id,slug,title,aliases,synopsis,description,author,artist,kind,status,year,age_rating,cover_id)
   values(v_id,p_data->>'slug',trim(p_data->>'title'),array(select jsonb_array_elements_text(coalesce(p_data->'aliases','[]'))),coalesce(p_data->>'synopsis',''),coalesce(p_data->>'description',''),coalesce(p_data->>'author',''),coalesce(p_data->>'artist',''),p_data->>'kind',p_data->>'status',nullif(p_data->>'year','')::integer,(p_data->>'age_rating')::integer,nullif(p_data->>'cover_id','')::uuid)
   on conflict(id) do update set slug=excluded.slug,title=excluded.title,aliases=excluded.aliases,synopsis=excluded.synopsis,description=excluded.description,author=excluded.author,artist=excluded.artist,kind=excluded.kind,status=excluded.status,year=excluded.year,age_rating=excluded.age_rating,cover_id=excluded.cover_id,updated_at=now();
   delete from public.work_tags where work_id=v_id;
   insert into public.work_tags(work_id,tag_id) select v_id,value::uuid from jsonb_array_elements_text(coalesce(p_data->'tags','[]')) on conflict do nothing;
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

create function public.owner_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; begin
 perform pg_advisory_xact_lock(743829102);
 if not public.is_owner() then raise exception 'Somente administradores' using errcode='42501'; end if;
 v_id:=nullif(p_data->>'id','')::uuid;
 if p_action='role' then update public.access_roles set role=p_data->>'role' where user_id=v_id;
 elsif p_action='suspend' then update public.access_roles set suspended=(p_data->>'suspended')::boolean where user_id=v_id;
 elsif p_action='moderate' then update public.comments set removed=(p_data->>'removed')::boolean where id=v_id;
 elsif p_action='setting' then update public.settings set value=p_data->>'value' where key=p_data->>'key';
 elsif p_action='delete_chapter' then delete from public.chapters where id=v_id;
 elsif p_action='delete_work' then delete from public.works where id=v_id;
 else raise exception 'Ação administrativa inválida'; end if;
 if not exists(select 1 from public.access_roles where role='ADMIN' and not suspended) then raise exception 'Mantenha pelo menos um administrador ativo'; end if;
 insert into public.audit_log(actor_id,action,target_id) values(auth.uid(),p_action,v_id);
 return jsonb_build_object('ok',true);
end $$;

revoke all on function public.new_member() from public,anon,authenticated;
revoke all on function public.member_action(text,jsonb),public.editor_action(text,jsonb),public.owner_action(text,jsonb) from public,anon;
grant execute on function public.member_action(text,jsonb),public.editor_action(text,jsonb),public.owner_action(text,jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('nox-media','nox-media',false,19000000,array['image/png','image/jpeg','image/webp']);
-- No direct Storage policies: all bytes pass server validation and publication checks.
insert into public.tags(name,slug,kind) values
 ('Ação','acao','GENRE'),('Aventura','aventura','GENRE'),('Fantasia','fantasia','GENRE'),('Drama','drama','GENRE'),('Romance','romance','GENRE'),('Comédia','comedia','GENRE'),('Sobrenatural','sobrenatural','GENRE'),('Escolar','escolar','TAG'),('Psicológico','psicologico','GENRE'),('Mistério','misterio','GENRE'),('Terror','terror','GENRE'),('Sci-Fi','sci-fi','GENRE'),('Isekai','isekai','TAG'),('Murim','murim','TAG'),('Sistema','sistema','TAG'),('Regressão','regressao','TAG'),('Reencarnação','reencarnacao','TAG'),('Apocalipse','apocalipse','TAG'),('Artes marciais','artes-marciais','TAG'),('Slice of Life','slice-of-life','GENRE'),('Esportes','esportes','GENRE'),('Histórico','historico','GENRE'),('Seinen','seinen','TAG'),('Shounen','shounen','TAG'),('Shoujo','shoujo','TAG'),('Josei','josei','TAG');
commit;
