import re

with open('src/routes/u/[username]/+page.server.ts', 'r') as f:
    content = f.read()

def replace_all(content, old, new):
    if old not in content:
        print("NOT FOUND:", old[:50])
    return content.replace(old, new)

# 5. inventoryRes
inv_old = """    canViewCosmetics
      ? locals.db
          .from('member_inventory')
          .select(`
            item_id,
            origin,
            acquired_at,
            shop_items(
              id,
              name,
              description,
              kind,
              rarity,
              is_animated,
              style_data
            )
          `)
          .eq('user_id', member.id)
          .order('acquired_at', { ascending: false })
      : Promise.resolve({ data: [] }),"""
inv_new = """    canViewCosmetics
      ? safeQuery(
          db.select({
            itemId: schema.memberInventory.itemId,
            origin: schema.memberInventory.origin,
            acquiredAt: schema.memberInventory.acquiredAt,
            shop_items: {
              id: schema.shopItems.id,
              name: schema.shopItems.name,
              description: schema.shopItems.description,
              kind: schema.shopItems.kind,
              rarity: schema.shopItems.rarity,
              isAnimated: schema.shopItems.isAnimated,
              styleData: schema.shopItems.styleData
            }
          })
          .from(schema.memberInventory)
          .leftJoin(schema.shopItems, eq(schema.memberInventory.itemId, schema.shopItems.id))
          .where(eq(schema.memberInventory.userId, member.id))
          .orderBy(desc(schema.memberInventory.acquiredAt))
        )
      : Promise.resolve({ data: [] }),"""
content = replace_all(content, inv_old, inv_new)

# 6. isFollowingRes
follow_old = """    locals.user && locals.user!.id !== member.id
      ? locals.db
          .from('user_follows')
          .select('follower_id')
          .eq('follower_id', locals.user!.id)
          .eq('following_id', member.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),"""
follow_new = """    locals.user && locals.user!.id !== member.id
      ? safeQuerySingle(
          db.select({ followerId: schema.userFollows.followerId })
          .from(schema.userFollows)
          .where(and(eq(schema.userFollows.followerId, locals.user!.id), eq(schema.userFollows.followingId, member.id)))
        )
      : Promise.resolve({ data: null }),"""
content = replace_all(content, follow_old, follow_new)

# 7. bannerRes
ban_old = """    member.equippedBannerId
      ? locals.db
          .from('shop_items')
          .select('id, style_data')
          .eq('id', member.equippedBannerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),"""
ban_new = """    member.equippedBannerId
      ? safeQuerySingle(
          db.select({ id: schema.shopItems.id, styleData: schema.shopItems.styleData })
          .from(schema.shopItems)
          .where(eq(schema.shopItems.id, member.equippedBannerId))
        )
      : Promise.resolve({ data: null }),"""
content = replace_all(content, ban_old, ban_new)

with open('src/routes/u/[username]/+page.server.ts', 'w') as f:
    f.write(content)
