import { redirect } from '@sveltejs/kit';
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
    } else if (params.area === 'historico') {
      const ybRes = await executeYugabyteSql(
        `SELECT r.user_id, r.chapter_id, c.work_id, r.page, r.max_page, r.completed_at, r.updated_at,
                c.id AS chapter_catalog_id, c.number AS chapter_number, c.display_number AS chapter_display_number,
                c.canonical_chapter_key, c.chapter_order_key, c.title AS chapter_title,
                c.work_id AS chapter_work_id, c.published_at AS chapter_published_at,
                w.id AS work_catalog_id, w.slug AS work_slug, w.title AS work_title, w.cover_id AS work_cover_id,
                w.kind AS work_kind, w.status AS work_status, w.published AS work_published,
                w.content_rating AS work_content_rating,
                count(*) OVER() AS full_count
         FROM reading r
         JOIN public.chapters c ON c.id = r.chapter_id
         JOIN public.works w ON w.id = c.work_id AND (w.published = true OR w.published IS NULL)
         WHERE r.user_id = $1
         ORDER BY r.updated_at DESC, r.chapter_id
         LIMIT $2 OFFSET $3;`,
        [locals.user.id, MEMBER_PAGE_SIZE, start],
        platform?.env
      );
      historyData = ybRes.rows || [];
      historyCount = historyData.length > 0 ? parseInt(historyData[0].full_count || '0', 10) : 0;
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
    }
  } catch (err) {
    console.warn('[MEMBER_AREA_SQL_ERROR]', err);
  }

  const total =
    (area === 'historico' ? historyCount : area === 'notificacoes' ? notifCount : libraryCount) || 0;
  const lastPage = Math.max(1, Math.ceil(total / MEMBER_PAGE_SIZE));
  if (page > lastPage && total > 0) redirect(303, pageLink(`/${area}`, lastPage, { status: tab, filtro: filter }));

  let completedCount = 0;
  let libTotalCount = 0;
  let completedWorksCount = 0;

  if (area === 'perfil') {
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
      }
    } catch (err) {
      console.warn('[MEMBER_PROFILE_STATS_WARN]', err);
    }
  }

  let unreadCount = 0;
  if (params.area === 'notificacoes') {
    try {
      const unreadRes = await executeYugabyteSql<{ count: string }>(
        `SELECT count(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL;`,
        [locals.user.id],
        platform?.env
      );
      unreadCount = parseInt(unreadRes.rows[0]?.count || '0', 10);
    } catch {
      // Non-critical unread badge count fallback.
    }
  }

  const enrichedHistory =
    params.area === 'historico' && Array.isArray(historyData) && historyData.length > 0
      ? await enrichReadingRowsWithCatalog(historyData, null, platform?.env)
      : historyData;

  return {
    area: params.area,
    library: libraryData,
    history: enrichedHistory,
    notifications: notifData,
    unread: unreadCount,
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
