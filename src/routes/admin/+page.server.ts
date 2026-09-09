export const load = async ({ locals }) => {
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
      .in('role', ['ADMIN', 'EDITOR'])
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
  ]);

  const totalFailedJobs24h = failedJobsRes.count || 0;
  const unrecoveredFailures = failedMappingsRes.count || 0;
  const recoveredFailures = Math.max(0, totalFailedJobs24h - unrecoveredFailures);

  return {
    works: works.count || 0,
    chapters: publishedChapters.count || 0,
    draftsCount: draftsCount.count || 0,
    tagsCount: tags.count || 0,
    drafts: (drafts.data as any[]) || [],
    recentPublished: (recentPublished.data as any[]) || [],
    recentWorks: (recentWorks.data as any[]) || [],
    importerActiveCount: importerQueue.count || 0,
    pendingReportsCount: pendingReports.count || 0,
    staffCount: staffCountRes.count || 0,
    failedJobs24h: totalFailedJobs24h,
    unrecoveredFailures,
    recoveredFailures
  };
};
