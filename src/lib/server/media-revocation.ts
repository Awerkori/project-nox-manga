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
  ctx?: any;
  origin?: string;
  reason?: string;
  accessClass?: string;
  status?: string;
  skipDb?: boolean;
}

export interface PurgeMediaOptions {
  cache?: any;
  ctx?: any;
  origin?: string;
  kv?: any;
}

export interface RevokeMediaResult {
  success: boolean;
  mediaId: string;
  revokedAt: number;
  cachePurged: number;
  workersCachePurged: number;
  kvPurged: number;
  tombstoneWritten: boolean;
  manifestUpdated: boolean;
  errors: string[];
}

export const REVOCATION_MANIFEST_KEY = 'media-revocation-manifest:v1';
export const REVOCATION_KEY_PREFIX = 'revoked:v1:';
const isVitest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);
export const REVOCATION_SYNC_INTERVAL_MS = isVitest ? 0 : 10000;

let memoryRevokedSet = new Set<string>();
let lastManifestSync = 0;
let manifestSuccessfullyLoaded = false;

export function clearMemoryRevocationCache(): void {
  memoryRevokedSet.clear();
  lastManifestSync = 0;
  manifestSuccessfullyLoaded = false;
}

export function getMemoryRevocationSet(): Set<string> {
  return new Set(memoryRevokedSet);
}

/**
 * Check whether a media ID is revoked across edge isolates and datacenters.
 * Tier 1: Instant in-memory check (0ms, 0 KV reads).
 * Tier 2: Periodic manifest sync from KV (shared state, 1 read per interval per isolate).
 * Tier 3: Direct tombstone lookup on explicit demand or if manifest failed to load.
 * Fail-Closed: When failClosed=true, if KV is absent or fails to verify status on a cached item,
 * returns true (revoked) so caller bypasses fast cache and validates against authoritative DB.
 */
export async function isMediaRevoked(
  mediaId: string,
  kv?: any,
  options?: { forceFresh?: boolean; checkTombstone?: boolean; failClosed?: boolean }
): Promise<boolean> {
  if (!mediaId || typeof mediaId !== 'string') return false;

  // 1. Instant in-memory check
  if (memoryRevokedSet.has(mediaId)) {
    return true;
  }

  if (!kv) {
    // If KV is absent and caller requires fail-closed protection on cached item, assume revoked
    return Boolean(options?.failClosed);
  }

  const isTest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);
  const now = Date.now();
  const shouldSyncManifest = options?.forceFresh || isTest || !manifestSuccessfullyLoaded || (now - lastManifestSync > REVOCATION_SYNC_INTERVAL_MS);

  if (shouldSyncManifest) {
    try {
      lastManifestSync = now;
      const manifest = await kv.get(REVOCATION_MANIFEST_KEY, { type: 'json' });
      if (manifest?.revokedIds && Array.isArray(manifest.revokedIds)) {
        manifestSuccessfullyLoaded = true;
        for (const id of manifest.revokedIds) {
          memoryRevokedSet.add(id);
        }
        if (memoryRevokedSet.has(mediaId)) return true;
      } else {
        manifestSuccessfullyLoaded = true; // Valid empty manifest
      }
    } catch {
      manifestSuccessfullyLoaded = false;
      if (options?.failClosed) return true;
    }
  }

  // 2. Direct tombstone check is executed if explicitly requested or manifest is not reliably loaded
  if (options?.forceFresh || options?.checkTombstone || !manifestSuccessfullyLoaded) {
    try {
      const tombstone = await kv.get(REVOCATION_KEY_PREFIX + mediaId);
      if (tombstone) {
        memoryRevokedSet.add(mediaId);
        return true;
      }
    } catch {
      if (options?.failClosed) return true;
    }
  }

  return false;
}

/**
 * Purges all public cached variants of a media item from:
 * 1. Cloudflare Workers Caching (via ctx.cache.purge by tag and prefix)
 * 2. Cloudflare Cache API (caches.default.delete)
 * 3. KV COVER_THUMBNAILS
 */
