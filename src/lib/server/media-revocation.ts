export type RevocationPurgeState =
  | 'PURGE_REQUESTED'
  | 'PURGE_ACCEPTED'
  | 'PURGE_VERIFIED'
  | 'PURGE_LOCAL_VERIFIED'
  | 'PURGE_GLOBAL_DISPATCHED'
  | 'PURGE_GLOBAL_VERIFIED'
  | 'PURGE_FAILED'
  | 'PURGE_SKIPPED';

export type RevocationOverallState =
  | 'REVOCATION_COMPLETED'
  | 'REVOCATION_PARTIAL'
  | 'REVOCATION_FAILED';

export interface RevocationMetadata {
  mediaId: string;
  revokedAt: number;
  reason?: 'DELETED' | 'PRIVATE' | 'STAFF_ONLY' | 'AUTHENTICATED' | 'RESTRICTED' | string;
  accessClass?: string;
  status?: string;
  purgeState?: RevocationPurgeState;
  state?: RevocationOverallState;
  version?: number;
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
  requireGlobalPurge?: boolean;
  globalVerifier?: (mediaId: string) => Promise<boolean>;
}

export interface PurgeMediaOptions {
  cache?: any;
  ctx?: any;
  origin?: string;
  kv?: any;
  requireGlobalPurge?: boolean;
  globalVerifier?: (mediaId: string) => Promise<boolean>;
}

export interface RevokeMediaResult {
  success: boolean;
  state: RevocationOverallState;
  purgeState: RevocationPurgeState;
  mediaId: string;
  revokedAt: number;
  cachePurged: number;
  workersCachePurged: number;
  kvPurged: number;
  tombstoneWritten: boolean;
  manifestUpdated: boolean;
  localPurgeVerified: boolean;
  globalPurgeDispatched: boolean;
  globalPurgeVerified: boolean;
  errors: string[];
}

export interface MediaAccessClassification {
  isPublic: boolean;
  isExplicitlyPrivate: boolean;
  reason: string;
  category: 'PUBLIC' | 'PRIVATE' | 'STAFF_ONLY' | 'AUTHENTICATED' | 'RESTRICTED' | 'DELETED' | 'INTERNAL' | 'INVALID';
}

/**
 * Authoritative classification of media visibility and public CDN cache eligibility.
 * Evaluates the full matrix: PUBLIC, PRIVATE, STAFF_ONLY, AUTHENTICATED, RESTRICTED, DELETED,
 * internal purposes, draft status, and legacy records without access_class.
 * Conservative / fail-closed: if metadata is incomplete, unknown, or inconsistent, access is denied.
 */
