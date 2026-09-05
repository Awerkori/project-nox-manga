import { WORK_FIELDS, check } from '$lib/server/db';
export const load = async ({ locals }) => {
  const result = await locals.db
    .from('works')
    .select(WORK_FIELDS)
    .eq('published', true)
    .order('updated_at', { ascending: false })
    .limit(12);
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
  return { works: result.data || [], recent: recent?.data || [] };
};
