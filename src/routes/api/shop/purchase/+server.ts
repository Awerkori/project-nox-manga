import { json, error } from '@sveltejs/kit';
import { member } from '$lib/server/db';

export const POST = async ({ request, locals }) => {
  member(locals);
  const body = await request.json().catch(() => ({}));
  const itemId = String(body.itemId || '').trim();

  if (!itemId) {
    error(400, 'Identificador do item não fornecido.');
  }

  const { data, error: rpcError } = await locals.db.rpc('purchase_shop_item', {
    p_item_id: itemId
  });

  if (rpcError) {
    error(400, rpcError.message);
  }

  return json(data);
};
