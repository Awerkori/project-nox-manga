import { error } from '@sveltejs/kit';
export const load = async ({ locals, params }) => {
  const { data } = await locals.db
    .from('members')
    .select('username,display_name,bio,xp,created_at')
    .eq('username', params.username)
    .maybeSingle();
  if (!data) error(404, 'Perfil não encontrado');
  return { member: data };
};
