import { error } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';

export const load = async ({ locals }) => {
  const isEditor = ['ADMIN', 'EDITOR'].includes(locals.role || '');
  if (!isEditor) error(403, 'Acesso restrito à equipe editorial');

  const db = locals.db || privileged();

  const [itemsRes, inventoryCountsRes] = await Promise.all([
    db.from('shop_items').select('*').order('kind').order('order_index', { ascending: true }),
    db.from('member_inventory').select('item_id')
  ]);

  if (itemsRes.error) throw error(500, itemsRes.error.message);

  const ownershipMap: Record<string, number> = {};
  for (const row of (inventoryCountsRes.data || []) as any[]) {
    ownershipMap[row.item_id] = (ownershipMap[row.item_id] || 0) + 1;
  }

  const items = (itemsRes.data || []).map((it: any) => ({
    ...it,
    owners_count: ownershipMap[it.id] || 0
  }));

  return {
    items
  };
};
