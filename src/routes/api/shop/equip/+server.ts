import { json, error } from '@sveltejs/kit';
import { member } from '$lib/server/db';

export const POST = async ({ request, locals }) => {
  member(locals);
  const body = await request.json().catch(() => ({}));
  let kind = String(body.kind || '').trim();
  const itemId = String(body.itemId || '').trim();

  if (!kind && itemId) {
    const { data: item } = await locals.db
      .from('shop_items')
      .select('kind')
      .eq('id', itemId)
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

  return json(data);
};
