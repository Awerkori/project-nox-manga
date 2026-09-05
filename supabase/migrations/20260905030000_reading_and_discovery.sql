begin;
create or replace function public.member_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
       end if;
       if v_page=v_count and v_read.completed_at is null and exists(select 1 from public.reading_sessions where user_id=uid and chapter_id=cid and next_page>v_count) and now()-v_read.started_at>=greatest(15,v_count*3)*interval '1 second' then
           update public.reading set completed_at=now() where user_id=uid and chapter_id=cid;
           if (select count(*) from public.reading where user_id=uid and completed_at>now()-interval '1 day')<=50 then
             update public.members set xp=xp+25 where id=uid returning xp into v_xp;
             if v_xp=25 or v_xp%250=0 then insert into public.notifications(user_id,kind,body,href,dedupe_key) values(uid,'achievement',case when v_xp=25 then 'Primeiro capítulo concluído. Bem-vindo à Nox!' else 'Você chegou ao nível '||(v_xp/250+1)||'!' end,'/perfil','xp:'||v_xp) on conflict do nothing; end if;
           end if;
       end if;
     end if;
     return jsonb_build_object('ok',true,'next_page',(select next_page from public.reading_sessions where user_id=uid and chapter_id=cid));
   else raise exception 'Ação inválida'; end if;
 end if;
 return jsonb_build_object('ok',true);
end $$;

-- Search is indexed and includes alternate names, never private source metadata.
alter table public.works add column search_text text not null default '';
create function public.index_work_search() returns trigger language plpgsql set search_path='' as $$
begin new.search_text:=new.title||' '||array_to_string(new.aliases,' '); return new; end$$;
create trigger works_search_text before insert or update of title,aliases on public.works for each row execute function public.index_work_search();
update public.works set search_text=title||' '||array_to_string(aliases,' ');
create index works_search_trgm_idx on public.works using gin(search_text gin_trgm_ops);
revoke all on function public.index_work_search() from public,anon,authenticated;

create function public.work_metrics(p_work uuid) returns table(favorites bigint,likes bigint,readers bigint)
language sql stable security definer set search_path='' as $$
 select (select count(*) from public.library where work_id=p_work and favorite),
 (select count(*) from public.likes where work_id=p_work),
 (select count(distinct r.user_id) from public.reading r join public.chapters c on c.id=r.chapter_id where c.work_id=p_work and c.published_at is not null)
 where exists(select 1 from public.works where id=p_work and published)
$$;
revoke all on function public.work_metrics(uuid) from public;
grant execute on function public.work_metrics(uuid) to anon,authenticated;

create function public.revoke_editor_invite(p_email text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_owner() then raise exception 'Somente administradores' using errcode='42501';end if;
 delete from public.editor_invites where email=lower(trim(p_email));
 insert into public.audit_log(actor_id,action) values(auth.uid(),'editor_invite_revoked');
end$$;
revoke all on function public.revoke_editor_invite(text) from public,anon;
grant execute on function public.revoke_editor_invite(text) to authenticated;
commit;
