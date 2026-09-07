import { redirect } from '@sveltejs/kit';
import { check, WORK_FIELDS } from '$lib/server/db';
import { MEMBER_PAGE_SIZE, pageNumber, pageLink } from '$lib/pagination';
export const load = async ({ locals, params, url }) => {
  if (!locals.user) redirect(303, '/entrar');
  const area = params.area;
  const rawTab = url.searchParams.get('status') || '';
  const tab = area === 'biblioteca' && ['READING', 'PLANNED', 'COMPLETED'].includes(rawTab) ? rawTab : '';
  const filter = area === 'notificacoes' && url.searchParams.get('filtro') === 'nao-lidas' ? 'nao-lidas' : '';
  const page = area === 'perfil' ? 1 : pageNumber(url.searchParams.get('pagina'));
  const start = (page - 1) * MEMBER_PAGE_SIZE;
  const empty = { data: [], error: null, count: 0 };
  let query = locals.db
    .from('library')
    .select(`*,works!inner(${WORK_FIELDS})`, { count: 'exact' })
    .eq('user_id', locals.user.id)
    .eq('works.published', true)
    .order('updated_at', { ascending: false })
    .order('work_id')
    .range(start, start + MEMBER_PAGE_SIZE - 1);
  if (params.area === 'favoritos') query = query.eq('favorite', true);
  if (tab) query = query.eq('status', tab);
  let notificationsQuery = locals.db
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', locals.user.id)
    .order('created_at', { ascending: false })
    .order('id')
    .range(start, start + MEMBER_PAGE_SIZE - 1);
  if (filter) notificationsQuery = notificationsQuery.is('read_at', null);
  const [library, history, notifications] = await Promise.all([
    ['biblioteca', 'favoritos'].includes(params.area) ? query : Promise.resolve(empty),
    params.area === 'historico'
      ? locals.db
          .from('reading')
          .select('*,chapters!inner(id,number,works!inner(slug,title,cover_id))', { count: 'exact' })
          .eq('user_id', locals.user.id)
          .not('chapters.published_at', 'is', null)
          .eq('chapters.works.published', true)
          .order('updated_at', { ascending: false })
          .order('chapter_id')
          .range(start, start + MEMBER_PAGE_SIZE - 1)
      : Promise.resolve(empty),
    params.area === 'notificacoes' ? notificationsQuery : Promise.resolve(empty)
  ]);
  // PostgREST may report an unsatisfiable range after records are removed or filters change.
  if ([library, history, notifications].some((result) => result.error?.code === 'PGRST103'))
    redirect(303, pageLink(`/${area}`, 1, { status: tab, filtro: filter }));
  [library, history, notifications].forEach(check);
  const total =
    (area === 'historico' ? history.count : area === 'notificacoes' ? notifications.count : library.count) ||
    0;
  const lastPage = Math.max(1, Math.ceil(total / MEMBER_PAGE_SIZE));
  if (page > lastPage) redirect(303, pageLink(`/${area}`, lastPage, { status: tab, filtro: filter }));
  const [completed, libraryTotal, completedWorks] =
    area === 'perfil'
      ? await Promise.all([
          locals.db
            .from('reading')
            .select('chapter_id', { count: 'exact', head: true })
            .eq('user_id', locals.user.id)
            .not('completed_at', 'is', null),
          locals.db
            .from('library')
            .select('work_id,works!inner(id)', { count: 'exact', head: true })
            .eq('user_id', locals.user.id)
            .eq('works.published', true),
          locals.db
            .from('library')
            .select('work_id,works!inner(id)', { count: 'exact', head: true })
            .eq('user_id', locals.user.id)
            .eq('works.published', true)
            .eq('status', 'COMPLETED')
        ])
      : [empty, empty, empty];
  [completed, libraryTotal, completedWorks].forEach(check);
  return {
    area: params.area,
    library: library.data || [],
    history: history.data || [],
    notifications: notifications.data || [],
    tab,
    filter,
    page,
    pageSize: MEMBER_PAGE_SIZE,
    total,
    completed: completed.count || 0,
    libraryTotal: libraryTotal.count || 0,
    completedWorks: completedWorks.count || 0
  };
};
