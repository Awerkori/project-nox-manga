import { db, schema, safeQuery } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const GET = async ({ url }) => {
  const { data } = await safeQuery(db.select({ slug: schema.works.slug, updatedAt: schema.works.updatedAt }).from(schema.works).where(eq(schema.works.published, true)).limit(10000));
  const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['', 'catalogo', 'ranking', 'sobre'].map((path) => `<url><loc>${escape(url.origin)}/${path}</loc></url>`).join('')}${(data || []).map((w) => `<url><loc>${escape(url.origin)}/obra/${w.slug}</loc><lastmod>${w.updatedAt ? String(w.updatedAt).slice(0, 10) : ''}</lastmod></url>`).join('')}</urlset>`,
    { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=300' } }
  );
};
