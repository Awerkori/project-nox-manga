import { redirect } from '@sveltejs/kit';
import { withTimeout } from '$lib/server/resilience';
import { adminLayoutCache, adminLayoutFlights, withSingleFlightCache } from '$lib/server/admin-cache';

const ADMIN_LAYOUT_COUNTS_TTL_MS = 30_000;

export const load = async ({ locals }) => {
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    throw redirect(303, '/entrar?redirect=/admin');
  }

  const isAdmin = locals.role === 'ADMIN';
  const cacheKey = isAdmin ? 'admin' : 'editorial';

  return withSingleFlightCache(adminLayoutCache, adminLayoutFlights, cacheKey, ADMIN_LAYOUT_COUNTS_TTL_MS, async () => {
    // 1. Pending content reports (Work & Chapter issues)
    const pendingReportsPromise = withTimeout(
      locals.db
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .in('status', ['NOVO', 'EM_ANALISE'])
        .is('deleted_at', null)
        .not('target_type', 'in', '("COMMENT","USER")'),
      1500,
      { count: 0 } as any,
      'admin_pending_content_reports'
    );

    // 2. Pending scan partner applications (ADMIN only)
    const pendingScansPromise = isAdmin
      ? withTimeout(
          locals.db
            .from('scan_partner_requests')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'PENDING')
            .is('deleted_at', null),
          1500,
          { count: 0 } as any,
          'admin_pending_scans'
        )
      : Promise.resolve({ count: 0 });

    // 3. Pending moderation issues (Comment & User issues) (ADMIN only)
    const pendingModerationPromise = isAdmin
      ? withTimeout(
          locals.db
            .from('reports')
            .select('id', { count: 'exact', head: true })
            .in('status', ['NOVO', 'EM_ANALISE'])
            .is('deleted_at', null)
            .in('target_type', ['COMMENT', 'USER']),
          1500,
          { count: 0 } as any,
          'admin_pending_moderation'
        )
      : Promise.resolve({ count: 0 });

    const [reportsRes, scansRes, modRes] = await Promise.all([
      pendingReportsPromise,
      pendingScansPromise,
      pendingModerationPromise
    ]);

    const pendingReportsCount = reportsRes?.count || 0;
    const pendingScansCount = scansRes?.count || 0;
    const pendingModerationCount = modRes?.count || 0;
    const totalTicketsCount = pendingReportsCount + (isAdmin ? pendingScansCount + pendingModerationCount : 0);

    return {
      pendingReportsCount,
      pendingScansCount,
      pendingModerationCount,
      totalTicketsCount
    };
  });
};
