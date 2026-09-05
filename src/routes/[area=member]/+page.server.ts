import { redirect } from '@sveltejs/kit';
import { check } from '$lib/server/db';
export const load = async ({ locals, params, url }) => {
  if (!locals.user) redirect(303, '/entrar');
  const tab = url.searchParams.get('status') || '';
  let query = locals.db
    .from('library')
    .select('*,works(*)')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (params.area === 'favoritos') query = query.eq('favorite', true);
  if (tab) query = query.eq('status', tab);
  const [library, history, notifications] = await Promise.all([
    ['biblioteca', 'favoritos', 'perfil'].includes(params.area)
      ? query
      : Promise.resolve({ data: [], error: null }),
    params.area === 'historico'
      ? locals.db
          .from('reading')
          .select('*,chapters(id,number,works(slug,title,cover_id))')
          .order('updated_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    params.area === 'notificacoes'
      ? locals.db.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null })
  ]);
  [library, history, notifications].forEach(check);
  const completed = await locals.db
    .from('reading')
    .select('chapter_id', { count: 'exact', head: true })
    .not('completed_at', 'is', null);
  return {
    area: params.area,
    library: library.data || [],
    history: history.data || [],
    notifications: notifications.data || [],
    tab,
    completed: completed.count || 0
  };
};
