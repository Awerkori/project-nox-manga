import { withTimeout } from '$lib/server/resilience';
import { CURATED_COSMETIC_ITEMS, LEGACY_UNREFURBISHED_IDS } from '$lib/cosmetics-catalog';

let cachedShopItems: { timestamp: number; data: any[] } | null = null;
const SHOP_CACHE_TTL_MS = 120_000;

export const load = async ({ locals, setHeaders }) => {
  let items: any[];
  if (cachedShopItems && Date.now() - cachedShopItems.timestamp < SHOP_CACHE_TTL_MS) {
    items = cachedShopItems.data;
  } else {
    const res = await withTimeout(
      locals.db
        .from('shop_items')
        .select('*')
        .order('order_index', { ascending: true }),
      3000,
      { data: [] } as any,
      'shop_items'
    );

    const dbItems = res?.data || [];
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
    const [invRes, profileRes] = await withTimeout(
      Promise.all([
        locals.db
          .from('member_inventory')
          .select('item_id')
          .eq('user_id', locals.user.id),
        locals.db
          .from('members')
          .select('id, username, display_name, avatar_id, avatar_crop, banner_id, equipped_banner_id, xp, avatar_frame_id, name_color, equipped_title_id')
          .eq('id', locals.user.id)
          .maybeSingle()
      ]),
      1200,
      [{ data: [] }, { data: profile || null }] as any,
      'shop_user_data'
    );

    userInventory = (invRes?.data || []).map((r: any) => r.item_id);
    const p = profileRes?.data || profile;
    if (p) {
      if (profileRes?.data && locals.sessionCache?.profile) {
        locals.sessionCache.profile.xp = profileRes.data.xp;
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
