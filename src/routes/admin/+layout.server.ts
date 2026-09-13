import { redirect } from '@sveltejs/kit';
import { withTimeout } from '$lib/server/resilience';

export const load = async ({ locals }) => {
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    throw redirect(303, '/entrar?redirect=/admin');
  }

  const reportsRes = await withTimeout(
    locals.db
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .in('status', ['NOVO', 'EM_ANALISE']),
    1500,
    { count: 0 } as any,
    'admin_pending_reports'
  );

  return {
    pendingReportsCount: reportsRes?.count || 0
  };
};