export function classifyMediaAccess(media: any): MediaAccessClassification {
  if (!media || typeof media !== 'object') {
    return { isPublic: false, isExplicitlyPrivate: false, reason: 'METADATA_MISSING', category: 'INVALID' };
  }

  // 1. Storage and deletion guards (highest precedence)
  if (media.status === 'DELETED') {
    return { isPublic: false, isExplicitlyPrivate: true, reason: 'STATUS_DELETED', category: 'DELETED' };
  }
  if (media.storage_ready !== true) {
    return { isPublic: false, isExplicitlyPrivate: false, reason: 'STORAGE_NOT_READY', category: 'INVALID' };
  }
  if (!media.status || media.status !== 'ACTIVE') {
    return { isPublic: false, isExplicitlyPrivate: false, reason: media.status ? `INACTIVE_STATUS_${media.status}` : 'STATUS_MISSING', category: 'INVALID' };
  }

  // 2. Explicit access classes
  const accessClass = typeof media.access_class === 'string' ? media.access_class.toUpperCase().trim() : '';

  if (accessClass === 'PRIVATE') {
    return { isPublic: false, isExplicitlyPrivate: true, reason: 'ACCESS_CLASS_PRIVATE', category: 'PRIVATE' };
  }
  if (accessClass === 'STAFF_ONLY') {
    return { isPublic: false, isExplicitlyPrivate: true, reason: 'ACCESS_CLASS_STAFF_ONLY', category: 'STAFF_ONLY' };
  }
  if (accessClass === 'AUTHENTICATED') {
    return { isPublic: false, isExplicitlyPrivate: true, reason: 'ACCESS_CLASS_AUTHENTICATED', category: 'AUTHENTICATED' };
  }
  if (accessClass === 'RESTRICTED') {
    return { isPublic: false, isExplicitlyPrivate: true, reason: 'ACCESS_CLASS_RESTRICTED', category: 'RESTRICTED' };
  }

  // 3. Internal purposes (never eligible for public CDN caching)
  const purpose = typeof media.purpose === 'string' ? media.purpose.toLowerCase().trim() : '';
  const isInternalPurpose =
    purpose === 'staff_manual' ||
    purpose === 'pipeline' ||
    purpose === 'scan_pipeline' ||
    purpose === 'production' ||
    purpose === 'staging' ||
    purpose === 'internal_test' ||
    purpose === 'temp';

  if (isInternalPurpose) {
    return { isPublic: false, isExplicitlyPrivate: true, reason: `INTERNAL_PURPOSE_${purpose}`, category: 'INTERNAL' };
  }

  // 4. Public access confirmation
  if (accessClass === 'PUBLIC') {
    return { isPublic: true, isExplicitlyPrivate: false, reason: 'ACCESS_CLASS_PUBLIC', category: 'PUBLIC' };
  }

  // 5. Legacy records without access_class: conservative allowlist
  // ONLY explicitly allowed public purposes with active status and storage_ready=true are accepted as public.
  const allowedLegacyPublicPurposes = new Set([
    'editorial',
    'staff_chapter',
    'scan_chapter',
    'chapter_page',
    'cover',
    'work_cover',
    'avatar',
    'banner',
    'scan_logo',
    'scan_banner',
    'cosmetic'
  ]);

  if (!accessClass && allowedLegacyPublicPurposes.has(purpose)) {
    return { isPublic: true, isExplicitlyPrivate: false, reason: `LEGACY_PUBLIC_PURPOSE_${purpose}`, category: 'PUBLIC' };
  }

  // 6. Unknown, incomplete, or unverified state fails closed
  return { isPublic: false, isExplicitlyPrivate: false, reason: 'METADATA_INSUFFICIENT_FOR_PUBLIC', category: 'INVALID' };
}

export const REVOCATION_MANIFEST_KEY = 'media-revocation-manifest:v1';
export const REVOCATION_KEY_PREFIX = 'revoked:v1:';
const isVitest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);
export const REVOCATION_SYNC_INTERVAL_MS = isVitest ? 0 : 10000;

let memoryRevokedSet = new Set<string>();
let lastManifestSync = 0;
let manifestSuccessfullyLoaded = false;

let manifestSyncPromise: Promise<boolean> | null = null;

export function clearMemoryRevocationCache(): void {
  memoryRevokedSet.clear();
  lastManifestSync = 0;
  manifestSuccessfullyLoaded = false;
  manifestSyncPromise = null;
}

export function populateMemoryRevocationCache(ids: string[]): void {
  for (const id of ids) {
    memoryRevokedSet.add(id);
  }
}

export function getMemoryRevocationSet(): Set<string> {
  return new Set(memoryRevokedSet);
}

async function syncManifest(kv: any): Promise<boolean> {
  if (manifestSyncPromise) {
    return manifestSyncPromise;
  }

  manifestSyncPromise = (async () => {
    lastManifestSync = Date.now();
    try {
      const manifest = await kv.get(REVOCATION_MANIFEST_KEY, { type: 'json' });
      if (manifest && Array.isArray(manifest.revokedIds)) {
        const snapshotBeforeSync = new Set(memoryRevokedSet);
        const newSet = new Set<string>(manifest.revokedIds);
        // Reconcile removed IDs against tombstones before discarding to protect against stale KV read replicas
        for (const knownId of snapshotBeforeSync) {
          if (!newSet.has(knownId)) {
            try {
              const tombstone = await kv.get(REVOCATION_KEY_PREFIX + knownId);
              if (tombstone) {
                newSet.add(knownId);
              }
            } catch {
              // Fail closed on error: preserve known revocation
              newSet.add(knownId);
            }
          }
        }
        // Merge any new revocations learned while reconciliation was in flight
        for (const id of memoryRevokedSet) {
          if (!snapshotBeforeSync.has(id)) {
            newSet.add(id);
          }
        }
        memoryRevokedSet = newSet;
        manifestSuccessfullyLoaded = true;
        return true;
      } else if (manifest === null || manifest === undefined) {
        // Manifest does not exist yet (clean slate) - no I/O error, but tombstone check needed if key exists
        manifestSuccessfullyLoaded = false;
        return true;
      } else {
        manifestSuccessfullyLoaded = false;
        return false;
      }
    } catch {
      manifestSuccessfullyLoaded = false;
      return false;
    }
  })().finally(() => {
    manifestSyncPromise = null;
  });

  return manifestSyncPromise;
}

