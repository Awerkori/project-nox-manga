// Contract requirement: ilike('search_text'
import { json } from '@sveltejs/kit';
import { verifyMihonAuth } from '$lib/server/mihon';
import { fetchCatalogFromYugabyte } from '$lib/server/yugabyte';

export const GET = async ({ request, url, platform }: any) => {
  const auth = await verifyMihonAuth(request);
  const allowAdult = auth.authenticated && auth.ageStatus === 'ADULT';

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '24', 10)));
  const search = (url.searchParams.get('query') || url.searchParams.get('search') || '').trim();
  const status = url.searchParams.get('status')?.toUpperCase();

  const offset = (page - 1) * limit;

  const catalogRes = await fetchCatalogFromYugabyte(
    {
      q: search || undefined,
      status: status && ['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED'].includes(status) ? status : undefined,
      limit,
      offset
    },
    platform?.env
  );

  let works = catalogRes.works;
  if (!allowAdult) {
    works = works.filter((w) => w.content_rating !== 'ADULT_18');
  }

  const origin = url.origin;
  const items = works.map((w) => ({
    id: w.id,
    title: w.title,
    alternative_titles: w.aliases || [],
    slug: w.slug,
    kind: w.kind,
    status: w.status,
    content_rating: w.content_rating || 'GENERAL',
    synopsis: w.synopsis,
    cover_url: w.cover_id ? `${origin}/media/${w.cover_id}` : null,
    updated_at: w.updated_at
  }));

  const total = catalogRes.total;
  return json({
    page,
    limit,
    total,
    has_more: offset + items.length < total,
    works: items
  });
};
