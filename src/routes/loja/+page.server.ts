import { withTimeout } from '$lib/server/resilience';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { safeQuery, safeQuerySingle } from '$lib/server/db/safe';

let cachedShopItems: { timestamp: number; data: any[] } | null = null;
const SHOP_CACHE_TTL_MS = 120_000;

export const load = async ({ locals, setHeaders }) => {
  let items: any[] = [];
  if (cachedShopItems && Date.now() - cachedShopItems.timestamp < SHOP_CACHE_TTL_MS) {
    items = cachedShopItems.data;
  } else {
    const res = await withTimeout(
      safeQuery(
        db.select()
          .from(schema.shopItems)
          .where(eq(schema.shopItems.isActive, 1))
          .orderBy(asc(schema.shopItems.orderIndex))
      ),
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
    const profile = locals.profile;
    const [invRes, profileRes] = await withTimeout(
      Promise.all([
        safeQuery(
          db.select({ item_id: schema.memberInventory.itemId })
            .from(schema.memberInventory)
            .where(eq(schema.memberInventory.userId, locals.user.id))
        ),
        profile
          ? Promise.resolve({ data: profile })
          : safeQuerySingle(
              db.select({
                id: schema.members.id,
                username: schema.members.username,
                display_name: schema.members.displayName,
                avatar_id: schema.members.avatarId,
                banner_id: schema.members.bannerId,
                equipped_banner_id: schema.members.equippedBannerId,
                xp: schema.members.xp,
                avatar_frame_id: schema.members.avatarFrameId,
                name_color: schema.members.nameColor,
                equipped_title_id: schema.members.equippedTitleId
              })
              .from(schema.members)
              .where(eq(schema.members.id, locals.user.id))
            )
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
