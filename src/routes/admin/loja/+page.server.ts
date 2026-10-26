import { error } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { CURATED_COSMETIC_ITEMS, LEGACY_UNREFURBISHED_IDS } from '$lib/cosmetics-catalog';

export const load = async ({ locals }) => {
  const isEditor = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
  if (!isEditor) error(403, 'Acesso restrito à equipe editorial');

  const db = locals.db || privileged();

  const [itemsRes, inventoryCountsRes] = await Promise.all([
    db.from('shop_items').select('*').order('order_index', { ascending: true }),
    db.from('member_inventory').select('item_id')
  ]);

  if (itemsRes.error) throw error(500, itemsRes.error.message);

  const ownershipMap: Record<string, number> = {};
  for (const row of (inventoryCountsRes.data || []) as any[]) {
    ownershipMap[row.item_id] = (ownershipMap[row.item_id] || 0) + 1;
  }

  const dbItems = itemsRes.data || [];
  const dbMap = new Map(dbItems.map((it: any) => [it.id, it]));
  const missingCurated: any[] = [];

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
      missingCurated.push({
        id: defaultItem.id,
        name: defaultItem.name,
        description: defaultItem.description,
        kind: defaultItem.kind,
        rarity: defaultItem.rarity,
        price_xp: defaultItem.price_xp,
        min_level: defaultItem.min_level,
        is_animated: defaultItem.is_animated,
        is_active: true,
        status: 'ACTIVE',
        order_index: defaultItem.order_index,
        asset_url: defaultItem.asset_url,
        style_data: defaultItem.style_data
      });
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

  // 3. Auto-seed missing items into database in the background if needed
  if (missingCurated.length > 0) {
    (async () => {
      try {
        const batchSize = 50;
        for (let i = 0; i < missingCurated.length; i += batchSize) {
          const chunk = missingCurated.slice(i, i + batchSize);
          await db.from('shop_items').upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
        }
        // Also ensure legacy unrefurbished placeholders are archived
        await db
          .from('shop_items')
          .update({ is_active: false, status: 'ARCHIVED' })
          .in('id', Array.from(LEGACY_UNREFURBISHED_IDS));
      } catch (err) {
        console.warn('Background shop_items seed notice:', err);
      }
    })();
  }

  // Sort by order_index
  combinedItems.sort((a, b) => (a.order_index ?? 999) - (b.order_index ?? 999));

  return {
    items: combinedItems
  };
};
