const ORIGIN = 'https://projectnox.org';
const PATHS = ['', 'catalogo', 'ranking', 'sobre'];

export const GET = async () => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${PATHS.map((path) => `<url><loc>${ORIGIN}/${path}</loc></url>`).join('')}</urlset>`,
  { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=3600' } },
);
