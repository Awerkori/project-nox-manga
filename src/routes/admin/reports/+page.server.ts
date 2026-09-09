import { fail, redirect } from '@sveltejs/kit';

export const load = async ({ locals, url }) => {
  if (!locals.user || !['ADMIN', 'EDITOR'].includes(locals.role || '')) {
    throw redirect(303, '/entrar?redirect=/admin/reports');
  }

  const statusFilter = url.searchParams.get('status') || 'ALL';
  const typeFilter = url.searchParams.get('type') || 'ALL';

  let query = locals.db
    .from('reports')
    .select(`
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
    `)
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
    locals.db
      .from('reports')
      .select('status, target_type')
  ]);

  const allReports = countsRes.data || [];
  const statusCounts = {
    ALL: allReports.length,
    NOVO: allReports.filter(r => r.status === 'NOVO').length,
    EM_ANALISE: allReports.filter(r => r.status === 'EM_ANALISE').length,
    ATRIBUIDO: allReports.filter(r => r.status === 'ATRIBUIDO').length,
    RESOLVIDO: allReports.filter(r => r.status === 'RESOLVIDO').length,
    REJEITADO: allReports.filter(r => r.status === 'REJEITADO').length
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

    const formData = await request.formData();
    const reportId = formData.get('reportId') as string;
    const newStatus = formData.get('status') as string;
    const notes = (formData.get('notes') as string || '').trim();

    if (!reportId || !['NOVO', 'EM_ANALISE', 'ATRIBUIDO', 'RESOLVIDO', 'REJEITADO'].includes(newStatus)) {
      return fail(400, { error: 'Status inválido.' });
    }

    const updatePayload: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (newStatus === 'ATRIBUIDO' || newStatus === 'EM_ANALISE') {
      updatePayload.assigned_to = locals.user.id;
    }
    if (notes) {
      updatePayload.resolution_notes = notes;
    }

    const { error } = await locals.db
      .from('reports')
      .update(updatePayload)
      .eq('id', reportId);

    if (error) {
      return fail(500, { error: 'Erro ao atualizar denúncia: ' + error.message });
    }

    return { success: true };
  }
};
