import { invalidateMediaMetadataCache } from './yugabyte';

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
  requirePurgeDispatch?: boolean;
  allowLocalOnly?: boolean;
  globalVerifier?: (mediaId: string) => Promise<boolean>;
}

export interface PurgeMediaOptions {
  cache?: any;
  ctx?: any;
  origin?: string;
  kv?: any;
  requireGlobalPurge?: boolean;
  requirePurgeDispatch?: boolean;
  allowLocalOnly?: boolean;
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

  // 1.1 Unpublished work and chapter guards (fail closed for unpublished content)
  if (media.work_published === false || media.all_works_published === false) {
    return { isPublic: false, isExplicitlyPrivate: true, reason: 'UNPUBLISHED_WORK', category: 'PRIVATE' };
  }

  // 1.1.0 Orphan cover guard: covers must be associated with at least one published work
  if (
    (media.purpose === 'cover' || media.purpose === 'work_cover') &&
    (media.has_published_association === false || media.has_published_cover === false)
  ) {
    return { isPublic: false, isExplicitlyPrivate: true, reason: 'ORPHAN_OR_UNPUBLISHED_COVER', category: 'PRIVATE' };
  }

  if (
    media.chapter_published === false ||
    media.all_chapters_published === false ||
    media.has_published_chapter === false ||
    media.has_published_association === false ||
    (media.chapter_published_at === null && (media.purpose === 'chapter_page' || media.purpose === 'staff_chapter' || media.purpose === 'scan_chapter'))
  ) {
    return { isPublic: false, isExplicitlyPrivate: true, reason: 'UNPUBLISHED_CHAPTER', category: 'PRIVATE' };
  }

