-- ==============================================================================
-- Project Nox Manga - Migration 20261025130000: Work Ratings System (0 to 5 Stars)
-- ==============================================================================

create table if not exists public.work_ratings (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  visitor_id text not null,
  user_id uuid references public.members(id) on delete cascade,
  rating smallint not null check (rating >= 0 and rating <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, visitor_id)
);

create index if not exists idx_work_ratings_work_id on public.work_ratings(work_id);
create index if not exists idx_work_ratings_user_id on public.work_ratings(user_id);

alter table public.work_ratings enable row level security;

drop policy if exists work_ratings_select on public.work_ratings;
create policy work_ratings_select on public.work_ratings
  for select to anon, authenticated using (true);

drop policy if exists work_ratings_insert on public.work_ratings;
create policy work_ratings_insert on public.work_ratings
  for insert to anon, authenticated with check (true);

drop policy if exists work_ratings_update on public.work_ratings;
create policy work_ratings_update on public.work_ratings
  for update to anon, authenticated using (true) with check (true);

drop policy if exists work_ratings_delete on public.work_ratings;
create policy work_ratings_delete on public.work_ratings
  for delete to anon, authenticated using (true);

grant select, insert, update, delete on public.work_ratings to anon, authenticated;
