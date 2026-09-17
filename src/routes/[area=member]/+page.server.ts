import { redirect } from '@sveltejs/kit';
import { db, schema, safeQuery } from '$lib/server/db';
import { eq, getTableColumns, and, desc, asc, isNull, isNotNull, count } from 'drizzle-orm';
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

  // Library query
  let libWheres = [
    eq(schema.library.userId, locals.user.id),
    eq(schema.works.published, true)
  ];
  if (params.area === 'favoritos') libWheres.push(eq(schema.library.favorite, 1));
  if (tab) libWheres.push(eq(schema.library.status, tab));

  const libraryQuery = db
    .select({
      ...getTableColumns(schema.library),
      works: getTableColumns(schema.works)
    })
    .from(schema.library)
    .innerJoin(schema.works, eq(schema.library.workId, schema.works.id))
    .where(and(...libWheres))
    .orderBy(desc(schema.library.updatedAt), asc(schema.library.workId))
    .limit(MEMBER_PAGE_SIZE)
    .offset(start);

  const libraryCountQuery = db
    .select({ count: count() })
    .from(schema.library)
    .innerJoin(schema.works, eq(schema.library.workId, schema.works.id))
    .where(and(...libWheres));

  // Notifications query
  let notificationsWheres = [eq(schema.notifications.userId, locals.user.id)];
  if (filter) notificationsWheres.push(isNull(schema.notifications.readAt));

  const notificationsQuery = db
    .select()
    .from(schema.notifications)
    .where(and(...notificationsWheres))
    .orderBy(desc(schema.notifications.createdAt), asc(schema.notifications.id))
    .limit(MEMBER_PAGE_SIZE)
    .offset(start);

  const notificationsCountQuery = db
    .select({ count: count() })
    .from(schema.notifications)
    .where(and(...notificationsWheres));

  // History query
  const historyWheres = [
    eq(schema.reading.userId, locals.user.id),
    isNotNull(schema.chapters.publishedAt),
    eq(schema.works.published, true)
  ];

  const historyQuery = db
    .select({
      ...getTableColumns(schema.reading),
      chapters: {
        id: schema.chapters.id,
        number: schema.chapters.number,
      },
      works: {
        slug: schema.works.slug,
        title: schema.works.title,
        coverId: schema.works.coverId
      }
    })
    .from(schema.reading)
    .innerJoin(schema.chapters, eq(schema.reading.chapterId, schema.chapters.id))
    .innerJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
    .where(and(...historyWheres))
    .orderBy(desc(schema.reading.updatedAt), asc(schema.reading.chapterId))
    .limit(MEMBER_PAGE_SIZE)
    .offset(start);

  const historyCountQuery = db
    .select({ count: count() })
    .from(schema.reading)
    .innerJoin(schema.chapters, eq(schema.reading.chapterId, schema.chapters.id))
    .innerJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
    .where(and(...historyWheres));

  async function getLibrary() {
    if (!['biblioteca', 'favoritos'].includes(params.area)) return empty;
    const [d, c] = await Promise.all([safeQuery(libraryQuery), safeQuery(libraryCountQuery)]);
    return { data: d.data || [], error: d.error, count: c.data?.[0]?.count || 0 };
  }

  async function getHistory() {
    if (params.area !== 'historico') return empty;
    const [d, c] = await Promise.all([safeQuery(historyQuery), safeQuery(historyCountQuery)]);
    return { data: d.data || [], error: d.error, count: c.data?.[0]?.count || 0 };
  }

  async function getNotifications() {
    if (params.area !== 'notificacoes') return empty;
    const [d, c] = await Promise.all([safeQuery(notificationsQuery), safeQuery(notificationsCountQuery)]);
    return { data: d.data || [], error: d.error, count: c.data?.[0]?.count || 0 };
  }

  const [library, history, notifications] = await Promise.all([
    getLibrary(),
    getHistory(),
    getNotifications()
  ]);

  if (library.error) console.error(library.error);
  if (history.error) console.error(history.error);
  if (notifications.error) console.error(notifications.error);

  const total =
    (area === 'historico' ? history.count : area === 'notificacoes' ? notifications.count : library.count) || 0;

  const lastPage = Math.max(1, Math.ceil(total / MEMBER_PAGE_SIZE));
  if (page > lastPage) redirect(303, pageLink(`/${area}`, lastPage, { status: tab, filtro: filter }));

  // Profile completed / libraryTotal / completedWorks
  const completedQuery = db
    .select({ count: count() })
    .from(schema.reading)
    .where(and(
      eq(schema.reading.userId, locals.user.id),
      isNotNull(schema.reading.completedAt)
    ));

  const libraryTotalQuery = db
    .select({ count: count() })
    .from(schema.library)
    .innerJoin(schema.works, eq(schema.library.workId, schema.works.id))
    .where(and(
      eq(schema.library.userId, locals.user.id),
      eq(schema.works.published, true)
    ));

  const completedWorksQuery = db
    .select({ count: count() })
    .from(schema.library)
    .innerJoin(schema.works, eq(schema.library.workId, schema.works.id))
    .where(and(
      eq(schema.library.userId, locals.user.id),
      eq(schema.works.published, true),
      eq(schema.library.status, 'COMPLETED')
    ));

  async function getProfileStats() {
    if (area !== 'perfil') return [empty, empty, empty];
    const [c, l, cw] = await Promise.all([
      safeQuery(completedQuery),
      safeQuery(libraryTotalQuery),
      safeQuery(completedWorksQuery)
    ]);
    return [
      { data: null, error: c.error, count: c.data?.[0]?.count || 0 },
      { data: null, error: l.error, count: l.data?.[0]?.count || 0 },
      { data: null, error: cw.error, count: cw.data?.[0]?.count || 0 }
    ];
  }

  const [completed, libraryTotal, completedWorks] = await getProfileStats();

  if (completed.error) console.error(completed.error);
  if (libraryTotal.error) console.error(libraryTotal.error);
  if (completedWorks.error) console.error(completedWorks.error);

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
