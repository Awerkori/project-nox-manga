import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db, schema, safeQuery, pool } from '$lib/server/db';
import { sql, eq, and, or, inArray, desc, asc, isNull } from 'drizzle-orm';

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function safeTokenCompare(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(provided);
  const b = encoder.encode(expected);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Authenticates internal server-to-server requests using dedicated bridge token.
 */
export function authenticateInternalGateway(request: Request, url?: URL): void {
  // 1. Enforce HTTPS in production if url is provided
  if (url && url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    error(403, 'Apenas conexões seguras HTTPS são permitidas');
  }

  // 2. Token verification
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    error(401, 'Acesso não autorizado: token ausente');
  }

  const token = authHeader.slice(7).trim();
  const expectedToken = env.NOX_STORAGE_BRIDGE_TOKEN;

  if (!expectedToken || !safeTokenCompare(token, expectedToken)) {
    error(401, 'Acesso não autorizado: token inválido');
  }
}

/* ==========================================================================
   1. JOB ACQUISITION (Atomic lease with SKIP LOCKED)
   ========================================================================== */
export interface AcquireJobsOptions {
  workerId: string;
  leaseDurationMinutes?: number;
  source?: string;
  taskType?: string;
  batchSize?: number;
}

export async function acquireJobsGateway(opts: AcquireJobsOptions) {
  const workerId = opts.workerId || `worker-${crypto.randomUUID().slice(0, 8)}`;
  const leaseMin = Math.max(1, Math.min(60, opts.leaseDurationMinutes || 5));
  const batchSize = Math.max(1, Math.min(10, opts.batchSize || 1));
  const source = opts.source || null;
  const taskType = opts.taskType || null;

  // Single CTE UPDATE with SKIP LOCKED
  const query = sql`
    WITH to_lock AS (
      SELECT id
      FROM importer_queue
      WHERE status IN ('QUEUED', 'RETRY')
        AND next_run_at <= NOW()
        AND (${source}::text IS NULL OR source = ${source}::text)
        AND (
          ${taskType}::text IS NULL
          OR (${taskType}::text = 'DISCOVERY' AND task_type IN ('DISCOVER_WORKS', 'SYNC_WORK'))
          OR task_type = ${taskType}::text
        )
      ORDER BY priority DESC, chapter_sort_key ASC NULLS LAST, next_run_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    )
    UPDATE importer_queue q
    SET status = 'IMPORTING',
        locked_by = ${workerId},
        locked_at = NOW(),
        lease_expires_at = NOW() + (${leaseMin}::text || ' minutes')::interval,
        attempts = q.attempts + 1,
        updated_at = NOW()
    FROM to_lock
    WHERE q.id = to_lock.id
    RETURNING q.id,
              q.task_type AS "task_type",
              q.source,
              q.priority,
              q.payload,
              q.dedupe_key AS "dedupe_key",
              q.status,
              q.attempts,
              q.max_attempts AS "max_attempts",
              q.locked_by AS "locked_by",
              q.locked_at AS "locked_at",
              q.lease_expires_at AS "lease_expires_at",
              q.next_run_at AS "next_run_at",
              q.last_error AS "last_error",
              q.chapter_sort_key AS "chapter_sort_key";
  `;

  const { data, error: qErr } = await safeQuery(db.execute(query));
  if (qErr) {
    throw new Error(`Failed to acquire jobs: ${(qErr as any).message}`);
  }

  const rows = (data as any)?.rows || (Array.isArray(data) ? data : []);
  const jobs = rows.map((r: any) => ({
    id: r.id,
    task_type: r.task_type,
    source: r.source,
    priority: r.priority,
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload || {}),
    dedupe_key: r.dedupe_key,
    status: r.status,
    attempts: r.attempts,
    max_attempts: r.max_attempts,
    locked_by: r.locked_by,
    locked_at: r.locked_at,
    lease_expires_at: r.lease_expires_at,
    next_run_at: r.next_run_at,
    last_error: r.last_error,
    chapter_sort_key: r.chapter_sort_key ? parseFloat(r.chapter_sort_key) : null,
  }));

  return { workerId, jobs };
}

/* ==========================================================================
   2. HEARTBEAT BATCH (Lease extension & progress tracking)
   ========================================================================== */
export interface HeartbeatJobItem {
  jobId: string;
  progressCurrent?: number;
  progressTotal?: number;
  progressStage?: string;
  leaseDurationMinutes?: number;
}

