/**
 * Project Nox — Permanent 4-Category Storage Sieve (Etapa 2)
 *
 * Implements the mandatory architectural sieve:
 *   NOVO DADO -> CLASSIFICAÇÃO -> ARMAZENAMENTO CORRETO.
 *
 * Categories:
 *   - CATEGORIA A — ESSENCIAL AO SQL: YugabyteDB (fast relational queries, search, transactions, accounts).
 *   - CATEGORIA B — IMPORTANTE, MAS NÃO EXIGE SQL IMEDIATO: Telegram Storage (media, cold files, chapter images).
 *   - CATEGORIA C — TEMPORÁRIO OU RECONSTRUÍVEL: Cache / Local KV / TTL (bounded expiration, no raw blobs in SQL).
 *   - CATEGORIA D — REALMENTE DESNECESSÁRIO: Purge (deduplication, expired records, dead orphans).
 */

export type DataCategory =
  | 'CATEGORY_A_SQL'
  | 'CATEGORY_B_TELEGRAM'
  | 'CATEGORY_C_CACHE_TTL'
  | 'CATEGORY_D_DISPOSABLE';

export type StorageTarget =
  | 'YUGABYTEDB'
  | 'TELEGRAM_STORAGE'
  | 'LOCAL_CACHE'
  | 'PURGE';

export interface SieveEntity {
  type:
    | 'work_metadata'
    | 'chapter_metadata'
    | 'page_pointer'
    | 'user_account'
    | 'session_token'
    | 'search_cache'
    | 'home_bundle_cache'
    | 'release_cache'
    | 'image_binary'
    | 'chapter_archive_zip'
    | 'scan_file'
    | 'audit_log'
    | 'ephemeral_metric'
    | 'dead_orphan_record'
    | 'duplicate_record'
    | 'generic';
  table?: string;
  sizeBytes?: number;
  mimeType?: string;
  isCold?: boolean;
  isDuplicate?: boolean;
  isExpired?: boolean;
  isIntermediate?: boolean;
  sha256?: string;
  ttlSeconds?: number;
  payload?: unknown;
}

export interface SieveDecision {
  category: DataCategory;
  target: StorageTarget;
  ttlSeconds: number | null;
  reason: string;
  allowSqlStorage: boolean;
  allowTelegramStorage: boolean;
  isSafeToPurge: boolean;
  deduplicationKey?: string;
}

/**
 * Maps known database tables to their primary data category.
 */
export const TABLE_CLASSIFICATIONS: Record<string, DataCategory> = {
  // Category A: Essential relational data in SQL
  works: 'CATEGORY_A_SQL',
  chapters: 'CATEGORY_A_SQL',
  pages: 'CATEGORY_A_SQL',
  media: 'CATEGORY_A_SQL', // stores Telegram references & dimensions, NOT raw bytes
  tags: 'CATEGORY_A_SQL',
  work_tags: 'CATEGORY_A_SQL',
  catalog_filter_tags: 'CATEGORY_A_SQL',
  user: 'CATEGORY_A_SQL',
  session: 'CATEGORY_A_SQL',
  account: 'CATEGORY_A_SQL',
  verification: 'CATEGORY_A_SQL',
  library: 'CATEGORY_A_SQL',
  reading: 'CATEGORY_A_SQL',
  reading_sessions: 'CATEGORY_A_SQL',
  likes: 'CATEGORY_A_SQL',
  members: 'CATEGORY_A_SQL',
  member_achievements: 'CATEGORY_A_SQL',
  member_inventory: 'CATEGORY_A_SQL',
  achievements: 'CATEGORY_A_SQL',
  shop_items: 'CATEGORY_A_SQL',
  xp_awards: 'CATEGORY_A_SQL',
  comments: 'CATEGORY_A_SQL',
  comment_likes: 'CATEGORY_A_SQL',
  scans: 'CATEGORY_A_SQL',
  scan_members: 'CATEGORY_A_SQL',
  settings: 'CATEGORY_A_SQL',
  importer_sources: 'CATEGORY_A_SQL',
  importer_work_mappings: 'CATEGORY_A_SQL',
  importer_lite_chapters: 'CATEGORY_A_SQL',
  importer_lite_chapter_sources: 'CATEGORY_A_SQL',

  // Category C: Ephemeral / Cache / Intermediate records with TTL
  importer_lite_uploads: 'CATEGORY_C_CACHE_TTL', // transient page upload states
  importer_rate_buckets: 'CATEGORY_C_CACHE_TTL',
  cover_vision_work_tasks: 'CATEGORY_C_CACHE_TTL',

  // Category D: Disposable / Expired / Dead data subject to rolling retention
  importer_telemetry: 'CATEGORY_D_DISPOSABLE', // older than 24h
  importer_job_metrics: 'CATEGORY_D_DISPOSABLE', // older than 7d
  importer_publication_events: 'CATEGORY_D_DISPOSABLE', // older than 24h
  importer_queue: 'CATEGORY_D_DISPOSABLE', // legacy abandoned queue
};