  // 1.2 Content Rating guards (Adult +18 content is strictly restricted and never public)
  const contentRating = (media.work_content_rating || media.content_rating || '').toString().toUpperCase().trim();
  if (contentRating === 'ADULT_18' || media.is_adult === true || media.is_adult_associated === true) {
    return { isPublic: false, isExplicitlyPrivate: true, reason: 'CONTENT_RATING_ADULT_18', category: 'RESTRICTED' };
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
export const REVOCATION_RESTORATION_KEY_PREFIX = 'restored:v1:';
const isVitest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);
export const REVOCATION_SYNC_INTERVAL_MS = isVitest ? 0 : 10000;

const memoryRevokedSet = new Set<string>();
const knownRevocations = new Map<string, { timestamp: number; version: number; isLegacy?: boolean }>();
const knownRestorations = new Map<string, { timestamp: number; version: number }>();
let lastManifestRevokedSet = new Set<string>();
const inFlightRevocations = new Set<string>();
const locallyInitiatedRevocations = new Set<string>();
let lastManifestSync = 0;
let manifestSuccessfullyLoaded = false;
let manifestKeyPresent = false;
let currentManifestVersion = 0;
let currentManifestUpdatedAt = 0;
let reconciliationCursor = 0;
let manifestSyncGeneration = 0;
const perIdRevocationSeq = new Map<string, number>();
let globalRevocationSeq = 0;

export function clearMemoryRevocationCache(): void {
  memoryRevokedSet.clear();
  knownRevocations.clear();
  knownRestorations.clear();
  lastManifestRevokedSet.clear();
  inFlightRevocations.clear();
  locallyInitiatedRevocations.clear();
  lastManifestSync = 0;
  manifestSuccessfullyLoaded = false;
  manifestKeyPresent = false;
  currentManifestVersion = 0;
  currentManifestUpdatedAt = 0;
  reconciliationCursor = 0;
  manifestSyncGeneration = 0;
  perIdRevocationSeq.clear();
  globalRevocationSeq = 0;
}

export function populateMemoryRevocationCache(ids: string[]): void {
  for (const id of ids) {
    memoryRevokedSet.add(id);
    knownRevocations.set(id, { timestamp: 0, version: 0 });
    perIdRevocationSeq.set(id, ++globalRevocationSeq);
  }
}

export function getMemoryRevocationSet(): Set<string> {
  return new Set(memoryRevokedSet);
}

async function syncManifest(kv: any): Promise<boolean> {
  lastManifestSync = Date.now();
  const syncGen = ++manifestSyncGeneration;
  try {
    const manifest = await kv.get(REVOCATION_MANIFEST_KEY, { type: 'json' });
    if (manifest && Array.isArray(manifest.revokedIds)) {
      const manifestVersion = Number(manifest.version) || 0;
      const manifestUpdatedAt = Number(manifest.updatedAt) || 0;

      // Ordering mechanism valid across concurrent uncoordinated KV writers:
      // A manifest is accepted as newer if its timestamp is advanced, or if timestamps match and version is >=.
      const isNewer = manifestUpdatedAt > currentManifestUpdatedAt ||
        (manifestUpdatedAt === currentManifestUpdatedAt && manifestVersion >= currentManifestVersion);

      if (isNewer) {
        lastManifestRevokedSet = new Set<string>(manifest.revokedIds);
        currentManifestVersion = manifestVersion;
        currentManifestUpdatedAt = manifestUpdatedAt;

        // 1. Add all currently revoked IDs from manifest to isolate memory and record metadata unless superseded by newer restoration
        const revocationsMap = manifest.revocations && typeof manifest.revocations === 'object' ? manifest.revocations : {};
        for (const id of Array.from(lastManifestRevokedSet)) {
          const hasPerIdTs = Object.prototype.hasOwnProperty.call(revocationsMap, id);
          const perIdRevocationTs = hasPerIdTs ? Number(revocationsMap[id]) || 0 : 0;
          const isLegacy = !hasPerIdTs;
          const restoration = knownRestorations.get(id);
          const existing = knownRevocations.get(id);
          // For legacy entries without per-ID timestamps, do NOT invent manifestUpdatedAt as their revocation timestamp.
          // Unrelated manifest writes must not advance the revocation timestamp of legacy entries past authentic restorations.

          if (restoration) {
            const isManifestOlderThanRestoration = manifestUpdatedAt < restoration.timestamp ||
              (manifestUpdatedAt === restoration.timestamp && manifestVersion <= restoration.version);

            if (isLegacy) {
              // Ambiguous legacy revocation:
              // Only discard if there is positive evidence that the manifest entry itself predates the restoration.
              // If the manifest was updated after the restoration, preserve the revocation (fail-closed)
              // even if an eventually consistent KV replica still returns an old tombstone from before the restoration.
              if (isManifestOlderThanRestoration) {
                lastManifestRevokedSet.delete(id);
                continue;
              }

              // Manifest was updated at or after restoration: preserve the revocation!
              memoryRevokedSet.add(id);
              let tombstoneFound = false;
              let tombstoneTs = 0;
              try {
                const tombstone = await kv.get(REVOCATION_KEY_PREFIX + id);
                if (tombstone) {
                  tombstoneFound = true;
                  tombstoneTs = Date.now();
                  try {
                    const parsed = typeof tombstone === 'string' ? JSON.parse(tombstone) : tombstone;
                    if (parsed?.revokedAt) tombstoneTs = Number(parsed.revokedAt);
                    else if (parsed?.timestamp) tombstoneTs = Number(parsed.timestamp);
                    else if (typeof parsed === 'number') tombstoneTs = parsed;
                  } catch {
                    // Ignore malformed tombstone JSON
                  }
                }
              } catch {
                // Ignore KV read error
              }

              const effectiveTs = (tombstoneFound && tombstoneTs >= restoration.timestamp)
                ? tombstoneTs
                : (existing?.timestamp || manifestUpdatedAt);
              if (!existing || effectiveTs > existing.timestamp) {
                knownRevocations.set(id, { timestamp: effectiveTs, version: manifestVersion, isLegacy: !tombstoneFound });
              }
              perIdRevocationSeq.set(id, ++globalRevocationSeq);
              knownRestorations.delete(id);
              continue;
            } else if (perIdRevocationTs < restoration.timestamp || (perIdRevocationTs === restoration.timestamp && manifestVersion <= restoration.version)) {
              lastManifestRevokedSet.delete(id);
              continue; // ID was restored; skip
            }
          }
          memoryRevokedSet.add(id);
          if (!existing) {
            knownRevocations.set(id, { timestamp: perIdRevocationTs || manifestUpdatedAt, version: manifestVersion, isLegacy });
          } else if (hasPerIdTs && perIdRevocationTs > existing.timestamp) {
            knownRevocations.set(id, { timestamp: perIdRevocationTs, version: manifestVersion, isLegacy: false });
          }
          perIdRevocationSeq.set(id, ++globalRevocationSeq);
          knownRestorations.delete(id);
        }

        // 2. Explicit positive restorations: process with bounded concurrency and verify tombstones only for relevant IDs
        if (Array.isArray(manifest.restoredIds)) {
          const restorationsMap = manifest.restorations && typeof manifest.restorations === 'object' ? manifest.restorations : {};
          const candidateRestorations: string[] = [];

          for (const restoredId of manifest.restoredIds) {
            if (lastManifestRevokedSet.has(restoredId) || inFlightRevocations.has(restoredId)) {
              continue;
            }
            const perIdRestorationTs = Number(restorationsMap[restoredId]) || manifestUpdatedAt;
            const known = knownRevocations.get(restoredId);
            if (known && (perIdRestorationTs < known.timestamp || (perIdRestorationTs === known.timestamp && manifestVersion <= known.version))) {
              continue; // A newer revocation exists in memory; do not unrevoke
            }

            // Optimization (P2): if this isolate has never seen this ID in memory or known revocations,
            // avoid serial KV reads on cache hits; simply record restoration metadata directly.
            if (!memoryRevokedSet.has(restoredId) && !knownRevocations.has(restoredId)) {
              const existingRest = knownRestorations.get(restoredId);
              if (!existingRest || perIdRestorationTs > existingRest.timestamp || (perIdRestorationTs === existingRest.timestamp && manifestVersion >= existingRest.version)) {
                knownRestorations.set(restoredId, { timestamp: perIdRestorationTs, version: manifestVersion });
              }
              continue;
            }

            candidateRestorations.push(restoredId);
          }

          // Process candidate restorations in bounded batches of 10
          const RESTORATION_BATCH_SIZE = 10;
          for (let i = 0; i < candidateRestorations.length; i += RESTORATION_BATCH_SIZE) {
            const batch = candidateRestorations.slice(i, i + RESTORATION_BATCH_SIZE);
            await Promise.allSettled(
              batch.map(async (restoredId) => {
                const perIdRestorationTs = Number(restorationsMap[restoredId]) || manifestUpdatedAt;
                const knownBefore = knownRevocations.get(restoredId);
                const startSeq = perIdRevocationSeq.get(restoredId) || 0;
                try {
                  const tombstone = await kv.get(REVOCATION_KEY_PREFIX + restoredId);
                  if (tombstone) {
                    let tombstoneTs = Date.now();
                    try {
                      const parsed = typeof tombstone === 'string' ? JSON.parse(tombstone) : tombstone;
                      if (parsed?.revokedAt) tombstoneTs = Number(parsed.revokedAt);
                    } catch {
                      // Ignore malformed tombstone JSON
                    }
                    // Compare against per-ID restoration timestamp instead of manifestUpdatedAt
                    if (tombstoneTs >= perIdRestorationTs) {
                      // Newer or concurrent tombstone exists: keep revoked!
                      memoryRevokedSet.add(restoredId);
                      const existing = knownRevocations.get(restoredId);
                      if (!existing || tombstoneTs > existing.timestamp || (tombstoneTs === existing.timestamp && manifestVersion >= existing.version)) {
                        knownRevocations.set(restoredId, { timestamp: tombstoneTs, version: manifestVersion });
                      }
                      perIdRevocationSeq.set(restoredId, ++globalRevocationSeq);
                      knownRestorations.delete(restoredId);
                      return;
                    }
                  }
                } catch {
                  // Fail closed: do not unrevoke on KV read error
                  return;
                }

                // Race Condition Guard (P1): Revalidate state after the await
                if (
                  manifestSyncGeneration !== syncGen ||
                  inFlightRevocations.has(restoredId) ||
                  lastManifestRevokedSet.has(restoredId) ||
                  (perIdRevocationSeq.get(restoredId) || 0) !== startSeq
                ) {
                  return;
                }
                const curKnown = knownRevocations.get(restoredId);
                if (curKnown && (!knownBefore || curKnown !== knownBefore || curKnown.timestamp > perIdRestorationTs)) {
                  return;
                }

                locallyInitiatedRevocations.delete(restoredId);
                memoryRevokedSet.delete(restoredId);
                knownRevocations.delete(restoredId);
                const existingRest = knownRestorations.get(restoredId);
                if (!existingRest || perIdRestorationTs > existingRest.timestamp || (perIdRestorationTs === existingRest.timestamp && manifestVersion >= existingRest.version)) {
                  knownRestorations.set(restoredId, { timestamp: perIdRestorationTs, version: manifestVersion });
                }
              })
            );
          }
        }

        // 3. Reconcile IDs: check missing IDs against tombstones with bounded concurrency (max 10)
        // Rotating cursor prevents starvation when early omitted IDs still have tombstones.
        // Explicit restorations in restoredIds are already handled in step 2.
        const restoredIdsSet = new Set<string>(Array.isArray(manifest.restoredIds) ? manifest.restoredIds : []);
        const missingIds = Array.from(memoryRevokedSet).filter((id) => {
          if (lastManifestRevokedSet.has(id) || inFlightRevocations.has(id) || restoredIdsSet.has(id)) {
            return false;
          }
          const known = knownRevocations.get(id);
          if (known && (manifestUpdatedAt < known.timestamp || (manifestUpdatedAt === known.timestamp && manifestVersion <= known.version))) {
            return false;
          }
          return true;
        });

        if (missingIds.length > 0) {
          if (reconciliationCursor >= missingIds.length) {
            reconciliationCursor = 0;
          }
          const batchSize = Math.min(10, missingIds.length);
          const batch: string[] = [];
          for (let i = 0; i < batchSize; i++) {
            batch.push(missingIds[(reconciliationCursor + i) % missingIds.length]);
          }
          reconciliationCursor = (reconciliationCursor + batchSize) % missingIds.length;

          await Promise.allSettled(
            batch.map(async (knownId) => {
              const startSeq = perIdRevocationSeq.get(knownId) || 0;
              try {
                const tombstone = await kv.get(REVOCATION_KEY_PREFIX + knownId);
                if (tombstone) {
                  let tombstoneTs = Date.now();
                  try {
                    const parsed = typeof tombstone === 'string' ? JSON.parse(tombstone) : tombstone;
                    if (parsed?.revokedAt) tombstoneTs = Number(parsed.revokedAt);
                  } catch {
                    // Ignore malformed tombstone JSON
                  }
                  const existing = knownRevocations.get(knownId);
                  if (!existing || tombstoneTs > existing.timestamp || (tombstoneTs === existing.timestamp && currentManifestVersion >= existing.version)) {
                    knownRevocations.set(knownId, { timestamp: tombstoneTs, version: currentManifestVersion });
                  }
                  memoryRevokedSet.add(knownId);
                  perIdRevocationSeq.set(knownId, ++globalRevocationSeq);
                  return;
                }

                // Tombstone is null: negative KV read alone is NOT sufficient proof of restoration
                const known = knownRevocations.get(knownId);
                let canRestore = false;
                let hasActualRestorationEvidence = false;
                let restorationTs = manifestUpdatedAt;
                let restorationVer = manifestVersion;

                if ((known && known.timestamp > 0) || locallyInitiatedRevocations.has(knownId)) {
                  const knownTs = Number(known?.timestamp) || 0;
                  const knownVer = Number(known?.version) || 0;
                  const knownRest = knownRestorations.get(knownId);
                  if (knownRest && ((knownTs === 0 && knownVer === 0) || knownRest.timestamp > knownTs || (knownRest.timestamp === knownTs && knownRest.version >= knownVer))) {
                    canRestore = true;
                    hasActualRestorationEvidence = true;
                    restorationTs = knownRest.timestamp;
                    restorationVer = knownRest.version;
                  } else {
                    try {
                      const resRecord = await kv.get(REVOCATION_RESTORATION_KEY_PREFIX + knownId, { type: 'json' });
                      if (resRecord) {
                        const recTs = Number(resRecord.restoredAt || resRecord.timestamp) || 0;
                        const recVer = Number(resRecord.version) || 0;
                        if ((knownTs === 0 && knownVer === 0) || recTs > knownTs || (recTs === knownTs && recVer >= knownVer)) {
                          canRestore = true;
                          hasActualRestorationEvidence = true;
                          restorationTs = recTs;
                          restorationVer = recVer;
                        }
                      }
                    } catch {
                      // Ignore restoration record read error
                    }
                  }
                } else if (!known || known.timestamp === 0) {
                  canRestore = true;
                }

                if (
                  canRestore &&
                  !inFlightRevocations.has(knownId) &&
                  manifestSyncGeneration === syncGen &&
                  !lastManifestRevokedSet.has(knownId) &&
                  (perIdRevocationSeq.get(knownId) || 0) === startSeq
                ) {
                  locallyInitiatedRevocations.delete(knownId);
                  memoryRevokedSet.delete(knownId);
                  knownRevocations.delete(knownId);
                  if (hasActualRestorationEvidence) {
                    knownRestorations.set(knownId, { timestamp: restorationTs, version: restorationVer });
                  }
                }
              } catch {
                // Fail closed: preserve known revocation on KV error
              }
            })
          );
        } else {
          reconciliationCursor = 0;
        }
      } else {
        // Manifest is older than our known version/timestamp - only merge IDs that have NOT been superseded by known restorations
        const olderRevocationsMap = manifest.revocations && typeof manifest.revocations === 'object' ? manifest.revocations : {};
        for (const id of (Array.from(manifest.revokedIds) as string[])) {
          const hasPerIdTs = Object.prototype.hasOwnProperty.call(olderRevocationsMap, id);
          const perIdRevocationTs = hasPerIdTs ? Number(olderRevocationsMap[id]) || 0 : 0;
          const isLegacy = !hasPerIdTs;
          const existing = knownRevocations.get(id);
          const effectiveRevocationTs = perIdRevocationTs || (existing && !existing.isLegacy ? existing.timestamp : 0);
          const restoration = knownRestorations.get(id);
          if (restoration) {
            if (isLegacy || effectiveRevocationTs < restoration.timestamp || (effectiveRevocationTs === restoration.timestamp && manifestVersion <= restoration.version)) {
              continue; // Skip! ID was restored after this older manifest was written
            }
          }
          memoryRevokedSet.add(id);
          lastManifestRevokedSet.add(id);
          if (!existing) {
            knownRevocations.set(id, { timestamp: perIdRevocationTs || manifestUpdatedAt, version: manifestVersion, isLegacy });
          } else if (hasPerIdTs && perIdRevocationTs > existing.timestamp) {
            knownRevocations.set(id, { timestamp: perIdRevocationTs, version: manifestVersion, isLegacy: false });
          }
        }
      }

      manifestSuccessfullyLoaded = true;
      manifestKeyPresent = true;
      return true;
    } else if (manifest === null || manifest === undefined) {
      lastManifestRevokedSet = new Set<string>();
      manifestSuccessfullyLoaded = true;
      manifestKeyPresent = false;
      return true;
    } else {
      manifestSuccessfullyLoaded = false;
      manifestKeyPresent = false;
      return false;
    }
  } catch {
    manifestSuccessfullyLoaded = false;
    manifestKeyPresent = false;
    return false;
  }
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

  // 0. In-flight revocation guard: always block in-flight revocations immediately
  if (inFlightRevocations.has(mediaId)) {
    return true;
  }

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

  // 3. Authoritative tombstone check: if explicitly requested, forced fresh, manifest absent, or manifest failed to load
  const shouldCheckTombstone =
    Boolean(options?.forceFresh) ||
    Boolean(options?.checkTombstone) ||
    !manifestKeyPresent ||
    !manifestSuccessfullyLoaded;

  if (shouldCheckTombstone) {
    try {
      const tombstone = await kv.get(REVOCATION_KEY_PREFIX + mediaId);
      if (tombstone) {
        let tombstoneTs = Date.now();
        try {
          const parsed = typeof tombstone === 'string' ? JSON.parse(tombstone) : tombstone;
          if (parsed?.revokedAt) tombstoneTs = Number(parsed.revokedAt);
        } catch {
          // Ignore malformed tombstone JSON
        }

        let isStaleTombstone = false;
        let restorationTs = 0;
        let restorationVer = 0;
        const knownRest = knownRestorations.get(mediaId);
        if (knownRest && knownRest.timestamp > tombstoneTs) {
          isStaleTombstone = true;
          restorationTs = knownRest.timestamp;
          restorationVer = knownRest.version;
        } else {
          try {
            const resRecord = await kv.get(REVOCATION_RESTORATION_KEY_PREFIX + mediaId, { type: 'json' });
            if (resRecord) {
              const recTs = Number(resRecord.restoredAt || resRecord.timestamp) || 0;
              const recVer = Number(resRecord.version) || 0;
              if (recTs > tombstoneTs) {
                isStaleTombstone = true;
                restorationTs = recTs;
                restorationVer = recVer;
                knownRestorations.set(mediaId, { timestamp: recTs, version: recVer });
              }
            }
          } catch {
            // Ignore restoration record read error
          }
        }

        if (!isStaleTombstone) {
          memoryRevokedSet.add(mediaId);
          const existing = knownRevocations.get(mediaId);
          if (!existing || tombstoneTs > existing.timestamp || (tombstoneTs === existing.timestamp && currentManifestVersion >= existing.version)) {
            knownRevocations.set(mediaId, { timestamp: tombstoneTs, version: currentManifestVersion, isLegacy: false });
          }
          perIdRevocationSeq.set(mediaId, ++globalRevocationSeq);
          knownRestorations.delete(mediaId);
          return true;
        } else {
          // If the tombstone is explicitly stale (predates a confirmed restoration record),
          // preserve newer known revocations if this isolate observed a revocation after this restoration
          const known = knownRevocations.get(mediaId);
          const knownRevTs = Number(known?.timestamp) || 0;
          const knownRevVer = Number(known?.version) || 0;
          const isLocallyInitiated = locallyInitiatedRevocations.has(mediaId);
          if (
            isLocallyInitiated ||
            (knownRevTs > 0 && (restorationTs < knownRevTs || (restorationTs === knownRevTs && restorationVer < knownRevVer)))
          ) {
            memoryRevokedSet.add(mediaId);
            return true;
          }
          const isLegacy = Boolean(known?.isLegacy || (!known?.timestamp && !knownRevocations.has(mediaId)));
          if (!lastManifestRevokedSet.has(mediaId) || isLegacy) {
            locallyInitiatedRevocations.delete(mediaId);
            memoryRevokedSet.delete(mediaId);
            knownRevocations.delete(mediaId);
            lastManifestRevokedSet.delete(mediaId);
            return false;
          }
        }
      } else {
        if (inFlightRevocations.has(mediaId)) {
          return true;
        }
        // Authoritative tombstone returned null.
        // A. If manifest is present and contains mediaId, manifest confirms revocation:
        if (manifestSuccessfullyLoaded && manifestKeyPresent && lastManifestRevokedSet.has(mediaId)) {
          const known = knownRevocations.get(mediaId);
          let knownRest = knownRestorations.get(mediaId);
          const isLegacy = Boolean(known?.isLegacy || (!known?.timestamp && !knownRevocations.has(mediaId)));

          if (!knownRest && isLegacy && kv) {
            try {
              const resRecord = await kv.get(REVOCATION_RESTORATION_KEY_PREFIX + mediaId, { type: 'json' });
              if (resRecord) {
                const recTs = Number(resRecord.restoredAt || resRecord.timestamp) || 0;
                const recVer = Number(resRecord.version) || 0;
                knownRest = { timestamp: recTs, version: recVer };
                knownRestorations.set(mediaId, knownRest);
              }
            } catch {
              // Ignore restoration record read error
            }
          }

          const revTs = known?.isLegacy ? 0 : (known?.timestamp || currentManifestUpdatedAt);
          const isManifestOlderThanRestoration = Boolean(
            knownRest &&
            (currentManifestUpdatedAt < knownRest.timestamp ||
              (currentManifestUpdatedAt === knownRest.timestamp && currentManifestVersion <= knownRest.version))
          );
          // Positive evidence of supersedence ONLY if manifest is genuinely older than restoration,
          // or entry has per-ID timestamp and restoration is newer than revTs.
          // Negative tombstone read on a newer manifest does NOT establish supersedence; preserve legacy revocation (fail-closed).
          if (knownRest && (isManifestOlderThanRestoration || (!isLegacy && (knownRest.timestamp > revTs || (knownRest.timestamp === revTs && knownRest.version >= currentManifestVersion))))) {
            lastManifestRevokedSet.delete(mediaId);
            locallyInitiatedRevocations.delete(mediaId);
            memoryRevokedSet.delete(mediaId);
            knownRevocations.delete(mediaId);
          } else {
            memoryRevokedSet.add(mediaId);
            return true;
          }
        }

        // B. If manifest is present and omits mediaId:
        if (manifestSuccessfullyLoaded && manifestKeyPresent && !lastManifestRevokedSet.has(mediaId)) {
          if (inFlightRevocations.has(mediaId)) {
            return true;
          }
          const known = knownRevocations.get(mediaId);
          if (known && !known.isLegacy && (currentManifestUpdatedAt < known.timestamp || (currentManifestUpdatedAt === known.timestamp && currentManifestVersion <= known.version))) {
            // Negative reads on tombstone + older manifest do not prove restoration; preserve known revocation
            return true;
          }

          // Codex P1: If an isolate has already observed a revocation, a newer manifest can omit that ID
          // due to concurrent writers while a lagging KV replica returns null. Preserve known revocation
          // until there is positive evidence of a later restoration.
          const startSeq = perIdRevocationSeq.get(mediaId) || 0;
          let hasRestorationEvidence = false;
          let restorationTs = currentManifestUpdatedAt;
          let restorationVer = currentManifestVersion;

          if ((known && (known.timestamp > 0 || known.isLegacy)) || locallyInitiatedRevocations.has(mediaId)) {
            const knownRest = knownRestorations.get(mediaId);
            const knownTs = Number(known?.timestamp) || 0;
            const knownVer = Number(known?.version) || 0;
            if (knownRest && ((knownTs === 0 && knownVer === 0) || knownRest.timestamp > knownTs || (knownRest.timestamp === knownTs && knownRest.version >= knownVer))) {
              hasRestorationEvidence = true;
              restorationTs = knownRest.timestamp;
              restorationVer = knownRest.version;
            } else {
              try {
                const resRecord = await kv.get(REVOCATION_RESTORATION_KEY_PREFIX + mediaId, { type: 'json' });
                if (resRecord) {
                  const recTs = Number(resRecord.restoredAt || resRecord.timestamp) || 0;
                  const recVer = Number(resRecord.version) || 0;
                  if ((knownTs === 0 && knownVer === 0) || recTs > knownTs || (recTs === knownTs && recVer >= knownVer)) {
                    hasRestorationEvidence = true;
                    restorationTs = recTs;
                    restorationVer = recVer;
                  }
                }
              } catch {
                // Ignore restoration record read error
              }
            }

            if (!hasRestorationEvidence) {
              return true;
            }
          } else if (options?.checkTombstone && kv) {
            try {
              const resRecord = await kv.get(REVOCATION_RESTORATION_KEY_PREFIX + mediaId, { type: 'json' });
              if (resRecord) {
                const recTs = Number(resRecord.restoredAt || resRecord.timestamp) || 0;
                const recVer = Number(resRecord.version) || 0;
                knownRestorations.set(mediaId, { timestamp: recTs, version: recVer });
              }
            } catch {
              // Ignore restoration record read error
            }
          }

          // Race Condition Guard (P1): Revalidate in-flight and sequence after any KV await
          if (
            inFlightRevocations.has(mediaId) ||
            lastManifestRevokedSet.has(mediaId) ||
            (perIdRevocationSeq.get(mediaId) || 0) !== startSeq
          ) {
            return true;
          }

          locallyInitiatedRevocations.delete(mediaId);
          memoryRevokedSet.delete(mediaId);
          knownRevocations.delete(mediaId);
          if (hasRestorationEvidence) {
            knownRestorations.set(mediaId, { timestamp: restorationTs, version: restorationVer });
          }
          return false;
        }

        // C. Clean slate: manifest key does not exist and tombstone is null -> media is not revoked
        if (manifestSuccessfullyLoaded && !manifestKeyPresent) {
          if (locallyInitiatedRevocations.has(mediaId)) {
            return true;
          }
          if (memoryRevokedSet.has(mediaId)) {
            return true;
          }
          return false;
        }

        // D. Manifest failed to load: do not trust negative tombstone alone; fail-closed
        if (memoryRevokedSet.has(mediaId)) {
          return true;
        }
        if (options?.failClosed) {
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
      // @ts-expect-error - optional cloudflare module available in Workers runtime
      const cw = await import('cloudflare:workers').catch(() => null);
      if (cw?.cache && typeof cw.cache.purge === 'function') {
        purgePromise = cw.cache.purge({ tags: [tagToPurge], pathPrefixes: [prefixToPurge] });
      }
    }

    if (purgePromise) {
      const purgeRes = await purgePromise;
      let hasPurgeError = false;
      let errorDetails = '';

      if (purgeRes === undefined || purgeRes === true) {
        // Native Cloudflare Workers Promise<void> or boolean true
        hasPurgeError = false;
      } else if (purgeRes && typeof purgeRes === 'object') {
        const hasExplicitSuccess = purgeRes.success === true ||
          purgeRes.ok === true ||
          (typeof purgeRes.status === 'number' && purgeRes.status >= 200 && purgeRes.status < 400);

        if (!hasExplicitSuccess || purgeRes.success === false || purgeRes.ok === false || (typeof purgeRes.status === 'number' && purgeRes.status >= 400)) {
          hasPurgeError = true;
        }
        if (purgeRes.error) {
          hasPurgeError = true;
          errorDetails = typeof purgeRes.error === 'object'
            ? (purgeRes.error.message || JSON.stringify(purgeRes.error))
            : String(purgeRes.error);
        }
        if (purgeRes.errors) {
          const hasNonEmptyErrors = Array.isArray(purgeRes.errors)
            ? purgeRes.errors.length > 0
            : Boolean(purgeRes.errors);

          if (hasNonEmptyErrors) {
            hasPurgeError = true;
            if (Array.isArray(purgeRes.errors)) {
              errorDetails = purgeRes.errors
                .map((e: any) => (e && typeof e === 'object' ? (e.message || JSON.stringify(e)) : String(e)))
                .join('; ');
            } else if (typeof purgeRes.errors === 'object') {
              errorDetails = purgeRes.errors.message || JSON.stringify(purgeRes.errors);
            } else {
              errorDetails = String(purgeRes.errors);
            }
          }
        }
        if (hasPurgeError && !errorDetails) {
          errorDetails = 'Workers cache purge returned object without explicit success confirmation';
        }
      } else {
        hasPurgeError = true;
        errorDetails = `Workers cache purge returned invalid value: ${String(purgeRes)}`;
      }

      if (hasPurgeError) {
        errors.push(`WORKERS_CACHE_PURGE_ERROR: ${errorDetails || 'Workers cache purge returned unsuccessful'}`);
      } else {
        workersCachePurged++;
        globalPurgeDispatched = true;
      }
    } else if (options.requirePurgeDispatch) {
      errors.push('WORKERS_CACHE_PURGE_UNAVAILABLE: ctx.cache.purge API is not available to purge Cloudflare Workers Caching declarative edge cache');
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
          throw new Error(`CACHE_API_DELETE_FAILED for ${url}: ${err?.message || err}`, { cause: err });
        }
      })
    );
    for (const dr of deleteResults) {
      if (dr.status === 'rejected') {
        errors.push(dr.reason?.message || 'CACHE_DELETE_REJECTED');
      }
    }

    const hasCacheDeleteErrors = deleteResults.some((dr) => dr.status === 'rejected');

    // Verify local purge: require successful deletions and verify that key variants are no longer cached
    if (typeof cache.match === 'function' && !hasCacheDeleteErrors) {
      try {
        let anyVariantStillCached = false;
        const variantsToCheck = [
          `${origin}/media/${mediaId}`,
          `${origin}/media/${mediaId}?size=thumb&v=3`,
          `${origin}/media/${mediaId}?size=hero&v=3`,
          ...(currentUrl ? [currentUrl] : [])
        ];
        for (const variantUrl of variantsToCheck) {
          const match = await cache.match(variantUrl);
          if (match) {
            anyVariantStillCached = true;
            break;
          }
        }
        if (!anyVariantStillCached) {
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
          throw new Error(`KV_DELETE_FAILED for ${key}: ${err?.message || err}`, { cause: err });
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

  inFlightRevocations.add(mediaId);
  locallyInitiatedRevocations.add(mediaId);
  try {
    const revokedAt = Date.now();
    const errors: string[] = [];
    let tombstoneWritten = false;
    let manifestUpdated = false;
    let purgeState: RevocationPurgeState = 'PURGE_REQUESTED';

    // 1. Instantly update in-memory set in current isolate
    memoryRevokedSet.add(mediaId);
    knownRevocations.set(mediaId, { timestamp: revokedAt, version: currentManifestVersion + 1 });
    perIdRevocationSeq.set(mediaId, ++globalRevocationSeq);
    try {
      invalidateMediaMetadataCache(mediaId);
    } catch {
      // Ignore cache invalidation error
    }

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
    // Clean up any existing restoration record
    if (typeof options.kv.delete === 'function') {
      try {
        await options.kv.delete(REVOCATION_RESTORATION_KEY_PREFIX + mediaId);
      } catch {
        // Best-effort restoration record cleanup
      }
    }
    knownRestorations.delete(mediaId);

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
        const existingVersion = Number(currentManifest.version) || 1;
        const nextVersion = Math.max(existingVersion, currentManifestVersion) + 1;
        const nextUpdatedAt = Math.max(Date.now(), (Number(currentManifest.updatedAt) || 0) + 1);
        const existingRestored = Array.isArray(currentManifest.restoredIds) ? currentManifest.restoredIds : [];
        const existingRestorations = currentManifest.restorations && typeof currentManifest.restorations === 'object' ? { ...currentManifest.restorations } : {};
        delete existingRestorations[mediaId];
        const existingRevocations = currentManifest.revocations && typeof currentManifest.revocations === 'object' ? { ...currentManifest.revocations } : {};
        existingRevocations[mediaId] = revokedAt;
        const nextManifest = {
          version: nextVersion,
          updatedAt: nextUpdatedAt,
          revokedIds: Array.from(idSet),
          ...(Object.keys(existingRevocations).length > 0 ? { revocations: existingRevocations } : {}),
          ...(existingRestored.length > 0 ? { restoredIds: existingRestored.filter((id: string) => id !== mediaId) } : {}),
          ...(Object.keys(existingRestorations).length > 0 ? { restorations: existingRestorations } : {})
        };
        await options.kv.put(REVOCATION_MANIFEST_KEY, JSON.stringify(nextManifest));

        // Read-After-Write Verification (RAWV): poll reads to account for KV propagation delay before rewriting
        const MAX_VERIFY_READS = 4;
        let verified: any = null;
        for (let readAttempt = 0; readAttempt < MAX_VERIFY_READS; readAttempt++) {
          verified = await options.kv.get(REVOCATION_MANIFEST_KEY, { type: 'json' }).catch(() => null);
          const verifiedPerIdTs = Number(verified?.revocations?.[mediaId]) || 0;
          const verifiedVersion = Number(verified?.version) || 0;
          const verifiedUpdatedAt = Number(verified?.updatedAt) || 0;
          if (
            verified?.revokedIds &&
            Array.isArray(verified.revokedIds) &&
            verified.revokedIds.includes(mediaId) &&
            (verifiedPerIdTs >= revokedAt || verifiedVersion >= nextVersion || verifiedUpdatedAt >= nextUpdatedAt)
          ) {
            manifestUpdated = true;
            break;
          }

          const readVersion = Number(verified?.version) || 0;
          const readUpdatedAt = Number(verified?.updatedAt) || 0;

          // If a genuinely newer manifest from a concurrent writer omitted mediaId, it was overwritten
          if (readUpdatedAt > nextUpdatedAt || (readUpdatedAt === nextUpdatedAt && readVersion > nextVersion)) {
            break;
          }

          // Otherwise it is replica propagation delay; wait before reading again without rewriting
          if (readAttempt < MAX_VERIFY_READS - 1) {
            const delayMs = isVitest ? 2 : 250 * (readAttempt + 1);
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }

        if (manifestUpdated && verified) {
          lastManifestRevokedSet = new Set(verified.revokedIds);
          currentManifestVersion = Math.max(currentManifestVersion, nextVersion);
          currentManifestUpdatedAt = Math.max(currentManifestUpdatedAt, nextUpdatedAt);
          const verifiedRevocationsMap = verified.revocations && typeof verified.revocations === 'object' ? verified.revocations : {};
          for (const id of verified.revokedIds) {
            memoryRevokedSet.add(id);
            const perIdTs = Number(verifiedRevocationsMap[id]) || (id === mediaId ? revokedAt : 0);
            const existing = knownRevocations.get(id);
            if (!existing) {
              knownRevocations.set(id, { timestamp: perIdTs || nextUpdatedAt, version: nextVersion });
            } else if (perIdTs > existing.timestamp) {
              knownRevocations.set(id, { timestamp: perIdTs, version: nextVersion });
            }
          }
          break;
        } else if (manifestWriteAttempts < MAX_MANIFEST_ATTEMPTS) {
          // Concurrent overwrite or propagation timeout; back off respecting KV 1 write/sec limit before retry
          const backoffMs = isVitest ? 5 : 1000;
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      } catch (manifestErr: any) {
        if (manifestWriteAttempts >= MAX_MANIFEST_ATTEMPTS) {
          errors.push(`MANIFEST_WRITE_FAILED: ${manifestErr?.message || manifestErr}`);
        } else {
          // Back off respecting KV 1 write/sec limit on write exceptions/rate limits before retry
          const backoffMs = isVitest ? 5 : 1000;
          await new Promise((r) => setTimeout(r, backoffMs));
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
    requirePurgeDispatch: options.requirePurgeDispatch,
    allowLocalOnly: options.allowLocalOnly,
    globalVerifier: options.globalVerifier
  });
  const { cachePurged, workersCachePurged, kvPurged, localPurgeVerified, globalPurgeDispatched, globalPurgeVerified } = purgeResult;
  if (purgeResult.errors && purgeResult.errors.length > 0) {
    errors.push(...purgeResult.errors);
    purgeState = 'PURGE_FAILED';
  } else if (globalPurgeVerified) {
    purgeState = 'PURGE_GLOBAL_VERIFIED';
  } else if (globalPurgeDispatched) {
    purgeState = localPurgeVerified ? 'PURGE_VERIFIED' : 'PURGE_GLOBAL_DISPATCHED';
  } else if (localPurgeVerified) {
    purgeState = 'PURGE_LOCAL_VERIFIED';
  } else if (cachePurged > 0) {
    purgeState = 'PURGE_ACCEPTED';
  } else {
    purgeState = 'PURGE_SKIPPED';
  }

  // 5. Determine overall revocation state
  // Strict rule: Persistence in both KV tombstone and manifest is mandatory for REVOCATION_COMPLETED.
  // Absence or failure of KV can never return REVOCATION_COMPLETED.
  let overallState: RevocationOverallState = 'REVOCATION_FAILED';
  const persistenceGuaranteed = Boolean(tombstoneWritten && manifestUpdated);
  if (persistenceGuaranteed) {
    locallyInitiatedRevocations.delete(mediaId);
  }
  const purgeGuaranteed = purgeState !== 'PURGE_FAILED';

  if (persistenceGuaranteed && purgeGuaranteed && errors.length === 0) {
    if (options.requireGlobalPurge && !globalPurgeVerified) {
      overallState = 'REVOCATION_PARTIAL';
      errors.push('GLOBAL_PURGE_UNVERIFIABLE: Local PoP cache purged, but global CDN edge invalidation cannot be proven synchronously; security preserved via authoritative KV tombstone and fail-closed checks');
    } else if (options.requirePurgeDispatch && !globalPurgeDispatched) {
      overallState = 'REVOCATION_PARTIAL';
      errors.push('GLOBAL_PURGE_NOT_DISPATCHED: Workers Caching edge purge (ctx.cache.purge) was not dispatched; declarative edge cache may serve stale content until eviction');
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
  } finally {
    inFlightRevocations.delete(mediaId);
  }
}

/**
 * Restores a previously revoked media if legitimate.
 */
export async function unrevokeMedia(
  mediaId: string,
  options: { kv?: any; cache?: any; ctx?: any; origin?: string } = {}
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  const restorationTimestamp = Date.now();
  let nextVersion = currentManifestVersion + 1;

  let tombstoneDeleted = false;
  let priorTombstoneContent: any = null;
  if (options.kv && typeof options.kv.delete === 'function') {
    try {
      if (typeof options.kv.get === 'function') {
        priorTombstoneContent = await options.kv.get(REVOCATION_KEY_PREFIX + mediaId).catch(() => null);
      }
      await options.kv.delete(REVOCATION_KEY_PREFIX + mediaId);
      tombstoneDeleted = true;
    } catch (err: any) {
      errors.push(`TOMBSTONE_DELETE_FAILED: ${err?.message || err}`);
    }

    if (tombstoneDeleted) {
      let priorRevTs = 0;
      if (priorTombstoneContent) {
        try {
          const parsed = typeof priorTombstoneContent === 'string' ? JSON.parse(priorTombstoneContent) : priorTombstoneContent;
          if (parsed?.revokedAt) priorRevTs = Number(parsed.revokedAt) || 0;
          else if (parsed?.timestamp) priorRevTs = Number(parsed.timestamp) || 0;
        } catch {
          // Ignore malformed prior tombstone content
        }
      }
      if (!priorRevTs) {
        priorRevTs = Number(knownRevocations.get(mediaId)?.timestamp) || 0;
      }
      // Check for intervening revocations before recording or publishing restoration:
      // A concurrent revocation completing during or after the deletion will have a newly created tombstone
      // or a manifest revocation timestamp greater than priorRevTs and >= restorationTimestamp.
      let interveningRevocationTs = 0;
      let currentManifest: any = null;
      try {
        currentManifest = await options.kv.get(REVOCATION_MANIFEST_KEY, { type: 'json' });
        if (currentManifest && typeof currentManifest.revocations === 'object') {
          interveningRevocationTs = Number(currentManifest.revocations[mediaId]) || 0;
        }
      } catch {
        // Best-effort manifest check
      }

      let interveningTombstoneTs = 0;
      try {
        const checkTomb = await options.kv.get(REVOCATION_KEY_PREFIX + mediaId, { type: 'json' });
        if (checkTomb && checkTomb.revokedAt) {
          interveningTombstoneTs = Number(checkTomb.revokedAt) || 0;
        }
      } catch {
        // Best-effort tombstone check
      }

      const isNewManifestRevocation = interveningRevocationTs > priorRevTs && interveningRevocationTs >= restorationTimestamp;
      const isNewTombstone = interveningTombstoneTs >= restorationTimestamp && interveningTombstoneTs > 0;
      const hasInterveningRevocation = isNewManifestRevocation || isNewTombstone;
      const effectiveRevTs = Math.max(isNewManifestRevocation ? interveningRevocationTs : 0, isNewTombstone ? interveningTombstoneTs : 0);

      if (hasInterveningRevocation) {
        // A newer revocation completed concurrently! Refuse to restore, preserve in manifest/KV, and keep fail-closed.
        memoryRevokedSet.add(mediaId);
        knownRevocations.set(mediaId, { timestamp: effectiveRevTs, version: nextVersion, isLegacy: false });

        try {
          await options.kv.put(REVOCATION_KEY_PREFIX + mediaId, JSON.stringify({
            mediaId,
            revokedAt: effectiveRevTs,
            reason: 'CONCURRENT_REVOCATION_PRESERVED'
          }));
        } catch {
          // Ignore concurrent revocation put error
        }

        if (currentManifest && Array.isArray(currentManifest.revokedIds)) {
          if (!currentManifest.revokedIds.includes(mediaId)) {
            currentManifest.revokedIds.push(mediaId);
          }
          if (!currentManifest.revocations || typeof currentManifest.revocations !== 'object') {
            currentManifest.revocations = {};
          }
          currentManifest.revocations[mediaId] = effectiveRevTs;
          try {
            await options.kv.put(REVOCATION_MANIFEST_KEY, JSON.stringify(currentManifest));
          } catch {
            // Ignore manifest put error
          }
        }

        errors.push('CONCURRENT_REVOCATION_INTERVENED');
        return { success: false, errors };
      }

      // Safe: No intervening revocation. Write durable restoration record to KV.
      let restorationRecordWritten = false;
      try {
        await options.kv.put(REVOCATION_RESTORATION_KEY_PREFIX + mediaId, JSON.stringify({
          mediaId,
          restoredAt: restorationTimestamp,
          version: nextVersion
        }));
        restorationRecordWritten = true;
      } catch (err: any) {
        errors.push(`RESTORATION_RECORD_WRITE_FAILED: ${err?.message || err}`);
      }

      if (!restorationRecordWritten) {
        // Rollback: restore the tombstone in KV ONLY if one existed prior to deletion!
        if (priorTombstoneContent) {
          try {
            const contentToRestore = typeof priorTombstoneContent === 'string'
              ? priorTombstoneContent
              : JSON.stringify(priorTombstoneContent);
            await options.kv.put(REVOCATION_KEY_PREFIX + mediaId, contentToRestore);
          } catch {
            // Rollback put error ignored
          }
        }
        return { success: false, errors };
      }

      if (restorationRecordWritten) {
        try {
          // Codex P1: Re-read the manifest before publishing restoration to ensure intervening revocations are detected
          currentManifest = await options.kv.get(REVOCATION_MANIFEST_KEY, { type: 'json' }).catch(() => null);
          if (currentManifest && Array.isArray(currentManifest.revokedIds)) {
            let raceTombstoneTs = 0;
            try {
              const checkRaceTomb = await options.kv.get(REVOCATION_KEY_PREFIX + mediaId, { type: 'json' });
              if (checkRaceTomb && checkRaceTomb.revokedAt) {
                raceTombstoneTs = Number(checkRaceTomb.revokedAt) || 0;
              }
            } catch {
              // Best-effort check race tombstone
            }
            const raceRevocationTs = Number(currentManifest.revocations?.[mediaId]) || 0;
            const isRaceManifestRevocation = raceRevocationTs > priorRevTs && raceRevocationTs >= restorationTimestamp;
            const isRaceTombstone = raceTombstoneTs >= restorationTimestamp && raceTombstoneTs > 0;
            if (isRaceManifestRevocation || isRaceTombstone) {
              const effectiveRaceRevTs = Math.max(isRaceManifestRevocation ? raceRevocationTs : 0, isRaceTombstone ? raceTombstoneTs : 0);
              await options.kv.delete(REVOCATION_RESTORATION_KEY_PREFIX + mediaId).catch(() => {});
              try {
                await options.kv.put(REVOCATION_KEY_PREFIX + mediaId, JSON.stringify({
                  mediaId,
                  revokedAt: effectiveRaceRevTs,
                  reason: 'CONCURRENT_REVOCATION_PRESERVED'
                }));
              } catch {
                // Best-effort preserve race revocation
              }
              memoryRevokedSet.add(mediaId);
              knownRevocations.set(mediaId, { timestamp: effectiveRaceRevTs, version: nextVersion, isLegacy: false });
              errors.push('CONCURRENT_REVOCATION_INTERVENED');
              return { success: false, errors };
            }

            currentManifest.revokedIds = currentManifest.revokedIds.filter((id: string) => id !== mediaId);
            const existingRevocations = currentManifest.revocations && typeof currentManifest.revocations === 'object' ? { ...currentManifest.revocations } : {};
            delete existingRevocations[mediaId];
            currentManifest.revocations = existingRevocations;

            nextVersion = Math.max(Number(currentManifest.version) || 1, currentManifestVersion) + 1;
            const manifestUpdatedAt = Math.max(Date.now(), (Number(currentManifest.updatedAt) || 0) + 1);
            currentManifest.updatedAt = manifestUpdatedAt;
            currentManifest.version = nextVersion;
            const existingRestored = Array.isArray(currentManifest.restoredIds) ? currentManifest.restoredIds : [];
            const retainedRestoredIds = [mediaId, ...existingRestored.filter((id: string) => id !== mediaId)].slice(0, 100);
            currentManifest.restoredIds = retainedRestoredIds;
            const existingRestorations = currentManifest.restorations && typeof currentManifest.restorations === 'object' ? { ...currentManifest.restorations } : {};
            existingRestorations[mediaId] = restorationTimestamp;
            // Prune restorations map to only retain entries present in retainedRestoredIds (max 100)
            const retainedRestoredSet = new Set(retainedRestoredIds);
            for (const rId of Object.keys(existingRestorations)) {
              if (!retainedRestoredSet.has(rId)) {
                delete existingRestorations[rId];
              }
            }
            currentManifest.restorations = existingRestorations;

            await options.kv.put(REVOCATION_MANIFEST_KEY, JSON.stringify(currentManifest));
            locallyInitiatedRevocations.delete(mediaId);
            memoryRevokedSet.delete(mediaId);
            knownRevocations.delete(mediaId);
            lastManifestRevokedSet = new Set(currentManifest.revokedIds);
            currentManifestVersion = nextVersion;
            currentManifestUpdatedAt = manifestUpdatedAt;
            knownRestorations.set(mediaId, { timestamp: restorationTimestamp, version: nextVersion });
            try {
              invalidateMediaMetadataCache(mediaId);
            } catch {
              // Best-effort cache invalidate
            }
          } else {
            locallyInitiatedRevocations.delete(mediaId);
            memoryRevokedSet.delete(mediaId);
            knownRevocations.delete(mediaId);
            lastManifestRevokedSet.delete(mediaId);
            knownRestorations.set(mediaId, { timestamp: restorationTimestamp, version: nextVersion });
            try {
              invalidateMediaMetadataCache(mediaId);
            } catch {
              // Best-effort cache invalidate
            }
          }
        } catch (manifestErr: any) {
          errors.push(`MANIFEST_UPDATE_FAILED: ${manifestErr?.message || manifestErr}`);
        }
      }
    }
  } else {
    // KV binding is absent. Restoration cannot be confirmed in persistent storage.
    // If the media was persistently revoked (in manifest or known in memory), keep revocation fail-closed!
    if (
      lastManifestRevokedSet.has(mediaId) ||
      (memoryRevokedSet.has(mediaId) && !locallyInitiatedRevocations.has(mediaId))
    ) {
      errors.push('KV_BINDING_REQUIRED: Restoration cannot be confirmed in persistent storage without KV');
      return { success: false, errors };
    }
    // Only unpersisted locally-initiated revocations can be cleared from this isolate's memory,
    // and we NEVER record a restoration in knownRestorations without confirmed persistence in KV.
    locallyInitiatedRevocations.delete(mediaId);
    memoryRevokedSet.delete(mediaId);
    knownRevocations.delete(mediaId);
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