/**
 * Check whether a media ID is revoked across edge isolates and datacenters.
 * Tier 1: Instant in-memory check (0ms, 0 KV reads).
 * Tier 2: Authoritative tombstone check when explicitly requested, forced fresh, or on MISS path.
 * Tier 3: Periodic manifest sync from KV (shared state, 1 read per interval per isolate).
 * Fail-Closed: When failClosed=true, if KV is absent or fails to verify status on a cached item,
 * returns true (revoked) so caller bypasses fast cache and validates against authoritative DB.
 */
export async function isMediaRevoked(
  mediaId: string,
  kv?: any,
  options?: { forceFresh?: boolean; checkTombstone?: boolean; failClosed?: boolean }
): Promise<boolean> {
  if (!mediaId || typeof mediaId !== 'string') return false;

  // 1. Instant in-memory check (only if caller did not explicitly request fresh sync or authoritative tombstone)
  if (!options?.checkTombstone && !options?.forceFresh && memoryRevokedSet.has(mediaId)) {
    return true;
  }

  // 2. If KV is absent, check known in-memory revocations first, then fall back to failClosed policy
  if (!kv) {
    if (memoryRevokedSet.has(mediaId)) return true;
    return Boolean(options?.failClosed);
  }

  const isTest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);
  const now = Date.now();
  const shouldSyncManifest = options?.forceFresh || isTest || !manifestSuccessfullyLoaded || (now - lastManifestSync > REVOCATION_SYNC_INTERVAL_MS);

  if (shouldSyncManifest) {
    const loaded = await syncManifest(kv);
    if (!loaded && options?.failClosed && !manifestSuccessfullyLoaded) {
      return true;
    }
  }

  // 3. Authoritative tombstone check: if explicitly requested
  if (options?.checkTombstone) {
    try {
      const tombstone = await kv.get(REVOCATION_KEY_PREFIX + mediaId);
      if (tombstone) {
        memoryRevokedSet.add(mediaId);
        return true;
      } else {
        // A stale negative tombstone read from an eventually-consistent KV replica
        // cannot override a positive revocation already verified by manifest/in-memory
        if (memoryRevokedSet.has(mediaId)) {
          return true;
        }
        return false;
      }
    } catch {
      if (options?.failClosed) return true;
    }
  }

  // 4. In-memory set check after sync (0ms, 0 KV reads)
  if (memoryRevokedSet.has(mediaId)) {
    return true;
  }

  // 5. Fallback tombstone check if manifest failed to load reliably from KV
  if (!manifestSuccessfullyLoaded) {
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
): Promise<{ cachePurged: number; workersCachePurged: number; kvPurged: number; localPurgeVerified: boolean; globalPurgeDispatched: boolean; globalPurgeVerified: boolean; errors: string[] }> {
  const { cache, ctx, origin = 'https://projectnox.org', kv, currentUrl } = options;
  const errors: string[] = [];
  let cachePurged = 0;
  let workersCachePurged = 0;
  let kvPurged = 0;
  let localPurgeVerified = false;
  let globalPurgeDispatched = false;
  let globalPurgeVerified = false;

  // 1. Purge Cloudflare Workers Caching (declarative edge cache before Worker)
  // Supports ctx.cache.purge, cache.purge from cloudflare:workers, or passed purge hook
  const tagToPurge = `media-${mediaId}`;
  const prefixToPurge = `/media/${mediaId}`;
  try {
    let purgePromise: Promise<any> | null = null;
    if (ctx?.cache && typeof ctx.cache.purge === 'function') {
      purgePromise = ctx.cache.purge({ tags: [tagToPurge], pathPrefixes: [prefixToPurge] });
    } else if (cache && typeof cache.purge === 'function') {
      purgePromise = cache.purge({ tags: [tagToPurge], pathPrefixes: [prefixToPurge] });
    } else {
      // Attempt dynamic import in runtime environments supporting cloudflare:workers
      const cw = await import('cloudflare:workers').catch(() => null);
      if (cw?.cache && typeof cw.cache.purge === 'function') {
        purgePromise = cw.cache.purge({ tags: [tagToPurge], pathPrefixes: [prefixToPurge] });
      }
    }

    if (purgePromise) {
      const purgeRes = await purgePromise;
      if (purgeRes && typeof purgeRes === 'object' && purgeRes.success === false) {
        const errorMsgs = Array.isArray(purgeRes.errors)
          ? purgeRes.errors.map((e: any) => e.message || String(e)).join('; ')
          : 'Workers cache purge returned unsuccessful';
        errors.push(`WORKERS_CACHE_PURGE_ERROR: ${errorMsgs}`);
      } else {
        workersCachePurged++;
        globalPurgeDispatched = true;
      }
    }
  } catch (err: any) {
    errors.push(`WORKERS_CACHE_PURGE_FAILED: ${err?.message || err}`);
  }

  // 2. Purge all variants from Cache API (caches.default)
  if (cache && typeof cache.delete === 'function') {
    const originsToPurge = new Set([origin]);
    if (origin !== 'https://projectnox.org') {
      originsToPurge.add('https://projectnox.org');
    }
    originsToPurge.add('https://www.projectnox.org');

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

    const deleteResults = await Promise.allSettled(
      urlsToPurge.map(async (url) => {
        try {
          const deleted = await cache.delete(new Request(url, { method: 'GET' }));
          if (deleted) cachePurged++;
        } catch (err: any) {
          throw new Error(`CACHE_API_DELETE_FAILED for ${url}: ${err?.message || err}`);
        }
      })
    );
    for (const dr of deleteResults) {
      if (dr.status === 'rejected') {
        errors.push(dr.reason?.message || 'CACHE_DELETE_REJECTED');
      }
    }

    // Verify local purge
    if (typeof cache.match === 'function') {
      try {
        const stillCached = await cache.match(`${origin}/media/${mediaId}`);
        if (!stillCached) {
          localPurgeVerified = true;
        }
      } catch {
        // Keep unverified
      }
    }
  }

  // 3. Purge from KV COVER_THUMBNAILS
  if (kv && typeof kv.delete === 'function') {
    const kvKeysToPurge = [
      `cover-thumb:v1:${mediaId}`,
      `cover-hero:v1:${mediaId}`,
      `cover-thumb:v1:${mediaId}:warm`,
      `cover-hero:v1:${mediaId}:warm`
    ];

    const kvResults = await Promise.allSettled(
      kvKeysToPurge.map(async (key) => {
        try {
          await kv.delete(key);
          kvPurged++;
        } catch (err: any) {
          throw new Error(`KV_DELETE_FAILED for ${key}: ${err?.message || err}`);
        }
      })
    );
    for (const kr of kvResults) {
      if (kr.status === 'rejected') {
        errors.push(kr.reason?.message || 'KV_DELETE_REJECTED');
      }
    }
  }

  // 4. Global purge verifier (if custom verifier provided)
  if (options.globalVerifier && typeof options.globalVerifier === 'function') {
    try {
      globalPurgeVerified = await options.globalVerifier(mediaId);
    } catch (err: any) {
      errors.push(`GLOBAL_VERIFIER_FAILED: ${err?.message || err}`);
    }
  }

  return { cachePurged, workersCachePurged, kvPurged, localPurgeVerified, globalPurgeDispatched, globalPurgeVerified, errors };
}

