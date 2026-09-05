export const GET = async ({ locals, url }) => {
  const { data } = await locals.db.from('works').select('slug,updated_at').eq('published', true).limit(10000);
  const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['', 'catalogo', 'ranking', 'sobre'].map((path) => `<url><loc>${escape(url.origin)}/${path}</loc></url>`).join('')}${(data || []).map((w) => `<url><loc>${escape(url.origin)}/obra/${w.slug}</loc><lastmod>${w.updated_at.slice(0, 10)}</lastmod></url>`).join('')}</urlset>`,
    { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=300' } }
  );
};
