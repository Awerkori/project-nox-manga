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
          .where(eq(schema.shopItems.isActive, true))
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

  if (locals.user) {const profile = locals.profile;
    const [invRes, profileRes] = await withTimeout(
      Promise.all([
        safeQuery(
          db.select({ itemId: schema.memberInventory.itemId})
            .from(schema.memberInventory)
            .where(eq(schema.memberInventory.userId, locals.user!.id))
        ),
        profile
          ? Promise.resolve({ data: profile })
          : safeQuerySingle(
              db.select({id: schema.members.id,
                username: schema.members.username,
                displayName: schema.members.displayName,
                avatarId: schema.members.avatarId,
                bannerId: schema.members.bannerId,
                equippedBannerId: schema.members.equippedBannerId,
                xp: schema.members.xp,
                avatarFrameId: schema.members.avatarFrameId,
                nameColor: schema.members.nameColor,
                equippedTitleId: schema.members.equippedTitleId})
              .from(schema.members)
              .where(eq(schema.members.id, locals.user!.id))
            )
      ]),
      1200,
      [{ data: [] }, { data: profile || null }] as any,
      'shop_user_data'
    );

    userInventory = (invRes?.data || []).map((r: any) => r.itemId);
    const p = profileRes?.data || profile;
    if (p) {userProfile = {
        id: p.id,
        username: p.username,
        displayName: p.displayName,
        avatarId: p.avatarId,
        bannerId: p.bannerId,
        equippedBannerId: p.equippedBannerId,
        xp: p.xp,
        frame_id: p.avatarFrameId,
        nameColor: p.nameColor,
        title_id: p.equippedTitleId};
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
