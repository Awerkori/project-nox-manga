/**
 * src/lib/server/obra-cache.ts
 * In-memory cache for auxiliary public obra page data (comments, likes, metrics, workScans)
 * with instant invalidation on interactive actions (like, favorite, comment).
 */

export type ObraAuxCacheEntry = {
  timestamp: number;
  comments: any[];
  likes: any[];
  metrics: any;
  workScans: any[];
};

const obraAuxCache = new Map<string, ObraAuxCacheEntry>();
const obraAuxFlights = new Map<string, Promise<ObraAuxCacheEntry>>();
const OBRA_AUX_CACHE_TTL_MS = 60_000; // 60s TTL; explicitly invalidated on like/comment/rating mutations

export function getObraAuxCache(workId: string): ObraAuxCacheEntry | null {
  const entry = obraAuxCache.get(workId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > OBRA_AUX_CACHE_TTL_MS) {
    obraAuxCache.delete(workId);
    return null;
  }
  return entry;
}

export function setObraAuxCache(workId: string, entry: Omit<ObraAuxCacheEntry, 'timestamp'>): void {
  if (obraAuxCache.size >= 300) {
    const oldestKey = obraAuxCache.keys().next().value;
    if (oldestKey) obraAuxCache.delete(oldestKey);
  }
  obraAuxCache.set(workId, {
    ...entry,
    timestamp: Date.now()
  });
}

export async function getOrFetchObraAux(
  workId: string,
  fetcher: () => Promise<ObraAuxCacheEntry>
): Promise<ObraAuxCacheEntry> {
  const cached = getObraAuxCache(workId);
  if (cached) return cached;
  const inFlight = obraAuxFlights.get(workId);
  if (inFlight) return inFlight;
  const run = fetcher().finally(() => {
    if (obraAuxFlights.get(workId) === run) obraAuxFlights.delete(workId);
  });
  obraAuxFlights.set(workId, run);
  return run;
}

export function invalidateObraAuxCache(workId?: string): void {
  if (workId) {
    obraAuxCache.delete(workId);
    obraAuxFlights.delete(workId);
  } else {
    obraAuxCache.clear();
    obraAuxFlights.clear();
  }
}
