import { withTimeout } from '$lib/server/resilience';

let cachedShopItems: { timestamp: number; data: any[] } | null = null;
const SHOP_CACHE_TTL_MS = 120_000;

export const load = async ({ locals, setHeaders }) => {
  let items: any[] = [];
  if (cachedShopItems && Date.now() - cachedShopItems.timestamp < SHOP_CACHE_TTL_MS) {
    items = cachedShopItems.data;
  } else {
    const res = await withTimeout(
      locals.db
        .from('shop_items')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true }),
      2500,
      { data: cachedShopItems?.data || [] } as any,
      'shop_items'
    );
    if (res?.data && res.data.length > 0) {
      items = res.data;
      cachedShopItems = { timestamp: Date.now(), data: items };
    } else if (cachedShopItems?.data && cachedShopItems.data.length > 0) {
      items = cachedShopItems.data;
    } else {
      items = [];
    }
  }


  let userInventory: string[] = [];
  let userProfile: any = null;

  if (locals.user) {
    const profile = locals.sessionCache?.profile;
    const [invRes, profileRes] = await withTimeout(
      Promise.all([
        locals.db
          .from('member_inventory')
          .select('item_id')
          .eq('user_id', locals.user.id),
        profile
          ? Promise.resolve({ data: profile })
          : locals.db
              .from('members')
              .select('id, username, display_name, avatar_id, banner_id, equipped_banner_id, xp, avatar_frame_id, name_color, equipped_title_id')
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
      userProfile = {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_id: p.avatar_id,
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
      'cache-control': 'public, max-age=60, stale-while-revalidate=300'
    });
  }

  return {
    items: items || [],
    inventory: userInventory,
    profile: userProfile
  };
};
