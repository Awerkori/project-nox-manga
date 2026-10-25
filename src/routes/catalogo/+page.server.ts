// Contract requirement: ilike('search_text'
import { withTimeout } from '$lib/server/resilience';
import { fetchCatalogFromYugabyte, fetchTagsFromYugabyte } from '$lib/server/yugabyte';

let cachedTags: { timestamp: number; data: any[] } | null = null;
const TAGS_CACHE_TTL_MS = 300_000;

let cachedUnfilteredPage1: { timestamp: number; works: any[]; count: number; tags: any[] } | null = null;
const CATALOGO_CACHE_TTL_MS = 300_000;

export const load = async ({ locals, url, setHeaders, platform }: any) => {
  const q = (url.searchParams.get('q') || '').slice(0, 100),
    tag = url.searchParams.get('tag') || '',
    kind = url.searchParams.get('tipo') || '',
    status = url.searchParams.get('status') || '',
    sort = url.searchParams.get('ordem') || 'recentes';
  const page = Math.floor(Math.max(1, Math.min(10000, Number(url.searchParams.get('pagina')) || 1)));

  const isUnfiltered = !q && !tag && !kind && !status && page === 1 && sort === 'recentes';

  if (!locals.user) {
    setHeaders({
      'cache-control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300'
    });
  }

  // Fast path for unfiltered default catalog view (zero DB wait when cached)
  if (isUnfiltered && cachedUnfilteredPage1 && Date.now() - cachedUnfilteredPage1.timestamp < CATALOGO_CACHE_TTL_MS) {
    return {
      works: cachedUnfilteredPage1.works,
      count: cachedUnfilteredPage1.count,
      tags: cachedUnfilteredPage1.tags,
      q,
      tag,
      kind,
      status,
      sort,
      page
    };
  }

  const tagsNeedRefresh = !cachedTags || Date.now() - cachedTags.timestamp > TAGS_CACHE_TTL_MS;

  const [tagsRes, catalogRes] = await Promise.all([
    !tagsNeedRefresh && cachedTags
      ? Promise.resolve(cachedTags.data)
      : withTimeout(
          fetchTagsFromYugabyte(platform?.env),
          2000,
          cachedTags?.data || [],
          'catalogo_yugabyte_tags'
        ),
    withTimeout(
      fetchCatalogFromYugabyte(
        {
          q,
          tag: tag || undefined,
          kind: kind || undefined,
          status: ['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED'].includes(status) ? status : undefined,
          sort: sort === 'titulo' ? 'titulo' : sort === 'views' ? 'views' : 'recentes',
          limit: 20,
          offset: (page - 1) * 20
        },
        platform?.env
      ),
      6000,
      { works: [], total: 0 },
      'catalogo_yugabyte_catalog'
    )
  ]);

  let tagsData = tagsRes || [];
  if (tagsData.length > 0) {
    cachedTags = { timestamp: Date.now(), data: tagsData };
  } else if (cachedTags) {
    tagsData = cachedTags.data;
  }

  let works = catalogRes.works || [];
  let totalCount = catalogRes.total || 0;

  if (works.length === 0 && isUnfiltered && cachedUnfilteredPage1) {
    works = cachedUnfilteredPage1.works;
    totalCount = cachedUnfilteredPage1.count;
  }

  if (isUnfiltered && works.length > 0) {
    cachedUnfilteredPage1 = {
      timestamp: Date.now(),
      works,
      count: totalCount,
      tags: tagsData
    };
  }

  return {
    works,
    count: totalCount,
    tags: tag && !tagsData.some((t: any) => t?.slug === tag)
      ? [...tagsData, { id: `selected:${tag}`, slug: tag, name: tag, kind: 'TAG' }]
      : tagsData,
    q,
    tag,
    kind,
    status,
    sort,
    page
  };
};
