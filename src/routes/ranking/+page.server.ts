export const load = async ({ locals }) => ({
  members:
    (
      await locals.db
        .from('members')
        .select('id,username,display_name,xp,avatar_id,created_at,equipped_title_id,equipped_badge_id')
        .eq('is_test', false)
        .gt('xp', 0)
        .order('xp', { ascending: false })
        .limit(50)
    ).data || []
});
