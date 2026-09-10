-- ============================================================
-- Migration: Public Profile Stats, Cosmetics Count, & Featured Achievement
-- ============================================================

-- 1. Add privacy and featured achievement fields to members
alter table public.members
  add column if not exists privacy_show_achievements boolean not null default true,
  add column if not exists privacy_show_cosmetics boolean not null default true,
  add column if not exists featured_achievement_id text references public.achievements(id) on delete set null;

-- 2. Create optimized member_public_profile_stats RPC
create or replace function public.member_public_profile_stats(p_user uuid)
returns table(
  chapters_read bigint,
  total_works bigint,
  completed_works bigint,
  favorites bigint,
  achievements_unlocked bigint,
  achievements_total bigint,
  cosmetics_count bigint
)
language sql stable security definer set search_path='' as $$
  select
    -- chapters_read
    coalesce((select count(*) from public.reading r join public.chapters c on c.id=r.chapter_id join public.works w on w.id=c.work_id where r.user_id=p_user and r.completed_at is not null and c.published_at is not null and w.published), 0)::bigint,
    -- total_works
    coalesce((select count(distinct l.work_id) from public.library l join public.works w on w.id=l.work_id where l.user_id=p_user and w.published), 0)::bigint,
    -- completed_works
    coalesce((select count(*) from public.library l join public.works w on w.id=l.work_id where l.user_id=p_user and l.status='COMPLETED' and w.published), 0)::bigint,
    -- favorites
    coalesce((select count(*) from public.library l join public.works w on w.id=l.work_id where l.user_id=p_user and l.favorite and w.published), 0)::bigint,
    -- achievements_unlocked
    coalesce((select count(distinct ma.achievement_id) from public.member_achievements ma join public.achievements a on a.id=ma.achievement_id where ma.user_id=p_user), 0)::bigint,
    -- achievements_total
    coalesce((select count(*) from public.achievements), 0)::bigint,
    -- cosmetics_count (deduplicated across inventory, shop, and legacy equipped items)
    coalesce((
      select count(distinct item_key)
      from (
        select item_id as item_key from public.member_inventory where user_id = p_user
        union
        select avatar_frame_id as item_key from public.members where id = p_user and avatar_frame_id is not null and trim(avatar_frame_id) <> ''
        union
        select equipped_title_id as item_key from public.members where id = p_user and equipped_title_id is not null and trim(equipped_title_id) <> ''
        union
        select equipped_banner_id as item_key from public.members where id = p_user and equipped_banner_id is not null and trim(equipped_banner_id) <> ''
        union
        select name_color as item_key from public.members where id = p_user and name_color is not null and trim(name_color) <> ''
      ) u
      where item_key is not null and trim(item_key) <> ''
    ), 0)::bigint
  where exists(select 1 from public.members where id=p_user);
$$;

revoke all on function public.member_public_profile_stats(uuid) from public;
grant execute on function public.member_public_profile_stats(uuid) to anon, authenticated;

-- 3. Create set_featured_achievement RPC
create or replace function public.set_featured_achievement(p_achievement_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Entre para definir sua conquista em destaque' using errcode='42501';
  end if;

  if p_achievement_id is not null and p_achievement_id <> '' then
    if not exists(select 1 from public.member_achievements where user_id = uid and achievement_id = p_achievement_id) then
      raise exception 'Você ainda não desbloqueou esta conquista' using errcode='42501';
    end if;
    update public.members set featured_achievement_id = p_achievement_id where id = uid;
  else
    update public.members set featured_achievement_id = null where id = uid;
  end if;

  return jsonb_build_object('ok', true, 'featured_achievement_id', p_achievement_id);
end;
$$;

grant execute on function public.set_featured_achievement(text) to authenticated;
