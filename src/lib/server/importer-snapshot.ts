import { executeYugabyteSql, withYugabyteReadSession } from '$lib/server/yugabyte';

export interface PublicationRateTelemetry {
  rate1m: number;
  rate5m: number;
  rate10m: number;
  rate30m: number;
  visible1m: number;
  visible5m: number;
  visible10m: number;
  visible30m: number;
  fresh1m: number;
  fresh5m: number;
  fresh10m: number;
  fresh30m: number;
  completedRate5m: number;
  completedRate30m: number;
  completed5m: number;
  completed30m: number;
  latestPublishedAt: string | null;
}

export interface CanonicalPublicationSnapshot {
  bucketRows: Array<Record<string, any>>;
  latestPublishedAt: string | null;
  source: 'YSQL_CANONICAL' | 'UNAVAILABLE';
}

/** Calculate all rate windows from canonical visible publication counts only. */
export function calculatePublicationRateTelemetry(
  bucketRows: Array<Record<string, any>>,
  nowMs = Date.now(),
): PublicationRateTelemetry {
  const oneMinAgo = nowMs - 60_000;
  const fiveMinAgo = nowMs - 5 * 60_000;
  const tenMinAgo = nowMs - 10 * 60_000;
  const thirtyMinAgo = nowMs - 30 * 60_000;
  let visible1m = 0;
  let visible5m = 0;
  let visible10m = 0;
  let visible30m = 0;
  let fresh1m = 0;
  let fresh5m = 0;
  let fresh10m = 0;
  let fresh30m = 0;
  let completed5m = 0;
  let completed30m = 0;
  let latestPublishedAt: string | null = null;

  for (const bucket of bucketRows) {
    const timestamp = new Date(bucket.bucket_minute).getTime();
    const visible = Number(bucket.visible_published || 0);
    const fresh = Number(bucket.fresh_visible || 0);
    const completed = Number(bucket.completed_jobs || 0);
    const latest = bucket.latest_published_at || (visible > 0 ? bucket.bucket_minute : null);
    if (latest && (!latestPublishedAt || new Date(latest).getTime() > new Date(latestPublishedAt).getTime())) {
      latestPublishedAt = new Date(latest).toISOString();
    }
    if (timestamp >= oneMinAgo) {
      visible1m += visible;
      fresh1m += fresh;
    }
    if (timestamp >= fiveMinAgo) {
      visible5m += visible;
      fresh5m += fresh;
      completed5m += completed;
    }
    if (timestamp >= tenMinAgo) {
      visible10m += visible;
      fresh10m += fresh;
    }
    if (timestamp >= thirtyMinAgo) {
      visible30m += visible;
      fresh30m += fresh;
      completed30m += completed;
    }
  }

  return {
    rate1m: visible1m,
    rate5m: Math.round((visible5m / 5) * 10) / 10,
    rate10m: Math.round((visible10m / 10) * 10) / 10,
    rate30m: Math.round((visible30m / 30) * 10) / 10,
    visible1m,
    visible5m,
    visible10m,
    visible30m,
    fresh1m,
    fresh5m,
    fresh10m,
    fresh30m,
    completedRate5m: Math.round((completed5m / 5) * 10) / 10,
    completedRate30m: Math.round((completed30m / 30) * 10) / 10,
    completed5m,
    completed30m,
    latestPublishedAt,
  };
}

/**
 * Read the authoritative publication transition from Yugabyte. The importer
 * and the site must not use different database planes for this metric.
 */
