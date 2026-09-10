-- ==============================================================================
-- Project Nox Manga — Migration 20260910030000
-- 1. Clean automatic blind bulk assignment of Project Nox
-- 2. Official Project Nox Scan Guarantee
-- 3. Equipped Profile Banner Slot Fix (separate from comment banner)
-- 4. Shop Items: Rarity (COMMON to MYTHIC), Status (ACTIVE, DRAFT, ARCHIVED), Thumbnail
-- 5. Achievements: Rarity (COMMON to MYTHIC), Reward Item Reference
-- 6. RPCs for Admin Scan Attribution and Shop Management
-- ==============================================================================

begin;

-- 1. Remove blind bulk assignment of Project Nox to all works and chapters
delete from public.work_scans where created_at = '2026-09-10T06:19:43.018035+00:00';
delete from public.chapter_scans where created_at = '2026-09-10T06:19:43.018035+00:00';

-- 2. Ensure Official Scan: Project Nox exists
insert into public.scans (name, slug, description, is_official, status, website, discord, fluxer)
values (
  'Project Nox',
  'project-nox',
  'Scan oficial e núcleo editorial do Project Nox.',
  true,
  'ACTIVE',
  'https://manga.project-nox-awerkori.workers.dev',
  'https://discord.gg/projectnox',
  'https://fluxer.app'
)
on conflict (slug) do update set
  name = 'Project Nox',
  is_official = true,
  status = 'ACTIVE',
  website = 'https://manga.project-nox-awerkori.workers.dev',
  discord = 'https://discord.gg/projectnox',
  fluxer = 'https://fluxer.app';

-- 3. Members equipped banner slot
alter table public.members add column if not exists equipped_banner_id text;
grant select (equipped_banner_id) on public.members to anon, authenticated;
grant update (equipped_banner_id) on public.members to authenticated;

-- Fix equip_cosmetic_item to correctly set equipped_banner_id for PROFILE_BANNER
create or replace function public.equip_cosmetic_item(p_kind text, p_item_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Entre para equipar itens' using errcode='42501';
  end if;

  if p_item_id is not null and p_item_id <> '' then
    if not exists(select 1 from public.member_inventory where user_id = uid and item_id = p_item_id) then
      raise exception 'Item não adquirido' using errcode='42501';
    end if;
  end if;

  if p_kind = 'AVATAR_FRAME' then
    update public.members set avatar_frame_id = nullif(p_item_id, '') where id = uid;
  elsif p_kind = 'NAME_COLOR' then
    update public.members set name_color = nullif(p_item_id, '') where id = uid;
  elsif p_kind = 'TITLE' then
    update public.members set equipped_title_id = nullif(p_item_id, '') where id = uid;
  elsif p_kind = 'BADGE' then
    update public.members set equipped_badge_id = nullif(p_item_id, '') where id = uid;
  elsif p_kind = 'PROFILE_BANNER' then
    update public.members set equipped_banner_id = nullif(p_item_id, '') where id = uid;
  elsif p_kind = 'COMMENT_BANNER' then
    update public.members set equipped_comment_banner_id = nullif(p_item_id, '') where id = uid;
  else
    raise exception 'Tipo de cosmético desconhecido: %', p_kind using errcode='22023';
  end if;

  return jsonb_build_object('ok', true, 'kind', p_kind, 'item_id', p_item_id);
end;
$$;

grant execute on function public.equip_cosmetic_item(text, text) to authenticated;

-- 4. Shop Items Rarity and Lifecycle
alter table public.shop_items add column if not exists rarity text not null default 'COMMON' check (rarity in ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'));
alter table public.shop_items add column if not exists status text not null default 'ACTIVE' check (status in ('ACTIVE', 'DRAFT', 'ARCHIVED'));
alter table public.shop_items add column if not exists thumbnail_url text;

grant select on public.shop_items to anon, authenticated;
grant insert, update, delete on public.shop_items to authenticated;

drop policy if exists shop_items_select on public.shop_items;
create policy shop_items_select on public.shop_items for select to anon, authenticated
  using (status = 'ACTIVE' or public.is_editor());

drop policy if exists shop_items_editor_all on public.shop_items;
create policy shop_items_editor_all on public.shop_items for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

-- 5. Achievements Rarity and Reward Item Reference
alter table public.achievements add column if not exists rarity text not null default 'COMMON' check (rarity in ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'));
alter table public.achievements add column if not exists reward_item_id text;

grant select on public.achievements to anon, authenticated;
grant insert, update, delete on public.achievements to authenticated;

-- 6. Audit Log metadata
alter table public.audit_log add column if not exists metadata jsonb not null default '{}'::jsonb;
grant select, insert on public.audit_log to authenticated;

-- 7. Admin Scans & Chapter Attribution RLS
drop policy if exists work_scans_editor_manage on public.work_scans;
create policy work_scans_editor_manage on public.work_scans for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

drop policy if exists chapter_scans_editor_manage on public.chapter_scans;
create policy chapter_scans_editor_manage on public.chapter_scans for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

grant all on public.work_scans to authenticated;
grant all on public.chapter_scans to authenticated;

commit;
