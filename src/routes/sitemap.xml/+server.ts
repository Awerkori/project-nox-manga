import { executeYugabyteSql } from '$lib/server/yugabyte';

const ORIGIN = 'https://projectnox.org';
const DAY_MS = 24 * 60 * 60 * 1_000;

const dayStart = (value: Date) => new Date(Date.UTC(
  value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(),
));

const dayToken = (value: Date) => value.toISOString().slice(0, 10);

/**
 * Shard by the indexed update date rather than OFFSET.  OFFSET makes later
 * pages increasingly expensive and can move rows between pages while crawlers
 * are reading the index.  A work belongs to exactly one date range per
 * response, so each child sitemap stays bounded and has a stable key range.
 */
export const GET = async ({ platform }: any) => {
  const result = await executeYugabyteSql<{ updated_at: string }>(
    `SELECT updated_at FROM works
     WHERE published = true AND updated_at IS NOT NULL
     ORDER BY updated_at ASC LIMIT 1;`, [], platform?.env,
  );
  const first = result.rows?.[0]?.updated_at ? dayStart(new Date(result.rows[0].updated_at)) : dayStart(new Date());
  const last = dayStart(new Date());
  const entries = [`<sitemap><loc>${ORIGIN}/sitemap-static.xml</loc></sitemap>`];
  for (let current = first; current <= last; current = new Date(current.getTime() + DAY_MS)) {
    const token = dayToken(current);
    entries.push(`<sitemap><loc>${ORIGIN}/sitemap-${token}.xml</loc><lastmod>${token}</lastmod></sitemap>`);
  }
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}</sitemapindex>`,
    { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=3600' } },
  );
};
