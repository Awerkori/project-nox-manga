export const load = async ({ locals }) => ({
  members: (await locals.db.rpc('member_public_ranking')).data || []
});
