export async function loadSnapshot({ locals }: any) {
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
    locals.db
      .from('importer_telemetry')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 2. STAGED count in chapter mappings
    locals.db
      .from('importer_chapter_mappings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'STAGED'),

    // 3. Currently active importing jobs (ONLY IMPORTING)
    locals.db
      .from('importer_queue')
      .select('*')
      .eq('status', 'IMPORTING')
      .order('updated_at', { ascending: false })
      .limit(64),

    // 3b. Jobs awaiting retry (DEDICATED RETRIES AREA)
    locals.db
      .from('importer_queue')
      .select('*')
      .eq('status', 'RETRY')
      .order('next_run_at', { ascending: true })
      .limit(24),

    // 3c. Jobs paused by staff
    locals.db
      .from('importer_queue')
      .select('*')
      .eq('status', 'PAUSED_BY_STAFF')
      .order('updated_at', { ascending: false })
      .limit(16),

    // 4. Staff priority requests
    locals.db
      .from('importer_staff_requests')
      .select('*, works(id, title, slug, cover_id), requester:members!importer_staff_requests_requested_by_fkey(id, username, display_name), canceller:members!importer_staff_requests_cancelled_by_fkey(id, username, display_name)')
      .order('created_at', { ascending: false })
      .limit(12),

    // 5. Top queued jobs
    locals.db
      .from('importer_queue')
      .select('*')
      .eq('status', 'QUEUED')
      .order('priority', { ascending: false })
      .order('chapter_sort_key', { ascending: true, nullsFirst: false })
      .order('next_run_at', { ascending: true })
      .limit(8),

    // 6. Chapters staged behind canonical barrier
    locals.db
      .from('importer_chapter_mappings')
      .select('*, works(id, title, cover_id)')
      .eq('status', 'STAGED')
      .order('chapter_sort_key', { ascending: true })
      .limit(8),

    // 7. Sources status & health
    locals.db
      .from('importer_sources')
      .select('*')
      .order('name', { ascending: true }),

    // 8. Works catalog for manual priority selection
    locals.db
      .from('works')
      .select('id, title, slug, cover_id')
      .order('title', { ascending: true })
      .limit(80),

    // 9. Catalog Work Health & Cross-Provider Reconciliations
    locals.db
      .from('importer_work_health')
      .select('*, works(id, title, slug, cover_id)')
      .order('last_reconciled_at', { ascending: false, nullsFirst: false })
      .limit(60),

    // 10. Chapter manifest entries
    locals.db
      .from('importer_chapter_manifest')
      .select('id, work_id, chapter_number, chapter_sort_key, status, selected_source, available_sources, page_count, last_checked_at')
      .order('chapter_sort_key', { ascending: true })
      .limit(100),

    // 11. Recent staff audit records
    locals.db
      .from('importer_staff_audit')
      .select('*, actor:members!importer_staff_audit_actor_id_fkey(id, username, display_name)')
      .order('created_at', { ascending: false })
      .limit(10)
  ].map(query => query.abortSignal(AbortSignal.timeout(10000))));

  const failedSections = [telemetryRes, stagedCountRes, importingJobsRes, retryJobsRes, pausedJobsRes, staffRequestsRes, nextQueuedRes, stagedRes, sourcesRes, worksListRes, workHealthRes, recentManifestRes, staffAuditRes].filter(r => r.error);
  if (failedSections.length) {
    console.warn('[ADMIN_SNAPSHOT_FAILED]', failedSections.map(r => ({ code: r.error?.code, message: r.error?.message })));
    throw new Error('Não foi possível atualizar todos os dados do painel.');
  }

  const [countRes, recentFailuresRes] = await Promise.all([
    (locals.db as any).rpc('admin_importer_queue_counts').abortSignal(AbortSignal.timeout(10000)),
    locals.db.from('importer_queue').select('id, source, chapter_sort_key, last_error, updated_at, payload').eq('status', 'FAILED').order('updated_at', { ascending: false }).limit(6).abortSignal(AbortSignal.timeout(10000))
  ]);
  if (countRes.error || !countRes.data) throw new Error('Métricas do Importer temporariamente indisponíveis.');
  const queueCounts = countRes.data;
  const queuedCount = { count: queueCounts.queued }, importingCount = { count: queueCounts.importing };
  const retryCount = { count: queueCounts.retry }, pausedCount = { count: queueCounts.paused };
  const cancelledCount = { count: queueCounts.cancelled }, completedCount = { count: queueCounts.completed };
  const failedCount = { count: queueCounts.failed }, failed1hRes = { count: queueCounts.failed1h }, failed24hRes = { count: queueCounts.failed24h };

  // Fetch Rate Buckets & Heartbeat for Always-On Adaptive Capacity
  const [rateBucketsRes, heartbeatRes] = await Promise.all([
    locals.db
      .from('importer_rate_buckets')
      .select('*')
      .gte('bucket_minute', new Date(Date.now() - 35 * 60 * 1000).toISOString())
      .order('bucket_minute', { ascending: false })
      .abortSignal(AbortSignal.timeout(5000))
      .then((r: any) => r)
      .catch((err: any) => {
        console.warn('[RATE_BUCKETS_FETCH_WARN]', err?.message);
        return { data: [] };
      }),
    locals.db
      .from('settings')
      .select('value')
      .eq('key', 'importer_heartbeat')
      .maybeSingle()
      .abortSignal(AbortSignal.timeout(5000))
      .then((r: any) => r)
      .catch((err: any) => {
        console.warn('[HEARTBEAT_FETCH_WARN]', err?.message);
        return { data: null };
      })
  ]);

  const bucketRows = rateBucketsRes?.data || [];
  const nowMs = Date.now();
  const fiveMinAgo = nowMs - 5 * 60 * 1000;
  const thirtyMinAgo = nowMs - 30 * 60 * 1000;

  let fresh5m = 0;
  let completed5m = 0;
  let fresh30m = 0;
  let completed30m = 0;

  for (const b of bucketRows) {
    const t = new Date(b.bucket_minute).getTime();
    if (t >= fiveMinAgo) {
      fresh5m += b.fresh_visible || 0;
      completed5m += b.completed_jobs || 0;
    }
    if (t >= thirtyMinAgo) {
      fresh30m += b.fresh_visible || 0;
      completed30m += b.completed_jobs || 0;
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

  const rate5m = heartbeatData?.rate5m ?? (Math.round((fresh5m / 5.0) * 10) / 10);
  const rate30m = heartbeatData?.rate30m ?? (Math.round((fresh30m / 30.0) * 10) / 10);
  const completedRate5m = heartbeatData?.completedRate5m ?? (Math.round((completed5m / 5.0) * 10) / 10);
  const completedRate30m = heartbeatData?.completedRate30m ?? (Math.round((completed30m / 30.0) * 10) / 10);

  const rateTelemetry = {
    rate5m,
    rate30m,
    fresh5m: heartbeatData?.fresh5m ?? fresh5m,
    fresh30m: heartbeatData?.fresh30m ?? fresh30m,
    completedRate5m,
    completedRate30m,
    completed5m: heartbeatData?.completed5m ?? completed5m,
    completed30m: heartbeatData?.completed30m ?? completed30m,
  };

  const telemetry = telemetryRes.data || null;
  const adaptiveCapacity = {
    concurrency: heartbeatData?.capacity?.concurrency ?? telemetry?.concurrency ?? 1,
    maxConcurrency: heartbeatData?.capacity?.maxConcurrency ?? 8,
    state: heartbeatData?.capacity?.state ?? (telemetry?.protective_stop ? 'MANUAL_STOP' : 'RUNNING_STABLE'),
    pressureScore: heartbeatData?.capacity?.pressureScore ?? 0,
    siteHealth: heartbeatData?.capacity?.siteHealth ?? 'GREEN',
    reason: heartbeatData?.capacity?.pressureReason || telemetry?.cycle_reason || 'Operação contínua Always-On',
    noProgressReason: heartbeatData?.noProgressReason ?? null,
    manualStopActive: Boolean(telemetry?.protective_stop),
  };

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
    const { data: worksFound } = await locals.db
      .from('works')
      .select('id, title, cover_id, slug')
      .in('id', neededWorkIds);
    if (worksFound) {
      worksMap = Object.fromEntries(worksFound.map((w) => [w.id, w]));
    }
  }

  // Active Focus Request (Prioridade Absoluta)
  const staffRequests = staffRequestsRes.data || [];
  const activeFocus = staffRequests.find(
    (r) => r.status === 'QUEUED' || r.status === 'IMPORTING' || r.status === 'RETRYING' || r.status === 'BLOCKED'
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
      locals.db
        .from('importer_chapter_mappings')
        .select('id, status, chapter_number, chapter_sort_key')
        .eq('work_id', focusWorkId),
      locals.db
        .from('chapters')
        .select('id', { count: 'exact', head: true })
        .eq('work_id', focusWorkId)
        .not('published_at', 'is', null),
      locals.db
        .from('importer_queue')
        .select('task_type, status, chapter_sort_key, payload')
        .eq('status', 'IMPORTING')
        .limit(1)
        .maybeSingle(),
      locals.db
        .from('importer_queue')
        .select('source, last_error, updated_at, attempts, payload, chapter_sort_key')
        .eq('status', 'FAILED')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    const mappings = mappingsRes.data || [];
    const totalDiscovered = mappings.length;
    const completed = mappings.filter((m) => m.status === 'COMPLETED').length;
    const staged = mappings.filter((m) => m.status === 'STAGED').length;
    const pending = mappings.filter((m) => m.status === 'PENDING' || m.status === 'DOWNLOADING').length;
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

  return {
    telemetry: telemetryRes.data || null,
    rateTelemetry,
    adaptiveCapacity,
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
    importingJobs: importingJobs.map((j) => ({
      ...j,
      work: (j.payload as any)?.workId ? worksMap[(j.payload as any).workId] : null
    })),
    retryJobs: retryJobs.map((j) => ({
      ...j,
      work: (j.payload as any)?.workId ? worksMap[(j.payload as any).workId] : null
    })),
    pausedJobs: pausedJobs.map((j) => ({
      ...j,
      work: (j.payload as any)?.workId ? worksMap[(j.payload as any).workId] : null
    })),
    activeJobs: [...importingJobs, ...retryJobs].map((j) => ({
      ...j,
      work: (j.payload as any)?.workId ? worksMap[(j.payload as any).workId] : null
    })),
    staffRequests,
    queuedJobs: queuedJobs.map((j) => ({
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
