-- ============================================================
-- Migration: 20260910080000_canonical_cosmetics_inventory_and_origins.sql
-- Description: Enforce canonical cosmetics ownership in member_inventory with origin tracking (SHOP, ACHIEVEMENT, EVENT, ADMIN_SPECIAL, LEGACY), catalog synchronization, and pure presentation equip/unequip.
-- ============================================================

-- 1. Add origin column to public.member_inventory
alter table public.member_inventory
  add column if not exists origin text not null default 'SHOP'
  check (origin in ('SHOP', 'ACHIEVEMENT', 'EVENT', 'ADMIN_SPECIAL', 'LEGACY'));

-- 2. Populate shop_items with all known Nox Titles and legacy identifiers
insert into public.shop_items (id, name, description, kind, price_xp, is_animated, asset_url, style_data, min_level, is_active, rarity, status)
values
  ('iniciado-nox', 'Iniciado da Nox', 'Título inicial de todo leitor que atravessa os portais da Nox.', 'TITLE', 0, false, '', '{}'::jsonb, 1, false, 'COMUM', 'ACTIVE'),
  ('nox-reader', 'Nox Reader', 'Primeiros passos pelo véu de sombras da biblioteca.', 'TITLE', 0, false, '', '{}'::jsonb, 1, false, 'COMUM', 'ACTIVE'),
  ('aficionado', 'Aficionado', 'Atenção constante voltada aos novos lançamentos da Nox.', 'TITLE', 0, false, '', '{}'::jsonb, 5, false, 'INCOMUM', 'ACTIVE'),
  ('colecionador', 'Colecionador', 'Dezenas de tomos guardados na estante pessoal.', 'TITLE', 0, false, '', '{}'::jsonb, 10, false, 'INCOMUM', 'ACTIVE'),
  ('curador', 'Curador', 'Olhar apurado para narrativas refinadas e cativantes.', 'TITLE', 0, false, '', '{}'::jsonb, 15, false, 'RARA', 'ACTIVE'),
  ('bibliofilo', 'Bibliófilo', 'Amor devoto aos arcos e universos mais memoráveis.', 'TITLE', 0, false, '', '{}'::jsonb, 20, false, 'RARA', 'ACTIVE'),
  ('vanguarda', 'Vanguarda', 'Sempre na linha de frente dos grandes arcos da biblioteca.', 'TITLE', 0, false, '', '{}'::jsonb, 30, false, 'EPICA', 'ACTIVE'),
  ('virtuoso', 'Virtuoso', 'Mestre na arte de apreciar cada detalhe narrativo.', 'TITLE', 0, false, '', '{}'::jsonb, 40, false, 'EPICA', 'ACTIVE'),
  ('eminencia', 'Eminência', 'Figura de prestígio e respeito nos corredores da Nox.', 'TITLE', 0, false, '', '{}'::jsonb, 50, false, 'LENDARIA', 'ACTIVE'),
  ('monolito', 'Monólito', 'Presença sólida e inabalável na comunidade.', 'TITLE', 0, false, '', '{}'::jsonb, 60, false, 'LENDARIA', 'ACTIVE'),
  ('luminar', 'Luminar', 'Luz radiante que guia novos leitores pela escuridão.', 'TITLE', 0, false, '', '{}'::jsonb, 70, false, 'MITICA', 'ACTIVE'),
  ('primor', 'Primor', 'O ápice do bom gosto e dedicação contínua.', 'TITLE', 0, false, '', '{}'::jsonb, 80, false, 'MITICA', 'ACTIVE')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  status = 'ACTIVE';

-- 3. Backfill all existing member equipped cosmetics into member_inventory with origin 'LEGACY'
insert into public.member_inventory (user_id, item_id, origin)
select m.id, m.equipped_title_id, 'LEGACY'
from public.members m
join public.shop_items s on s.id = m.equipped_title_id
where m.equipped_title_id is not null and trim(m.equipped_title_id) <> ''
on conflict (user_id, item_id) do nothing;

insert into public.member_inventory (user_id, item_id, origin)
select m.id, m.avatar_frame_id, 'LEGACY'
from public.members m
join public.shop_items s on s.id = m.avatar_frame_id
where m.avatar_frame_id is not null and trim(m.avatar_frame_id) <> ''
on conflict (user_id, item_id) do nothing;

insert into public.member_inventory (user_id, item_id, origin)
select m.id, m.equipped_banner_id, 'LEGACY'
from public.members m
join public.shop_items s on s.id = m.equipped_banner_id
where m.equipped_banner_id is not null and trim(m.equipped_banner_id) <> ''
on conflict (user_id, item_id) do nothing;

