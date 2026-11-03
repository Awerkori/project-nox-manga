import { executeYugabyteSql } from '$lib/server/yugabyte';
import {
  adminAuxPanelCache,
  adminAuxPanelFlights,
  withSingleFlightCache
} from '$lib/server/admin-cache';

export const load = async ({ platform }: any) => {
  return withSingleFlightCache(
    adminAuxPanelCache,
    adminAuxPanelFlights,
    'admin:tags',
    45_000,
    async () => {
      const res = await executeYugabyteSql(`
        SELECT t.id, t.name, t.slug, t.kind, COUNT(wt.work_id)::int AS work_count
        FROM tags t
        LEFT JOIN work_tags wt ON wt.tag_id = t.id
        GROUP BY t.id, t.name, t.slug, t.kind
        ORDER BY t.kind, t.name;
      `, [], platform?.env);

      return {
        tags: (res.rows || []).map((tag: any) => ({
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
          kind: tag.kind,
          workCount: Number(tag.work_count || 0)
        }))
      };
    }
  );
};