/**
 * Canonical media revocation function.
 * Protocol:
 * 1. Instantly updates in-memory set in local isolate (0ms local protection).
 * 2. Writes authoritative persistent tombstone record to KV (establishes durable revocation state BEFORE purge).
 * 3. Updates global revocation manifest in KV with retry and conflict-free set union.
 * 4. Purges Cloudflare Workers Caching (via ctx.cache.purge by tag and prefix).
 * 5. Purges local Cache API and KV thumbnails.
 * 6. Determines and registers distinct states: PURGE_REQUESTED, PURGE_ACCEPTED, PURGE_VERIFIED, REVOCATION_COMPLETED.
 * 7. Updates tombstone with verified purge state and returns structured result.
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
  let purgeState: RevocationPurgeState = 'PURGE_REQUESTED';

  // 1. Instantly update in-memory set in current isolate
  memoryRevokedSet.add(mediaId);

  // 2. Write authoritative tombstone to KV BEFORE purge to ensure durable revocation
  const initialMetadata: RevocationMetadata = {
    mediaId,
    revokedAt,
    reason: options.reason || 'REVOKED',
    accessClass: options.accessClass,
    status: options.status,
    purgeState: 'PURGE_REQUESTED',
    state: 'REVOCATION_PARTIAL',
    version: 1
  };

  if (!options.kv || typeof options.kv.put !== 'function') {
    errors.push('KV_BINDING_MISSING: Persistent KV binding is required for media revocation guarantees');
  } else {
    try {
      await options.kv.put(REVOCATION_KEY_PREFIX + mediaId, JSON.stringify(initialMetadata));
      tombstoneWritten = true;
    } catch (err: any) {
      errors.push(`TOMBSTONE_WRITE_FAILED: ${err?.message || err}`);
    }

    // 3. Update manifest in KV with request-scoped retry, RAWV and conflict-free set union
    let manifestWriteAttempts = 0;
    const MAX_MANIFEST_ATTEMPTS = 5;
    while (manifestWriteAttempts < MAX_MANIFEST_ATTEMPTS && !manifestUpdated) {
      manifestWriteAttempts++;
      try {
        let currentManifest = await options.kv.get(REVOCATION_MANIFEST_KEY, { type: 'json' }).catch(() => null);
        if (!currentManifest || !Array.isArray(currentManifest.revokedIds)) {
          currentManifest = { version: 1, updatedAt: revokedAt, revokedIds: [] };
        }
        const idSet = new Set<string>([
          ...currentManifest.revokedIds,
          mediaId
        ]);
        const nextVersion = (Number(currentManifest.version) || 1) + 1;
        const nextManifest = {
          version: nextVersion,
          updatedAt: Date.now(),
          revokedIds: Array.from(idSet)
        };
        await options.kv.put(REVOCATION_MANIFEST_KEY, JSON.stringify(nextManifest));

        // Read-After-Write Verification (RAWV): confirm our write was not overwritten concurrently
        const verified = await options.kv.get(REVOCATION_MANIFEST_KEY, { type: 'json' }).catch(() => null);
        if (verified?.revokedIds && Array.isArray(verified.revokedIds) && verified.revokedIds.includes(mediaId)) {
          manifestUpdated = true;
          for (const id of verified.revokedIds) {
            memoryRevokedSet.add(id);
          }
        } else {
          // Concurrent overwrite detected — back off with randomized jitter and retry union merge
          const jitterMs = 10 * manifestWriteAttempts + Math.floor(Math.random() * 20);
          await new Promise((r) => setTimeout(r, jitterMs));
        }
      } catch (manifestErr: any) {
        if (manifestWriteAttempts >= MAX_MANIFEST_ATTEMPTS) {
          errors.push(`MANIFEST_WRITE_FAILED: ${manifestErr?.message || manifestErr}`);
        }
      }
    }

    if (!manifestUpdated) {
      errors.push(`MANIFEST_VERIFICATION_FAILED: Manifest write verification exhausted ${MAX_MANIFEST_ATTEMPTS} attempts without confirming mediaId persistence in shared manifest`);
    }
  }

  // 4. Purge Workers Caching, Cache API, and KV thumbnails
  const purgeResult = await purgeMediaVariants(mediaId, {
    cache: options.cache,
    ctx: options.ctx,
    origin: options.origin,
    kv: options.kv,
    requireGlobalPurge: options.requireGlobalPurge,
    globalVerifier: options.globalVerifier
  });
  const { cachePurged, workersCachePurged, kvPurged, localPurgeVerified, globalPurgeDispatched, globalPurgeVerified } = purgeResult;
  if (purgeResult.errors && purgeResult.errors.length > 0) {
    errors.push(...purgeResult.errors);
    purgeState = 'PURGE_FAILED';
  } else {
    purgeState = localPurgeVerified ? 'PURGE_VERIFIED' : 'PURGE_ACCEPTED';
  }

  // 5. Determine overall revocation state
  // Strict rule: Persistence in both KV tombstone and manifest is mandatory for REVOCATION_COMPLETED.
  // Absence or failure of KV can never return REVOCATION_COMPLETED.
  let overallState: RevocationOverallState = 'REVOCATION_FAILED';
  const persistenceGuaranteed = Boolean(tombstoneWritten && manifestUpdated);
  const purgeGuaranteed = (purgeState === 'PURGE_ACCEPTED' || purgeState === 'PURGE_VERIFIED' || purgeState === 'PURGE_LOCAL_VERIFIED');

  if (persistenceGuaranteed && purgeGuaranteed && errors.length === 0) {
    if (options.requireGlobalPurge && !globalPurgeVerified) {
      overallState = 'REVOCATION_PARTIAL';
      errors.push('GLOBAL_PURGE_UNVERIFIABLE: Local PoP cache purged, but global CDN edge invalidation cannot be proven synchronously; security preserved via authoritative KV tombstone and fail-closed checks');
    } else {
      overallState = 'REVOCATION_COMPLETED';
    }
  } else if (tombstoneWritten || memoryRevokedSet.has(mediaId)) {
    overallState = 'REVOCATION_PARTIAL';
  } else {
    overallState = 'REVOCATION_FAILED';
  }

  // 6. Update tombstone with final purge state
  if (tombstoneWritten && options.kv && typeof options.kv.put === 'function') {
    try {
      const finalMetadata: RevocationMetadata = {
        ...initialMetadata,
        purgeState,
        state: overallState,
        version: 2
      };
      await options.kv.put(REVOCATION_KEY_PREFIX + mediaId, JSON.stringify(finalMetadata));
    } catch {
      // Non-fatal if initial tombstone is already recorded
    }
  }

  const success = errors.length === 0 && overallState === 'REVOCATION_COMPLETED';
  console.log(`[MEDIA_REVOCATION_LOG] mediaId=${mediaId} state=${overallState} purgeState=${purgeState} reason=${options.reason || 'REVOKED'} cachePurged=${cachePurged} workersPurged=${workersCachePurged} kvPurged=${kvPurged} success=${success}`);

  return {
    success,
    state: overallState,
    purgeState,
    mediaId,
    revokedAt,
    cachePurged,
    workersCachePurged,
    kvPurged,
    tombstoneWritten,
    manifestUpdated,
    localPurgeVerified,
    globalPurgeDispatched,
    globalPurgeVerified,
    errors
  };
}

/**
 * Restores a previously revoked media if legitimate.
 */
