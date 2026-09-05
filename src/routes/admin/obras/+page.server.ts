import { WORK_FIELDS, check } from '$lib/server/db';
export const load = async ({ locals }) => {
  const result = await locals.db
    .from('works')
    .select(WORK_FIELDS)
    .order('updated_at', { ascending: false })
    .limit(200);
  check(result);
  return { works: result.data || [] };
};
