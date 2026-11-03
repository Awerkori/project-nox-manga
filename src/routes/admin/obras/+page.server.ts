import { executeYugabyteSql } from '$lib/server/yugabyte';
import {
  adminAuxPanelCache,
  adminAuxPanelFlights,
  withSingleFlightCache
} from '$lib/server/admin-cache';

export const load = async ({ url, platform }: any) => {
  const search = (url.searchParams.get('q') || '').trim();
  const kind = (
    url.searchParams.get('tipo') ||
    url.searchParams.get('kind') ||
    url.searchParams.get('formato') ||
    'ALL'
  ).trim();
  const status = (url.searchParams.get('status') || 'ALL').trim();
  const page = Math.max(
    1,
    parseInt(url.searchParams.get('pagina') || url.searchParams.get('page') || '1', 10) || 1
  );
  const perPage = Math.min(
    100,
    Math.max(10, parseInt(url.searchParams.get('limite') || '25', 10) || 25)
  );

  const cacheKey = `admin:obras:${search}:${kind}:${status}:${page}:${perPage}`;
  return withSingleFlightCache(
    adminAuxPanelCache,
    adminAuxPanelFlights,
    cacheKey,
    20_000,
    async () => {
      let whereClauses: string[] = ['1=1'];
      let params: any[] = [];

      if (kind !== 'ALL') {
        params.push(kind);
        whereClauses.push(`kind = $${params.length}`);
      }
      if (status === 'PUBLISHED') {
        whereClauses.push(`published = true`);
      } else if (status === 'DRAFT') {
        whereClauses.push(`(published IS NULL OR published = false)`);
      }
      if (search) {
        params.push(`%${search}%`);
        const idx = params.length;
        whereClauses.push(`(title ILIKE $${idx} OR slug ILIKE $${idx} OR author ILIKE $${idx})`);
      }

      const whereSql = whereClauses.join(' AND ');

      const countRes = await executeYugabyteSql<{ cnt: number }>(
        `SELECT COUNT(*)::int AS cnt FROM public.works WHERE ${whereSql};`,
        params,
        platform?.env
      ).catch(() => ({ rows: [{ cnt: 0 }] }));
      const total = countRes.rows[0]?.cnt || 0;
      const totalPages = Math.ceil(total / perPage) || 1;

      const offset = (page - 1) * perPage;
      const dataParams = [...params, perPage, offset];
      const limitParamIdx = params.length + 1;
      const offsetParamIdx = params.length + 2;

      const dataRes = await executeYugabyteSql(
        `SELECT id, slug, title, aliases, synopsis, description, author, artist, kind, status, year, age_rating, published, featured, cover_id, updated_at, created_at, content_rating, views_total
         FROM public.works
         WHERE ${whereSql}
         ORDER BY updated_at DESC
         LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx};`,
        dataParams,
        platform?.env
      ).catch(() => ({ rows: [] }));

      const works = dataRes.rows || [];

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
    }
  );
};
