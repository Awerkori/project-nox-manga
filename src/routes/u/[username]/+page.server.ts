import { error } from '@sveltejs/kit';
export const load = async ({ locals, params }) => {
  const { data: member } = await locals.db
    .from('members')
    .select('id,username,display_name,bio,xp,avatar_id,created_at,equipped_title_id,equipped_badge_id')
    .eq('username', params.username)
    .maybeSingle();
  if (!member) error(404, 'Perfil não encontrado');
  const { data: stats } = await locals.db.rpc('member_public_stats', { p_user: member.id });
  return {
    member,
    stats: stats?.[0] || { chapters_read: 0, completed_works: 0, favorites: 0 }
  };
};

