import { eq, sql, desc, inArray } from "drizzle-orm";
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { normalizeBotReference, KNOWN_MANGA_SHARDS } from '$lib/server/storage-router';

export type ReconciliationStatus =
  | 'OK'
  | 'BROKEN_REFERENCE'
  | 'MISSING_SHARD'
  | 'BOT_MISMATCH'
  | 'POOL_MISMATCH'
  | 'ORPHAN_ARTIFACT';

export interface ReconciliationAnomaly {
  mediaId: string;
  anomalyType: ReconciliationStatus;
  description: string;
  poolKey?: string;
  shardId?: string | null;
  botReference?: string | null;
  providerKey?: string | null;
  remedyRecommendation: string;
}

export interface ReconciliationReport {
  timestamp: string;
  totalSampled: number;
  healthyCount: number;
  anomalyCount: number;
  breakdown: Record<ReconciliationStatus, number>;
  anomalies: ReconciliationAnomaly[];
  poolsChecked: string[];
  safeStatus: 'CLEAN' | 'ATTENTION_NEEDED';
}

export interface ShardLookup {
  id: string;
  poolId: string;
  poolKey: string;
  botReference: string;
  displayName: string;
}

/**
 * Pure auditor for an individual media record.
 * STRICTLY NON-DESTRUCTIVE: returns anomaly status without making any changes.
 */
export function auditMediaRecord(
  media: {id: string;
    provider: string;
    providerKey: string | null;
    purpose?: string | null;
    storagePoolId?: string | null;
    storageShardId?: string | null;
    botReference?: string | null;
    chapterId?: string | null;
    scanId?: string | null;},
  shardsMap: Map<string, ShardLookup>,
  poolsMap: Map<string, { id: string; key: string }>,
  existingChapterIds?: Set<string>
): ReconciliationAnomaly | null {// 1. Check for BROKEN_REFERENCE
  if (!media.providerKey || media.providerKey.trim().length === 0) {
    return {
      mediaId: media.id,
      anomalyType: 'BROKEN_REFERENCE',
      description: `Media record has missing or blank providerKey (provider: ${media.provider}).`,
      shardId: media.storageShardId,
      botReference: media.botReference,
      providerKey: media.providerKey,
      remedyRecommendation: 'Re-upload or backfill file reference from upstream archive.',
    };
  }

  // 2. Check for MISSING_SHARD if shard ID is referenced
  if (media.storageShardId) {const shard = shardsMap.get(media.storageShardId);
    if (!shard) {
      return {
        mediaId: media.id,
        anomalyType: 'MISSING_SHARD',
        description: `Referenced storageShardId ${media.storageShardId} does not exist in storage_shards.`,
        shardId: media.storageShardId,
        botReference: media.botReference,
        providerKey: media.providerKey,
        remedyRecommendation: 'Reassign media record to valid active shard in the appropriate storage pool.',
      };
    }

    // 3. Check for BOT_MISMATCH
    if (media.botReference && shard.botReference) {
      const normMediaBot = normalizeBotReference(media.botReference);
      const normShardBot = normalizeBotReference(shard.botReference);
      if (normMediaBot !== normShardBot) {
        return {
          mediaId: media.id,
          anomalyType: 'BOT_MISMATCH',
          description: `Bot reference mismatch: media has ${normMediaBot} but assigned shard ${shard.displayName} requires ${normShardBot}.`,
          poolKey: shard.poolKey,
          shardId: media.storageShardId,
          botReference: media.botReference,
          providerKey: media.providerKey,
          remedyRecommendation: `Update media botReference to ${normShardBot} to ensure affinity with assigned shard.`,
        };
      }
    }

    // 4. Check for POOL_MISMATCH
    if (media.purpose) {
      const isPipelinePurpose = ['pipeline', 'scan_pipeline', 'production'].includes(media.purpose);
      const isStaffPurpose = ['staff_manual', 'staff_chapter', 'staff'].includes(media.purpose);
      const isEditorialPurpose = ['editorial'].includes(media.purpose);

      if (isPipelinePurpose && shard.poolKey !== 'PRODUCTION_STORAGE') {
        return {
          mediaId: media.id,
          anomalyType: 'POOL_MISMATCH',
          description: `Isolation breach: media with pipeline purpose is assigned to pool ${shard.poolKey} instead of PRODUCTION_STORAGE.`,
          poolKey: shard.poolKey,
          shardId: media.storageShardId,
          botReference: media.botReference,
          providerKey: media.providerKey,
          remedyRecommendation: 'Enforce strict fail-closed pool isolation; route pipeline files only to PRODUCTION_STORAGE.',
        };
      }

      if (isStaffPurpose && shard.poolKey !== 'STAFF_STORAGE') {
        return {
          mediaId: media.id,
          anomalyType: 'POOL_MISMATCH',
          description: `Isolation breach: media with staff_manual purpose is assigned to pool ${shard.poolKey} instead of STAFF_STORAGE.`,
          poolKey: shard.poolKey,
          shardId: media.storageShardId,
          botReference: media.botReference,
          providerKey: media.providerKey,
          remedyRecommendation: 'Enforce staff isolation; route staff manual files to STAFF_STORAGE.',
        };
      }

      if (isEditorialPurpose && shard.poolKey !== 'MANGA_STORAGE' && shard.poolKey !== 'OVERFLOW_STORAGE') {
        return {
          mediaId: media.id,
          anomalyType: 'POOL_MISMATCH',
          description: `Isolation breach: public editorial manga media is assigned to pool ${shard.poolKey} instead of MANGA_STORAGE.`,
          poolKey: shard.poolKey,
          shardId: media.storageShardId,
          botReference: media.botReference,
          providerKey: media.providerKey,
          remedyRecommendation: 'Route public manga pages only to MANGA_STORAGE shards.',
        };
      }
    }
  }

  // 5. Check for ORPHAN_ARTIFACT
  if (media.chapterId && existingChapterIds && !existingChapterIds.has(media.chapterId)) {return {
      mediaId: media.id,
      anomalyType: 'ORPHAN_ARTIFACT',
      description: `Media references non-existent chapterId ${media.chapterId}.`,
      shardId: media.storageShardId,
      botReference: media.botReference,
      providerKey: media.providerKey,
      remedyRecommendation: 'Review chapter lifecycle; verify if chapter was deleted without cascading media cleanup.',
    };
  }

  return null;
}

