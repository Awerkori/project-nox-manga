import { executeYugabyteSql } from '$lib/server/yugabyte';

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

export async function loadSnapshot({ locals, platform }: any) {
  const snapshotStartedAt = performance.now();
  const queryTimings: Record<string, number> = {};
  const profileEnabled =
    platform?.env?.IMPORTER_SNAPSHOT_PROFILE === '1' ||
    (typeof process !== 'undefined' && process.env?.IMPORTER_SNAPSHOT_PROFILE === '1');
  // The database client is deliberately untyped in this server module. Keep the
  // profiling wrapper equally transparent so it cannot change the inferred
  // response type of existing queries.
  const timed = async (name: string, query: () => any): Promise<any> => {
    if (!profileEnabled) return query();
    const startedAt = performance.now();
    try {
      return await query();
    } finally {
      queryTimings[name] = Math.round(performance.now() - startedAt);
    }
  };

  const [
    telemetryRes,
    stagedCountRes,
    importingJobsRes,
    retryJobsRes,
    pausedJobsRes,
    staffRequestsRes,
    nextQueuedRes,
    stagedRes,
    sourcesRes,
    worksListRes,
    workHealthRes,
    recentManifestRes,
    staffAuditRes
  ] = await Promise.all([
    // 1. Latest telemetry heartbeat
    timed('telemetry', () => locals.db
      .from('importer_telemetry')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .abortSignal(AbortSignal.timeout(10000))),

    // 2. STAGED count in chapter mappings
    timed('staged_count', () => locals.db
      .from('importer_chapter_mappings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'STAGED')
      .abortSignal(AbortSignal.timeout(10000))),

    // 3. Currently active importing jobs (ONLY IMPORTING)
    timed('importing_jobs', () => locals.db
      .from('importer_queue')
      .select('*')
      .eq('status', 'IMPORTING')
      .order('updated_at', { ascending: false })
      .limit(64)
      .abortSignal(AbortSignal.timeout(10000))),

    // 3b. Jobs awaiting retry (DEDICATED RETRIES AREA)
    timed('retry_jobs', () => locals.db
      .from('importer_queue')
      .select('*')
      .eq('status', 'RETRY')
      .order('next_run_at', { ascending: true })
      .limit(24)
      .abortSignal(AbortSignal.timeout(10000))),

    // 3c. Jobs paused by staff
    timed('paused_jobs', () => locals.db
      .from('importer_queue')
      .select('*')
      .eq('status', 'PAUSED_BY_STAFF')
      .order('updated_at', { ascending: false })
      .limit(16)
      .abortSignal(AbortSignal.timeout(10000))),

    // 4. Staff priority requests
    timed('staff_requests', () => locals.db
      .from('importer_staff_requests')
      .select('*, works(id, title, slug, cover_id), requester:members!importer_staff_requests_requested_by_fkey(id, username, display_name), canceller:members!importer_staff_requests_cancelled_by_fkey(id, username, display_name)')
      .order('created_at', { ascending: false })
      .limit(12)
      .abortSignal(AbortSignal.timeout(10000))),

    // 5. Top queued jobs
    timed('next_queued_jobs', () => locals.db
      .from('importer_queue')
      .select('*')
      .eq('status', 'QUEUED')
      .order('priority', { ascending: false })
      .order('chapter_sort_key', { ascending: true, nullsFirst: false })
      .order('next_run_at', { ascending: true })
      .limit(8)
      .abortSignal(AbortSignal.timeout(10000))),

    // 6. Chapters staged behind canonical barrier
    timed('staged_chapters', () => locals.db
      .from('importer_chapter_mappings')
      .select('*, works(id, title, cover_id)')
      .eq('status', 'STAGED')
      .order('chapter_sort_key', { ascending: true })
      .limit(8)
      .abortSignal(AbortSignal.timeout(10000))),

    // 7. Sources status & health
    timed('sources', () => locals.db
      .from('importer_sources')
      .select('*')
      .order('name', { ascending: true })
      .abortSignal(AbortSignal.timeout(10000))),

    // 8. Works catalog for manual priority selection
    timed('catalog_works', () => locals.db
      .from('works')
      .select('id, title, slug, cover_id')
      .order('title', { ascending: true })
      .limit(80)
      .abortSignal(AbortSignal.timeout(10000))),

    // 9. Catalog Work Health & Cross-Provider Reconciliations
    timed('work_health', () => locals.db
      .from('importer_work_health')
      .select('*, works(id, title, slug, cover_id)')
      .order('last_reconciled_at', { ascending: false, nullsFirst: false })
      .limit(60)
      .abortSignal(AbortSignal.timeout(10000))),

    // 10. Chapter manifest entries
    timed('chapter_manifest', () => locals.db
      .from('importer_chapter_manifest')
      .select('id, work_id, chapter_number, chapter_sort_key, status, selected_source, available_sources, page_count, last_checked_at')
      .order('chapter_sort_key', { ascending: true })
      .limit(100)
      .abortSignal(AbortSignal.timeout(10000))),

    // 11. Recent staff audit records
    timed('staff_audit', () => locals.db
      .from('importer_staff_audit')
      .select('*, actor:members!importer_staff_audit_actor_id_fkey(id, username, display_name)')
      .order('created_at', { ascending: false })
      .limit(10)
      .abortSignal(AbortSignal.timeout(10000)))
  ]);

  const failedSections = [telemetryRes, stagedCountRes, importingJobsRes, retryJobsRes, pausedJobsRes, staffRequestsRes, nextQueuedRes, stagedRes, sourcesRes, worksListRes, workHealthRes, recentManifestRes, staffAuditRes].filter(r => r.error);
  if (failedSections.length) {
    console.warn('[ADMIN_SNAPSHOT_FAILED]', failedSections.map(r => ({ code: r.error?.code, message: r.error?.message })));
    throw new Error('Não foi possível atualizar todos os dados do painel.');
  }

  const [countRes, recentFailuresRes] = await Promise.all([
    timed('queue_counts', () => (locals.db as any).rpc('admin_importer_queue_counts').abortSignal(AbortSignal.timeout(10000))),
    timed('recent_failures', () => locals.db.from('importer_queue').select('id, source, chapter_sort_key, last_error, updated_at, payload').eq('status', 'FAILED').order('updated_at', { ascending: false }).limit(6).abortSignal(AbortSignal.timeout(10000)))
  ]);
  if (countRes.error || !countRes.data) throw new Error('Métricas do Importer temporariamente indisponíveis.');
  const queueCounts = countRes.data;
  const queuedCount = { count: queueCounts.queued }, importingCount = { count: queueCounts.importing };
  const retryCount = { count: queueCounts.retry }, pausedCount = { count: queueCounts.paused };
  const cancelledCount = { count: queueCounts.cancelled }, completedCount = { count: queueCounts.completed };
  const failedCount = { count: queueCounts.failed }, failed1hRes = { count: queueCounts.failed1h }, failed24hRes = { count: queueCounts.failed24h };

  // The Importer writes canonical publication transitions to Yugabyte through
  // its direct pool. Reading these metrics through locals.db (Supabase REST)
  // made the panel observe a different data plane and show stale/zero rates.
  const [canonicalPublication, heartbeatData] = await Promise.all([
    timed('canonical_publications', () => loadCanonicalPublicationSnapshot(platform)),
    timed('ysql_heartbeat', () => loadYsqlImporterHeartbeat(platform)),
  ]);
  const bucketRows = canonicalPublication.bucketRows;
  const rateTelemetry = {
    ...calculatePublicationRateTelemetry(bucketRows),
    source: canonicalPublication.source,
  };

  const telemetry = telemetryRes.data || null;
  const adaptiveCapacity = {
    concurrency: heartbeatData?.capacity?.concurrency ?? telemetry?.concurrency ?? 1,
    // Never resurrect the historic eight-slot default when the heartbeat is
    // temporarily unavailable: the last real telemetry value is safer and
    // keeps the operator panel truthful during a partial outage.
    maxConcurrency: heartbeatData?.capacity?.maxConcurrency ?? telemetry?.concurrency ?? 1,
    state: heartbeatData?.capacity?.state ?? (telemetry?.protective_stop ? 'MANUAL_STOP' : 'RUNNING_STABLE'),
    pressureScore: heartbeatData?.capacity?.pressureScore ?? 0,
    siteHealth: heartbeatData?.capacity?.siteHealth ?? 'GREEN',
    reason: heartbeatData?.capacity?.pressureReason || telemetry?.cycle_reason || 'Operação contínua Always-On',
    noProgressReason: heartbeatData?.noProgressReason ?? null,
    manualStopActive: Boolean(telemetry?.protective_stop),
    targetFloor: heartbeatData?.capacity?.targetFloor ?? 5,
    optimalLow: heartbeatData?.capacity?.optimalLow ?? 7,
    optimalHigh: heartbeatData?.capacity?.optimalHigh ?? 9,
    preferredHigh: heartbeatData?.capacity?.preferredHigh ?? 10,
    ceiling: heartbeatData?.capacity?.ceiling ?? 12,
    limitingFactor: heartbeatData?.capacity?.limitingFactor ?? heartbeatData?.throughput?.limitingFactor ?? null,
    throughputStatus: heartbeatData?.capacity?.throughputStatus ?? heartbeatData?.throughput?.status ?? null,
    autoEmergencyPause: heartbeatData?.autoEmergencyPause ?? null,
  };
  // This is part of the importer heartbeat write, not another panel query.
  // It explains capacity without turning the admin page into DB pressure.
  const pipelineCapacity = heartbeatData?.pipelineCapacity ?? null;
  const eligibleBacklog = Number(heartbeatData?.eligibleJobs ?? 0);

  const importingJobs = importingJobsRes.data || [];
  const retryJobs = retryJobsRes.data || [];
  const pausedJobs = pausedJobsRes.data || [];
  const queuedJobs = nextQueuedRes.data || [];

  // Enrich jobs with work titles & covers
  const neededWorkIds = Array.from(
    new Set(
      [...importingJobs, ...retryJobs, ...pausedJobs, ...queuedJobs]
        .map((j) => (j.payload as any)?.workId)
        .filter(Boolean)
    )
  );

  let worksMap: Record<string, any> = {};
  if (neededWorkIds.length > 0) {
    const { data: worksFound } = await timed('job_works', () => locals.db
        .from('works')
        .select('id, title, cover_id, slug')
        .in('id', neededWorkIds));
    if (worksFound) {
      worksMap = Object.fromEntries(worksFound.map((w: any) => [w.id, w]));
    }
  }

  // Active Focus Request (Prioridade Absoluta)
  const staffRequests = staffRequestsRes.data || [];
  const activeFocus = staffRequests.find(
    (r: any) => r.status === 'QUEUED' || r.status === 'IMPORTING' || r.status === 'RETRYING' || r.status === 'BLOCKED'
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
    const [mappingsRes, publishedCountRes, currentJobRes, failedJobRes] = await Promise.all([
      timed('focus_mappings', () => locals.db
        .from('importer_chapter_mappings')
        .select('id, status, chapter_number, chapter_sort_key')
        .eq('work_id', focusWorkId)),
      timed('focus_published_count', () => locals.db
        .from('chapters')
        .select('id', { count: 'exact', head: true })
        .eq('work_id', focusWorkId)
        .not('published_at', 'is', null)),
      timed('focus_current_job', () => locals.db
        .from('importer_queue')
        .select('task_type, status, chapter_sort_key, payload')
        .eq('status', 'IMPORTING')
        .limit(1)
        .maybeSingle()),
      timed('focus_failed_job', () => locals.db
        .from('importer_queue')
        .select('source, last_error, updated_at, attempts, payload, chapter_sort_key')
        .eq('status', 'FAILED')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle())
    ]);

    const mappings = mappingsRes.data || [];
    const totalDiscovered = mappings.length;
    const completed = mappings.filter((m: any) => m.status === 'COMPLETED').length;
    const staged = mappings.filter((m: any) => m.status === 'STAGED').length;
    const pending = mappings.filter((m: any) => m.status === 'PENDING' || m.status === 'DOWNLOADING').length;
    const published = publishedCountRes.count || 0;
    const percent = totalDiscovered > 0 ? Math.round((completed / totalDiscovered) * 100) : 0;
    const currentChapter = currentJobRes.data
      ? ((currentJobRes.data.payload as any)?.chapterNumber ?? currentJobRes.data.chapter_sort_key)
      : null;

    activeFocusStats = {
      totalDiscovered,
      completed,
      staged,
      pending,
      published,
      percent,
      currentChapter
    };

    if (failedJobRes.data && (failedJobRes.data.payload as any)?.workId === focusWorkId) {
      activeFocusFailure = {
        lastError: failedJobRes.data.last_error,
        source: failedJobRes.data.source,
        chapterNumber: (failedJobRes.data.payload as any)?.chapterNumber ?? failedJobRes.data.chapter_sort_key,
        updatedAt: failedJobRes.data.updated_at,
        attempts: failedJobRes.data.attempts
      };
    }
  }

  const blockedUpstreamTotal = queueCounts.blocked;
  const blockedCountBySource: Record<string, number> = queueCounts.blockedBySource;

  const sourcesList = sourcesRes.data || [];
  const sourcesWithBlockedCounts = sourcesList.map((s: any) => ({
    ...s,
    blockedJobsCount: blockedCountBySource[s.id] || 0
  }));

  const operationalSources = sourcesWithBlockedCounts.filter(
    (s: any) => s.enabled === true && (s.status === 'ACTIVE' || s.status === 'DEGRADED')
  );
  const upstreamBlockedSources = sourcesWithBlockedCounts.filter((s: any) => s.status === 'UPSTREAM_BLOCKED');
  const excludedByPolicySources = sourcesWithBlockedCounts.filter((s: any) => s.status === 'EXCLUDED_BY_POLICY');

  const providerBlockers = upstreamBlockedSources.map((s: any) => ({
    sourceId: s.id,
    sourceName: s.name,
    reason: s.blocked_reason || 'CLOUDFLARE_DATACENTER_BLOCK',
    message: (s.blocked_details as any)?.message || 'Fonte bloqueada; diagnóstico detalhado indisponível.',
    affectedJobsCount: s.blockedJobsCount,
    localStatus: (s.blocked_details as any)?.local_status ?? null,
    remoteStatus: (s.blocked_details as any)?.discloud_status ?? null
  }));

  const snapshotDurationMs = Math.round(performance.now() - snapshotStartedAt);
  if (profileEnabled) {
    console.info('[IMPORTER_SNAPSHOT_PROFILE]', JSON.stringify({
      durationMs: snapshotDurationMs,
      queries: queryTimings
    }));
  }

  return {
    snapshotMeta: {
      generatedAt: new Date().toISOString(),
      durationMs: snapshotDurationMs
    },
    telemetry: telemetryRes.data || null,
    rateTelemetry,
    rateBuckets: bucketRows,
    adaptiveCapacity,
    pipelineCapacity,
    eligibleBacklog,
    activeFocus: activeFocus ? { ...activeFocus, stats: activeFocusStats, failure: activeFocusFailure } : null,
    counts: {
      queued: queuedCount.count || 0,
      importing: importingCount.count || 0,
      retry: retryCount.count || 0,
      paused: pausedCount.count || 0,
      cancelled: cancelledCount.count || 0,
      blockedByUpstream: blockedUpstreamTotal,
      staged: stagedCountRes.count || 0,
      completed: completedCount.count || 0,
      failed: failedCount.count || 0,
      failed1h: failed1hRes.count || 0,
      failed24h: failed24hRes.count || 0
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
    recentFailures: recentFailuresRes.data || [],
    recentAudit: staffAuditRes.data || [],
    importingJobs: importingJobs.map((j: any) => ({
      ...j,
      work: (j.payload as any)?.workId ? worksMap[(j.payload as any).workId] : null
    })),
    retryJobs: retryJobs.map((j: any) => ({
      ...j,
      work: (j.payload as any)?.workId ? worksMap[(j.payload as any).workId] : null
    })),
    pausedJobs: pausedJobs.map((j: any) => ({
      ...j,
      work: (j.payload as any)?.workId ? worksMap[(j.payload as any).workId] : null
    })),
    activeJobs: [...importingJobs, ...retryJobs].map((j) => ({
      ...j,
      work: (j.payload as any)?.workId ? worksMap[(j.payload as any).workId] : null
    })),
    staffRequests,
    queuedJobs: queuedJobs.map((j: any) => ({
      ...j,
      work: (j.payload as any)?.workId ? worksMap[(j.payload as any).workId] : null
    })),
    stagedChapters: stagedRes.data || [],
    catalogWorks: worksListRes.data || [],
    workHealth: (workHealthRes.data || []).map((h: any) => ({
      ...h,
      work: h.works,
      gapCount: Array.isArray(h.gaps) ? h.gaps.length : 0,
      unresolvedGapCount: Array.isArray(h.unresolved_gaps) ? h.unresolved_gaps.length : 0,
      gaps: Array.isArray(h.gaps) ? h.gaps.slice(0, 8) : [],
      unresolved_gaps: Array.isArray(h.unresolved_gaps) ? h.unresolved_gaps.slice(0, 3) : []
    })),
    chapterManifest: recentManifestRes.data || [],
    healthMetrics: {
      healthyCount: (workHealthRes.data || []).filter((h: any) => h.health_status === 'HEALTHY').length,
      incompleteCount: (workHealthRes.data || []).filter((h: any) => h.health_status === 'INCOMPLETE').length,
      reconcilingCount: (workHealthRes.data || []).filter((h: any) => h.health_status === 'RECONCILING').length,
      unverifiedCount: (workHealthRes.data || []).filter((h: any) => h.health_status === 'UNVERIFIED').length,
      totalGaps: (workHealthRes.data || []).reduce((acc: number, h: any) => acc + (Array.isArray(h.gaps) ? h.gaps.length : 0), 0),
      totalUnresolvedGaps: (workHealthRes.data || []).reduce((acc: number, h: any) => acc + (Array.isArray(h.unresolved_gaps) ? h.unresolved_gaps.length : 0), 0),
      totalKnownChapters: (workHealthRes.data || []).reduce((acc: number, h: any) => acc + (h.total_known_chapters || 0), 0),
      totalImportedChapters: (workHealthRes.data || []).reduce((acc: number, h: any) => acc + (h.total_imported_chapters || 0), 0),
    }
  };
};
