import { error } from '@sveltejs/kit';
import { CURATED_COSMETIC_ITEMS, LEGACY_UNREFURBISHED_IDS } from '$lib/cosmetics-catalog';
import {
  adminAuxPanelCache,
  adminAuxPanelFlights,
  withSingleFlightCache
} from '$lib/server/admin-cache';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const load = async ({ locals, platform }: any) => {
  const isEditor = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
  if (!isEditor) error(403, 'Acesso restrito à equipe editorial');

  return withSingleFlightCache(
    adminAuxPanelCache,
    adminAuxPanelFlights,
    'admin:loja',
    30_000,
    async () => {
      const [itemsRes, inventoryCountsRes] = await Promise.all([
        executeYugabyteSql(
          `SELECT * FROM public.shop_items ORDER BY order_index ASC;`,
          [],
          platform?.env
        ).catch(() => ({ rows: [] })),
        executeYugabyteSql(
          `SELECT item_id, count(*)::int AS cnt FROM public.member_inventory GROUP BY item_id;`,
          [],
          platform?.env
        ).catch(() => ({ rows: [] }))
      ]);

      const ownershipMap: Record<string, number> = {};
      for (const row of (inventoryCountsRes.rows || [])) {
        ownershipMap[row.item_id] = Number(row.cnt) || 0;
      }

      const dbItems = itemsRes.rows || [];
      const dbMap = new Map(dbItems.map((it: any) => [it.id, it]));

      const combinedItems: any[] = [];

      // 1. Process all curated items
      for (const curated of CURATED_COSMETIC_ITEMS) {
        if (LEGACY_UNREFURBISHED_IDS.has(curated.id)) continue;

        const dbItem = dbMap.get(curated.id);
        if (dbItem) {
          combinedItems.push({
            ...dbItem,
            kind: dbItem.kind === 'PROFILE_BANNER' ? 'COMMENT_BANNER' : dbItem.kind,
            color_variants: dbItem.style_data?.color_variants || curated.color_variants || [],
            owners_count: ownershipMap[dbItem.id] || 0
          });
        } else {
          const defaultItem = {
            id: curated.id,
            name: curated.name,
            description: curated.description,
            kind: curated.kind === 'PROFILE_BANNER' ? 'COMMENT_BANNER' : curated.kind,
            rarity: curated.rarity,
            price_xp: curated.price_xp,
            min_level: curated.min_level,
            is_animated: curated.is_animated,
            is_active: true,
            status: 'ACTIVE',
            order_index: curated.order_index,
            asset_url: curated.asset_url || '',
            style_data: {
              ...curated.style_data,
              ...(curated.color_variants ? { color_variants: curated.color_variants } : {})
            },
            color_variants: curated.color_variants || [],
            owners_count: ownershipMap[curated.id] || 0
          };
          combinedItems.push(defaultItem);
        }
      }

      // 2. Add genuine custom items created directly in DB
      const curatedIds = new Set(CURATED_COSMETIC_ITEMS.map((c) => c.id));
      for (const dbItem of dbItems) {
        if (!curatedIds.has(dbItem.id) && !LEGACY_UNREFURBISHED_IDS.has(dbItem.id)) {
          combinedItems.push({
            ...dbItem,
            color_variants: dbItem.style_data?.color_variants || [],
            owners_count: ownershipMap[dbItem.id] || 0
          });
        }
      }

      // Sort by order_index
      combinedItems.sort((a, b) => (a.order_index ?? 999) - (b.order_index ?? 999));

      return {
        items: combinedItems
      };
    }
  );
};
