import { error } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';

const ORIGIN = 'https://projectnox.org';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const xml = (entries: string) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`,
  { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=3600' } },
);

/** A single, index-backed UTC day; avoids large result sets and OFFSET scans. */
export const GET = async ({ params, platform }: any) => {
  const date = params.date;
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) error(404, 'Sitemap inexistente');
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1_000);
  const result = await executeYugabyteSql<{ slug: string; updated_at: string }>(
    `SELECT slug, updated_at FROM works
     WHERE published = true AND updated_at >= $1 AND updated_at < $2
     ORDER BY updated_at DESC;`, [start.toISOString(), end.toISOString()], platform?.env,
  );
  const entries = (result.rows || []).map((work) =>
    `<url><loc>${ORIGIN}/obra/${encodeURIComponent(work.slug)}</loc><lastmod>${String(work.updated_at).slice(0, 10)}</lastmod></url>`,
  ).join('');
  return xml(entries);
};
