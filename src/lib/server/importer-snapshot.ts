import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { desc, asc, eq, inArray, isNotNull, and, count, sql, aliasedTable } from 'drizzle-orm';

export async function loadSnapshot({ locals }: any) {
  const requesterAlias = aliasedTable(schema.members, 'requester');
  const cancellerAlias = aliasedTable(schema.members, 'canceller');

  const [
    telemetryRes,
    stagedCountRes,
    importingJobsRes,
    retryJobsRes,
    pausedJobsRes,
    staffRequestsResRaw,
    nextQueuedRes,
    stagedResRaw,
    sourcesRes,
    worksListRes,
    workHealthResRaw,
    recentManifestRes,
    staffAuditResRaw
  ] = await Promise.all([
    // 1. Latest telemetry heartbeat
    safeQuerySingle(
      db.select()
        .from(schema.importerTelemetry)
        .orderBy(desc(schema.importerTelemetry.createdAt))
        .limit(1)
    ),

    // 2. STAGED count in chapter mappings
    safeQuerySingle(
      db.select({ count: count() })
        .from(schema.importerChapterMappings)
        .where(eq(schema.importerChapterMappings.status, 'STAGED'))
    ),

    // 3. Currently active importing jobs (ONLY IMPORTING)
    safeQuery(
      db.select()
        .from(schema.importerQueue)
        .where(eq(schema.importerQueue.status, 'IMPORTING'))
        .orderBy(desc(schema.importerQueue.updatedAt))
        .limit(64)
    ),

    // 3b. Jobs awaiting retry (DEDICATED RETRIES AREA)
    safeQuery(
      db.select()
        .from(schema.importerQueue)
        .where(eq(schema.importerQueue.status, 'RETRY'))
        .orderBy(asc(schema.importerQueue.nextRunAt))
        .limit(24)
    ),

    // 3c. Jobs paused by staff
    safeQuery(
      db.select()
        .from(schema.importerQueue)
        .where(eq(schema.importerQueue.status, 'PAUSED_BY_STAFF'))
        .orderBy(desc(schema.importerQueue.updatedAt))
        .limit(16)
    ),

    // 4. Staff priority requests
    safeQuery(
      db.select({
        request: schema.importerStaffRequests,
        works: {
          id: schema.works.id,
          title: schema.works.title,
          slug: schema.works.slug,
          coverId: schema.works.coverId,
        },
        requester: {
          id: requesterAlias.id,
          username: requesterAlias.username,
          displayName: requesterAlias.displayName,
        },
        canceller: {
          id: cancellerAlias.id,
          username: cancellerAlias.username,
          displayName: cancellerAlias.displayName,
        }
      })
      .from(schema.importerStaffRequests)
      .leftJoin(schema.works, eq(schema.importerStaffRequests.workId, schema.works.id))
      .leftJoin(requesterAlias, eq(schema.importerStaffRequests.requestedBy, requesterAlias.id))
      .leftJoin(cancellerAlias, eq(schema.importerStaffRequests.cancelledBy, cancellerAlias.id))
      .orderBy(desc(schema.importerStaffRequests.createdAt))
      .limit(12)
    ),

    // 5. Top queued jobs
    safeQuery(
      db.select()
        .from(schema.importerQueue)
        .where(eq(schema.importerQueue.status, 'QUEUED'))
        .orderBy(desc(schema.importerQueue.priority), asc(schema.importerQueue.chapterSortKey), asc(schema.importerQueue.nextRunAt))
        .limit(8)
    ),

    // 6. Chapters staged behind canonical barrier
    safeQuery(
      db.select({
        mapping: schema.importerChapterMappings,
        works: {
          id: schema.works.id,
          title: schema.works.title,
          coverId: schema.works.coverId,
        }
      })
      .from(schema.importerChapterMappings)
      .leftJoin(schema.works, eq(schema.importerChapterMappings.workId, schema.works.id))
      .where(eq(schema.importerChapterMappings.status, 'STAGED'))
      .orderBy(asc(schema.importerChapterMappings.chapterSortKey))
      .limit(8)
    ),

    // 7. Sources status & health
    safeQuery(
      db.select()
        .from(schema.importerSources)
        .orderBy(asc(schema.importerSources.name))
    ),

    // 8. Works catalog for manual priority selection
    safeQuery(
      db.select({
        id: schema.works.id,
        title: schema.works.title,
        slug: schema.works.slug,
        coverId: schema.works.coverId,
      })
      .from(schema.works)
      .orderBy(asc(schema.works.title))
      .limit(80)
    ),

    // 9. Catalog Work Health & Cross-Provider Reconciliations
    safeQuery(
      db.select({
        health: schema.importerWorkHealth,
        works: {
          id: schema.works.id,
          title: schema.works.title,
          slug: schema.works.slug,
          coverId: schema.works.coverId,
        }
      })
      .from(schema.importerWorkHealth)
      .leftJoin(schema.works, eq(schema.importerWorkHealth.workId, schema.works.id))
      .orderBy(desc(schema.importerWorkHealth.lastReconciledAt))
      .limit(60)
    ),

    // 10. Chapter manifest entries
    safeQuery(
      db.select({
        id: schema.importerChapterManifest.id,
        workId: schema.importerChapterManifest.workId,
        chapterNumber: schema.importerChapterManifest.chapterNumber,
        chapterSortKey: schema.importerChapterManifest.chapterSortKey,
        status: schema.importerChapterManifest.status,
        selectedSource: schema.importerChapterManifest.selectedSource,
        availableSources: schema.importerChapterManifest.availableSources,
        pageCount: schema.importerChapterManifest.pageCount,
        lastCheckedAt: schema.importerChapterManifest.lastCheckedAt,
      })
      .from(schema.importerChapterManifest)
      .orderBy(asc(schema.importerChapterManifest.chapterSortKey))
      .limit(100)
    ),

    // 11. Recent staff audit records
    safeQuery(
      db.select({
        audit: schema.importerStaffAudit,
        actor: {
          id: schema.members.id,
          username: schema.members.username,
          displayName: schema.members.displayName,
        }
      })
      .from(schema.importerStaffAudit)
      .leftJoin(schema.members, eq(schema.importerStaffAudit.actorId, schema.members.id))
      .orderBy(desc(schema.importerStaffAudit.createdAt))
      .limit(10)
    )
  ]);

  const staffRequestsRes = {
    error: staffRequestsResRaw.error,
    data: staffRequestsResRaw.data ? staffRequestsResRaw.data.map((r: any) => ({ ...r.request, works: r.works, requester: r.requester, canceller: r.canceller })) : null
  };
  const stagedRes = {
    error: stagedResRaw.error,
    data: stagedResRaw.data ? stagedResRaw.data.map((r: any) => ({ ...r.mapping, works: r.works })) : null
  };
  const workHealthRes = {
    error: workHealthResRaw.error,
    data: workHealthResRaw.data ? workHealthResRaw.data.map((r: any) => ({ ...r.health, works: r.works })) : null
  };
  const staffAuditRes = {
    error: staffAuditResRaw.error,
    data: staffAuditResRaw.data ? staffAuditResRaw.data.map((r: any) => ({ ...r.audit, actor: r.actor })) : null
  };

  const failedSections = [telemetryRes, stagedCountRes, importingJobsRes, retryJobsRes, pausedJobsRes, staffRequestsRes, nextQueuedRes, stagedRes, sourcesRes, worksListRes, workHealthRes, recentManifestRes, staffAuditRes].filter(r => r.error);
  if (failedSections.length) {
    console.warn('[ADMIN_SNAPSHOT_FAILED]', failedSections.map(r => ({ code: (r.error as any)?.code, message: (r.error as any)?.message })));
    throw new Error('No foi possvel atualizar todos os dados do painel.');
  }

  // Calculate counts manually since RPC is gone
  const [queueCountsRaw, recentFailuresRes, blockedBySourceRaw] = await Promise.all([
    safeQuerySingle(
      db.select({
        queued: sql<number>`SUM(CASE WHEN ${schema.importerQueue.status} = 'QUEUED' THEN 1 ELSE 0 END)`,
        importing: sql<number>`SUM(CASE WHEN ${schema.importerQueue.status} = 'IMPORTING' THEN 1 ELSE 0 END)`,
        retry: sql<number>`SUM(CASE WHEN ${schema.importerQueue.status} = 'RETRY' THEN 1 ELSE 0 END)`,
        paused: sql<number>`SUM(CASE WHEN ${schema.importerQueue.status} = 'PAUSED_BY_STAFF' THEN 1 ELSE 0 END)`,
        cancelled: sql<number>`SUM(CASE WHEN ${schema.importerQueue.status} = 'CANCELLED' THEN 1 ELSE 0 END)`,
        completed: sql<number>`SUM(CASE WHEN ${schema.importerQueue.status} = 'COMPLETED' THEN 1 ELSE 0 END)`,
        failed: sql<number>`SUM(CASE WHEN ${schema.importerQueue.status} = 'FAILED' THEN 1 ELSE 0 END)`,
        failed1h: sql<number>`SUM(CASE WHEN ${schema.importerQueue.status} = 'FAILED' AND ${schema.importerQueue.updatedAt} >= datetime('now', '-1 hour') THEN 1 ELSE 0 END)`,
        failed24h: sql<number>`SUM(CASE WHEN ${schema.importerQueue.status} = 'FAILED' AND ${schema.importerQueue.updatedAt} >= datetime('now', '-24 hours') THEN 1 ELSE 0 END)`,
        blocked: sql<number>`SUM(CASE WHEN ${schema.importerQueue.status} = 'BLOCKED' THEN 1 ELSE 0 END)`
      }).from(schema.importerQueue)
    ),
    safeQuery(
      db.select({
        id: schema.importerQueue.id,
        source: schema.importerQueue.source,
        chapterSortKey: schema.importerQueue.chapterSortKey,
        lastError: schema.importerQueue.lastError,
        updatedAt: schema.importerQueue.updatedAt,
        payload: schema.importerQueue.payload
      })
      .from(schema.importerQueue)
      .where(eq(schema.importerQueue.status, 'FAILED'))
      .orderBy(desc(schema.importerQueue.updatedAt))
      .limit(6)
    ),
    safeQuery(
      db.select({
        source: schema.importerQueue.source,
        count: count()
      })
      .from(schema.importerQueue)
      .where(eq(schema.importerQueue.status, 'BLOCKED'))
      .groupBy(schema.importerQueue.source)
    )
  ]);

  if (queueCountsRaw.error || !queueCountsRaw.data) throw new Error('Mtricas do Importer temporariamente indisponveis.');
  
  const queueCounts = queueCountsRaw.data;
  const queuedCount = { count: queueCounts.queued };
  const importingCount = { count: queueCounts.importing };
  const retryCount = { count: queueCounts.retry };
  const pausedCount = { count: queueCounts.paused };
  const cancelledCount = { count: queueCounts.cancelled };
  const completedCount = { count: queueCounts.completed };
  const failedCount = { count: queueCounts.failed };
  const failed1hRes = { count: queueCounts.failed1h };
  const failed24hRes = { count: queueCounts.failed24h };

  const importingJobs = importingJobsRes.data || [];
  const retryJobs = retryJobsRes.data || [];
  const pausedJobs = pausedJobsRes.data || [];
  const queuedJobs = nextQueuedRes.data || [];

  // Enrich jobs with work titles & covers
  const neededWorkIds = Array.from(
    new Set(
      [...importingJobs, ...retryJobs, ...pausedJobs, ...queuedJobs]
        .map((j) => {
          try {
            const p = typeof j.payload === 'string' ? JSON.parse(j.payload) : j.payload;
            return p?.workId;
          } catch(e) { return null; }
        })
        .filter(Boolean)
    )
  );

  let worksMap: Record<string, any> = {};
  if (neededWorkIds.length > 0) {
    const { data: worksFound } = await safeQuery(
      db.select({
        id: schema.works.id,
        title: schema.works.title,
        coverId: schema.works.coverId,
        slug: schema.works.slug
      })
      .from(schema.works)
      .where(inArray(schema.works.id, neededWorkIds))
    );
    if (worksFound) {
      worksMap = Object.fromEntries(worksFound.map((w) => [w.id, w]));
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
    const focusWorkId = activeFocus.workId;
    const [mappingsRes, publishedCountRes, currentJobRes, failedJobRes] = await Promise.all([
      safeQuery(
        db.select({
          id: schema.importerChapterMappings.id,
          status: schema.importerChapterMappings.status,
          chapterNumber: schema.importerChapterMappings.chapterNumber,
          chapterSortKey: schema.importerChapterMappings.chapterSortKey
        })
        .from(schema.importerChapterMappings)
        .where(eq(schema.importerChapterMappings.workId, focusWorkId))
      ),
      safeQuerySingle(
        db.select({ count: count() })
          .from(schema.chapters)
          .where(and(eq(schema.chapters.workId, focusWorkId), isNotNull(schema.chapters.publishedAt)))
      ),
      safeQuerySingle(
        db.select({
          taskType: schema.importerQueue.taskType,
          status: schema.importerQueue.status,
          chapterSortKey: schema.importerQueue.chapterSortKey,
          payload: schema.importerQueue.payload
        })
        .from(schema.importerQueue)
        .where(eq(schema.importerQueue.status, 'IMPORTING'))
        .limit(1)
      ),
      safeQuerySingle(
        db.select({
          source: schema.importerQueue.source,
          lastError: schema.importerQueue.lastError,
          updatedAt: schema.importerQueue.updatedAt,
          attempts: schema.importerQueue.attempts,
          payload: schema.importerQueue.payload,
          chapterSortKey: schema.importerQueue.chapterSortKey
        })
        .from(schema.importerQueue)
        .where(eq(schema.importerQueue.status, 'FAILED'))
        .orderBy(desc(schema.importerQueue.updatedAt))
        .limit(1)
      )
    ]);

    const mappings = mappingsRes.data || [];
    const totalDiscovered = mappings.length;
    const completed = mappings.filter((m: any) => m.status === 'COMPLETED').length;
    const staged = mappings.filter((m: any) => m.status === 'STAGED').length;
    const pending = mappings.filter((m: any) => m.status === 'PENDING' || m.status === 'DOWNLOADING').length;
    const published = publishedCountRes.data?.count || 0;
    const percent = totalDiscovered > 0 ? Math.round((completed / totalDiscovered) * 100) : 0;
    
    let currentChapter = null;
    if (currentJobRes.data) {
       try {
         const p = typeof currentJobRes.data.payload === 'string' ? JSON.parse(currentJobRes.data.payload) : currentJobRes.data.payload;
         currentChapter = p?.chapterNumber ?? currentJobRes.data.chapterSortKey;
       } catch(e) { currentChapter = currentJobRes.data.chapterSortKey; }
    }

    activeFocusStats = {
      totalDiscovered,
      completed,
      staged,
      pending,
      published,
      percent,
      currentChapter
    };

    if (failedJobRes.data) {
       try {
         const p = typeof failedJobRes.data.payload === 'string' ? JSON.parse(failedJobRes.data.payload) : failedJobRes.data.payload;
         if (p?.workId === focusWorkId) {
           activeFocusFailure = {
             lastError: failedJobRes.data.lastError,
             source: failedJobRes.data.source,
             chapterNumber: p?.chapterNumber ?? failedJobRes.data.chapterSortKey,
             updatedAt: failedJobRes.data.updatedAt,
             attempts: failedJobRes.data.attempts
           };
         }
       } catch(e) {}
    }
  }

  const blockedUpstreamTotal = queueCounts.blocked || 0;
  
  const blockedCountBySource: Record<string, number> = {};
  if (blockedBySourceRaw.data) {
    blockedBySourceRaw.data.forEach((r: any) => {
      blockedCountBySource[r.source] = r.count;
    });
  }

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

  const providerBlockers = upstreamBlockedSources.map((s: any) => {
    let details: any = {};
    try {
      details = typeof s.blockedDetails === 'string' ? JSON.parse(s.blockedDetails) : (s.blockedDetails || {});
    } catch(e) {}
    return {
      sourceId: s.id,
      sourceName: s.name,
      reason: s.blockedReason || 'CLOUDFLARE_DATACENTER_BLOCK',
      message: (details as any).message || 'Fonte bloqueada; diagnstico detalhado indisponvel.',
      affectedJobsCount: s.blockedJobsCount,
      localStatus: details.local_status ?? null,
      remoteStatus: details.discloud_status ?? null
    };
  });

  const getPayload = (j: any) => {
    try { return typeof j.payload === 'string' ? JSON.parse(j.payload) : j.payload; }
    catch(e) { return {}; }
  };

  return {
    telemetry: telemetryRes.data || null,
    activeFocus: activeFocus ? { ...activeFocus, stats: activeFocusStats, failure: activeFocusFailure } : null,
    counts: {
      queued: queuedCount.count || 0,
      importing: importingCount.count || 0,
      retry: retryCount.count || 0,
      paused: pausedCount.count || 0,
      cancelled: cancelledCount.count || 0,
      blockedByUpstream: blockedUpstreamTotal,
      staged: stagedCountRes.data?.count || 0,
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
      work: getPayload(j)?.workId ? worksMap[getPayload(j).workId] : null
    })),
    retryJobs: retryJobs.map((j: any) => ({
      ...j,
      work: getPayload(j)?.workId ? worksMap[getPayload(j).workId] : null
    })),
    pausedJobs: pausedJobs.map((j: any) => ({
      ...j,
      work: getPayload(j)?.workId ? worksMap[getPayload(j).workId] : null
    })),
    activeJobs: [...importingJobs, ...retryJobs].map((j: any) => ({
      ...j,
      work: getPayload(j)?.workId ? worksMap[getPayload(j).workId] : null
    })),
    staffRequests,
    queuedJobs: queuedJobs.map((j: any) => ({
      ...j,
      work: getPayload(j)?.workId ? worksMap[getPayload(j).workId] : null
    })),
    stagedChapters: stagedRes.data || [],
    catalogWorks: worksListRes.data || [],
    workHealth: (workHealthRes.data || []).map((h: any) => {
      let gaps: any[] = [];
      let unresolvedGaps: any[] = [];
      try { gaps = typeof h.gaps === 'string' ? JSON.parse(h.gaps) : (h.gaps || []); } catch(e) {}
      try { unresolvedGaps = typeof h.unresolvedGaps === 'string' ? JSON.parse(h.unresolvedGaps) : (h.unresolvedGaps || []); } catch(e) {}
      return {
        ...h,
        work: h.works,
        gapCount: Array.isArray(gaps) ? gaps.length : 0,
        unresolvedGapCount: Array.isArray(unresolvedGaps) ? unresolvedGaps.length : 0,
        gaps: Array.isArray(gaps) ? gaps.slice(0, 8) : [],
        unresolvedGaps: Array.isArray(unresolvedGaps) ? unresolvedGaps.slice(0, 3) : []
      };
    }),
    chapterManifest: recentManifestRes.data || [],
    healthMetrics: {
      healthyCount: (workHealthRes.data || []).filter((h: any) => h.healthStatus === 'HEALTHY').length,
      incompleteCount: (workHealthRes.data || []).filter((h: any) => h.healthStatus === 'INCOMPLETE').length,
      reconcilingCount: (workHealthRes.data || []).filter((h: any) => h.healthStatus === 'RECONCILING').length,
      unverifiedCount: (workHealthRes.data || []).filter((h: any) => h.healthStatus === 'UNVERIFIED').length,
      totalGaps: (workHealthRes.data || []).reduce((acc: number, h: any) => {
        let gaps: any[] = [];
        try { gaps = typeof h.gaps === 'string' ? JSON.parse(h.gaps) : (h.gaps || []); } catch(e) {}
        return acc + (Array.isArray(gaps) ? gaps.length : 0);
      }, 0),
      totalUnresolvedGaps: (workHealthRes.data || []).reduce((acc: number, h: any) => {
        let unresolvedGaps: any[] = [];
        try { unresolvedGaps = typeof h.unresolvedGaps === 'string' ? JSON.parse(h.unresolvedGaps) : (h.unresolvedGaps || []); } catch(e) {}
        return acc + (Array.isArray(unresolvedGaps) ? unresolvedGaps.length : 0);
      }, 0),
      totalKnownChapters: (workHealthRes.data || []).reduce((acc: number, h: any) => acc + (h.totalKnownChapters || 0), 0),
      totalImportedChapters: (workHealthRes.data || []).reduce((acc: number, h: any) => acc + (h.totalImportedChapters || 0), 0),
    }
  };
}
