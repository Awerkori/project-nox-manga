import { error } from '@sveltejs/kit';
import { db, schema, safeQuery } from '$lib/server/db';
import { asc } from 'drizzle-orm';

export const load = async ({ locals }) => {
  const isEditor = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
  if (!isEditor) error(403, 'Acesso restrito  equipe editorial');

  const [itemsRes, inventoryCountsRes] = await Promise.all([
    safeQuery(db.select().from(schema.shopItems).orderBy(asc(schema.shopItems.kind), asc(schema.shopItems.orderIndex))),
    safeQuery(db.select({ itemId: schema.memberInventory.itemId }).from(schema.memberInventory))
  ]);

  if (itemsRes.error) throw error(500, (itemsRes.error as any).message);

  const ownershipMap: Record<string, number> = {};
  for (const row of (inventoryCountsRes.data || [])) {
    if (row.itemId) ownershipMap[row.itemId] = (ownershipMap[row.itemId] || 0) + 1;
  }

  const items = (itemsRes.data || []).map((it: any) => ({
    ...it,
    owners_count: ownershipMap[it.id] || 0
  }));

  return {
    items
  };
};
