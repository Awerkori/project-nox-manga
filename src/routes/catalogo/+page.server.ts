// Contract requirement: ilike('search_text'
import { withTimeout } from '$lib/server/resilience';
import { fetchCatalogFromYugabyte } from '$lib/server/yugabyte';

const CATALOGO_CACHE_TTL_MS = 300_000;
const CATALOGO_FILTERED_TTL_MS = 120_000;
const MAX_CATALOG_CACHED_PAGES = 30;
const MAX_FILTERED_CACHE_SIZE = 50;

const catalogPagesCache = new Map<number, { timestamp: number; works: any[]; count: number; hasMore: boolean }>();
const catalogFilteredCache = new Map<string, { timestamp: number; works: any[]; count: number; hasMore: boolean }>();
const catalogInFlight = new Map<string, Promise<any>>();

export const load = async ({ locals, url, setHeaders, platform }: any) => {
  const q = (url.searchParams.get('q') || '').slice(0, 100),
    tag = url.searchParams.get('tag') || '',
    kind = url.searchParams.get('tipo') || '',
    status = url.searchParams.get('status') || '',
    sort = url.searchParams.get('ordem') || 'recentes';
  const rawPage = Number(url.searchParams.get('pagina')) || 1;
  const page = Math.floor(Math.max(1, Math.min(1000, rawPage)));

  const isUnfiltered = !q && !tag && !kind && !status && sort === 'recentes';
  const selectedTag = tag
    ? [{ id: `selected:${tag}`, slug: tag, name: tag, kind: 'TAG' }]
    : [];

  // Out of range catalog guard: catalog currently has ~913 pages (18,254 works / 20 per page).
  // Normalizes all pages > 1000 to canonical page 1001 so edge caches share a single entry
  // without polluting legitimate works or exhausting database connections.
  if (rawPage > 1000) {
    if (!locals.user) {
      setHeaders({ 'cache-control': 'public, max-age=3600, s-maxage=3600' });
    }
    return {
      works: [],
      count: 0,
      hasMore: false,
      loadError: false,
      tags: selectedTag,
      q,
      tag,
      kind,
      status,
      sort,
      page: 1001
    };
  }

  // Fast path for unfiltered catalog pages (pages 1..30 served from memory with zero DB wait)
  if (isUnfiltered && catalogPagesCache.has(page)) {
    const cached = catalogPagesCache.get(page)!;
    if (Date.now() - cached.timestamp < CATALOGO_CACHE_TTL_MS) {
      if (!locals.user) {
        setHeaders({ 'cache-control': 'public, max-age=120, s-maxage=300, stale-while-revalidate=600' });
      }
      return {
        works: cached.works,
        count: cached.count,
        hasMore: cached.hasMore,
        tags: selectedTag,
        q,
        tag,
        kind,
        status,
        sort,
        page
      };
    }
  }

  const queryKey = `${page}_${q}_${tag}_${kind}_${status}_${sort}`;

  // Fast path for filtered queries in memory
  if (!isUnfiltered && catalogFilteredCache.has(queryKey)) {
    const cached = catalogFilteredCache.get(queryKey)!;
    if (Date.now() - cached.timestamp < CATALOGO_FILTERED_TTL_MS) {
      if (!locals.user) {
        setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300' });
      }
      return {
        works: cached.works,
        count: cached.count,
        hasMore: cached.hasMore,
        tags: selectedTag,
        q,
        tag,
        kind,
        status,
        sort,
        page
      };
    }
  }

  const runQuery = async () => {
    return withTimeout(
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
  };

  let pending = catalogInFlight.get(queryKey);
  if (!pending) {
    pending = runQuery().finally(() => catalogInFlight.delete(queryKey));
    catalogInFlight.set(queryKey, pending);
  }
  const catalogRes = await pending;

  let works = catalogRes.works || [];
  let totalCount = catalogRes.total || 0;
  let hasMore = catalogRes.hasMore === true;

  if (works.length === 0 && isUnfiltered && catalogPagesCache.has(page)) {
    const fallback = catalogPagesCache.get(page)!;
    works = fallback.works;
    totalCount = fallback.count;
    hasMore = fallback.hasMore;
  }

  const loadError = catalogRes.isDegraded === true && works.length === 0;
  if (!locals.user) {
    setHeaders({
      'cache-control': catalogRes.isDegraded
        ? 'private, no-store'
        : 'public, max-age=60, s-maxage=120, stale-while-revalidate=300'
    });
  }

  if (works.length > 0 && !catalogRes.isDegraded) {
    if (isUnfiltered && page <= MAX_CATALOG_CACHED_PAGES) {
      catalogPagesCache.set(page, {
        timestamp: Date.now(),
        works,
        count: totalCount,
        hasMore
      });
    } else if (!isUnfiltered) {
      if (catalogFilteredCache.size >= MAX_FILTERED_CACHE_SIZE) {
        const oldestKey = catalogFilteredCache.keys().next().value;
        if (oldestKey) catalogFilteredCache.delete(oldestKey);
      }
      catalogFilteredCache.set(queryKey, {
        timestamp: Date.now(),
        works,
        count: totalCount,
        hasMore
      });
    }
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
