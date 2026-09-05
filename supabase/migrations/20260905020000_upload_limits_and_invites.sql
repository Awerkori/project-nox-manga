begin;
alter table public.media add column storage_ready boolean not null default true;
alter table public.media add column purpose text not null default 'editorial' check(purpose in ('editorial','avatar'));
create index media_provider_idx on public.media(provider);
create index media_author_date_idx on public.media(created_by,created_at);
create table public.editor_invites(email text primary key check(email=lower(trim(email)) and length(email)<=254),created_by uuid not null references public.members,created_at timestamptz not null default now());
alter table public.editor_invites enable row level security;
revoke all on public.editor_invites from public,anon,authenticated;
grant select on public.editor_invites to authenticated;
create policy invites_owner on public.editor_invites for select using(public.is_owner());

create function public.invite_editor(p_email text) returns void language plpgsql security definer set search_path='' as $$
declare e text:=lower(trim(p_email));begin
 if not public.is_owner() then raise exception 'Somente administradores' using errcode='42501';end if;
 if e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(e)>254 then raise exception 'E-mail inválido';end if;
 insert into public.editor_invites(email,created_by) values(e,auth.uid()) on conflict(email) do update set created_by=excluded.created_by,created_at=now();
 insert into public.audit_log(actor_id,action) values(auth.uid(),'editor_invite');
end$$;
create function public.claim_editor_invite() returns boolean language plpgsql security definer set search_path='' as $$
declare e text;begin
 select lower(email) into e from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if e is null then return false;end if;
 perform 1 from public.editor_invites where email=e for update;if not found then return false;end if;
 update public.access_roles set role='EDITOR' where user_id=auth.uid() and role='USER' and not suspended;
 if not found then return false;end if;
 delete from public.editor_invites where email=e;
 insert into public.audit_log(actor_id,action,target_id) values(auth.uid(),'editor_invite_claimed',auth.uid());
 return true;
end$$;
revoke all on function public.invite_editor(text),public.claim_editor_invite() from public,anon;
grant execute on function public.invite_editor(text),public.claim_editor_invite() to authenticated;

create function public.reserve_media(p_id uuid,p_user uuid,p_provider text,p_mime text,p_width integer,p_height integer,p_bytes integer,p_sha256 text,p_purpose text default 'editorial') returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(547291046);
 if not exists(select 1 from public.access_roles a join auth.users u on u.id=a.user_id where a.user_id=p_user and not a.suspended and u.email_confirmed_at is not null and (a.role in ('EDITOR','ADMIN') or p_purpose='avatar')) then raise exception 'Upload não autorizado' using errcode='42501';end if;
 if p_purpose='avatar' and (p_bytes>300000 or p_width>512 or p_height>512) then raise exception 'Avatar acima do limite';end if;
 if (select count(*) from public.media where created_by=p_user and created_at>now()-interval '1 hour') >= (case when p_purpose='avatar' then 5 else 600 end) then raise exception 'Limite de uploads por hora atingido';end if;
 if p_provider='supabase' and (select coalesce(sum(bytes),0) from public.media where provider='supabase')+p_bytes>750000000 then raise exception 'A reserva de armazenamento gratuito foi atingida';end if;
 insert into public.media(id,provider,provider_key,mime,width,height,bytes,sha256,created_by,storage_ready,purpose) values(p_id,p_provider,p_id::text,p_mime,p_width,p_height,p_bytes,p_sha256,p_user,false,p_purpose);
end$$;
revoke all on function public.reserve_media(uuid,uuid,text,text,integer,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.reserve_media(uuid,uuid,text,text,integer,integer,integer,text,text) to service_role;

create function public.verify_publication_media() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.published_at is not null and old.published_at is null then
  if exists(select 1 from public.pages p join public.media m on m.id=p.media_id where p.chapter_id=new.id and not m.storage_ready) or not exists(select 1 from public.works w join public.media m on m.id=w.cover_id where w.id=new.work_id and m.storage_ready) then raise exception 'Aguarde a conclusão de todos os uploads antes de publicar';end if;
 end if;return new;
end$$;
create trigger chapter_upload_complete before update of published_at on public.chapters for each row execute function public.verify_publication_media();
revoke all on function public.verify_publication_media() from public,anon,authenticated;
create function public.public_settings() returns table(key text,value text) language sql stable security definer set search_path='' as $$select key,value from public.settings where key in ('site_name','description','contact')$$;
grant execute on function public.public_settings() to anon,authenticated;
commit;
