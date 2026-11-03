import { redirect } from '@sveltejs/kit';
import { check, WORK_FIELDS } from '$lib/server/db';
import { MEMBER_PAGE_SIZE, pageNumber, pageLink } from '$lib/pagination';
import { enrichReadingRowsWithCatalog } from '$lib/server/reading-history';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const load = async ({ locals, params, url, platform }: any) => {
  if (!locals.user) redirect(303, '/entrar');
  const area = params.area;
  const rawTab = url.searchParams.get('status') || '';
  const tab = area === 'biblioteca' && ['READING', 'PLANNED', 'COMPLETED'].includes(rawTab) ? rawTab : '';
  const filter = area === 'notificacoes' && url.searchParams.get('filtro') === 'nao-lidas' ? 'nao-lidas' : '';
  const page = area === 'perfil' ? 1 : pageNumber(url.searchParams.get('pagina'));
  const start = (page - 1) * MEMBER_PAGE_SIZE;

  let libraryData: any[] = [];
  let libraryCount = 0;
  let historyData: any[] = [];
  let historyCount = 0;
  let notifData: any[] = [];
  let notifCount = 0;
  let ybSuccess = false;

  try {
    if (['biblioteca', 'favoritos'].includes(params.area)) {
      const isFav = params.area === 'favoritos';
      const ybRes = await executeYugabyteSql(
        `SELECT l.user_id, l.work_id, l.status, l.favorite, l.following, l.updated_at,
                to_jsonb(w.*) AS works,
                count(*) OVER() AS full_count
         FROM library l
         JOIN works w ON w.id = l.work_id
         WHERE l.user_id = $1 AND w.published = true
           AND ($2 = '' OR l.status = $2)
           AND ($3 = false OR l.favorite = true)
         ORDER BY l.updated_at DESC, l.work_id
         LIMIT $4 OFFSET $5;`,
        [locals.user.id, tab, isFav, MEMBER_PAGE_SIZE, start],
        platform?.env
      );
      libraryData = ybRes.rows || [];
      libraryCount = libraryData.length > 0 ? parseInt(libraryData[0].full_count || '0', 10) : 0;
      ybSuccess = true;
    } else if (params.area === 'historico') {
      const ybRes = await executeYugabyteSql(
        `SELECT r.user_id, r.chapter_id, r.page, r.max_page, r.completed_at, r.updated_at,
                count(*) OVER() AS full_count
         FROM reading r
         WHERE r.user_id = $1
         ORDER BY r.updated_at DESC, r.chapter_id
         LIMIT $2 OFFSET $3;`,
        [locals.user.id, MEMBER_PAGE_SIZE, start],
        platform?.env
      );
      historyData = ybRes.rows || [];
      historyCount = historyData.length > 0 ? parseInt(historyData[0].full_count || '0', 10) : 0;
      ybSuccess = true;
    } else if (params.area === 'notificacoes') {
      const ybRes = await executeYugabyteSql(
        `SELECT n.*, count(*) OVER() AS full_count
         FROM notifications n
         WHERE n.user_id = $1
           AND ($2 = '' OR n.read_at IS NULL)
         ORDER BY n.created_at DESC, n.id
         LIMIT $3 OFFSET $4;`,
        [locals.user.id, filter ? 'unread' : '', MEMBER_PAGE_SIZE, start],
        platform?.env
      );
      notifData = ybRes.rows || [];
      notifCount = notifData.length > 0 ? parseInt(notifData[0].full_count || '0', 10) : 0;
      ybSuccess = true;
    }
  } catch {
    ybSuccess = false;
  }

  const empty = { data: [], error: null, count: 0 };
  if (!ybSuccess) {
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
            .select('*', { count: 'exact' })
            .eq('user_id', locals.user.id)
            .order('updated_at', { ascending: false })
            .order('chapter_id')
            .range(start, start + MEMBER_PAGE_SIZE - 1)
        : Promise.resolve(empty),
      params.area === 'notificacoes' ? notificationsQuery : Promise.resolve(empty)
    ]);
    if ([library, history, notifications].some((result: any) => result.error?.code === 'PGRST103'))
      redirect(303, pageLink(`/${area}`, 1, { status: tab, filtro: filter }));
    [library, history, notifications].forEach(check);

    libraryData = library.data || [];
    libraryCount = library.count || 0;
    historyData = history.data || [];
    historyCount = history.count || 0;
    notifData = notifications.data || [];
    notifCount = notifications.count || 0;
  }

  const total =
    (area === 'historico' ? historyCount : area === 'notificacoes' ? notifCount : libraryCount) || 0;
  const lastPage = Math.max(1, Math.ceil(total / MEMBER_PAGE_SIZE));
  if (page > lastPage && total > 0) redirect(303, pageLink(`/${area}`, lastPage, { status: tab, filtro: filter }));

  let completedCount = 0;
  let libTotalCount = 0;
  let completedWorksCount = 0;

  if (area === 'perfil') {
    let ybPerfilSuccess = false;
    try {
      const perfRes = await executeYugabyteSql(
        `SELECT 
          (SELECT count(*) FROM reading WHERE user_id = $1 AND completed_at IS NOT NULL) AS completed,
          (SELECT count(*) FROM library l JOIN works w ON w.id = l.work_id WHERE l.user_id = $1 AND w.published = true) AS library_total,
          (SELECT count(*) FROM library l JOIN works w ON w.id = l.work_id WHERE l.user_id = $1 AND w.published = true AND l.status = 'COMPLETED') AS completed_works;`,
        [locals.user.id],
        platform?.env
      );
      if (perfRes.rows && perfRes.rows[0]) {
        completedCount = parseInt(perfRes.rows[0].completed || '0', 10);
        libTotalCount = parseInt(perfRes.rows[0].library_total || '0', 10);
        completedWorksCount = parseInt(perfRes.rows[0].completed_works || '0', 10);
        ybPerfilSuccess = true;
      }
    } catch {
      ybPerfilSuccess = false;
    }

    if (!ybPerfilSuccess) {
      const [completed, libraryTotal, completedWorks] = await Promise.all([
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
      ]);
      [completed, libraryTotal, completedWorks].forEach(check);
      completedCount = completed.count || 0;
      libTotalCount = libraryTotal.count || 0;
      completedWorksCount = completedWorks.count || 0;
    }
  }

  const enrichedHistory =
    params.area === 'historico' && Array.isArray(historyData) && historyData.length > 0
      ? await enrichReadingRowsWithCatalog(historyData, locals.db, platform?.env)
      : historyData;

  return {
    area: params.area,
    library: libraryData,
    history: enrichedHistory,
    notifications: notifData,
    tab,
    filter,
    page,
    pageSize: MEMBER_PAGE_SIZE,
    total,
    completed: completedCount,
    libraryTotal: libTotalCount,
    completedWorks: completedWorksCount
  };
};
