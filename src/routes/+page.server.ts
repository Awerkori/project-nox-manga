import { WORK_FIELDS, check } from '$lib/server/db';

export const load = async ({ locals }) => {
  const result = await locals.db
    .from('works')
    .select(WORK_FIELDS)
    .eq('published', true)
    .order('updated_at', { ascending: false })
    .limit(16);
  check(result);

  const recent = locals.user
    ? await locals.db
        .from('reading')
        .select('page,updated_at,chapters!inner(id,number,works!inner(slug,title,cover_id))')
        .not('chapters.published_at', 'is', null)
        .eq('chapters.works.published', true)
        .order('updated_at', { ascending: false })
        .limit(4)
    : null;

  const topReaders = await locals.db
    .from('members')
    .select('id,username,display_name,avatar_id,xp')
    .order('xp', { ascending: false })
    .limit(3);

  const works = result.data || [];
  const featured = works.find((w) => w.featured) || works[0] || null;

  return {
    works,
    featured,
    recent: recent?.data || [],
    topReaders: topReaders?.data || []
  };
};