/**
 * Executes a non-destructive storage reconciliation sampling audit across all 7 storage pools.
 */
export async function runStorageReconciliationAudit(sampleLimitPerPool: number = 50): Promise<ReconciliationReport> {
  const timestamp = new Date().toISOString();
  
  // 1. Query all pools
  const { data: pools } = await safeQuery(db.select({ id: schema.storagePools.id, key: schema.storagePools.key }).from(schema.storagePools));
  const poolsMap = new Map<string, { id: string; key: string }>();
  for (const p of pools || []) {
    poolsMap.set(p.id, p);
  }

  // 2. Query all shards
  const { data: shards } = await safeQuery(db.select({ id: schema.storageShards.id, poolId: schema.storageShards.poolId, botReference: schema.storageShards.botReference, displayName: schema.storageShards.displayName }).from(schema.storageShards));
  const shardsMap = new Map<string, ShardLookup>();
  for (const s of shards || []) {
    const pool = poolsMap.get(s.poolId);
    shardsMap.set(s.id, {
      id: s.id,
      poolId: s.poolId,
      poolKey: pool?.key || 'UNKNOWN',
      botReference: s.botReference,
      displayName: s.displayName,
    });
  }

  // 3. Sample media records
  const { data: sampleMedia } = await safeQuery(db.select({ id: schema.media.id, provider: schema.media.provider, providerKey: schema.media.providerKey, purpose: schema.media.purpose, storagePoolId: schema.media.storagePoolId, storageShardId: schema.media.storageShardId, botReference: schema.media.botReference, chapterId: schema.media.chapterId, scanId: schema.media.scanId }).from(schema.media).orderBy(desc(schema.media.createdAt)).limit(sampleLimitPerPool * 7));

  // 4. Gather chapter IDs from sample for existence check
  const chapterIdsToCheck = (sampleMedia || [])
    .map((m) => m.chapterId)
    .filter((id): id is string => Boolean(id));

  let existingChapterIds: Set<string> | undefined;
  if (chapterIdsToCheck.length > 0) {
    const { data: foundChapters } = await safeQuery(db.select({ id: schema.chapters.id }).from(schema.chapters).where(inArray(schema.chapters.id, chapterIdsToCheck)));
    existingChapterIds = new Set((foundChapters || []).map((c) => c.id));
  }

  const breakdown: Record<ReconciliationStatus, number> = {
    OK: 0,
    BROKEN_REFERENCE: 0,
    MISSING_SHARD: 0,
    BOT_MISMATCH: 0,
    POOL_MISMATCH: 0,
    ORPHAN_ARTIFACT: 0,
  };

  const anomalies: ReconciliationAnomaly[] = [];

  for (const media of sampleMedia || []) {
    const anomaly = auditMediaRecord(media, shardsMap, poolsMap, existingChapterIds);
    if (anomaly) {
      breakdown[anomaly.anomalyType]++;
      anomalies.push(anomaly);
    } else {
      breakdown.OK++;
    }
  }

  const totalSampled = (sampleMedia || []).length;
  const anomalyCount = anomalies.length;
  const healthyCount = totalSampled - anomalyCount;

  return {
    timestamp,
    totalSampled,
    healthyCount,
    anomalyCount,
    breakdown,
    anomalies,
    poolsChecked: Array.from(poolsMap.values()).map((p) => p.key),
    safeStatus: anomalyCount === 0 ? 'CLEAN' : 'ATTENTION_NEEDED',
  };
}
