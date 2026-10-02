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

  // Fetch Rate Buckets & Heartbeat for Always-On Adaptive Capacity
  const [rateBucketsRes, heartbeatRes] = await Promise.all([
    timed('rate_buckets', () => locals.db
      .from('importer_rate_buckets')
      .select('*')
      .gte('bucket_minute', new Date(Date.now() - 65 * 60 * 1000).toISOString())
      .order('bucket_minute', { ascending: false })
      .abortSignal(AbortSignal.timeout(5000)))
      .then((r: any) => r)
      .catch((err: any) => {
        console.warn('[RATE_BUCKETS_FETCH_WARN]', err?.message);
        return { data: [] };
      }),
    timed('heartbeat', () => locals.db
      .from('settings')
      .select('value')
      .eq('key', 'importer_heartbeat')
      .maybeSingle()
      .abortSignal(AbortSignal.timeout(5000)))
      .then((r: any) => r)
      .catch((err: any) => {
        console.warn('[HEARTBEAT_FETCH_WARN]', err?.message);
        return { data: null };
      })
  ]);

  const bucketRows = rateBucketsRes?.data || [];
  const nowMs = Date.now();
  const oneMinAgo = nowMs - 1 * 60 * 1000;
  const fiveMinAgo = nowMs - 5 * 60 * 1000;
  const tenMinAgo = nowMs - 10 * 60 * 1000;
  const thirtyMinAgo = nowMs - 30 * 60 * 1000;

  let visible1m = 0;
  let visible5m = 0;
  let visible10m = 0;
  let visible30m = 0;
  let fresh1m = 0;
  let fresh5m = 0;
  let fresh10m = 0;
  let completed5m = 0;
  let fresh30m = 0;
  let completed30m = 0;

  for (const b of bucketRows) {
    const t = new Date(b.bucket_minute).getTime();
    const visible = b.visible_published || 0;
    const fresh = b.fresh_visible || 0;
    const completed = b.completed_jobs || 0;
    if (t >= oneMinAgo) {
      visible1m += visible;
      fresh1m += fresh;
    }
    if (t >= fiveMinAgo) {
      visible5m += visible;
      fresh5m += fresh;
      completed5m += completed;
    }
    if (t >= tenMinAgo) {
      visible10m += visible;
      fresh10m += fresh;
    }
    if (t >= thirtyMinAgo) {
      visible30m += visible;
      fresh30m += fresh;
      completed30m += completed;
    }
  }

  let heartbeatData: any = null;
  if (heartbeatRes?.data?.value) {
    try {
      heartbeatData = typeof heartbeatRes.data.value === 'string'
        ? JSON.parse(heartbeatRes.data.value)
        : heartbeatRes.data.value;
    } catch {
      // Ignore heartbeat parse error and fallback to rate buckets
    }
  }

  // Canonical visible publications are the only Cap/min definition. The
  // fallback intentionally uses visible_published, never fresh or completed.
  const rate1m = heartbeatData?.rate1m ?? visible1m;
  const rate5m = heartbeatData?.rate5m ?? (Math.round((visible5m / 5.0) * 10) / 10);
  const rate10m = heartbeatData?.rate10m ?? (Math.round((visible10m / 10.0) * 10) / 10);
  const rate30m = heartbeatData?.rate30m ?? (Math.round((visible30m / 30.0) * 10) / 10);
  const completedRate5m = heartbeatData?.completedRate5m ?? (Math.round((completed5m / 5.0) * 10) / 10);
  const completedRate30m = heartbeatData?.completedRate30m ?? (Math.round((completed30m / 30.0) * 10) / 10);

  const rateTelemetry = {
    rate1m,
    rate5m,
    rate10m,
    rate30m,
    visible1m,
    visible5m,
    visible10m,
    visible30m,
    fresh1m,
    fresh5m: heartbeatData?.fresh5m ?? fresh5m,
    fresh10m,
    fresh30m: heartbeatData?.fresh30m ?? fresh30m,
    completedRate5m,
    completedRate30m,
    completed5m: heartbeatData?.completed5m ?? completed5m,
    completed30m: heartbeatData?.completed30m ?? completed30m,
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
