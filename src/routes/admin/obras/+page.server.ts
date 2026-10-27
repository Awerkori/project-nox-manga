import { privileged } from '$lib/server/db';

export const load = async ({ locals, url }: any) => {
  const search = (url.searchParams.get('q') || '').trim();
  const kind = (url.searchParams.get('tipo') || url.searchParams.get('kind') || url.searchParams.get('formato') || 'ALL').trim();
  const status = (url.searchParams.get('status') || 'ALL').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('pagina') || url.searchParams.get('page') || '1', 10) || 1);
  const perPage = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limite') || '25', 10) || 25));

  const db = locals.db || privileged();

  let works: any[] = [];
  let total = 0;
  let totalPages = 1;

  try {
    const rpcRes = await db.rpc('admin_search_works', {
      p_search: search || null,
      p_kind: kind,
      p_status: status,
      p_page: page,
      p_per_page: perPage
    });

    if (!rpcRes.error && rpcRes.data) {
      works = rpcRes.data.works || [];
      total = Number(rpcRes.data.total) || 0;
      totalPages = Number(rpcRes.data.total_pages) || 1;
    } else {
      throw new Error(rpcRes.error?.message || 'RPC returned no data');
    }
  } catch (err: any) {
    console.warn('admin_search_works RPC fallback executing:', err?.message);
    let q = db
      .from('works')
      .select('id,slug,title,aliases,synopsis,description,author,artist,kind,status,year,age_rating,published,featured,cover_id,updated_at,created_at,content_rating,views_total', { count: 'exact' });

    if (kind !== 'ALL') q = q.eq('kind', kind);
    if (status === 'PUBLISHED') q = q.eq('published', true);
    if (status === 'DRAFT') q = q.or('published.is.null,published.eq.false');
    if (search) {
      q = q.or(`title.ilike.%${search}%,slug.ilike.%${search}%,search_text.ilike.%${search}%,author.ilike.%${search}%`);
    }

    const { data: fallbackData, count: fallbackCount } = await q
      .order('updated_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);

    works = fallbackData || [];
    total = fallbackCount || works.length;
    totalPages = Math.ceil(total / perPage) || 1;
  }

  return {
    works,
    total,
    page,
    perPage,
    totalPages,
    search,
    selectedKind: kind,
    selectedStatus: status
  };
};