export async function loadCanonicalPublicationSnapshot(platform: any, nowMs = Date.now()): Promise<CanonicalPublicationSnapshot> {
  const since = new Date(nowMs - 65 * 60_000).toISOString();
  try {
    const [publishedResult, pipelineResult] = await Promise.allSettled([
      executeYugabyteSql(
        `SELECT date_trunc('minute', published_at) AS bucket_minute,
                MAX(published_at) AS latest_published_at,
                COUNT(*)::int AS visible_published,
                COUNT(*) FILTER (WHERE COALESCE(is_fresh_release, false))::int AS fresh_visible
         FROM public.chapters
         WHERE published_at >= $1::timestamptz
         GROUP BY date_trunc('minute', published_at)
         ORDER BY bucket_minute DESC`,
        [since],
        platform?.env,
      ),
      executeYugabyteSql(
        `SELECT bucket_minute, completed_jobs
         FROM public.importer_rate_buckets
         WHERE bucket_minute >= $1::timestamptz
         ORDER BY bucket_minute DESC`,
        [since],
        platform?.env,
      ),
    ]);

    // Canonical publication is the source of truth for cap/min. A secondary
    // pipeline-bucket read must never turn a successful chapter publication
    // into an all-zero snapshot when that auxiliary table is unavailable.
    if (publishedResult.status === 'rejected') {
      throw publishedResult.reason;
    }
    const publishedRes = publishedResult.value;
    const pipelineRes = pipelineResult.status === 'fulfilled' ? pipelineResult.value : { rows: [] };
    if (pipelineResult.status === 'rejected') {
      console.warn('[PIPELINE_RATE_TELEMETRY_UNAVAILABLE]', pipelineResult.reason?.message || pipelineResult.reason);
    }

    const byMinute = new Map<string, Record<string, any>>();
    for (const row of publishedRes.rows || []) {
      const key = new Date(row.bucket_minute).toISOString();
      byMinute.set(key, {
        bucket_minute: key,
        latest_published_at: row.latest_published_at,
        visible_published: Number(row.visible_published || 0),
        fresh_visible: Number(row.fresh_visible || 0),
        completed_jobs: 0,
      });
    }
    for (const row of pipelineRes.rows || []) {
      const key = new Date(row.bucket_minute).toISOString();
      const bucket = byMinute.get(key) || {
        bucket_minute: key,
        latest_published_at: null,
        visible_published: 0,
        fresh_visible: 0,
        completed_jobs: 0,
      };
      bucket.completed_jobs = Number(row.completed_jobs || 0);
      byMinute.set(key, bucket);
    }
    return {
      bucketRows: [...byMinute.values()].sort((a, b) =>
        new Date(b.bucket_minute).getTime() - new Date(a.bucket_minute).getTime()),
      latestPublishedAt: publishedRes.rows?.[0]?.latest_published_at
        ? new Date(publishedRes.rows[0].latest_published_at).toISOString()
        : null,
      source: 'YSQL_CANONICAL',
    };
  } catch (error: any) {
    console.warn('[CANONICAL_PUBLICATION_TELEMETRY_UNAVAILABLE]', error?.message || error);
    return { bucketRows: [], latestPublishedAt: null, source: 'UNAVAILABLE' };
  }
}

