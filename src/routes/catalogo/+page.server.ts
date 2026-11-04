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

  // Only share public search results. A timed-out request must not cache its
  // degraded response; an independently completed SQL read may populate the
  // edge cache after that response has been returned.
  let edgeCache: Cache | undefined;
  let edgeKey: string | undefined;
  if (!locals.user && q && platform?.context?.waitUntil) {
    try {
      edgeCache = (globalThis as any).caches?.default;
      if (edgeCache) {
        const raw = JSON.stringify([q, tag, kind, status, sort, page]);
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
        edgeKey = `https://edge-cache.project-nox.internal/catalog-search-v1/${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`;
      }
    } catch { edgeCache = undefined; edgeKey = undefined; }
  }
  let cachedResult: any;
  if (edgeCache && edgeKey) {
    try {
      const response = await edgeCache.match(edgeKey);
      if (response) {
        const entry = await response.json() as any;
        if (Date.now() - entry.timestamp < 45_000 && entry.timestamp <= Date.now() && Array.isArray(entry.result?.works)) {
          cachedResult = entry.result;
        }
      }
    } catch { /* edge cache is best-effort */ }
  }

  let edgeWrite: Promise<unknown> = Promise.resolve();
  const catalogPromise = cachedResult ? Promise.resolve(cachedResult) : fetchCatalogFromYugabyte(
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
      platform?.env,
      (result) => {
        if (!edgeCache || !edgeKey || result.isDegraded) return;
        edgeWrite = edgeCache.put(edgeKey, new Response(JSON.stringify({ timestamp: Date.now(), result }), {
          headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=45' }
        })).catch(() => {});
      }
    );
  if (!cachedResult && edgeCache && platform?.context?.waitUntil) {
    platform.context.waitUntil(catalogPromise.then(() => edgeWrite).catch(() => {}));
  }
  const catalogRes = await withTimeout(
    catalogPromise,
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
    setHeaders({ 'cache-control': catalogRes.isDegraded
      ? 'private, no-store'
      : 'public, max-age=60, s-maxage=120, stale-while-revalidate=300' });
  }

  if (isUnfiltered && works.length > 0 && !catalogRes.isDegraded) {
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