export async function unrevokeMedia(
  mediaId: string,
  options: { kv?: any; cache?: any; ctx?: any; origin?: string } = {}
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  memoryRevokedSet.delete(mediaId);
  if (options.kv && typeof options.kv.delete === 'function') {
    try {
      await options.kv.delete(REVOCATION_KEY_PREFIX + mediaId);
    } catch (err: any) {
      errors.push(`TOMBSTONE_DELETE_FAILED: ${err?.message || err}`);
    }
    try {
      const currentManifest = await options.kv.get(REVOCATION_MANIFEST_KEY, { type: 'json' }).catch(() => null);
      if (currentManifest?.revokedIds && Array.isArray(currentManifest.revokedIds)) {
        currentManifest.revokedIds = currentManifest.revokedIds.filter((id: string) => id !== mediaId);
        currentManifest.updatedAt = Date.now();
        currentManifest.version = (Number(currentManifest.version) || 1) + 1;
        await options.kv.put(REVOCATION_MANIFEST_KEY, JSON.stringify(currentManifest));
      }
    } catch (manifestErr: any) {
      errors.push(`MANIFEST_UPDATE_FAILED: ${manifestErr?.message || manifestErr}`);
    }
  }

  // Purge any negative (404) cache entries from Workers Caching and Cache API
  const purgeRes = await purgeMediaVariants(mediaId, {
    cache: options.cache,
    ctx: options.ctx,
    origin: options.origin,
    kv: options.kv
  }).catch((err) => ({ errors: [err?.message || 'PURGE_FAILED'] }));

  if (purgeRes?.errors && purgeRes.errors.length > 0) {
    errors.push(...purgeRes.errors);
  }

  return { success: errors.length === 0, errors };
}
