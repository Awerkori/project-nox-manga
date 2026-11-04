import { json } from '@sveltejs/kit';
import { fetchCatalogFromYugabyte } from '$lib/server/yugabyte';

export const GET = async ({ url, platform }: any) => {
  const sortParam = url.searchParams.get('sort') || 'latest';
  const q = (url.searchParams.get('q') || url.searchParams.get('search') || '').trim();
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));
  const limit = Math.min(24, Math.max(1, parseInt(url.searchParams.get('limit') || '8', 10)));
  const includeTotal = url.searchParams.get('include_total') !== 'false';

  const sort = sortParam === 'most_read' || sortParam === 'popular' ? 'views'
    : sortParam === 'titulo' ? 'titulo' : 'recentes';

  const result = await fetchCatalogFromYugabyte(
    {
      q: q || undefined,
      sort,
      limit,
      offset,
      includeTotal
    },
    platform?.env
  );

  if (result.isDegraded) {
    return json({ error: 'Catálogo temporariamente indisponível' }, {
      status: 503,
      headers: { 'cache-control': 'private, no-store' }
    });
  }

  return json(
    {
      works: result.works,
      ...(includeTotal ? { total: result.total } : {}),
      hasMore: includeTotal ? offset + result.works.length < result.total : result.hasMore
    },
    {
      headers: {
        'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120'
      }
    }
  );
};
