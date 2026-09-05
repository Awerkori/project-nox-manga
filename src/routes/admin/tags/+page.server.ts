export const load = async ({ locals }) => ({
  tags: (await locals.db.from('tags').select('*').order('kind').order('name')).data || []
});
