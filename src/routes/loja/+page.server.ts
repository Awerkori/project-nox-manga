import { CURATED_COSMETIC_ITEMS, LEGACY_UNREFURBISHED_IDS } from '$lib/cosmetics-catalog';
import { executeYugabyteSql } from '$lib/server/yugabyte';

let cachedShopItems: { timestamp: number; data: any[] } | null = null;
const SHOP_CACHE_TTL_MS = 300_000;

export const load = async ({ locals, setHeaders, platform }: any) => {
  let items: any[];
  if (cachedShopItems && Date.now() - cachedShopItems.timestamp < SHOP_CACHE_TTL_MS) {
    items = cachedShopItems.data;
  } else {
    let dbItems: any[];
    try {
      const ybRes = await executeYugabyteSql(
        `SELECT * FROM shop_items ORDER BY order_index ASC;`,
        [],
        platform?.env
      );
      dbItems = ybRes.rows || [];
    } catch (err) {
      console.warn('[SHOP_ITEMS_SQL_ERROR]', err);
      dbItems = [];
    }
    const dbMap = new Map(dbItems.map((it: any) => [it.id, it]));
    const curatedMap = new Map(CURATED_COSMETIC_ITEMS.map((it) => [it.id, it]));

    const activeItems: any[] = [];

    // 1. Process all curated items with database overlays
    for (const curated of CURATED_COSMETIC_ITEMS) {
      if (LEGACY_UNREFURBISHED_IDS.has(curated.id)) continue;

      const dbItem = dbMap.get(curated.id);
      if (dbItem) {
        // If explicitly deactivated or archived by admin, exclude from store
        if (dbItem.is_active === false || dbItem.status === 'ARCHIVED') {
          continue;
        }
        // Merge database-managed metadata over catalog visual templates
        activeItems.push({
          ...curated,
          name: dbItem.name || curated.name,
          description: dbItem.description !== undefined ? dbItem.description : curated.description,
          price_xp: dbItem.price_xp ?? curated.price_xp,
          min_level: dbItem.min_level ?? curated.min_level,
          rarity: dbItem.rarity || curated.rarity,
          is_animated: dbItem.is_animated ?? curated.is_animated,
          order_index: dbItem.order_index ?? curated.order_index,
          asset_url: dbItem.asset_url || curated.asset_url,
          color_variants: dbItem.style_data?.color_variants || curated.color_variants,
          style_data: { ...curated.style_data, ...(dbItem.style_data || {}) }
        });
      } else {
        // Fallback default from catalog template
        activeItems.push(curated);
      }
    }

    // 2. Include genuine custom items added directly via admin panel (excluding unrefurbished legacy placeholders)
    for (const dbItem of dbItems) {
      if (!curatedMap.has(dbItem.id) && !LEGACY_UNREFURBISHED_IDS.has(dbItem.id)) {
        if (dbItem.is_active !== false && dbItem.status !== 'ARCHIVED') {
          activeItems.push({
            id: dbItem.id,
            name: dbItem.name,
            description: dbItem.description || '',
            kind: dbItem.kind,
            rarity: dbItem.rarity || 'COMUM',
            price_xp: dbItem.price_xp ?? 500,
            min_level: dbItem.min_level ?? 1,
            is_animated: Boolean(dbItem.is_animated),
            order_index: dbItem.order_index ?? 999,
            asset_url: dbItem.asset_url || '',
            style_data: dbItem.style_data || {},
            color_variants: dbItem.style_data?.color_variants || []
          });
        }
      }
    }

    activeItems.sort((a, b) => (a.order_index ?? 999) - (b.order_index ?? 999));
    items = activeItems;

    cachedShopItems = { timestamp: Date.now(), data: items };
  }

  let userInventory: string[] = [];
  let userProfile: any = null;

  if (locals.user) {
    setHeaders({
      'cache-control': 'private, no-cache, no-store, must-revalidate'
    });

    const profile = locals.sessionCache?.profile;
    let p = profile;

    try {
      const [invRes, memRes] = await Promise.all([
        executeYugabyteSql(`SELECT item_id FROM member_inventory WHERE user_id = $1;`, [locals.user.id], platform?.env),
        executeYugabyteSql(
          `SELECT id, username, display_name, avatar_id, avatar_crop, banner_id, equipped_banner_id, xp, avatar_frame_id, name_color, equipped_title_id
           FROM members WHERE id = $1 LIMIT 1;`,
          [locals.user.id],
          platform?.env
        )
      ]);
      userInventory = (invRes.rows || []).map((r: any) => r.item_id);
      if (memRes.rows[0]) {
        p = memRes.rows[0];
      }
    } catch (err) {
      console.warn('[SHOP_USER_DATA_SQL_ERROR]', err);
    }
    if (p) {
      if (locals.sessionCache?.profile && typeof p.xp === 'number') {
        locals.sessionCache.profile.xp = p.xp;
      }
      userProfile = {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_id: p.avatar_id,
        avatar_crop: p.avatar_crop,
        banner_id: p.banner_id,
        equipped_banner_id: p.equipped_banner_id,
        xp: p.xp,
        frame_id: p.avatar_frame_id,
        name_color: p.name_color,
        title_id: p.equipped_title_id
      };
    }
  } else {
    setHeaders({
      'cache-control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300'
    });
  }

  return {
    items: items || [],
    inventory: userInventory,
    profile: userProfile
  };
};
