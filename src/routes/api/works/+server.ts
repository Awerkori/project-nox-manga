import { json } from '@sveltejs/kit';
import { fetchCatalogFromYugabyte } from '$lib/server/yugabyte';

export const GET = async ({ url, platform }: any) => {
  const sortParam = url.searchParams.get('sort') || 'latest';
  const q = (url.searchParams.get('q') || url.searchParams.get('search') || '').trim();
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));
  const limit = Math.min(24, Math.max(1, parseInt(url.searchParams.get('limit') || '8', 10)));

  const sort = sortParam === 'most_read' || sortParam === 'popular' ? 'views'
    : sortParam === 'titulo' ? 'titulo' : 'recentes';

  const result = await fetchCatalogFromYugabyte(
    {
      q: q || undefined,
      sort,
      limit,
      offset
    },
    platform?.env
  );

  return json(
    {
      works: result.works,
      total: result.total,
      hasMore: offset + result.works.length < result.total
    },
    {
      headers: {
        'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120'
      }
    }
  );
};
