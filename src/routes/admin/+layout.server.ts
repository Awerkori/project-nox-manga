import { redirect } from '@sveltejs/kit';
import { withTimeout } from '$lib/server/resilience';
import { db, schema, safeQuery } from '$lib/server/db';
import { count, inArray } from 'drizzle-orm';

export const load = async ({ locals }) => {
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    throw redirect(303, '/entrar?redirect=/admin');
  }

  const reportsRes = await withTimeout(
    safeQuery(db.select({ count: count() }).from(schema.reports).where(inArray(schema.reports.status, ['NOVO', 'EM_ANALISE']))),
    1500,
    { data: [{ count: 0 }] } as any,
    'admin_pending_reports'
  );

  return {
    pendingReportsCount: reportsRes?.data?.[0]?.count || 0
  };
};
