import re

with open('src/routes/u/[username]/+page.server.ts', 'r') as f:
    content = f.read()

def replace_all(content, old, new):
    if old not in content:
        print("NOT FOUND:", old[:50])
    return content.replace(old, new)

legacy_old = """    const { data: legacyShopItems } = await locals.db
      .from('shop_items')
      .select('id, name, description, kind, rarity, is_animated, style_data')
      .in('id', equippedLegacyIds);"""
legacy_new = """    const { data: legacyShopItems } = await safeQuery(
      db.select({
        id: schema.shopItems.id,
        name: schema.shopItems.name,
        description: schema.shopItems.description,
        kind: schema.shopItems.kind,
        rarity: schema.shopItems.rarity,
        isAnimated: schema.shopItems.isAnimated,
        styleData: schema.shopItems.styleData
      })
      .from(schema.shopItems)
      .where(inArray(schema.shopItems.id, equippedLegacyIds))
    );"""
content = replace_all(content, legacy_old, legacy_new)

with open('src/routes/u/[username]/+page.server.ts', 'w') as f:
    f.write(content)
