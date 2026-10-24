import { executeYugabyteSql } from '$lib/server/yugabyte';

export const GET = async ({ url, platform }: any) => {
  const res = await executeYugabyteSql<{ slug: string; updated_at: string }>(
    'SELECT slug, updated_at FROM works WHERE published = true ORDER BY updated_at DESC LIMIT 10000;',
    [],
    platform?.env
  );
  const data = res.rows || [];
  const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['', 'catalogo', 'ranking', 'sobre'].map((path) => `<url><loc>${escape(url.origin)}/${path}</loc></url>`).join('')}${data.map((w) => `<url><loc>${escape(url.origin)}/obra/${w.slug}</loc><lastmod>${w.updated_at ? String(w.updated_at).slice(0, 10) : ''}</lastmod></url>`).join('')}</urlset>`,
    { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=300' } }
  );
};
