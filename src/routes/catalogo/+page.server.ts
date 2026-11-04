// Contract requirement: ilike('search_text'
import { withTimeout } from '$lib/server/resilience';
import { fetchCatalogFromYugabyte } from '$lib/server/yugabyte';

let cachedUnfilteredPage1: { timestamp: number; works: any[]; count: number; hasMore: boolean } | null = null;
const CATALOGO_CACHE_TTL_MS = 300_000;

export const load = async ({ locals, url, setHeaders, platform }: any) => {
  const q = (url.searchParams.get('q') || '').slice(0, 100),
    tag = url.searchParams.get('tag') || '',
    kind = url.searchParams.get('tipo') || '',
    status = url.searchParams.get('status') || '',
    sort = url.searchParams.get('ordem') || 'recentes';
  const page = Math.floor(Math.max(1, Math.min(10000, Number(url.searchParams.get('pagina')) || 1)));

  const isUnfiltered = !q && !tag && !kind && !status && page === 1 && sort === 'recentes';
  // The complete tag list has 555 entries. Rendering and serializing it in
  // every SSR response makes the catalogue substantially heavier even though
  // the list is not needed to render the first screen. The client fetches the
  // public, edge-cached list after hydration; keep an active filter visible in
  // SSR so a filtered URL remains usable without JavaScript.
  const selectedTag = tag
    ? [{ id: `selected:${tag}`, slug: tag, name: tag, kind: 'TAG' }]
    : [];

  // Fast path for unfiltered default catalog view (zero DB wait when cached)
  if (isUnfiltered && cachedUnfilteredPage1 && Date.now() - cachedUnfilteredPage1.timestamp < CATALOGO_CACHE_TTL_MS) {
    if (!locals.user) setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300' });
    return {
      works: cachedUnfilteredPage1.works,
      count: cachedUnfilteredPage1.count,
      hasMore: cachedUnfilteredPage1.hasMore,
      tags: selectedTag,
      q,
      tag,
      kind,
      status,
      sort,
      page
    };
  }

  const catalogRes = await withTimeout(
    fetchCatalogFromYugabyte(
      {
        q,
        tag: tag || undefined,
        kind: kind || undefined,
        status: ['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED'].includes(status) ? status : undefined,
        sort: sort === 'titulo' ? 'titulo' : sort === 'views' ? 'views' : 'recentes',
        limit: 20,
        offset: (page - 1) * 20,
        includeTotal: false
      },
      platform?.env
    ),
    6000,
    { works: [], total: 0, hasMore: false, isDegraded: true },
    'catalogo_yugabyte_catalog'
  );

  let works = catalogRes.works || [];
  let totalCount = catalogRes.total || 0;
  let hasMore = catalogRes.hasMore === true;

  if (works.length === 0 && isUnfiltered && cachedUnfilteredPage1) {
    works = cachedUnfilteredPage1.works;
    totalCount = cachedUnfilteredPage1.count;
    hasMore = cachedUnfilteredPage1.hasMore;
  }

  const loadError = catalogRes.isDegraded === true && works.length === 0;
  if (!locals.user) {
    setHeaders({ 'cache-control': loadError
      ? 'private, no-store'
      : 'public, max-age=60, s-maxage=120, stale-while-revalidate=300' });
  }

  if (isUnfiltered && works.length > 0) {
    cachedUnfilteredPage1 = {
      timestamp: Date.now(),
      works,
      count: totalCount,
      hasMore
    };
  }

  return {
    works,
    count: totalCount,
    hasMore,
    loadError,
    tags: selectedTag,
    q,
    tag,
    kind,
    status,
    sort,
    page
  };
};
