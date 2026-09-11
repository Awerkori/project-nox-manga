import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    throw redirect(303, '/entrar?redirect=/admin');
  }

  const { count: pendingReportsCount } = await locals.db
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .in('status', ['NOVO', 'EM_ANALISE']);

  return {
    pendingReportsCount: pendingReportsCount || 0
  };
};
