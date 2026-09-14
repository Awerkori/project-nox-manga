import { error } from '@sveltejs/kit';

const snapshots = new Map<string, { timestamp: number; payload: any }>();
const inFlight = new Map<string, Promise<any>>();
const ADMIN_CACHE_TTL_MS = 30_000;

const loadSnapshot = async (locals: App.Locals) => {
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
    failedMappingsRes
  ] = await Promise.all([
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
      .select('id,number,title,created_at,works(id,title,slug,cover_id)')
      .is('published_at', null)
      .eq('origin', 'MANUAL')
      .order('created_at', { ascending: false })
      .limit(8),
    locals.db
      .from('chapters')
      .select('id,number,title,published_at,works(id,title,slug,cover_id)')
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
      .in('status', ['FAILED', 'VERIFICATION_FAILED'])
    ].map(async (query) => {
      try { return await query.abortSignal(AbortSignal.timeout(3500)); }
      catch { return { error: true, count: null, data: null }; }
    }));

  const metricsUnavailable = [works, publishedChapters, draftsCount, tags, drafts,
    recentPublished, recentWorks, importerQueue, pendingReports, staffCountRes,
    failedJobsRes, failedMappingsRes].some(result => result.error);

  const totalFailedJobs24h = failedJobsRes.count ?? null;
  const unrecoveredFailures = failedMappingsRes.count ?? null;
  const recoveredFailures = totalFailedJobs24h === null || unrecoveredFailures === null
    ? null : Math.max(0, totalFailedJobs24h - unrecoveredFailures);

  const payload = {
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
    recoveredFailures
  };

  return payload;
};

export const load = async ({ locals }: { locals: App.Locals }) => {
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    throw error(403, 'Acesso restrito à equipe');
  }
  const key = `${locals.user.id}:${locals.role}`;
  const cached = snapshots.get(key);
  if (cached && Date.now() - cached.timestamp < ADMIN_CACHE_TTL_MS) return cached.payload;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const pending = loadSnapshot(locals).then(payload => {
    if (!payload.metricsUnavailable) {
      if (snapshots.size >= 50) snapshots.delete(snapshots.keys().next().value!);
      snapshots.set(key, { timestamp: Date.now(), payload });
    }
    return payload;
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, pending);
  return pending;
};