/** Maximum size in bytes allowed for inline SQL payload values before offload is required. */
export const MAX_INLINE_SQL_BLOB_BYTES = 65536; // 64 KB

/**
 * Classifies an incoming entity and returns the definitive routing decision.
 */
export function classifyData(entity: SieveEntity): SieveDecision {
  // 1. Check for disposable / duplicate / expired records (Category D)
  if (entity.isDuplicate || entity.type === 'duplicate_record') {
    return {
      category: 'CATEGORY_D_DISPOSABLE',
      target: 'PURGE',
      ttlSeconds: 0,
      reason: 'Duplicate record rejected by sieve to prevent SQL bloat',
      allowSqlStorage: false,
      allowTelegramStorage: false,
      isSafeToPurge: true,
      deduplicationKey: entity.sha256,
    };
  }

  if (entity.isExpired || entity.type === 'dead_orphan_record') {
    return {
      category: 'CATEGORY_D_DISPOSABLE',
      target: 'PURGE',
      ttlSeconds: 0,
      reason: 'Expired or orphan record scheduled for safe purge',
      allowSqlStorage: false,
      allowTelegramStorage: false,
      isSafeToPurge: true,
    };
  }

  // 2. Check for binary assets or cold files (Category B)
  if (
    entity.type === 'image_binary' ||
    entity.type === 'chapter_archive_zip' ||
    entity.type === 'scan_file' ||
    (entity.sizeBytes && entity.sizeBytes > MAX_INLINE_SQL_BLOB_BYTES && !entity.type.includes('metadata'))
  ) {
    return {
      category: 'CATEGORY_B_TELEGRAM',
      target: 'TELEGRAM_STORAGE',
      ttlSeconds: null,
      reason: 'Heavy binary or archival file offloaded to Telegram Storage; store only lightweight pointer in SQL',
      allowSqlStorage: false,
      allowTelegramStorage: true,
      isSafeToPurge: false,
      deduplicationKey: entity.sha256,
    };
  }

  // 3. Check for transient / cache / intermediate data (Category C)
  if (
    entity.type === 'search_cache' ||
    entity.type === 'home_bundle_cache' ||
    entity.type === 'release_cache' ||
    entity.type === 'ephemeral_metric' ||
    entity.isIntermediate ||
    entity.ttlSeconds !== undefined
  ) {
    const ttl = entity.ttlSeconds ?? (
      entity.type === 'search_cache' ? 60 :
      entity.type === 'release_cache' ? 300 :
      entity.type === 'home_bundle_cache' ? 300 : 3600
    );

    return {
      category: 'CATEGORY_C_CACHE_TTL',
      target: 'LOCAL_CACHE',
      ttlSeconds: ttl,
      reason: 'Transient or reconstructible data routed to memory/cache with strict TTL; forbidden from persistent SQL',
      allowSqlStorage: false,
      allowTelegramStorage: false,
      isSafeToPurge: true,
    };
  }

  // 4. Essential relational core (Category A)
  return {
    category: 'CATEGORY_A_SQL',
    target: 'YUGABYTEDB',
    ttlSeconds: null,
    reason: 'Essential relational data required for transactions, constraints, indexes, or immediate site operations',
    allowSqlStorage: true,
    allowTelegramStorage: false,
    isSafeToPurge: false,
  };
}

/**
 * Pre-write enforcement guard to ensure no raw media or unbounded cache leaks into YugabyteDB.
 */
export function enforceSieveSqlWrite(
  table: string,
  payload: Record<string, unknown>
): { ok: boolean; error?: string } {
  // Disallow storing raw base64 or buffer blobs directly in text columns of SQL tables
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string') {
      if (value.startsWith('data:image/') || (value.length > MAX_INLINE_SQL_BLOB_BYTES && !key.includes('description') && !key.includes('content') && !key.includes('synopsis'))) {
        return {
          ok: false,
          error: `[DATA_SIEVE_VIOLATION] Column '${key}' exceeds inline threshold (${value.length} bytes). Binary media must be offloaded to Telegram Storage (Category B).`,
        };
      }
    } else if (value instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(value))) {
      const len = (value as Uint8Array).byteLength || (value as Buffer).length;
      if (len > 4096) {
        return {
          ok: false,
          error: `[DATA_SIEVE_VIOLATION] Column '${key}' contains raw binary buffer (${len} bytes). Binary data must be offloaded to Telegram Storage (Category B).`,
        };
      }
    }
  }

  // In media table, require provider to be non-empty and never 'inline' or 'raw_base64'
  if (table === 'media' || table === 'public.media') {
    const provider = String(payload.provider || '');
    if (provider === 'inline' || provider === 'base64' || provider === 'data_uri') {
      return {
        ok: false,
        error: `[DATA_SIEVE_VIOLATION] Media table cannot use inline provider '${provider}'. Provider must be 'telegram' or valid external storage.`,
      };
    }
  }

  return { ok: true };
}
