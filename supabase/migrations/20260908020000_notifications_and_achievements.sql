begin;

create or replace function public.member_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); wid uuid; cid uuid; v_id uuid; v_comment_id uuid; v_page integer; v_count integer; v_xp integer; v_read public.reading; v_session public.reading_sessions;
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

create or replace function public.claim_editor_invite() returns boolean language plpgsql security definer set search_path='' as $$
declare e text;begin
 select lower(email) into e from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if e is null then return false;end if;
 perform 1 from public.editor_invites where email=e for update;if not found then return false;end if;
 update public.access_roles set role='EDITOR' where user_id=auth.uid() and role='USER' and not suspended;
 if not found then return false;end if;
 delete from public.editor_invites where email=e;
 insert into public.notifications(user_id,kind,body,href,dedupe_key)
 values(auth.uid(),'editorial','Acesso editorial concedido. Bem-vindo à equipe de publicação!','/admin','role:editor')
 on conflict do nothing;
 insert into public.audit_log(actor_id,action,target_id) values(auth.uid(),'editor_invite_claimed',auth.uid());
 return true;
end$$;

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
 elsif p_action='moderate' then update public.comments set removed=(p_data->>'removed')::boolean where id=v_id;
 elsif p_action='setting' then update public.settings set value=p_data->>'value' where key=p_data->>'key';
 elsif p_action='delete_chapter' then delete from public.chapters where id=v_id;
 elsif p_action='delete_work' then delete from public.works where id=v_id;
 else raise exception 'Ação administrativa inválida'; end if;
 if not exists(select 1 from public.access_roles where role='ADMIN' and not suspended) then raise exception 'Mantenha pelo menos um administrador ativo'; end if;
 insert into public.audit_log(actor_id,action,target_id) values(auth.uid(),p_action,v_id);
 return jsonb_build_object('ok',true);
end $$;

commit;
