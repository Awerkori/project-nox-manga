-- Migration 20261027020000: Equip Cosmetic Item Variant Support
-- Allows equipping cosmetic variants (e.g. 'frame_cosmic_nox:gold') while validating against the base item in member_inventory.

CREATE OR REPLACE FUNCTION public.equip_cosmetic_item(p_kind text, p_item_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  base_item_id text;
begin
  if uid is null then
    raise exception 'Entre para equipar itens' using errcode='42501';
  end if;

  if p_item_id is not null and p_item_id <> '' then
    base_item_id := split_part(p_item_id, ':', 1);

    -- Verify user owns the item in canonical inventory (check both full id and base id)
    if not exists(select 1 from public.member_inventory where user_id = uid and (item_id = p_item_id or item_id = base_item_id)) then
      -- Auto-grant if it is a free starter/level title or legacy cosmetic in catalog
      if exists(select 1 from public.shop_items where (id = p_item_id or id = base_item_id) and (price_xp = 0 or kind = 'TITLE')) then
        insert into public.member_inventory(user_id, item_id, origin)
        values (uid, base_item_id, 'LEGACY')
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
$function$;
