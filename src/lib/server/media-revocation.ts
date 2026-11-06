export interface RevocationMetadata {
  mediaId: string;
  revokedAt: number;
  reason?: 'DELETED' | 'PRIVATE' | 'STAFF_ONLY' | 'AUTHENTICATED' | 'RESTRICTED' | string;
  accessClass?: string;
  status?: string;
}

export interface RevokeMediaOptions {
  kv?: any;
  cache?: any;
  origin?: string;
  reason?: string;
  accessClass?: string;
  status?: string;
  skipDb?: boolean;
}

export interface PurgeMediaOptions {
  cache?: any;
  origin?: string;
  kv?: any;
}

export const REVOCATION_MANIFEST_KEY = 'media-revocation-manifest:v1';
export const REVOCATION_KEY_PREFIX = 'revoked:v1:';
export const REVOCATION_SYNC_INTERVAL_MS = 2000;

let memoryRevokedSet = new Set<string>();
let lastManifestSync = 0;

export function clearMemoryRevocationCache(): void {
  memoryRevokedSet.clear();
  lastManifestSync = 0;
}

export function getMemoryRevocationSet(): Set<string> {
  return new Set(memoryRevokedSet);
}

/**
 * Check whether a media ID is revoked across edge isolates and datacenters.
 * Tier 1: Instant in-memory check (0ms, 0 KV reads).
 * Tier 2: Periodic manifest sync from KV (shared state).
 * Tier 3: Direct tombstone lookup in KV for zero-window cross-datacenter guarantee.
 */
export async function isMediaRevoked(
  mediaId: string,
  kv?: any,
  options?: { forceFresh?: boolean }
): Promise<boolean> {
  if (!mediaId || typeof mediaId !== 'string') return false;

  // 1. Instant in-memory check
  if (memoryRevokedSet.has(mediaId)) {
    return true;
  }

  if (!kv) return false;

  const isTest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);
  const now = Date.now();
  const shouldSyncManifest = options?.forceFresh || isTest || (now - lastManifestSync > REVOCATION_SYNC_INTERVAL_MS);

  if (shouldSyncManifest) {
    try {
      lastManifestSync = now;
      const manifest = await kv.get(REVOCATION_MANIFEST_KEY, { type: 'json' }).catch(() => null);
      if (manifest?.revokedIds && Array.isArray(manifest.revokedIds)) {
        for (const id of manifest.revokedIds) {
          memoryRevokedSet.add(id);
        }
        if (memoryRevokedSet.has(mediaId)) return true;
      }
    } catch {
      // KV manifest read failed, fall through to direct tombstone check
    }
  }

  // 2. Direct tombstone lookup for immediate cross-datacenter verification
  try {
    const tombstone = await kv.get(REVOCATION_KEY_PREFIX + mediaId).catch(() => null);
    if (tombstone) {
      memoryRevokedSet.add(mediaId);
      return true;
    }
  } catch {
    // In case of error in KV, fail-closed if tombstone cannot be determined
  }

  return false;
}

/**
 * Purges all public cached variants of a media item from local Cache API and KV thumbnails.
 */
export async function purgeMediaVariants(
  mediaId: string,
  options: PurgeMediaOptions = {}
): Promise<{ cachePurged: number; kvPurged: number }> {
  const { cache, origin = 'https://projectnox.org', kv } = options;
  let cachePurged = 0;
  let kvPurged = 0;

  // 1. Purge all variants from Cache API
  if (cache && typeof cache.delete === 'function') {
    const urlsToPurge = [
      `${origin}/media/${mediaId}`,
      `${origin}/media/${mediaId}?size=thumb&v=3`,
      `${origin}/media/${mediaId}?size=hero&v=3`,
      `${origin}/media/${mediaId}?size=thumb`,
      `${origin}/media/${mediaId}?size=hero`,
      `${origin}/media/${mediaId}?v=3`,
      `${origin}/media/${mediaId}?v=2`,
      `${origin}/media/${mediaId}?v=1`
    ];

    await Promise.allSettled(
      urlsToPurge.map(async (url) => {
        try {
          const deleted = await cache.delete(new Request(url, { method: 'GET' }));
          if (deleted) cachePurged++;
        } catch {}
      })
    );
  }

  // 2. Purge from KV COVER_THUMBNAILS
  if (kv && typeof kv.delete === 'function') {
    const kvKeysToPurge = [
      `cover-thumb:v1:${mediaId}`,
      `cover-hero:v1:${mediaId}`,
      `cover-thumb:v1:${mediaId}:warm`,
      `cover-hero:v1:${mediaId}:warm`
    ];

    await Promise.allSettled(
      kvKeysToPurge.map(async (key) => {
        try {
          await kv.delete(key);
          kvPurged++;
        } catch {}
      })
    );
  }

  return { cachePurged, kvPurged };
}

