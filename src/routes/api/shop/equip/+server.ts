import { json, error } from '@sveltejs/kit';
import { member } from '$lib/server/db';
import { invalidateUserSession } from '$lib/server/session-cache';

export const POST = async ({ request, locals }) => {
  member(locals);
  const body = await request.json().catch(() => ({}));
  let kind = String(body.kind || '').trim();
  const itemId = String(body.itemId || '').trim();

  if (!kind && itemId) {
    const baseItemId = itemId.includes(':') ? itemId.split(':')[0] : itemId;
    const { data: item } = await locals.db
      .from('shop_items')
      .select('kind')
      .eq('id', baseItemId)
      .maybeSingle();
    if (item?.kind) kind = item.kind;
  }

  if (!kind) {
    error(400, 'Tipo de cosmético não fornecido.');
  }

  const { data, error: rpcError } = await locals.db.rpc('equip_cosmetic_item', {
    p_kind: kind,
    p_item_id: itemId
  });

  if (rpcError) {
    error(400, rpcError.message);
  }

  // Keep equipped_banner_id and equipped_comment_banner_id synchronized
  if (kind === 'PROFILE_BANNER' || kind === 'COMMENT_BANNER') {
    const companionKind = kind === 'PROFILE_BANNER' ? 'COMMENT_BANNER' : 'PROFILE_BANNER';
    try {
      await locals.db.rpc('equip_cosmetic_item', {
        p_kind: companionKind,
        p_item_id: itemId
      });
    } catch (_) {
      // Ignore if column update already covered
    }
  }

  if (locals.user?.id) {
    invalidateUserSession(locals.user.id);
  }

  return json(data);
};
