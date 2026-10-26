const fs = require('fs');

const catContent = fs.readFileSync('src/lib/cosmetics-catalog.ts', 'utf-8');

const itemRegex = /\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*description:\s*'([^']*)',\s*kind:\s*'([^']+)',\s*rarity:\s*'([^']+)',\s*price_xp:\s*(\d+),\s*min_level:\s*(\d+),\s*is_animated:\s*(true|false),\s*order_index:\s*(\d+),\s*asset_url:\s*'([^']*)',\s*style_data:\s*(\{[\s\S]*?\}),?(?:\s*color_variants:\s*(\[[\s\S]*?\]))?\s*\}/g;

const items = [];
let m;
while ((m = itemRegex.exec(catContent)) !== null) {
  const [_, id, name, description, kind, rarity, price_xp, min_level, is_animated, order_index, asset_url, style_data, color_variants] = m;
  
  let parsedStyle = {};
  if (style_data.includes('CURATED_BANNER_BACKGROUNDS')) {
    parsedStyle = { theme: 'cosmic_banner', banner_id: id };
  } else {
    try {
      parsedStyle = new Function('return ' + style_data)();
    } catch (e) {
      console.error('Failed to parse style for', id, e.message);
    }
  }

  if (color_variants) {
    try {
      parsedStyle.color_variants = new Function('return ' + color_variants)();
    } catch (e) {
      console.error('Failed to parse color_variants for', id, e.message);
    }
  }

  const dbKind = kind === 'PROFILE_BANNER' ? 'COMMENT_BANNER' : kind;

  items.push({
    id,
    name,
    description,
    kind: dbKind,
    rarity,
    price_xp: parseInt(price_xp, 10),
    min_level: parseInt(min_level, 10),
    is_animated: is_animated === 'true',
    order_index: parseInt(order_index, 10),
    asset_url: asset_url || '',
    style_data: parsedStyle
  });
}

console.log('Successfully parsed items:', items.length);

const sqlLines = [];
sqlLines.push('-- =========================================================================');
sqlLines.push('-- PROJECT NOX: Complete 200 Curated Cosmetics Database Sync');
sqlLines.push('-- 50 Frames, 50 Name Colors (15 Static + 35 Animated), 50 Titles, 50 Banners');
sqlLines.push('-- =========================================================================');
sqlLines.push('');
sqlLines.push('-- 1. Ensure shop_items kind check accepts all valid cosmetic slots');
sqlLines.push('ALTER TABLE public.shop_items DROP CONSTRAINT IF EXISTS shop_items_kind_check;');
sqlLines.push('ALTER TABLE public.shop_items ADD CONSTRAINT shop_items_kind_check');
sqlLines.push("  CHECK (kind IN ('AVATAR_FRAME', 'COMMENT_BANNER', 'PROFILE_BANNER', 'NAME_COLOR', 'TITLE', 'BADGE'));");
sqlLines.push('');
sqlLines.push('-- 2. Upsert All 200 Curated Cosmetics');
sqlLines.push('INSERT INTO public.shop_items(');
sqlLines.push('  id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data');
sqlLines.push(') VALUES');

const valueRows = items.map((it) => {
  const safeName = it.name.replace(/'/g, "''");
  const safeDesc = it.description.replace(/'/g, "''");
  const styleJson = JSON.stringify(it.style_data).replace(/'/g, "''");
  return `  ('${it.id}', '${safeName}', '${safeDesc}', '${it.kind}', ${it.price_xp}, '${it.rarity}', ${it.is_animated}, ${it.min_level}, true, 'ACTIVE', ${it.order_index}, '${it.asset_url}', '${styleJson}'::jsonb)`;
});

sqlLines.push(valueRows.join(',\n'));
sqlLines.push('ON CONFLICT (id) DO UPDATE SET');
sqlLines.push('  name = EXCLUDED.name,');
sqlLines.push('  description = EXCLUDED.description,');
sqlLines.push('  kind = EXCLUDED.kind,');
sqlLines.push('  price_xp = EXCLUDED.price_xp,');
sqlLines.push('  rarity = EXCLUDED.rarity,');
sqlLines.push('  is_animated = EXCLUDED.is_animated,');
sqlLines.push('  min_level = EXCLUDED.min_level,');
sqlLines.push('  order_index = EXCLUDED.order_index,');
sqlLines.push('  asset_url = EXCLUDED.asset_url,');
sqlLines.push('  style_data = EXCLUDED.style_data;');
sqlLines.push('');

const outPath = 'supabase/migrations/20261026010000_full_200_cosmetics_catalog_sync.sql';
fs.writeFileSync(outPath, sqlLines.join('\n'), 'utf-8');
console.log('Saved complete migration to:', outPath);
