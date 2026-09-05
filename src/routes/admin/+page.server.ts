export const load = async ({ locals }) => {
  const [works, chapters, drafts] = await Promise.all([
    locals.db.from('works').select('id', { count: 'exact', head: true }),
    locals.db.from('chapters').select('id', { count: 'exact', head: true }).not('published_at', 'is', null),
    locals.db
      .from('chapters')
      .select('id,number,title,works(id,title)')
      .is('published_at', null)
      .order('created_at', { ascending: false })
      .limit(10)
  ]);
  return { works: works.count || 0, chapters: chapters.count || 0, drafts: drafts.data || [] };
};
