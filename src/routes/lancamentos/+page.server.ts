import { fetchPaginatedReleasesFromYugabyte } from "$lib/server/yugabyte";

const LANCAMENTOS_CACHE_TTL_MS = 60_000;
const lancamentosCache = new Map<string, { timestamp: number; result: any }>();
const lancamentosInFlight = new Map<string, Promise<any>>();

export const load = async ({ url, platform, setHeaders }: any) => {
  const rawPage = url.searchParams.get("page");
  const parsedPage = rawPage ? parseInt(rawPage, 10) : 1;

  const rawKind = url.searchParams.get("kind");
  const kind = rawKind && rawKind.toUpperCase() !== "ALL" ? rawKind.toUpperCase() : null;

  const PAGE_SIZE = 24;
  const CHAPTERS_PER_WORK = 4;

  // Out-of-bounds guard: project has fewer than 50 releases pages.
  // Normalizes all pages > 50 to canonical page 51 with 1h edge cache without querying the DB.
  if (parsedPage > 50) {
    if (setHeaders) {
      setHeaders({
        "cache-control": "public, max-age=3600, s-maxage=3600"
      });
    }
    return {
      releases: [],
      totalWorks: 0,
      totalPages: 50,
      currentPage: 51,
      pageSize: PAGE_SIZE,
      selectedKind: kind || "ALL",
      loadError: false
    };
  }

  const currentPage = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const cacheKey = `${currentPage}_${kind || 'ALL'}`;

  const cached = lancamentosCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < LANCAMENTOS_CACHE_TTL_MS) {
    if (setHeaders) {
      setHeaders({
        "cache-control": "public, max-age=60, s-maxage=120, stale-while-revalidate=300"
      });
    }
    return {
      releases: cached.result.releases,
      totalWorks: cached.result.totalWorks,
      totalPages: cached.result.totalPages,
      currentPage: cached.result.currentPage,
      pageSize: cached.result.pageSize,
      selectedKind: kind || "ALL",
      loadError: false
    };
  }

  try {
    let pending = lancamentosInFlight.get(cacheKey);
    if (!pending) {
      pending = fetchPaginatedReleasesFromYugabyte(
        currentPage,
        PAGE_SIZE,
        CHAPTERS_PER_WORK,
        platform?.env,
        kind
      ).finally(() => lancamentosInFlight.delete(cacheKey));
      lancamentosInFlight.set(cacheKey, pending);
    }
    const result = await pending;

    if (currentPage <= 5) {
      lancamentosCache.set(cacheKey, { timestamp: Date.now(), result });
    }

    if (setHeaders) {
      setHeaders({
        "cache-control": "public, max-age=60, s-maxage=120, stale-while-revalidate=300"
      });
    }

    return {
      releases: result.releases,
      totalWorks: result.totalWorks,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      pageSize: result.pageSize,
      selectedKind: kind || "ALL",
      loadError: false
    };
  } catch (err) {
    console.error("[LANCAMENTOS SERVER LOAD ERROR]:", err);
    if (setHeaders) {
      setHeaders({
        "cache-control": "private, no-store"
      });
    }
    return {
      releases: [],
      totalWorks: 0,
      totalPages: 1,
      currentPage,
      pageSize: PAGE_SIZE,
      selectedKind: kind || "ALL",
      loadError: true
    };
  }
};
