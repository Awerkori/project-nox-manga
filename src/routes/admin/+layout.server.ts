import { redirect } from '@sveltejs/kit';
import { adminLayoutCache, adminLayoutFlights, withSingleFlightCache } from '$lib/server/admin-cache';
import { executeYugabyteSql } from '$lib/server/yugabyte';

const ADMIN_LAYOUT_COUNTS_TTL_MS = 30_000;

export const load = async ({ locals, platform }: any) => {
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    throw redirect(303, '/entrar?redirect=/admin');
  }

  const isAdmin = locals.role === 'ADMIN';
  const cacheKey = isAdmin ? 'admin' : 'editorial';

  return withSingleFlightCache(adminLayoutCache, adminLayoutFlights, cacheKey, ADMIN_LAYOUT_COUNTS_TTL_MS, async () => {
    const [reportsRes, scansRes, modRes] = await Promise.all([
      executeYugabyteSql(
        `SELECT count(*)::int AS cnt
         FROM public.reports
         WHERE status IN ('NOVO', 'EM_ANALISE')
           AND (target_type IS NULL OR target_type NOT IN ('COMMENT', 'USER'));`,
        [],
        platform?.env
      ).catch(() => ({ rows: [{ cnt: 0 }] })),

      isAdmin
        ? executeYugabyteSql(
            `SELECT count(*)::int AS cnt
             FROM public.scan_partner_requests
             WHERE status = 'PENDING';`,
            [],
            platform?.env
          ).catch(() => ({ rows: [{ cnt: 0 }] }))
        : Promise.resolve({ rows: [{ cnt: 0 }] }),

      isAdmin
        ? executeYugabyteSql(
            `SELECT count(*)::int AS cnt
             FROM public.reports
             WHERE status IN ('NOVO', 'EM_ANALISE')
               AND target_type IN ('COMMENT', 'USER');`,
            [],
            platform?.env
          ).catch(() => ({ rows: [{ cnt: 0 }] }))
        : Promise.resolve({ rows: [{ cnt: 0 }] })
    ]);

    const pendingReportsCount = Number(reportsRes?.rows[0]?.cnt) || 0;
    const pendingScansCount = Number(scansRes?.rows[0]?.cnt) || 0;
    const pendingModerationCount = Number(modRes?.rows[0]?.cnt) || 0;
    const totalTicketsCount = pendingReportsCount + (isAdmin ? pendingScansCount + pendingModerationCount : 0);

    return {
      pendingReportsCount,
      pendingScansCount,
      pendingModerationCount,
      totalTicketsCount
    };
  });
};