export async function loadYsqlImporterHeartbeat(platform: any): Promise<any | null> {
  try {
    const result = await executeYugabyteSql(
      `SELECT value FROM public.settings WHERE key = 'importer_heartbeat' LIMIT 1`,
      [],
      platform?.env,
    );
    const value = result.rows?.[0]?.value;
    if (!value) return null;
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch (error: any) {
    console.warn('[YSQL_HEARTBEAT_FETCH_WARN]', error?.message || error);
    return null;
  }
}

const SNAPSHOT_FRESH_TTL_MS = 20_000;
const SNAPSHOT_STALE_TTL_MS = 120_000;
const AUX_METADATA_TTL_MS = 45_000;

let cachedSnapshotEntry: { at: number; data: any } | null = null;
let inFlightSnapshotPromise: Promise<any> | null = null;
let cachedAuxMetadataEntry: { at: number; data: any } | null = null;
let inFlightAuxMetadataPromise: Promise<any> | null = null;

export function invalidateImporterSnapshotCache(): void {
  cachedSnapshotEntry = null;
  cachedAuxMetadataEntry = null;
}

function parseJsonSafe(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function mapLitePriorityToUi(priority: unknown): number {
  const p = Number(priority);
  if (p === 0) return 1000;
  if (p === 1) return 100;
  if (p === 2) return 80;
  return 40;
}

function mapLiteTaskRow(
  row: Record<string, any>,
  statusOverride: string,
  workerByTaskId: Map<string, any>,
): Record<string, any> {
  const payloadObj = parseJsonSafe(row.payload);
  const checkpointObj = parseJsonSafe(row.checkpoint);
  const liveWorker = workerByTaskId.get(String(row.id));
  const workId = row.work_id || payloadObj.workId || null;
  const chapterSortKey =
    payloadObj.orderKey ?? payloadObj.chapterNumber ?? row.chapter_key ?? null;
  const source = String(payloadObj.source || liveWorker?.source || 'unknown');

  return {
    id: row.id,
    task_type: row.task_type,
    status: statusOverride,
    source,
    chapter_sort_key: chapterSortKey,
    priority: mapLitePriorityToUi(row.priority),
    attempts: Number(row.attempts || 0),
    next_run_at: row.next_run_at || null,
    locked_by: row.lease_owner || liveWorker?.slotId || null,
    lease_expires_at: row.lease_until || null,
    last_error: row.reason || null,
    pause_reason: statusOverride === 'PAUSED_BY_STAFF' ? row.reason || null : null,
    progress_current: checkpointObj.uploadedPages ?? checkpointObj.downloadedPages ?? null,
    progress_total: checkpointObj.totalPages ?? payloadObj.pageCount ?? null,
    progress_stage:
      liveWorker?.stage ||
      checkpointObj.stage ||
      (row.task_type === 'PUBLISH' ? 'PUBLISHING' : 'UPLOADING'),
    updated_at: row.updated_at || row.created_at || null,
    created_at: row.created_at || null,
    payload: {
      ...payloadObj,
      workId,
      workTitle: payloadObj.workTitle || payloadObj.title || null,
      chapterNumber: payloadObj.chapterNumber ?? chapterSortKey,
    },
  };
}

async function safeSupabaseQuery<T = any>(
  factory: () => PromiseLike<{ data: T | null; error?: any; count?: number | null }>,
  fallbackData: T,
  timeoutMs = 2_800,
): Promise<{ data: T; count: number }> {
  try {
    const result = await Promise.race([
      Promise.resolve(factory()),
      new Promise<{ data: T; error: Error; count: number }>((resolve) =>
        setTimeout(() => resolve({ data: fallbackData, error: new Error('timeout'), count: 0 }), timeoutMs),
      ),
    ]);
    if (result?.error || result?.data == null) {
      return { data: fallbackData, count: Number(result?.count || 0) };
    }
    return { data: result.data, count: Number(result.count || 0) };
  } catch {
    return { data: fallbackData, count: 0 };
  }
}

async function loadAuxSupabaseMetadata(locals: any, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedAuxMetadataEntry && now - cachedAuxMetadataEntry.at < AUX_METADATA_TTL_MS) {
    return cachedAuxMetadataEntry.data;
  }
  if (!forceRefresh && inFlightAuxMetadataPromise) {
    return inFlightAuxMetadataPromise;
  }

  const promise = (async () => {
    const [staffRequestsRes, workHealthRes, staffAuditRes, recentManifestRes, stagedRes] = await Promise.all([
      safeSupabaseQuery(
        () =>
          locals.db
            .from('importer_staff_requests')
            .select('*, works(id, title, slug, cover_id), requester:members!importer_staff_requests_requested_by_fkey(id, username, display_name), canceller:members!importer_staff_requests_cancelled_by_fkey(id, username, display_name)')
            .order('created_at', { ascending: false })
            .limit(12),
        [],
      ),
      safeSupabaseQuery(
        () =>
          locals.db
            .from('importer_work_health')
            .select('*, works(id, title, slug, cover_id)')
            .order('last_reconciled_at', { ascending: false, nullsFirst: false })
            .limit(36),
        [],
      ),
      safeSupabaseQuery(
        () =>
          locals.db
            .from('importer_staff_audit')
            .select('*, actor:members!importer_staff_audit_actor_id_fkey(id, username, display_name)')
            .order('created_at', { ascending: false })
            .limit(10),
        [],
      ),
      safeSupabaseQuery(
        () =>
          locals.db
            .from('importer_chapter_manifest')
            .select('id, work_id, chapter_number, chapter_sort_key, status, selected_source, available_sources, page_count, last_checked_at')
            .order('chapter_sort_key', { ascending: true })
            .limit(40),
        [],
      ),
      safeSupabaseQuery(
        () =>
          locals.db
            .from('importer_chapter_mappings')
            .select('*, works(id, title, cover_id)', { count: 'exact' })
            .eq('status', 'STAGED')
            .order('chapter_sort_key', { ascending: true })
            .limit(8),
        [],
      ),
    ]);

    const data = {
      staffRequests: staffRequestsRes.data || [],
      workHealthRaw: workHealthRes.data || [],
      staffAudit: staffAuditRes.data || [],
      chapterManifest: recentManifestRes.data || [],
      stagedChapters: stagedRes.data || [],
      stagedCount: stagedRes.count || (stagedRes.data || []).length,
    };
    cachedAuxMetadataEntry = { at: Date.now(), data };
    return data;
  })().finally(() => {
    if (inFlightAuxMetadataPromise === promise) {
      inFlightAuxMetadataPromise = null;
    }
  });

  inFlightAuxMetadataPromise = promise;
  return promise;
}

export async function loadSnapshot(
  { locals, platform }: any,
  options?: { forceRefresh?: boolean },
) {
  const forceRefresh = Boolean(options?.forceRefresh);
  const isTestEnv =
    typeof process !== 'undefined' && (process.env?.VITEST === 'true' || process.env?.NODE_ENV === 'test');

  if (!isTestEnv && !forceRefresh) {
    const now = Date.now();
    if (cachedSnapshotEntry) {
      const ageMs = now - cachedSnapshotEntry.at;
      if (ageMs < SNAPSHOT_FRESH_TTL_MS) {
        return cachedSnapshotEntry.data;
      }
      if (ageMs < SNAPSHOT_STALE_TTL_MS) {
        if (!inFlightSnapshotPromise) {
          const bg = buildSnapshot({ locals, platform }, false);
          platform?.context?.waitUntil?.(bg.catch(() => {}));
        }
        return cachedSnapshotEntry.data;
      }
    }
    if (inFlightSnapshotPromise) {
      return inFlightSnapshotPromise;
    }
  }

  return buildSnapshot({ locals, platform }, forceRefresh, isTestEnv);
}

async function buildSnapshot(
  { locals, platform }: any,
  forceRefresh = false,
  isTestEnv = false,
) {
  if (!isTestEnv && !forceRefresh && inFlightSnapshotPromise) {
    return inFlightSnapshotPromise;
  }

  const runSnapshot = async () => {
    const snapshotStartedAt = performance.now();
    const queryTimings: Record<string, number> = {};
    const profileEnabled =
      platform?.env?.IMPORTER_SNAPSHOT_PROFILE === '1' ||
      (typeof process !== 'undefined' && process.env?.IMPORTER_SNAPSHOT_PROFILE === '1');

    const timed = async <T>(name: string, query: () => Promise<T>): Promise<T> => {
      if (!profileEnabled) return query();
      const startedAt = performance.now();
      try {
        return await query();
      } finally {
        queryTimings[name] = Math.round(performance.now() - startedAt);
      }
    };

    // Execute all YugabyteDB reads on a single pinned session (maxConcurrency = 1)
    // in parallel with bounded, cached Supabase operational metadata. Never invoke
    // legacy 215k-row `importer_queue` or `admin_importer_queue_counts` scans.
    const [ysqlBundle, auxMeta] = await Promise.all([
      withYugabyteReadSession(
        platform?.env,
        async (sessionEnv) => {
          const sessionPlatform = platform ? { ...platform, env: sessionEnv } : { env: sessionEnv };
          const safeSql = async (name: string, sql: string, params: unknown[] = []) => {
            try {
              const res = await timed(name, () => executeYugabyteSql(sql, params, sessionEnv));
              return res.rows || [];
            } catch (err: any) {
              console.warn(`[IMPORTER_SNAPSHOT_SQL_WARN:${name}]`, err?.message || err);
              return [];
            }
          };

          const [
            canonicalPublication,
            heartbeatData,
            runningRows,
            retryRows,
            readyRows,
            blockedRows,
            sourcesRows,
            catalogWorksRows,
            reltuplesRows,
          ] = await Promise.all([
            timed('canonical_publications', () => loadCanonicalPublicationSnapshot(sessionPlatform)),
            timed('ysql_heartbeat', () => loadYsqlImporterHeartbeat(sessionPlatform)),
            // Uses importer_lite_tasks_recovery_idx (WHERE state IN ('RUNNING', 'RETRY_WAIT'))
            safeSql(
              'running_tasks',
              `SELECT id, task_type, work_id, work_key, chapter_key, priority, state, attempts,
                      next_run_at, lease_owner, lease_until, reason, payload, checkpoint, created_at, updated_at
               FROM public.importer_lite_tasks
               WHERE state = 'RUNNING'
               ORDER BY lease_until DESC NULLS LAST
               LIMIT 24`,
            ),
            safeSql(
              'retry_tasks',
              `SELECT id, task_type, work_id, work_key, chapter_key, priority, state, attempts,
                      next_run_at, lease_owner, lease_until, reason, payload, checkpoint, created_at, updated_at
               FROM public.importer_lite_tasks
               WHERE state = 'RETRY_WAIT'
               ORDER BY lease_until ASC NULLS LAST, next_run_at ASC NULLS LAST
               LIMIT 20`,
            ),
            // Uses importer_lite_tasks_work_pending_chapter_order_idx
            safeSql(
              'ready_tasks',
              `SELECT id, task_type, work_id, work_key, chapter_key, priority, state, attempts,
                      next_run_at, lease_owner, lease_until, reason, payload, checkpoint, created_at, updated_at
               FROM public.importer_lite_tasks
               WHERE task_type IN ('IMPORT_CHAPTER', 'PUBLISH') AND state = 'READY'
               ORDER BY work_key ASC, NULLIF((payload->>'orderKey'), '') ASC, id ASC
               LIMIT 12`,
            ),
            // Uses importer_lite_tasks_blocked_work_idx (WHERE state = 'BLOCKED')
            safeSql(
              'blocked_tasks',
              `SELECT id, task_type, work_id, work_key, chapter_key, priority, state, attempts,
                      next_run_at, lease_owner, lease_until, reason, payload, checkpoint, created_at, updated_at
               FROM public.importer_lite_tasks
               WHERE state = 'BLOCKED'
               ORDER BY work_id ASC, updated_at DESC
               LIMIT 36`,
            ),
            safeSql(
              'ysql_sources',
              `SELECT s.*,
                      h.consecutive_failures,
                      h.cooldown_until,
                      h.last_error AS health_last_error,
                      h.last_success_at AS health_last_success_at
               FROM public.importer_sources s
               LEFT JOIN public.importer_lite_source_health h ON h.source = s.id
               ORDER BY s.name ASC`,
            ),
            safeSql(
              'catalog_works',
              `SELECT id, title, slug, cover_id
               FROM public.works
               WHERE published = true
               ORDER BY updated_at DESC NULLS LAST
               LIMIT 32`,
            ),
            safeSql(
              'reltuples_estimates',
              `SELECT relname, GREATEST(0, reltuples::bigint)::int AS est
               FROM pg_class
               WHERE relname IN ('importer_lite_tasks', 'chapters')`,
            ),
          ]);

          const neededWorkIds = Array.from(
            new Set(
              [...runningRows, ...retryRows, ...readyRows, ...blockedRows]
                .map((r: any) => r.work_id || parseJsonSafe(r.payload).workId)
                .filter((id: any) => typeof id === 'string' && id.length >= 32),
            ),
          );

          let jobWorksRows: Array<Record<string, any>> = [];
          if (neededWorkIds.length > 0) {
            jobWorksRows = await safeSql(
              'job_works',
              `SELECT id, title, cover_id, slug
               FROM public.works
               WHERE id = ANY($1::uuid[])`,
              [neededWorkIds],
            );
          }

          return {
            canonicalPublication,
            heartbeatData,
            runningRows,
            retryRows,
            readyRows,
            blockedRows,
            sourcesRows,
            catalogWorksRows,
            reltuplesRows,
            jobWorksRows,
          };
        },
        1,
      ),
      timed('aux_supabase_meta', () => loadAuxSupabaseMetadata(locals, forceRefresh)),
    ]);

    const {
      canonicalPublication,
      heartbeatData,
      runningRows,
      retryRows,
      readyRows,
      blockedRows,
      sourcesRows,
      catalogWorksRows,
      reltuplesRows,
      jobWorksRows,
    } = ysqlBundle;

    // Fallback to Supabase sources/works only if YugabyteDB returned empty (e.g. unit test mocks)
    let sourcesList = sourcesRows;
    if (sourcesList.length === 0 && locals?.db) {
      const fallbackSources = await safeSupabaseQuery(
        () => locals.db.from('importer_sources').select('*').order('name', { ascending: true }),
        [],
      );
      sourcesList = fallbackSources.data || [];
    }

    let catalogWorks = catalogWorksRows;
    if (catalogWorks.length === 0 && locals?.db) {
      const fallbackWorks = await safeSupabaseQuery(
        () =>
          locals.db
            .from('works')
            .select('id, title, slug, cover_id')
            .order('updated_at', { ascending: false })
            .limit(32),
        [],
      );
      catalogWorks = fallbackWorks.data || [];
    }

    const bucketRows = canonicalPublication.bucketRows;
    const rateTelemetry = {
      ...calculatePublicationRateTelemetry(bucketRows),
      source: canonicalPublication.source,
    };

    const workerByTaskId = new Map<string, any>();
    for (const slot of heartbeatData?.workers || []) {
      if (slot?.taskId) {
        workerByTaskId.set(String(slot.taskId), slot);
      }
    }

    const importingJobs = runningRows.map((r: any) => mapLiteTaskRow(r, 'IMPORTING', workerByTaskId));
    const retryJobs = retryRows.map((r: any) => mapLiteTaskRow(r, 'RETRY', workerByTaskId));
    const pausedJobs: Array<Record<string, any>> = [];
    const queuedJobs = readyRows.map((r: any) => mapLiteTaskRow(r, 'QUEUED', workerByTaskId));
    const blockedMapped = blockedRows.map((r: any) => mapLiteTaskRow(r, 'FAILED', workerByTaskId));

    const worksMap: Record<string, any> = {};
    for (const w of catalogWorks) {
      if (w?.id) worksMap[w.id] = w;
    }
    for (const w of jobWorksRows) {
      if (w?.id) worksMap[w.id] = w;
    }

    const reltuplesMap = Object.fromEntries(
      (reltuplesRows || []).map((r: any) => [String(r.relname), Number(r.est || 0)]),
    );

    const activeWorkersCount = Number(
      heartbeatData?.chapterAdmission?.active ??
        (Array.isArray(heartbeatData?.workers)
          ? heartbeatData.workers.filter((w: any) => Boolean(w?.taskId)).length
          : importingJobs.length),
    );
    const configuredConcurrency = Number(
      heartbeatData?.chapterAdmission?.capacity ??
        heartbeatData?.capacity?.concurrency ??
        heartbeatData?.chapterWorkers ??
        20,
    );
    const manualStopActive = Boolean(heartbeatData?.manualProtectiveStop?.active);

    const telemetry = heartbeatData
      ? {
          worker_id: heartbeatData.runtimeInstanceId || 'importer-r842',
          rss_mb: Math.round(
            Number(
              heartbeatData.memoryPressure?.rssMiB ??
                heartbeatData.liveness?.memoryMiB?.rss ??
                0,
            ),
          ),
          heap_used_mb: Math.round(
            Number(
              heartbeatData.memoryPressure?.heapUsedMiB ??
                heartbeatData.liveness?.memoryMiB?.heapUsed ??
                0,
            ),
          ),
          heap_total_mb: Math.round(
            Number(
              heartbeatData.memoryPressure?.heapTotalMiB ??
                heartbeatData.liveness?.memoryMiB?.heapTotal ??
                0,
            ),
          ),
          array_buffers_mb: Math.round(
            Number(heartbeatData.liveness?.memoryMiB?.arrayBuffers ?? 0),
          ),
          event_loop_lag_ms: Math.round(
            Number(heartbeatData.liveness?.eventLoopLagMs ?? heartbeatData.eventLoopLagMs ?? 0),
          ),
          concurrency: configuredConcurrency,
          active_jobs: activeWorkersCount,
          cycle_action:
            heartbeatData.adaptiveAdmission?.action ??
            heartbeatData.adaptiveAdmission?.mode ??
            (manualStopActive ? 'MANUAL_STOP' : 'ALWAYS_ON'),
          cycle_reason:
            heartbeatData.adaptiveAdmission?.reason ??
            heartbeatData.capacity?.pressureReason ??
            'Operação contínua Always-On',
          protective_stop: manualStopActive,
          protective_stop_reason: heartbeatData.manualProtectiveStop?.reason ?? null,
          created_at: heartbeatData.observedAt || new Date().toISOString(),
        }
      : null;

    const adaptiveCapacity = {
      concurrency: heartbeatData?.capacity?.concurrency ?? configuredConcurrency,
      maxConcurrency:
        heartbeatData?.capacity?.maxConcurrency ??
        heartbeatData?.chapterWorkers ??
        configuredConcurrency,
      state:
        heartbeatData?.capacity?.state ??
        heartbeatData?.adaptiveAdmission?.state ??
        (manualStopActive ? 'MANUAL_STOP' : 'RUNNING_STABLE'),
      pressureScore: Number(
        heartbeatData?.capacity?.pressureScore ??
          heartbeatData?.adaptiveAdmission?.pressureScore ??
          0,
      ),
      siteHealth:
        heartbeatData?.capacity?.siteHealth ??
        heartbeatData?.site?.status ??
        'GREEN',
      reason:
        heartbeatData?.capacity?.pressureReason ??
        heartbeatData?.adaptiveAdmission?.reason ??
        telemetry?.cycle_reason ??
        'Operação contínua Always-On',
      noProgressReason: heartbeatData?.noProgressReason ?? null,
      manualStopActive,
      targetFloor: heartbeatData?.capacity?.targetFloor ?? 5,
      optimalLow: heartbeatData?.capacity?.optimalLow ?? 7,
      optimalHigh: heartbeatData?.capacity?.optimalHigh ?? 9,
      preferredHigh: heartbeatData?.capacity?.preferredHigh ?? 10,
      ceiling: heartbeatData?.capacity?.ceiling ?? 12,
      limitingFactor:
        heartbeatData?.capacity?.limitingFactor ??
        heartbeatData?.throughput?.limitingFactor ??
        null,
      throughputStatus:
        heartbeatData?.capacity?.throughputStatus ??
        heartbeatData?.throughput?.status ??
        null,
      autoEmergencyPause: heartbeatData?.autoEmergencyPause ?? null,
    };

    const pipelineCapacity = heartbeatData?.pipelineCapacity ?? null;
    const eligibleBacklog = Number(
      heartbeatData?.eligibleJobs ??
        heartbeatData?.pipelineCapacity?.eligibleBacklog ??
        reltuplesMap.importer_lite_tasks ??
        queuedJobs.length,
    );

    const staffRequests = auxMeta.staffRequests || [];
    const activeFocus =
      staffRequests.find(
        (r: any) =>
          r.status === 'QUEUED' ||
          r.status === 'IMPORTING' ||
          r.status === 'RETRYING' ||
          r.status === 'BLOCKED',
      ) || null;

    let activeFocusStats: {
      totalDiscovered: number;
      completed: number;
      staged: number;
      pending: number;
      published: number;
      percent: number;
      currentChapter: string | number | null;
    } | null = null;

    let activeFocusFailure: {
      lastError: string | null;
      source: string | null;
      chapterNumber: string | number | null;
      updatedAt: string | null;
      attempts: number;
    } | null = null;

    if (activeFocus) {
      const focusWorkId = activeFocus.work_id;
      const currentFocusJob =
        importingJobs.find((j) => j.payload?.workId === focusWorkId) || null;
      const failedFocusJob =
        [...retryJobs, ...blockedMapped].find((j) => j.payload?.workId === focusWorkId) || null;

      let published: number;
      try {
        const pubRes = await executeYugabyteSql(
          `SELECT COUNT(*)::int AS cnt
           FROM public.chapters
           WHERE work_id = $1::uuid AND published_at IS NOT NULL`,
          [focusWorkId],
          platform?.env,
        );
        published = Number(pubRes.rows?.[0]?.cnt || 0);
      } catch {
        published = 0;
      }

      activeFocusStats = {
        totalDiscovered: published,
        completed: published,
        staged: 0,
        pending: currentFocusJob ? 1 : 0,
        published,
        percent: published > 0 ? 100 : 0,
        currentChapter: currentFocusJob?.chapter_sort_key ?? null,
      };

      if (failedFocusJob) {
        activeFocusFailure = {
          lastError: failedFocusJob.last_error,
          source: failedFocusJob.source,
          chapterNumber: failedFocusJob.chapter_sort_key,
          updatedAt: failedFocusJob.updated_at,
          attempts: failedFocusJob.attempts,
        };
      }
    }

    const blockedCountBySource: Record<string, number> = {};
    for (const b of blockedMapped) {
      if (b.source) {
        blockedCountBySource[b.source] = (blockedCountBySource[b.source] || 0) + 1;
      }
    }

    const sourcesWithBlockedCounts = sourcesList.map((s: any) => ({
      ...s,
      last_sync_at: s.health_last_success_at || s.last_sync_at || null,
      blockedJobsCount: blockedCountBySource[s.id] || 0,
    }));

    const operationalSources = sourcesWithBlockedCounts.filter(
      (s: any) => s.enabled === true && (s.status === 'ACTIVE' || s.status === 'DEGRADED'),
    );
    const upstreamBlockedSources = sourcesWithBlockedCounts.filter(
      (s: any) => s.status === 'UPSTREAM_BLOCKED',
    );
    const excludedByPolicySources = sourcesWithBlockedCounts.filter(
      (s: any) => s.status === 'EXCLUDED_BY_POLICY',
    );

    const providerBlockers = upstreamBlockedSources.map((s: any) => ({
      sourceId: s.id,
      sourceName: s.name,
      reason: s.blocked_reason || 'CLOUDFLARE_DATACENTER_BLOCK',
      message:
        (s.blocked_details as any)?.message ||
        'Fonte bloqueada; diagnóstico detalhado indisponível.',
      affectedJobsCount: s.blockedJobsCount,
      localStatus: (s.blocked_details as any)?.local_status ?? null,
      remoteStatus: (s.blocked_details as any)?.discloud_status ?? null,
    }));

    const nowMs = Date.now();
    const failed1hCount = blockedMapped.filter(
      (r) => r.updated_at && nowMs - new Date(r.updated_at).getTime() <= 3_600_000,
    ).length;
    const failed24hCount = blockedMapped.filter(
      (r) => r.updated_at && nowMs - new Date(r.updated_at).getTime() <= 86_400_000,
    ).length;
    const completedTotal = Number(
      heartbeatData?.ysqlTelemetry?.completedChapters ??
        reltuplesMap.chapters ??
        0,
    );

    const workHealthRaw = auxMeta.workHealthRaw || [];
    const snapshotDurationMs = Math.round(performance.now() - snapshotStartedAt);
    if (profileEnabled) {
      console.info(
        '[IMPORTER_SNAPSHOT_PROFILE]',
        JSON.stringify({
          durationMs: snapshotDurationMs,
          queries: queryTimings,
        }),
      );
    }

    return {
      snapshotMeta: {
        generatedAt: new Date().toISOString(),
        durationMs: snapshotDurationMs,
      },
      telemetry,
      rateTelemetry,
      rateBuckets: bucketRows,
      adaptiveCapacity,
      pipelineCapacity,
      eligibleBacklog,
      activeFocus: activeFocus
        ? { ...activeFocus, stats: activeFocusStats, failure: activeFocusFailure }
        : null,
      counts: {
        queued: eligibleBacklog,
        importing: Math.max(activeWorkersCount, importingJobs.length),
        retry: retryJobs.length,
        paused: pausedJobs.length,
        cancelled: 0,
        blockedByUpstream: blockedMapped.length,
        staged: auxMeta.stagedCount || 0,
        completed: completedTotal,
        failed: blockedMapped.length,
        failed1h: failed1hCount,
        failed24h: failed24hCount,
      },
      providerBlockers,
      blockedCountBySource,
      sources: operationalSources,
      operationalSources,
      upstreamBlockedSources,
      excludedByPolicySources,
      activeSourcesCount: operationalSources.filter((s: any) => s.status === 'ACTIVE').length,
      operationalSourcesCount: operationalSources.length,
      upstreamBlockedSourcesCount: upstreamBlockedSources.length,
      excludedByPolicySourcesCount: excludedByPolicySources.length,
      totalSourcesCount: sourcesList.length,
      recentFailures: blockedMapped.slice(0, 6),
      recentAudit: auxMeta.staffAudit || [],
      importingJobs: importingJobs.map((j: any) => ({
        ...j,
        work: j.payload?.workId ? worksMap[j.payload.workId] || null : null,
      })),
      retryJobs: retryJobs.map((j: any) => ({
        ...j,
        work: j.payload?.workId ? worksMap[j.payload.workId] || null : null,
      })),
      pausedJobs,
      activeJobs: [...importingJobs, ...retryJobs].map((j: any) => ({
        ...j,
        work: j.payload?.workId ? worksMap[j.payload.workId] || null : null,
      })),
      staffRequests,
      queuedJobs: queuedJobs.map((j: any) => ({
        ...j,
        work: j.payload?.workId ? worksMap[j.payload.workId] || null : null,
      })),
      stagedChapters: auxMeta.stagedChapters || [],
      catalogWorks,
      workHealth: workHealthRaw.map((h: any) => ({
        ...h,
        work: h.works,
        gapCount: Array.isArray(h.gaps) ? h.gaps.length : 0,
        unresolvedGapCount: Array.isArray(h.unresolved_gaps) ? h.unresolved_gaps.length : 0,
        gaps: Array.isArray(h.gaps) ? h.gaps.slice(0, 8) : [],
        unresolved_gaps: Array.isArray(h.unresolved_gaps) ? h.unresolved_gaps.slice(0, 3) : [],
      })),
      chapterManifest: auxMeta.chapterManifest || [],
      healthMetrics: {
        healthyCount: workHealthRaw.filter((h: any) => h.health_status === 'HEALTHY').length,
        incompleteCount: workHealthRaw.filter((h: any) => h.health_status === 'INCOMPLETE').length,
        reconcilingCount: workHealthRaw.filter((h: any) => h.health_status === 'RECONCILING').length,
        unverifiedCount: workHealthRaw.filter((h: any) => h.health_status === 'UNVERIFIED').length,
        totalGaps: workHealthRaw.reduce(
          (acc: number, h: any) => acc + (Array.isArray(h.gaps) ? h.gaps.length : 0),
          0,
        ),
        totalUnresolvedGaps: workHealthRaw.reduce(
          (acc: number, h: any) => acc + (Array.isArray(h.unresolved_gaps) ? h.unresolved_gaps.length : 0),
          0,
        ),
        totalKnownChapters: workHealthRaw.reduce(
          (acc: number, h: any) => acc + (h.total_known_chapters || 0),
          0,
        ),
        totalImportedChapters: workHealthRaw.reduce(
          (acc: number, h: any) => acc + (h.total_imported_chapters || 0),
          0,
        ),
      },
    };
  };

  if (isTestEnv) {
    return runSnapshot();
  }

  const flight = runSnapshot()
    .then((data) => {
      cachedSnapshotEntry = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      if (inFlightSnapshotPromise === flight) {
        inFlightSnapshotPromise = null;
      }
    });
  inFlightSnapshotPromise = flight;
  return flight;
}
