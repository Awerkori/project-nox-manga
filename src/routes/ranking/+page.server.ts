export const load = async ({ locals }) => ({
  members:
    (
      await locals.db
        .from('members')
        .select('id,username,display_name,xp,created_at')
        .gt('xp', 0)
        .order('xp', { ascending: false })
        .limit(50)
    ).data || []
});