export async function heartbeatBatchGateway(workerId: string, jobs: HeartbeatJobItem[]) {
  if (!jobs || jobs.length === 0) return { success: true, updates: [] };

  const updates: Array<{ jobId: string; status: string; cancelRequested: boolean; renewed: boolean }> = [];

  for (const item of jobs) {
    const leaseMin = Math.max(1, Math.min(60, item.leaseDurationMinutes || 5));
    const query = sql`
      UPDATE importer_queue
      SET lease_expires_at = NOW() + (${leaseMin}::text || ' minutes')::interval,
          progress_current = COALESCE(${item.progressCurrent ?? null}, progress_current),
          progress_total = COALESCE(${item.progressTotal ?? null}, progress_total),
          progress_stage = COALESCE(${item.progressStage ?? null}, progress_stage),
          updated_at = NOW()
      WHERE id = ${item.jobId}
        AND (locked_by = ${workerId} OR locked_by IS NULL)
      RETURNING id, status, cancel_requested;
    `;

    const { data, error: qErr } = await safeQuery(db.execute(query));
    const rows = (data as any)?.rows || (Array.isArray(data) ? data : []);
    if (!qErr && rows.length > 0) {
      const row = rows[0];
      updates.push({
        jobId: row.id,
        status: row.status,
        cancelRequested: Boolean(row.cancel_requested || row.status === 'CANCELLED_BY_STAFF'),
        renewed: true,
      });
    } else {
      // Check current state to see if staff cancelled or ownership lost
      const { data: checkData } = await safeQuery(
        db.select({ status: schema.importerQueue.status, cancelRequested: schema.importerQueue.cancelRequested })
          .from(schema.importerQueue)
          .where(eq(schema.importerQueue.id, item.jobId))
          .limit(1)
      );
      const cur = checkData?.[0];
      updates.push({
        jobId: item.jobId,
        status: cur?.status || 'UNKNOWN',
        cancelRequested: Boolean(cur?.cancelRequested || cur?.status === 'CANCELLED_BY_STAFF'),
        renewed: false,
      });
    }
  }

  return { success: true, updates };
}

/* ==========================================================================
   3. FAIL / RETRY BATCH
   ========================================================================== */
export interface FailJobItem {
  jobId: string;
  status?: 'RETRY' | 'FAILED' | 'PAUSED_BY_STAFF' | 'BLOCKED_BY_UPSTREAM';
  error?: string;
  retryDelaySeconds?: number;
  retryReason?: string;
}

export async function failBatchGateway(workerId: string, jobs: FailJobItem[]) {
  if (!jobs || jobs.length === 0) return { success: true, updatedCount: 0 };

  let updatedCount = 0;
  for (const item of jobs) {
    const targetStatus = item.status || 'RETRY';
    const delaySec = Math.max(1, item.retryDelaySeconds || 30);
    const errText = item.error ? item.error.slice(0, 1000) : null;
    const retryReason = item.retryReason ? item.retryReason.slice(0, 100) : null;

    const query = sql`
      UPDATE importer_queue
      SET status = ${targetStatus},
          last_error = ${errText},
          last_error_at = NOW(),
          retry_reason = ${retryReason},
          next_run_at = NOW() + (${delaySec}::text || ' seconds')::interval,
          locked_by = NULL,
          locked_at = NULL,
          lease_expires_at = NULL,
          updated_at = NOW()
      WHERE id = ${item.jobId}
        AND (locked_by = ${workerId} OR locked_by IS NULL OR status = 'IMPORTING')
      RETURNING id;
    `;

    const { data, error: qErr } = await safeQuery(db.execute(query));
    const rows = (data as any)?.rows || (Array.isArray(data) ? data : []);
    if (!qErr && rows.length > 0) {
      updatedCount += rows.length;
    }
  }

  return { success: true, updatedCount };
}

/* ==========================================================================
   4. ATOMIC CHAPTER PUBLICATION (Single Transaction)
   ========================================================================== */
export interface PublishPageItem {
  position: number;
  mediaId?: string;
  providerKey: string;
  botReference?: string;
  storageShardId?: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
}

