export const load = async ({ locals }) => {
  const [works, publishedChapters, draftsCount, tags, drafts, recentPublished, recentWorks] =
    await Promise.all([
      locals.db.from('works').select('id', { count: 'exact', head: true }),
      locals.db
        .from('chapters')
        .select('id', { count: 'exact', head: true })
        .not('published_at', 'is', null),
      locals.db
        .from('chapters')
        .select('id', { count: 'exact', head: true })
        .is('published_at', null),
      locals.db.from('tags').select('id', { count: 'exact', head: true }),
      locals.db
        .from('chapters')
        .select('id,number,title,created_at,works(id,title,slug,cover_id)')
        .is('published_at', null)
        .order('created_at', { ascending: false })
        .limit(6),
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
        .limit(5)
    ]);

  return {
    works: works.count || 0,
    chapters: publishedChapters.count || 0,
    draftsCount: draftsCount.count || 0,
    tagsCount: tags.count || 0,
    drafts: (drafts.data as any[]) || [],
    recentPublished: (recentPublished.data as any[]) || [],
    recentWorks: (recentWorks.data as any[]) || []
  };
};
