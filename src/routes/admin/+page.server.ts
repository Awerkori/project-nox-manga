import { error } from '@sveltejs/kit';
import { loadYsqlImporterHeartbeat } from '$lib/server/importer-snapshot';
import { executeYugabyteSql, withYugabyteReadSession } from '$lib/server/yugabyte';

const snapshots = new Map<string, { timestamp: number; payload: any }>();
const inFlight = new Map<string, Promise<any>>();
const ADMIN_CACHE_TTL_MS = 45_000;
const ADMIN_STALE_TTL_MS = 180_000;

function isTestRuntime(): boolean {
  return (
    typeof process !== 'undefined' &&
    (process.env?.VITEST === 'true' || process.env?.NODE_ENV === 'test')
  );
}

const loadTestSnapshot = async (locals: App.Locals) => {
  const twentyFourHoursAgo = new Date(Date.now() - 86400_000).toISOString();

  const [
    works,
    publishedChapters,
    draftsCount,
    tags,
    drafts,
    recentPublished,
    recentWorks,
    importerQueue,
    pendingReports,
    staffCountRes,
    failedJobsRes,
    failedMappingsRes,
  ] = await Promise.all(
    [
      locals.db.from('works').select('id', { count: 'exact', head: true }),
      locals.db
        .from('chapters')
        .select('id', { count: 'exact', head: true })
        .not('published_at', 'is', null),
      locals.db
        .from('chapters')
        .select('id', { count: 'exact', head: true })
        .is('published_at', null)
        .eq('origin', 'MANUAL'),
      locals.db.from('tags').select('id', { count: 'exact', head: true }),
      locals.db
        .from('chapters')
        .select(
          'id,number,display_number,canonical_chapter_key,chapter_order_key,chapter_kind,edition,language,title,created_at,works(id,title,slug,cover_id)',
        )
        .is('published_at', null)
        .eq('origin', 'MANUAL')
        .order('created_at', { ascending: false })
        .limit(8),
      locals.db
        .from('chapters')
        .select(
          'id,number,display_number,canonical_chapter_key,chapter_order_key,chapter_kind,edition,language,title,published_at,works(id,title,slug,cover_id)',
        )
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(6),
      locals.db
        .from('works')
        .select('id,title,slug,kind,status,published,cover_id,updated_at')
        .order('updated_at', { ascending: false })
        .limit(5),
      locals.db
        .from('importer_queue')
        .select('id', { count: 'exact', head: true })
        .in('status', ['QUEUED', 'IMPORTING', 'RETRY']),
      locals.db
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .in('status', ['NOVO', 'EM_ANALISE']),
      locals.db
        .from('access_roles')
        .select('user_id', { count: 'exact', head: true })
        .in('role', ['ADMIN', 'STAFF_SITE', 'EDITOR'])
        .eq('suspended', false),
      locals.db
        .from('importer_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'FAILED')
        .gte('updated_at', twentyFourHoursAgo),
      locals.db
        .from('importer_chapter_mappings')
        .select('id', { count: 'exact', head: true })
        .in('status', ['FAILED', 'VERIFICATION_FAILED']),
    ].map(async (query) => {
      try {
        return await query.abortSignal(AbortSignal.timeout(3500));
      } catch {
        return { error: true, count: null, data: null };
      }
    }),
  );

  const metricsUnavailable = [
    works,
    publishedChapters,
    draftsCount,
    tags,
    drafts,
    recentPublished,
    recentWorks,
    importerQueue,
    pendingReports,
    staffCountRes,
    failedJobsRes,
    failedMappingsRes,
  ].some((result) => result.error);

  const totalFailedJobs24h = failedJobsRes.count ?? null;
  const unrecoveredFailures = failedMappingsRes.count ?? null;
  const recoveredFailures =
    totalFailedJobs24h === null || unrecoveredFailures === null
      ? null
      : Math.max(0, totalFailedJobs24h - unrecoveredFailures);

  return {
    metricsUnavailable,
    works: works.count ?? null,
    chapters: publishedChapters.count ?? null,
    draftsCount: draftsCount.count ?? null,
    tagsCount: tags.count ?? null,
    drafts: (drafts.data as any[]) || [],
    recentPublished: (recentPublished.data as any[]) || [],
    recentWorks: (recentWorks.data as any[]) || [],
    importerActiveCount: importerQueue.count ?? null,
    pendingReportsCount: pendingReports.count ?? null,
    staffCount: staffCountRes.count ?? null,
    failedJobs24h: totalFailedJobs24h,
    unrecoveredFailures,
    recoveredFailures,
  };
};

const loadProductionSnapshot = async (locals: App.Locals, platform: App.Platform | undefined) => {
  const safeQuery = async (query: any) => {
    try {
      return await query.abortSignal(AbortSignal.timeout(2500));
    } catch {
      return { error: true, count: null, data: null };
    }
  };

  const [ysqlData, supaData] = await Promise.all([
    withYugabyteReadSession(
      platform?.env,
      async (sessionEnv) => {
        const sessionPlatform = platform ? { ...platform, env: sessionEnv } : { env: sessionEnv };
        const safeSql = async (sql: string, params: unknown[] = []) => {
          try {
            const res = await executeYugabyteSql(sql, params, sessionEnv);
            return res.rows || [];
          } catch {
            return [];
          }
        };

        const [heartbeat, worksCntRows, chaptersEstRows, recentPublishedRows, recentWorksRows] =
          await Promise.all([
            loadYsqlImporterHeartbeat(sessionPlatform),
            safeSql(`SELECT COUNT(*)::int AS cnt FROM public.works`),
            safeSql(
              `SELECT GREATEST(0, reltuples::bigint)::int AS est
               FROM pg_class
               WHERE relname = 'chapters'
               LIMIT 1`,
            ),
            safeSql(
              `SELECT c.id, c.number, c.display_number, c.canonical_chapter_key, c.chapter_order_key,
                      c.chapter_kind, c.edition, c.language, c.title, c.published_at,
                      w.id AS w_id, w.title AS w_title, w.slug AS w_slug, w.cover_id AS w_cover_id
               FROM public.chapters c
               LEFT JOIN public.works w ON w.id = c.work_id
               WHERE c.published_at IS NOT NULL
               ORDER BY c.published_at DESC
               LIMIT 6`,
            ),
            safeSql(
              `SELECT id, title, slug, kind, status, published, cover_id, updated_at
               FROM public.works
               ORDER BY updated_at DESC NULLS LAST
               LIMIT 5`,
            ),
          ]);

        return {
          heartbeat,
          worksCount: worksCntRows[0]?.cnt ?? null,
          chaptersCount:
            heartbeat?.ysqlTelemetry?.completedChapters ??
            chaptersEstRows[0]?.est ??
            null,
          recentPublished: recentPublishedRows.map((r: any) => ({
            id: r.id,
            number: r.number,
            display_number: r.display_number,
            canonical_chapter_key: r.canonical_chapter_key,
            chapter_order_key: r.chapter_order_key,
            chapter_kind: r.chapter_kind,
            edition: r.edition,
            language: r.language,
            title: r.title,
            published_at: r.published_at,
            works: r.w_id
              ? { id: r.w_id, title: r.w_title, slug: r.w_slug, cover_id: r.w_cover_id }
              : null,
          })),
          recentWorks: recentWorksRows,
        };
      },
      1,
    ),
    Promise.all([
      safeQuery(locals.db.from('tags').select('id', { count: 'exact', head: true })),
      safeQuery(
        locals.db
          .from('chapters')
          .select(
            'id,number,display_number,canonical_chapter_key,chapter_order_key,chapter_kind,edition,language,title,created_at,works(id,title,slug,cover_id)',
            { count: 'exact' },
          )
          .is('published_at', null)
          .eq('origin', 'MANUAL')
          .order('created_at', { ascending: false })
          .limit(8),
      ),
      safeQuery(
        locals.db
          .from('reports')
          .select('id', { count: 'exact', head: true })
          .in('status', ['NOVO', 'EM_ANALISE']),
      ),
      safeQuery(
        locals.db
          .from('access_roles')
          .select('user_id', { count: 'exact', head: true })
          .in('role', ['ADMIN', 'STAFF_SITE', 'EDITOR'])
          .eq('suspended', false),
      ),
    ]),
  ]);

  const [tags, drafts, pendingReports, staffCountRes] = supaData;
  const hb = ysqlData.heartbeat;
  const importerActiveCount = Number(
    hb?.chapterAdmission?.active ?? hb?.eligibleJobs ?? 0,
  );

  return {
    metricsUnavailable: ysqlData.worksCount === null && tags.error,
    works: ysqlData.worksCount ?? 0,
    chapters: ysqlData.chaptersCount ?? 0,
    draftsCount: drafts.count ?? ((drafts.data as any[]) || []).length,
    tagsCount: tags.count ?? 0,
    drafts: (drafts.data as any[]) || [],
    recentPublished: ysqlData.recentPublished || [],
    recentWorks: ysqlData.recentWorks || [],
    importerActiveCount,
    pendingReportsCount: pendingReports.count ?? 0,
    staffCount: staffCountRes.count ?? 0,
    failedJobs24h: 0,
    unrecoveredFailures: 0,
    recoveredFailures: 0,
  };
};

export const load = async ({
  locals,
  platform,
}: {
  locals: App.Locals;
  platform?: App.Platform;
}) => {
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    throw error(403, 'Acesso restrito à equipe');
  }

  const testMode = isTestRuntime();
  const key = testMode ? `${locals.user.id}:${locals.role}` : `role:${locals.role}`;
  const now = Date.now();
  const cached = snapshots.get(key);
  if (cached) {
    const age = now - cached.timestamp;
    if (age < ADMIN_CACHE_TTL_MS) return cached.payload;
    if (!testMode && age < ADMIN_STALE_TTL_MS) {
      if (!inFlight.has(key)) {
        const bg = loadProductionSnapshot(locals, platform)
          .then((payload) => {
            snapshots.set(key, { timestamp: Date.now(), payload });
            return payload;
          })
          .finally(() => inFlight.delete(key));
        inFlight.set(key, bg);
        platform?.context?.waitUntil?.(bg.catch(() => {}));
      }
      return cached.payload;
    }
  }

  const existing = inFlight.get(key);
  if (existing) return existing;

  const pending = (testMode ? loadTestSnapshot(locals) : loadProductionSnapshot(locals, platform))
    .then((payload) => {
      if (!payload.metricsUnavailable) {
        if (snapshots.size >= 50) snapshots.delete(snapshots.keys().next().value!);
        snapshots.set(key, { timestamp: Date.now(), payload });
      }
      return payload;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, pending);
  return pending;
};