insert into public.member_inventory (user_id, item_id, origin)
select m.id, m.name_color, 'LEGACY'
from public.members m
join public.shop_items s on s.id = m.name_color
where m.name_color is not null and trim(m.name_color) <> ''
on conflict (user_id, item_id) do nothing;

-- 4. Update buy_shop_item RPC to record canonical origin 'SHOP'
create or replace function public.buy_shop_item(p_item_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  v_item record;
  v_current_xp integer;
  v_user_level integer;
  v_new_xp integer;
begin
  if uid is null then
    raise exception 'Entre em sua conta para adquirir itens' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 100));

  select * into v_item from public.shop_items where id = p_item_id and is_active = true and status = 'ACTIVE';
  if v_item.id is null then
    raise exception 'Item não encontrado ou indisponível' using errcode='P0002';
  end if;

  if exists(select 1 from public.member_inventory where user_id = uid and item_id = p_item_id) then
    raise exception 'Você já possui este item em seu inventário' using errcode='23505';
  end if;

  select xp into v_current_xp from public.members where id = uid;
  if v_current_xp is null then
    raise exception 'Perfil não encontrado' using errcode='P0002';
  end if;

  v_user_level := floor(sqrt(1 + v_current_xp / 50));
  if v_user_level < v_item.min_level then
    raise exception 'Nível insuficiente. Este item exige Nível %', v_item.min_level using errcode='22023';
  end if;

  if v_current_xp < v_item.price_xp then
    raise exception 'XP insuficiente. Você possui % XP mas o item custa % XP', v_current_xp, v_item.price_xp using errcode='22023';
  end if;

  v_new_xp := v_current_xp - v_item.price_xp;

  insert into public.member_inventory(user_id, item_id, origin)
  values (uid, p_item_id, 'SHOP')
  on conflict (user_id, item_id) do nothing;

  update public.members
  set xp = v_new_xp
  where id = uid;

  insert into public.notifications(user_id, kind, body, href, dedupe_key)
  values (
    uid,
    'shop',
    'Você adquiriu ' || v_item.name || ' por ' || v_item.price_xp || ' XP!',
    '/me?tab=inventario',
    'shop:' || p_item_id || ':' || extract(epoch from now())::bigint
  );

  return jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'item_name', v_item.name,
    'spent_xp', v_item.price_xp,
    'remaining_xp', v_new_xp
  );
end;
$$;

-- 5. Update equip_cosmetic_item RPC to preserve ownership and ensure clean equip/unequip
create or replace function public.equip_cosmetic_item(p_kind text, p_item_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Entre para equipar itens' using errcode='42501';
  end if;

  if p_item_id is not null and p_item_id <> '' then
    -- Verify user owns the item in canonical inventory
    if not exists(select 1 from public.member_inventory where user_id = uid and item_id = p_item_id) then
      -- Auto-grant if it is a free starter/level title or legacy cosmetic in catalog
      if exists(select 1 from public.shop_items where id = p_item_id and (price_xp = 0 or kind = 'TITLE')) then
        insert into public.member_inventory(user_id, item_id, origin)
        values (uid, p_item_id, 'LEGACY')
        on conflict (user_id, item_id) do nothing;
      else
        raise exception 'Item não adquirido' using errcode='42501';
      end if;
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

-- 6. Update member_public_profile_stats RPC to count canonical distinct inventory items
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
    -- cosmetics_count (canonical total distinct cosmetics owned in member_inventory)
    coalesce((
      select count(distinct item_id)
      from public.member_inventory
      where user_id = p_user
    ), 0)::bigint
  where exists(select 1 from public.members where id=p_user);
$$;

revoke all on function public.member_public_profile_stats(uuid) from public;
grant execute on function public.member_public_profile_stats(uuid) to anon, authenticated;

-- 7. Grant cosmetics helper for admin/special/event/achievement distribution
create or replace function public.grant_member_cosmetic(
  p_user uuid,
  p_item_id text,
  p_origin text default 'ADMIN_SPECIAL'
)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not public.is_editor() then
    raise exception 'Acesso negado' using errcode='42501';
  end if;

  if not exists(select 1 from public.shop_items where id = p_item_id) then
    raise exception 'Item não encontrado no catálogo' using errcode='P0002';
  end if;

  insert into public.member_inventory(user_id, item_id, origin)
  values (p_user, p_item_id, p_origin)
  on conflict (user_id, item_id) do update set origin = excluded.origin;

  return true;
end;
$$;

grant execute on function public.grant_member_cosmetic(uuid, text, text) to authenticated;
grant execute on function public.buy_shop_item(text) to authenticated;
grant execute on function public.equip_cosmetic_item(text, text) to authenticated;
