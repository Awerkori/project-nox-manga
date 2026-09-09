begin;

-- Published adult works are visible only to active, confirmed members whose
-- server-side profile explicitly records ADULT. The public anon key remains
-- public by design; authorization is enforced by PostgreSQL.
create or replace function public.member_is_adult()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.is_member()
    and exists (
      select 1
      from public.members m
      where m.id = auth.uid()
        and m.age_status = 'ADULT'
    ),
    false
  )
$$;

create or replace function public.public_work(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.works w
    where w.id = p_id
      and w.published
      and (w.content_rating <> 'ADULT_18' or public.member_is_adult())
  )
$$;

create or replace function public.public_chapter(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.chapters c
    where c.id = p_id
      and c.published_at is not null
      and public.public_work(c.work_id)
  )
$$;

revoke all on function public.member_is_adult() from public;
revoke all on function public.public_work(uuid) from public;
revoke all on function public.public_chapter(uuid) from public;
grant execute on function public.member_is_adult() to anon, authenticated;
grant execute on function public.public_work(uuid) to anon, authenticated;
grant execute on function public.public_chapter(uuid) to anon, authenticated;

drop policy if exists works_public on public.works;
create policy works_public on public.works
  for select
  using (
    (published and (content_rating <> 'ADULT_18' or public.member_is_adult()))
    or public.is_editor()
  );

drop policy if exists work_tags_public on public.work_tags;
create policy work_tags_public on public.work_tags
  for select
  using (public.public_work(work_id) or public.is_editor());

drop policy if exists chapters_public on public.chapters;
create policy chapters_public on public.chapters
  for select
  using (public.public_chapter(id) or public.is_editor());

drop policy if exists pages_public on public.pages;
create policy pages_public on public.pages
  for select
  using (public.public_chapter(chapter_id) or public.is_editor());

drop policy if exists comments_public on public.comments;
create policy comments_public on public.comments
  for select
  using (
    (
      not removed
      and public.public_work(work_id)
      and (chapter_id is null or public.public_chapter(chapter_id))
    )
    or public.is_owner()
  );

drop policy if exists likes_public on public.likes;
create policy likes_public on public.likes
  for select
  using (public.public_work(work_id));

-- Mutations of the staff import queue must go through the audited RPCs. An
-- editor may inspect requests, but cannot rewrite actor, priority or status.
drop policy if exists staff_requests_insert on public.importer_staff_requests;
drop policy if exists staff_requests_update on public.importer_staff_requests;
revoke insert, update on public.importer_staff_requests from authenticated;

-- Enforce sequential reading as a database invariant. This protects every
-- caller, including direct PostgREST/RPC calls that bypass the web interface.
create function public.enforce_reading_session_sequence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.next_page > old.next_page + 1 then
    raise exception 'Progresso de leitura fora de sequência' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger reading_sessions_sequential_update
before update of next_page on public.reading_sessions
for each row execute function public.enforce_reading_session_sequence();

create function public.enforce_xp_reading_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pages integer;
  v_next_page integer;
begin
  select count(*) into v_pages
  from public.pages p
  where p.chapter_id = new.chapter_id;

  select s.next_page into v_next_page
  from public.reading_sessions s
  where s.user_id = new.user_id
    and s.chapter_id = new.chapter_id;

  if v_pages < 1 or coalesce(v_next_page, 1) <= v_pages then
    raise exception 'Leitura sequencial ainda não concluída' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger xp_awards_require_sequential_reading
before insert on public.xp_awards
for each row execute function public.enforce_xp_reading_completion();

revoke all on function public.enforce_reading_session_sequence() from public, anon, authenticated;
revoke all on function public.enforce_xp_reading_completion() from public, anon, authenticated;

commit;
