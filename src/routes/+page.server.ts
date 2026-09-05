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
        .select('page,updated_at,chapters(id,number,works(slug,title,cover_id))')
        .order('updated_at', { ascending: false })
        .limit(4)
    : null;
  return { works: result.data || [], recent: recent?.data || [] };
};
