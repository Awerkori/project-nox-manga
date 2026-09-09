begin;

-- A table-level SELECT grant also covers columns added by later migrations.
-- Replace it with an explicit public projection so private preferences cannot
-- become readable through PostgREST as the members table evolves.
revoke select on public.members from anon, authenticated;
revoke select (
  equipped_title_id,
  equipped_badge_id,
  manual_title,
  manual_badge
) on public.members from anon, authenticated;

grant select (
  id,
  username,
  display_name,
  bio,
  avatar_id,
  xp,
  created_at,
  equipped_title_id,
  equipped_badge_id
) on public.members to anon, authenticated;

-- These columns are changed through member_action(), where unlock rules are
-- enforced. Keep them unavailable to direct Data API updates.
revoke update (
  equipped_title_id,
  equipped_badge_id,
  manual_title,
  manual_badge
) on public.members from authenticated;

-- RLS filters rows, not columns. Return the private portion of the current
-- member profile through a fixed, self-only projection instead of granting
-- private columns on the public profiles table.
create or replace function public.member_self_profile()
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  avatar_id uuid,
  xp integer,
  created_at timestamptz,
  age_status text,
  blur_nsfw boolean,
  equipped_title_id text,
  equipped_badge_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    m.username,
    m.display_name,
    m.bio,
    m.avatar_id,
    m.xp,
    m.created_at,
    m.age_status,
    m.blur_nsfw,
    m.equipped_title_id,
    m.equipped_badge_id
  from public.members m
  where m.id = auth.uid()
$$;

revoke all on function public.member_self_profile() from public, anon;
grant execute on function public.member_self_profile() to authenticated;

-- The public ranking needs the private is_test flag as a filter, but callers
-- must never receive or filter on that column directly.
create or replace function public.member_public_ranking()
returns table (
  id uuid,
  username text,
  display_name text,
  xp integer,
  avatar_id uuid,
  created_at timestamptz,
  equipped_title_id text,
  equipped_badge_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    m.username,
    m.display_name,
    m.xp,
    m.avatar_id,
    m.created_at,
    m.equipped_title_id,
    m.equipped_badge_id
  from public.members m
  where not m.is_test and m.xp > 0
  order by m.xp desc, m.id
  limit 50
$$;

revoke all on function public.member_public_ranking() from public;
grant execute on function public.member_public_ranking() to anon, authenticated;

commit;