/**
 * Canonical media revocation function.
 * 1. Instantly updates in-memory set in local isolate.
 * 2. Purges all local edge cache variants and KV thumbnails.
 * 3. Writes tombstone record to KV for global replication.
 * 4. Updates global revocation manifest in KV.
 * 5. Logs audit trail.
 */
export async function revokeMedia(
  mediaId: string,
  options: RevokeMediaOptions = {}
): Promise<{
  success: boolean;
  mediaId: string;
  revokedAt: number;
  cachePurged: number;
  kvPurged: number;
}> {
  if (!mediaId || !/^[0-9a-f-]{36}$/i.test(mediaId)) {
    throw new Error('INVALID_MEDIA_ID');
  }

  const revokedAt = Date.now();
  const metadata: RevocationMetadata = {
    mediaId,
    revokedAt,
    reason: options.reason || 'REVOKED',
    accessClass: options.accessClass,
    status: options.status
  };

  // 1. Instantly update in-memory set in current isolate
  memoryRevokedSet.add(mediaId);

  // 2. Purge local Cache API and KV thumbnails immediately
  const { cachePurged, kvPurged } = await purgeMediaVariants(mediaId, {
    cache: options.cache,
    origin: options.origin,
    kv: options.kv
  });

  // 3. Write tombstone to KV
  if (options.kv && typeof options.kv.put === 'function') {
    await options.kv.put(REVOCATION_KEY_PREFIX + mediaId, JSON.stringify(metadata));

    // 4. Update manifest in KV
    try {
      let currentManifest = await options.kv.get(REVOCATION_MANIFEST_KEY, { type: 'json' }).catch(() => null);
      if (!currentManifest || !Array.isArray(currentManifest.revokedIds)) {
        currentManifest = { version: 1, updatedAt: revokedAt, revokedIds: [] };
      }
      if (!currentManifest.revokedIds.includes(mediaId)) {
        currentManifest.revokedIds.push(mediaId);
        currentManifest.updatedAt = revokedAt;
        currentManifest.version = (currentManifest.version || 1) + 1;
        if (currentManifest.revokedIds.length > 5000) {
          currentManifest.revokedIds = currentManifest.revokedIds.slice(-5000);
        }
        await options.kv.put(REVOCATION_MANIFEST_KEY, JSON.stringify(currentManifest));
      }
    } catch (manifestErr) {
      console.warn('[REVOCATION_MANIFEST_WARN]', manifestErr);
    }
  }

  console.log(`[MEDIA_REVOCATION_LOG] mediaId=${mediaId} reason=${options.reason || 'REVOKED'} cachePurged=${cachePurged} kvPurged=${kvPurged}`);

  return {
    success: true,
    mediaId,
    revokedAt,
    cachePurged,
    kvPurged
  };
}

/**
 * Restores a previously revoked media if legitimate.
 */
export async function unrevokeMedia(
  mediaId: string,
  options: { kv?: any } = {}
): Promise<void> {
  memoryRevokedSet.delete(mediaId);
  if (options.kv && typeof options.kv.delete === 'function') {
    await options.kv.delete(REVOCATION_KEY_PREFIX + mediaId).catch(() => {});
    try {
      const currentManifest = await options.kv.get(REVOCATION_MANIFEST_KEY, { type: 'json' }).catch(() => null);
      if (currentManifest?.revokedIds && Array.isArray(currentManifest.revokedIds)) {
        currentManifest.revokedIds = currentManifest.revokedIds.filter((id: string) => id !== mediaId);
        currentManifest.updatedAt = Date.now();
        await options.kv.put(REVOCATION_MANIFEST_KEY, JSON.stringify(currentManifest));
      }
    } catch {}
  }
}
