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
const OBRA_AUX_CACHE_TTL_MS = 2_000; // 2 seconds TTL to prevent stale reads on invalidation

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

export function invalidateObraAuxCache(workId?: string): void {
  if (workId) {
    obraAuxCache.delete(workId);
  } else {
    obraAuxCache.clear();
  }
}