export interface PublishBatchPayload {
  jobId?: string;
  work: {
    id?: string;
    slug: string;
    title: string;
    synopsis?: string;
    description?: string;
    author?: string;
    artist?: string;
    kind?: string;
    status?: string;
    ageRating?: number;
    aliases?: string[];
  };
  workMapping?: {
    source: string;
    sourceWorkId: string;
    sourceSlug: string;
    sourceTitle: string;
    metadata?: any;
    isPrimary?: boolean;
    confidenceScore?: number;
  };
  chapter: {
    number: number;
    title?: string;
    chapterSortKey?: number;
    sourceChapterId: string;
    source: string;
  };
  pages: PublishPageItem[];
  isPageProvider?: boolean;
}

export async function publishBatchGateway(payload: PublishBatchPayload) {
  // CRITICAL PRODUCTION GUARD 1: Refuse chapters with 0 pages!
  if (!payload.pages || payload.pages.length === 0) {
    throw new Error('SAFETY_GUARD_REJECTED: Publication refused because page count is 0.');
  }

  // Validate chapter number
  const chapterNumber = payload.chapter.number;
  if (typeof chapterNumber !== 'number' || isNaN(chapterNumber) || chapterNumber < 0) {
    throw new Error(`Invalid chapter number: ${chapterNumber}`);
  }

  const sortKey =
    typeof payload.chapter.chapterSortKey === 'number'
      ? payload.chapter.chapterSortKey
      : Math.round(chapterNumber * 10000);

  const nowIso = new Date().toISOString();

  // Execute ENTIRE publication in ONE single atomic transaction
  return await (db as any).transaction(async (tx: any) => {
    // Step 1: Resolve or Upsert Work
    let workId = payload.work.id || null;

    // Check if mapping exists
    if (!workId && payload.workMapping?.source && payload.workMapping?.sourceWorkId) {
      const mapRes = await tx
        .select({ workId: schema.importerWorkMappings.workId })
        .from(schema.importerWorkMappings)
        .where(
          and(
            eq(schema.importerWorkMappings.source, payload.workMapping.source),
            eq(schema.importerWorkMappings.sourceWorkId, payload.workMapping.sourceWorkId)
          )
        )
        .limit(1);

      if (mapRes.length > 0 && mapRes[0].workId) {
        workId = mapRes[0].workId;
      }
    }

    // Check by slug
    if (!workId && payload.work.slug) {
      const workSlugRes = await tx
        .select({ id: schema.works.id })
        .from(schema.works)
        .where(eq(schema.works.slug, payload.work.slug))
        .limit(1);

      if (workSlugRes.length > 0) {
        workId = workSlugRes[0].id;
      }
    }

    // If still not found, create new Work
    if (!workId) {
      workId = crypto.randomUUID();
      const slug = payload.work.slug || `work-${workId.slice(0, 8)}`;
      const title = payload.work.title || 'Sem título';
      const synopsis = payload.work.synopsis || '';
      const description = payload.work.description || synopsis;
      const author = payload.work.author || 'Desconhecido';
      const artist = payload.work.artist || 'Desconhecido';
      const kind = payload.work.kind || 'MANGA';
      const status = payload.work.status || 'ONGOING';
      const ageRating = payload.work.ageRating ?? 0;
      const searchText = `${title} ${slug}`.toLowerCase();
      const metaProv = JSON.stringify({
        title: { source: payload.chapter.source || 'importer', updated_at: nowIso }
      });

      await tx.execute(sql`
        INSERT INTO works (
          id, slug, title, aliases, synopsis, description, author, artist,
          kind, status, age_rating, published, featured, search_text,
          metadata_provenance, content_rating, views_total, latest_chapter_published_at,
          created_at, updated_at
        ) VALUES (
          ${workId}, ${slug}, ${title}, ARRAY[]::text[], ${synopsis}, ${description},
          ${author}, ${artist}, ${kind}, ${status}, ${ageRating}, true, false, ${searchText},
          ${metaProv}::jsonb, 'SAFE', 0, ${nowIso}::timestamptz,
          ${nowIso}::timestamptz, ${nowIso}::timestamptz
        );
      `);
    }

    // Step 2: Upsert importer_work_mappings if mapping data is provided
    let workMappingId: string = crypto.randomUUID();
    if (payload.workMapping?.source && payload.workMapping?.sourceWorkId) {
      const existingMap = await tx
        .select({ id: schema.importerWorkMappings.id })
        .from(schema.importerWorkMappings)
        .where(
          and(
            eq(schema.importerWorkMappings.source, payload.workMapping.source),
            eq(schema.importerWorkMappings.sourceWorkId, payload.workMapping.sourceWorkId)
          )
        )
        .limit(1);

      if (existingMap.length > 0) {
        workMappingId = existingMap[0].id;
        await tx
          .update(schema.importerWorkMappings)
          .set({
            workId: workId,
            sourceSlug: payload.workMapping.sourceSlug || '',
            sourceTitle: payload.workMapping.sourceTitle || '',
            syncStatus: 'ACTIVE',
            metadata: typeof payload.workMapping.metadata === 'object' ? JSON.stringify(payload.workMapping.metadata) : (payload.workMapping.metadata || '{}'),
            lastSyncedAt: nowIso,
            updatedAt: nowIso,
          })
          .where(eq(schema.importerWorkMappings.id, workMappingId));
      } else {
        await tx.insert(schema.importerWorkMappings).values({
          id: workMappingId,
          source: payload.workMapping.source,
          sourceWorkId: payload.workMapping.sourceWorkId,
          workId: workId,
          sourceSlug: payload.workMapping.sourceSlug || '',
          sourceTitle: payload.workMapping.sourceTitle || '',
          syncStatus: 'ACTIVE',
          metadata: typeof payload.workMapping.metadata === 'object' ? JSON.stringify(payload.workMapping.metadata) : (payload.workMapping.metadata || '{}'),
          confidenceScore: payload.workMapping.confidenceScore ?? 1.0,
          isPrimary: payload.workMapping.isPrimary ?? true,
          matchMethod: 'EXACT',
          lastSyncedAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    // Step 3: Resolve or Insert Chapter
    let chapterId: string;
    const existingChapter = await tx
      .select({ id: schema.chapters.id, publishedAt: schema.chapters.publishedAt })
      .from(schema.chapters)
      .where(
        and(
          eq(schema.chapters.workId, workId!),
          eq(schema.chapters.number, chapterNumber)
        )
      )
      .limit(1);

    if (existingChapter.length > 0) {
      chapterId = existingChapter[0].id;
      await tx.execute(sql`
        UPDATE chapters
        SET title = ${payload.chapter.title || `Capítulo ${chapterNumber}`},
            published_at = COALESCE(published_at, ${nowIso}::timestamptz)
        WHERE id = ${chapterId};
      `);
    } else {
      chapterId = crypto.randomUUID();
      await tx.execute(sql`
        INSERT INTO chapters (
          id, work_id, number, title, published_at, origin, views_total, created_at
        ) VALUES (
          ${chapterId}, ${workId}, ${chapterNumber}, ${payload.chapter.title || `Capítulo ${chapterNumber}`},
          ${nowIso}::timestamptz, 'importer', 0, ${nowIso}::timestamptz
        );
      `);
    }

    // Step 4: Upsert Media rows
    for (const page of payload.pages) {
      const mId = page.mediaId || crypto.randomUUID();
      page.mediaId = mId;

      const shardIdUuid = page.storageShardId && /^[0-9a-f-]{36}$/i.test(page.storageShardId) ? page.storageShardId : null;

      await tx.execute(sql`
        INSERT INTO media (
          id, provider, provider_key, mime, width, height, bytes, sha256,
          created_by, storage_ready, purpose, bot_reference, storage_shard_id, chapter_id, created_at
        ) VALUES (
          ${mId}::uuid, 'telegram', ${page.providerKey}, ${page.mime}, ${page.width}, ${page.height},
          ${page.bytes}, ${page.sha256}, '732fbe87-5040-41fb-9983-0aedb2af44c8'::uuid, true, 'editorial',
          ${page.botReference || 'MANGA_STORAGE_01'}, ${shardIdUuid}::uuid, ${chapterId}::uuid, ${nowIso}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          provider_key = EXCLUDED.provider_key,
          storage_ready = true,
          chapter_id = EXCLUDED.chapter_id;
      `);
    }

    // Step 5: Overwrite Pages for this chapter (Atomic idempotency)
    await tx.execute(sql`DELETE FROM pages WHERE chapter_id = ${chapterId};`);

    for (const page of payload.pages) {
      await tx.execute(sql`
        INSERT INTO pages (chapter_id, position, media_id, width, height)
        VALUES (${chapterId}, ${page.position}, ${page.mediaId}, ${page.width}, ${page.height});
      `);
    }

    // Step 6: Upsert importer_chapter_mappings
    await tx.execute(sql`
      INSERT INTO importer_chapter_mappings (
        id, source, source_chapter_id, chapter_id, work_id, work_mapping_id,
        chapter_number, chapter_sort_key, page_count, is_page_provider, status, is_gap,
        created_at, updated_at
      ) VALUES (
        ${crypto.randomUUID()}, ${payload.chapter.source}, ${payload.chapter.sourceChapterId},
        ${chapterId}, ${workId}, ${workMappingId}, ${chapterNumber}, ${sortKey},
        ${payload.pages.length}, ${payload.isPageProvider ?? true}, 'COMPLETED', false,
        ${nowIso}, ${nowIso}
      )
      ON CONFLICT (source, source_chapter_id) DO UPDATE SET
        chapter_id = EXCLUDED.chapter_id,
        work_id = EXCLUDED.work_id,
        work_mapping_id = EXCLUDED.work_mapping_id,
        chapter_number = EXCLUDED.chapter_number,
        chapter_sort_key = EXCLUDED.chapter_sort_key,
        page_count = EXCLUDED.page_count,
        is_page_provider = EXCLUDED.is_page_provider,
        status = 'COMPLETED',
        is_gap = false,
        last_error = NULL,
        updated_at = ${nowIso};
    `);

    // Step 7: Update importer_queue if jobId was passed
    if (payload.jobId) {
      await tx.execute(sql`
        UPDATE importer_queue
        SET status = 'COMPLETED',
            locked_by = NULL,
            locked_at = NULL,
            lease_expires_at = NULL,
            last_error = NULL,
            progress_stage = 'PUBLISHED',
            progress_current = ${payload.pages.length},
            progress_total = ${payload.pages.length},
            updated_at = NOW()
        WHERE id = ${payload.jobId};
      `);
    }

    // Step 8: Update Work's latest_chapter_published_at and enforce publication barrier for published = true
    const { data: currentWork } = await safeQuerySingle(
      tx.select({ id: schema.works.id, title: schema.works.title, slug: schema.works.slug, coverId: schema.works.coverId })
        .from(schema.works)
        .where(eq(schema.works.id, workId!))
    );

    let canPublish = false;
    if (currentWork?.coverId && currentWork?.title && currentWork?.slug) {
      const { data: coverMedia } = await safeQuerySingle(
        tx.select({ id: schema.media.id, storageReady: schema.media.storageReady, bytes: schema.media.bytes })
          .from(schema.media)
          .where(eq(schema.media.id, currentWork.coverId))
      );
      if (coverMedia?.storageReady && (coverMedia?.bytes || 0) >= 1500) {
        canPublish = true;
      }
    }

    const workUpdate: Record<string, any> = {
      latestChapterPublishedAt: nowIso,
      updatedAt: nowIso,
    };
    if (canPublish) {
      workUpdate.published = true;
    }

    await tx
      .update(schema.works)
      .set(workUpdate)
      .where(eq(schema.works.id, workId!));

    return {
      success: true,
      workId: workId!,
      chapterId,
      pageCount: payload.pages.length,
      publishedAt: nowIso,
    };
  });
}

/* ==========================================================================
   5. ENQUEUE JOBS (Batch with Dedupe Key & Conflict Handling)
   ========================================================================== */
export interface EnqueueJobItem {
  taskType: string;
  source: string;
  dedupeKey: string;
  payload?: Record<string, any>;
  priority?: number;
  chapterSortKey?: number | null;
}

export async function enqueueJobsGateway(jobs: EnqueueJobItem[]) {
  if (!jobs || jobs.length === 0) return { enqueuedCount: 0 };

  let enqueuedCount = 0;
  for (const job of jobs) {
    const payloadStr = typeof job.payload === 'object' ? JSON.stringify(job.payload) : (job.payload || '{}');
    const priority = job.priority ?? 10;
    const sortKey = job.chapterSortKey ?? null;

    const query = sql`
      INSERT INTO importer_queue (
        id, task_type, source, dedupe_key, payload, priority, status,
        chapter_sort_key, attempts, max_attempts, next_run_at, cancel_requested, created_at, updated_at
      ) VALUES (
        ${crypto.randomUUID()}, ${job.taskType}, ${job.source}, ${job.dedupeKey},
        ${payloadStr}, ${priority}, 'QUEUED', ${sortKey}, 0, 5, NOW(), false, NOW(), NOW()
      )
      ON CONFLICT (dedupe_key) DO UPDATE SET
        status = CASE
          WHEN importer_queue.status IN ('FAILED', 'CANCELLED', 'CANCELLED_BY_STAFF') THEN 'QUEUED'
          ELSE importer_queue.status
        END,
        priority = GREATEST(importer_queue.priority, ${priority}),
        payload = ${payloadStr},
        chapter_sort_key = COALESCE(${sortKey}, importer_queue.chapter_sort_key),
        next_run_at = CASE
          WHEN importer_queue.status IN ('FAILED', 'CANCELLED', 'CANCELLED_BY_STAFF') THEN NOW()
          ELSE importer_queue.next_run_at
        END,
        attempts = CASE
          WHEN importer_queue.status IN ('FAILED', 'CANCELLED', 'CANCELLED_BY_STAFF') THEN 0
          ELSE importer_queue.attempts
        END,
        last_error = CASE
          WHEN importer_queue.status IN ('FAILED', 'CANCELLED', 'CANCELLED_BY_STAFF') THEN NULL
          ELSE importer_queue.last_error
        END,
        locked_by = CASE
          WHEN importer_queue.status IN ('FAILED', 'CANCELLED', 'CANCELLED_BY_STAFF') THEN NULL
          ELSE importer_queue.locked_by
        END,
        lease_expires_at = CASE
          WHEN importer_queue.status IN ('FAILED', 'CANCELLED', 'CANCELLED_BY_STAFF') THEN NULL
          ELSE importer_queue.lease_expires_at
        END,
        updated_at = NOW()
      RETURNING id;
    `;

    const { data, error: qErr } = await safeQuery(db.execute(query));
    const rows = (data as any)?.rows || (Array.isArray(data) ? data : []);
    if (!qErr && rows.length > 0) {
      enqueuedCount++;
    }
  }

  return { enqueuedCount };
}

/* ==========================================================================
   6. STALLED LEASES RECOVERY
   ========================================================================== */
export async function recoverStalledGateway() {
  const query = sql`
    UPDATE importer_queue
    SET status = 'QUEUED',
        locked_by = NULL,
        locked_at = NULL,
        lease_expires_at = NULL,
        next_run_at = NOW(),
        last_recovered_error = COALESCE(last_error, 'Lease expirado (recuperado automaticamente)'),
        recovered_at = NOW(),
        retry_reason = 'LEASE_EXPIRED_RECOVERED',
        last_error = NULL,
        updated_at = NOW()
    WHERE status = 'IMPORTING'
      AND lease_expires_at < NOW()
    RETURNING id;
  `;

  const { data, error: qErr } = await safeQuery(db.execute(query));
  const rows = (data as any)?.rows || (Array.isArray(data) ? data : []);
  return { recoveredCount: rows.length };
}

/* ==========================================================================
   7. SOURCES MANAGEMENT
   ========================================================================== */
export async function getSourcesGateway(enabledOnly = false) {
  const query = enabledOnly
    ? sql`SELECT id, name, base_url AS "baseUrl", enabled, rate_limit_per_second AS "rateLimitPerSecond", sync_interval_minutes AS "syncIntervalMinutes", last_sync_at AS "lastSyncAt", config, created_at AS "createdAt" FROM importer_sources WHERE enabled IS TRUE ORDER BY name ASC`
    : sql`SELECT id, name, base_url AS "baseUrl", enabled, rate_limit_per_second AS "rateLimitPerSecond", sync_interval_minutes AS "syncIntervalMinutes", last_sync_at AS "lastSyncAt", config, created_at AS "createdAt" FROM importer_sources ORDER BY name ASC`;

  const { data, error: qErr } = await safeQuery((db as any).execute(query));
  if (qErr) throw qErr;

  const rows = (data as any)?.rows || (Array.isArray(data) ? data : []);
  return rows.map((s: any) => ({
    id: s.id,
    name: s.name,
    baseUrl: s.baseUrl,
    enabled: Boolean(s.enabled),
    rateLimitPerSecond: s.rateLimitPerSecond,
    syncIntervalMinutes: s.syncIntervalMinutes,
    lastSyncAt: s.lastSyncAt,
    config: typeof s.config === 'string' ? JSON.parse(s.config || '{}') : (s.config || {}),
    createdAt: s.createdAt,
  }));
}

export async function updateSourceGateway(sourceIdOrName: string, update: {
  lastSyncAt?: string;
  enabled?: boolean;
  config?: Record<string, any>;
}) {
  const query = sql`
    UPDATE importer_sources
    SET updated_at = NOW(),
        last_sync_at = COALESCE(${update.lastSyncAt ?? null}, last_sync_at),
        enabled = COALESCE(${update.enabled !== undefined ? update.enabled : null}, enabled),
        config = COALESCE(${update.config ? JSON.stringify(update.config) : null}, config)
    WHERE id = ${sourceIdOrName} OR name = ${sourceIdOrName}
    RETURNING id;
  `;
  const { data, error: qErr } = await safeQuery((db as any).execute(query));
  if (qErr) throw qErr;
  const rows = (data as any)?.rows || (Array.isArray(data) ? data : []);
  return { success: true, updated: Boolean(rows.length) };
}

/* ==========================================================================
   8. CHECKPOINTS MANAGEMENT
   ========================================================================== */
export async function getCheckpointGateway(source: string) {
  const { data, error: qErr } = await safeQuery(
    db.select().from(schema.importerCheckpoints).where(eq(schema.importerCheckpoints.source, source)).limit(1)
  );
  if (qErr) throw qErr;
  const row = data?.[0];
  if (!row) return null;
  return {
    id: row.id,
    source: row.source,
    cursor_value: row.cursorValue,
    last_checked_at: row.lastCheckedAt,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata || {}),
  };
}

export async function saveCheckpointGateway(
  source: string,
  cursorValue: string | null,
  metadata: Record<string, any> = {}
) {
  const nowIso = new Date().toISOString();
  const metaStr = JSON.stringify(metadata);

  await (db as any).execute(sql`
    INSERT INTO importer_checkpoints (id, source, cursor_value, metadata, last_checked_at, updated_at)
    VALUES (${crypto.randomUUID()}, ${source}, ${cursorValue}, ${metaStr}, ${nowIso}, ${nowIso})
    ON CONFLICT (source) DO UPDATE SET
      cursor_value = EXCLUDED.cursor_value,
      metadata = EXCLUDED.metadata,
      last_checked_at = ${nowIso},
      updated_at = ${nowIso};
  `);

  return { success: true, source, cursorValue };
}

/* ==========================================================================
   9. WORK DEDUPLICATION / MATCHING
   ========================================================================== */
export interface ResolveWorkCandidate {
  source: string;
  sourceWorkId: string;
  sourceSlug?: string;
  title: string;
  slug?: string;
  aliases?: string[];
}

export async function resolveWorkGateway(candidate: ResolveWorkCandidate) {
  // 1. Check existing mapping
  const mapRes = await (db as any).execute(sql`
    SELECT m.id AS "mappingId", m.work_id AS "workId", w.title, w.slug, w.kind, w.status
    FROM importer_work_mappings m
    LEFT JOIN works w ON w.id = m.work_id
    WHERE m.source = ${candidate.source}
      AND (
        m.source_work_id = ${candidate.sourceWorkId}
        OR (${candidate.sourceSlug ?? null}::text IS NOT NULL AND m.source_slug = ${candidate.sourceSlug ?? null})
      )
    LIMIT 1;
  `);

  const mapRows = (mapRes as any)?.rows || (Array.isArray(mapRes) ? mapRes : []);
  if (mapRows.length > 0 && mapRows[0].workId) {
    return {
      matched: true,
      matchMethod: 'EXISTING_MAPPING',
      workId: mapRows[0].workId,
      mappingId: mapRows[0].mappingId,
      work: {
        id: mapRows[0].workId,
        title: mapRows[0].title,
        slug: mapRows[0].slug,
        kind: mapRows[0].kind,
        status: mapRows[0].status,
      },
    };
  }

  // 2. Check by exact slug or title match in works
  const candidateSlug = candidate.slug || candidate.sourceSlug || '';
  if (candidateSlug) {
    const slugRes = await (db as any).execute(sql`
      SELECT id, title, slug, kind, status
      FROM works
      WHERE slug = ${candidateSlug}
      LIMIT 1;
    `);

    const slugRows = (slugRes as any)?.rows || (Array.isArray(slugRes) ? slugRes : []);
    if (slugRows.length > 0) {
      return {
        matched: true,
        matchMethod: 'EXACT_SLUG',
        workId: slugRows[0].id,
        mappingId: null,
        work: slugRows[0],
      };
    }
  }

  // 3. Check by title match in works
  if (candidate.title) {
    const titleRes = await (db as any).execute(sql`
      SELECT id, title, slug, kind, status
      FROM works
      WHERE LOWER(title) = LOWER(${candidate.title})
      LIMIT 1;
    `);

    const titleRows = (titleRes as any)?.rows || (Array.isArray(titleRes) ? titleRes : []);
    if (titleRows.length > 0) {
      return {
        matched: true,
        matchMethod: 'EXACT_TITLE',
        workId: titleRows[0].id,
        mappingId: null,
        work: titleRows[0],
      };
    }
  }

  return { matched: false, workId: null, mappingId: null };
}

/* ==========================================================================
   10. CONSOLIDATED STATS (For Read-Only Consistency Auditing)
   ========================================================================== */
export async function getStatsGateway() {
  const statsRes = await (db as any).execute(sql`
    WITH src_counts AS (
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN enabled IS TRUE THEN 1 ELSE 0 END), 0)::int AS enabled,
        COALESCE(SUM(CASE WHEN enabled IS NOT TRUE THEN 1 ELSE 0 END), 0)::int AS disabled
      FROM importer_sources
    ),
    q_counts AS (
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN status = 'QUEUED' THEN 1 ELSE 0 END), 0)::int AS queued,
        COALESCE(SUM(CASE WHEN status = 'IMPORTING' THEN 1 ELSE 0 END), 0)::int AS importing,
        COALESCE(SUM(CASE WHEN status = 'RETRY' THEN 1 ELSE 0 END), 0)::int AS retry,
        COALESCE(SUM(CASE WHEN status = 'PAUSED_BY_STAFF' THEN 1 ELSE 0 END), 0)::int AS paused,
        COALESCE(SUM(CASE WHEN status = 'CANCELLED' OR status = 'CANCELLED_BY_STAFF' THEN 1 ELSE 0 END), 0)::int AS cancelled,
        COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END), 0)::int AS completed,
        COALESCE(SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END), 0)::int AS failed
      FROM importer_queue
    ),
    map_counts AS (
      SELECT
        (SELECT COUNT(*)::int FROM importer_work_mappings) AS work_mappings,
        (SELECT COUNT(*)::int FROM importer_chapter_mappings) AS chapter_mappings
    )
    SELECT
      json_build_object('total', s.total, 'enabled', s.enabled, 'disabled', s.disabled) AS sources,
      json_build_object(
        'total', q.total, 'queued', q.queued, 'importing', q.importing,
        'retry', q.retry, 'paused', q.paused, 'cancelled', q.cancelled,
        'completed', q.completed, 'failed', q.failed
      ) AS queue,
      json_build_object('workMappings', m.work_mappings, 'chapterMappings', m.chapter_mappings) AS mappings
    FROM src_counts s, q_counts q, map_counts m;
  `);

  const rows = (statsRes as any)?.rows || (Array.isArray(statsRes) ? statsRes : []);
  if (rows.length > 0) {
    return rows[0];
  }

  return {
    sources: { total: 0, enabled: 0, disabled: 0 },
    queue: { total: 0, queued: 0, importing: 0, retry: 0, paused: 0, completed: 0, failed: 0 },
    mappings: { workMappings: 0, chapterMappings: 0 },
  };
}

/* ==========================================================================
   13. INTERNAL SECURE SQL GATEWAY (Parameterized Queries via Hyperdrive)
   ========================================================================== */
export async function executeSqlGateway(queryText: string, params: any[] = []) {
  if (!queryText || typeof queryText !== 'string') {
    throw new Error('Missing or invalid query text');
  }

  const res = await pool.query(queryText, params || []);
  return {
    rows: res.rows || [],
    rowCount: res.rowCount ?? (res.rows ? res.rows.length : 0),
  };
}

export async function executeBatchSqlGateway(queries: Array<{ text: string; params?: any[] }>) {
  if (!Array.isArray(queries) || queries.length === 0) {
    return [];
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const q of queries) {
      const res = await client.query(q.text, q.params || []);
      results.push({
        rows: res.rows || [],
        rowCount: res.rowCount ?? (res.rows ? res.rows.length : 0),
      });
    }
    await client.query('COMMIT');
    return results;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

