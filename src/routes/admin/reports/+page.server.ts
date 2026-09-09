import { fail, redirect } from '@sveltejs/kit';
import { readRequestFormData } from '$lib/server/request-body';

export const load = async ({ locals, url }) => {
  if (!locals.user || !['ADMIN', 'EDITOR'].includes(locals.role || '')) {
    throw redirect(303, '/entrar?redirect=/admin/reports');
  }

  const statusFilter = url.searchParams.get('status') || 'ALL';
  const typeFilter = url.searchParams.get('type') || 'ALL';

  let query = locals.db
    .from('reports')
    .select(
      `
      id,
      target_type,
      reason,
      details,
      status,
      resolution_notes,
      created_at,
      updated_at,
      reporter:members!reports_reporter_id_fkey(id, username, display_name),
      assigned:members!reports_assigned_to_fkey(id, username, display_name),
      work:works(id, title, slug),
      chapter:chapters(id, number, title),
      comment:comments(id, body, user_id)
    `
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (statusFilter !== 'ALL') {
    query = query.eq('status', statusFilter);
  }
  if (typeFilter !== 'ALL') {
    query = query.eq('target_type', typeFilter);
  }

  const [reportsRes, countsRes] = await Promise.all([
    query,
    locals.db.from('reports').select('status, target_type')
  ]);

  const allReports = countsRes.data || [];
  const statusCounts = {
    ALL: allReports.length,
    NOVO: allReports.filter((r) => r.status === 'NOVO').length,
    EM_ANALISE: allReports.filter((r) => r.status === 'EM_ANALISE').length,
    ATRIBUIDO: allReports.filter((r) => r.status === 'ATRIBUIDO').length,
    RESOLVIDO: allReports.filter((r) => r.status === 'RESOLVIDO').length,
    REJEITADO: allReports.filter((r) => r.status === 'REJEITADO').length
  };

  return {
    reports: reportsRes.data || [],
    statusCounts,
    statusFilter,
    typeFilter
  };
};

export const actions = {
  updateStatus: async ({ request, locals }) => {
    if (!locals.user || !['ADMIN', 'EDITOR'].includes(locals.role || '')) {
      return fail(403, { error: 'Não autorizado.' });
    }

    const formData = await readRequestFormData(request);
    const reportId = formData.get('reportId') as string;
    const newStatus = formData.get('status') as string;
    const notes = ((formData.get('notes') as string) || '').trim();

    if (!reportId || !['NOVO', 'EM_ANALISE', 'ATRIBUIDO', 'RESOLVIDO', 'REJEITADO'].includes(newStatus)) {
      return fail(400, { error: 'Status inválido.' });
    }

    if (notes.length > 2000) return fail(400, { error: 'Notas não podem exceder 2000 caracteres.' });

    const { error } = await locals.db.rpc('moderate_report', {
      p_report_id: reportId,
      p_status: newStatus,
      p_resolution_notes: notes || undefined
    });

    if (error) {
      console.warn('report_moderation_failed', { code: error.code });
      return fail(500, { error: 'Não foi possível atualizar a denúncia.' });
    }

    return { success: true };
  }
};