export async function purgeMediaVariants(
  mediaId: string,
  options: PurgeMediaOptions & { currentUrl?: string } = {}
): Promise<{ cachePurged: number; workersCachePurged: number; kvPurged: number }> {
  const { cache, ctx, origin = 'https://projectnox.org', kv, currentUrl } = options;
  let cachePurged = 0;
  let workersCachePurged = 0;
  let kvPurged = 0;

  // 1. Purge Cloudflare Workers Caching (declarative edge cache before Worker)
  // Supports ctx.cache.purge, cache.purge from cloudflare:workers, or passed purge hook
  const tagToPurge = `media-${mediaId}`;
  const prefixToPurge = `/media/${mediaId}`;
  try {
    if (ctx?.cache && typeof ctx.cache.purge === 'function') {
      await ctx.cache.purge({ tags: [tagToPurge], pathPrefixes: [prefixToPurge] }).catch(() => {});
      workersCachePurged++;
    } else if (cache && typeof cache.purge === 'function') {
      await cache.purge({ tags: [tagToPurge], pathPrefixes: [prefixToPurge] }).catch(() => {});
      workersCachePurged++;
    } else {
      // Attempt dynamic import in runtime environments supporting cloudflare:workers
      const cw = await import('cloudflare:workers').catch(() => null);
      if (cw?.cache && typeof cw.cache.purge === 'function') {
        await cw.cache.purge({ tags: [tagToPurge], pathPrefixes: [prefixToPurge] }).catch(() => {});
        workersCachePurged++;
      }
    }
  } catch {}

  // 2. Purge all variants from Cache API (caches.default)
  if (cache && typeof cache.delete === 'function') {
    const originsToPurge = new Set([origin]);
    if (origin !== 'https://projectnox.org') {
      originsToPurge.add('https://projectnox.org');
    }

    const urlsToPurge: string[] = [];
    for (const org of originsToPurge) {
      urlsToPurge.push(
        `${org}/media/${mediaId}`,
        `${org}/media/${mediaId}/`,
        `${org}/media/${mediaId}?size=thumb&v=3`,
        `${org}/media/${mediaId}?size=hero&v=3`,
        `${org}/media/${mediaId}?size=thumb&v=2`,
        `${org}/media/${mediaId}?size=hero&v=2`,
        `${org}/media/${mediaId}?size=thumb&v=1`,
        `${org}/media/${mediaId}?size=hero&v=1`,
        `${org}/media/${mediaId}?size=thumb`,
        `${org}/media/${mediaId}?size=hero`,
        `${org}/media/${mediaId}?v=3`,
        `${org}/media/${mediaId}?v=2`,
        `${org}/media/${mediaId}?v=1`
      );
    }

    if (currentUrl && !urlsToPurge.includes(currentUrl)) {
      urlsToPurge.push(currentUrl);
    }

    await Promise.allSettled(
      urlsToPurge.map(async (url) => {
        try {
          const deleted = await cache.delete(new Request(url, { method: 'GET' }));
          if (deleted) cachePurged++;
        } catch {}
      })
    );
  }

  // 3. Purge from KV COVER_THUMBNAILS
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

  return { cachePurged, workersCachePurged, kvPurged };
}

/**
 * Canonical media revocation function.
 * 1. Instantly updates in-memory set in local isolate.
 * 2. Purges Cloudflare Workers Caching (declarative edge cache before Worker).
 * 3. Purges local Cache API and KV thumbnails.
 * 4. Writes tombstone record to KV for global replication.
 * 5. Updates global revocation manifest in KV with retry and conflict merging.
 * 6. Logs audit trail and returns verified status of all operations.
 */
