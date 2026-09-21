/**
 * Cloudflare Workers Shared Cache API Adapter
 * 
 * Provides cross-isolate cache coordination via Cloudflare's native Cache API (caches.default).
 * 
 * Invariants:
 * - Operates at the Cloudflare edge datacenter level (shared by all V8 isolates in the region).
 * - ZERO Hyperdrive queries on cache HIT.
 * - Cache eviction via deleteSharedCache immediately makes new content visible across all isolates.
 * - Graceful fallback to null when caches.default is not available (e.g. Node.js build/tests).
 */

export const CACHE_BASE_URL = 'https://manga.project-nox-awerkori.workers.dev/__nox_cache';

export const SHARED_CACHE_KEYS = {
  HOME_PUBLIC: `${CACHE_BASE_URL}/home_public_v1`,
  LANCAMENTOS_PREFIX: `${CACHE_BASE_URL}/lancamentos/`,
  OBRA_PREFIX: `${CACHE_BASE_URL}/obra/`,
  READER_PREFIX: `${CACHE_BASE_URL}/reader/`,
};

function getDefaultCache(): Cache | null {
  try {
    if (typeof caches !== 'undefined' && caches && 'default' in caches) {
      return (caches as any).default as Cache;
    }
  } catch {
    // Ignore in non-Cloudflare environments
  }
  return null;
}

/**
 * Retrieve an item from the shared Cloudflare edge cache.
 * Returns null on miss or error.
 */
export async function getSharedCache<T>(key: string): Promise<T | null> {
  const cache = getDefaultCache();
  if (!cache) return null;

  try {
    const req = new Request(key, { method: 'GET' });
    const res = await cache.match(req);
    if (!res) return null;

    const data = await res.json();
    return data as T;
  } catch (err) {
    console.warn('[SHARED CACHE MATCH ERROR]', key, err);
    return null;
  }
}

/**
 * Store an item in the shared Cloudflare edge cache.
 * Uses public Cache-Control with s-maxage to allow Cloudflare Cache API retention.
 */
export async function setSharedCache<T>(key: string, data: T, ttlSeconds: number = 20): Promise<void> {
  const cache = getDefaultCache();
  if (!cache) return;

  try {
    const req = new Request(key, { method: 'GET' });
    const res = new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`
      }
    });

    await cache.put(req, res);
  } catch (err) {
    console.warn('[SHARED CACHE PUT ERROR]', key, err);
  }
}

/**
 * Delete an item from the shared Cloudflare edge cache.
 * Immediately purges the entry across all isolates in the datacenter.
 */
export async function deleteSharedCache(key: string): Promise<boolean> {
  const cache = getDefaultCache();
  if (!cache) return false;

  try {
    const req = new Request(key, { method: 'GET' });
    return await cache.delete(req);
  } catch (err) {
    console.warn('[SHARED CACHE DELETE ERROR]', key, err);
    return false;
  }
}

/**
 * Batch delete multiple keys from the shared Cloudflare edge cache.
 */
export async function deleteSharedCacheBatch(keys: string[]): Promise<boolean[]> {
  const cache = getDefaultCache();
  if (!cache) return keys.map(() => false);

  return await Promise.all(
    keys.map(async (key) => {
      try {
        const req = new Request(key, { method: 'GET' });
        return await cache.delete(req);
      } catch {
        return false;
      }
    })
  );
}