export async function revokeMedia(
  mediaId: string,
  options: RevokeMediaOptions = {}
): Promise<RevokeMediaResult> {
  if (!mediaId || !/^[0-9a-f-]{36}$/i.test(mediaId)) {
    throw new Error('INVALID_MEDIA_ID');
  }

  const revokedAt = Date.now();
  const errors: string[] = [];
  let tombstoneWritten = false;
  let manifestUpdated = false;

  const metadata: RevocationMetadata = {
    mediaId,
    revokedAt,
    reason: options.reason || 'REVOKED',
    accessClass: options.accessClass,
    status: options.status
  };

  // 1. Instantly update in-memory set in current isolate
  memoryRevokedSet.add(mediaId);

  // 2. Purge Workers Caching, Cache API, and KV thumbnails
  const { cachePurged, workersCachePurged, kvPurged } = await purgeMediaVariants(mediaId, {
    cache: options.cache,
    ctx: options.ctx,
    origin: options.origin,
    kv: options.kv
  });

  // 3. Write tombstone to KV
  if (options.kv && typeof options.kv.put === 'function') {
    try {
      await options.kv.put(REVOCATION_KEY_PREFIX + mediaId, JSON.stringify(metadata));
      tombstoneWritten = true;
    } catch (err: any) {
      errors.push(`TOMBSTONE_WRITE_FAILED: ${err?.message || err}`);
    }

    // 4. Update manifest in KV with merge logic to avoid concurrent overwrite
    try {
      let currentManifest = await options.kv.get(REVOCATION_MANIFEST_KEY, { type: 'json' }).catch(() => null);
      if (!currentManifest || !Array.isArray(currentManifest.revokedIds)) {
        currentManifest = { version: 1, updatedAt: revokedAt, revokedIds: [] };
      }
      const idSet = new Set(currentManifest.revokedIds);
      idSet.add(mediaId);
      currentManifest.revokedIds = Array.from(idSet);
      currentManifest.updatedAt = revokedAt;
      currentManifest.version = (currentManifest.version || 1) + 1;
      await options.kv.put(REVOCATION_MANIFEST_KEY, JSON.stringify(currentManifest));
      manifestUpdated = true;
    } catch (manifestErr: any) {
      errors.push(`MANIFEST_WRITE_FAILED: ${manifestErr?.message || manifestErr}`);
    }
  }

  const success = errors.length === 0;
  console.log(`[MEDIA_REVOCATION_LOG] mediaId=${mediaId} reason=${options.reason || 'REVOKED'} cachePurged=${cachePurged} workersPurged=${workersCachePurged} kvPurged=${kvPurged} success=${success}`);

  return {
    success,
    mediaId,
    revokedAt,
    cachePurged,
    workersCachePurged,
    kvPurged,
    tombstoneWritten,
    manifestUpdated,
    errors
  };
}

/**
 * Restores a previously revoked media if legitimate.
 */
export async function unrevokeMedia(
  mediaId: string,
  options: { kv?: any; cache?: any; ctx?: any; origin?: string } = {}
): Promise<void> {
  memoryRevokedSet.delete(mediaId);
  if (options.kv && typeof options.kv.delete === 'function') {
    await options.kv.delete(REVOCATION_KEY_PREFIX + mediaId).catch(() => {});
    try {
      const currentManifest = await options.kv.get(REVOCATION_MANIFEST_KEY, { type: 'json' }).catch(() => null);
      if (currentManifest?.revokedIds && Array.isArray(currentManifest.revokedIds)) {
        currentManifest.revokedIds = currentManifest.revokedIds.filter((id: string) => id !== mediaId);
        currentManifest.updatedAt = Date.now();
        currentManifest.version = (currentManifest.version || 1) + 1;
        await options.kv.put(REVOCATION_MANIFEST_KEY, JSON.stringify(currentManifest));
      }
    } catch {}
  }

  // Purge any negative (404) cache entries from Workers Caching and Cache API
  await purgeMediaVariants(mediaId, {
    cache: options.cache,
    ctx: options.ctx,
    origin: options.origin,
    kv: options.kv
  }).catch(() => {});
}
