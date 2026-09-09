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
      chapter:chapters(id, number, title, works(id, title, slug)),
      comment:comments(id, body, user_id)
    `)
    .order('created_at', { ascending: false })
    .limit(200);

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

  const rawReports = (reportsRes.data as any[]) || [];

  // Group into clusters by target item
  const clustersMap = new Map<string, {
    clusterKey: string;
    targetType: string;
    targetTitle: string;
    targetLink?: string;
    count: number;
    newCount: number;
    status: string;
    latestCreatedAt: string;
    reasons: string[];
    reportIds: string[];
    reports: any[];
  }>();

  for (const rep of rawReports) {
    let key = `SINGLE:${rep.id}`;
    let title = 'Conteúdo Geral';
    let link = '';

    if (rep.target_type === 'CHAPTER' && rep.chapter) {
      key = `CHAPTER:${rep.chapter.id}`;
      const workTitle = rep.chapter.works?.title || 'Obra';
      title = `${workTitle} — Cap. ${rep.chapter.number}${rep.chapter.title ? ` (${rep.chapter.title})` : ''}`;
      link = `/ler/${rep.chapter.id}`;
    } else if (rep.target_type === 'WORK' && rep.work) {
      key = `WORK:${rep.work.id}`;
      title = `Obra: ${rep.work.title}`;
      link = `/obra/${rep.work.slug}`;
    } else if (rep.target_type === 'COMMENT' && rep.comment) {
      key = `COMMENT:${rep.comment.id}`;
      title = `Comentário: "${rep.comment.body.slice(0, 40)}${rep.comment.body.length > 40 ? '...' : ''}"`;
    } else if (rep.target_type === 'USER' && rep.target_user_id) {
      key = `USER:${rep.target_user_id}`;
      title = `Perfil de Usuário`;
    }

    let cluster = clustersMap.get(key);
    if (!cluster) {
      cluster = {
        clusterKey: key,
        targetType: rep.target_type,
        targetTitle: title,
        targetLink: link,
        count: 0,
        newCount: 0,
        status: rep.status,
        latestCreatedAt: rep.created_at,
        reasons: [],
        reportIds: [],
        reports: []
      };
      clustersMap.set(key, cluster);
    }

    cluster.count += 1;
    if (rep.status === 'NOVO') cluster.newCount += 1;
    if (!cluster.reasons.includes(rep.reason)) cluster.reasons.push(rep.reason);
    cluster.reportIds.push(rep.id);
    cluster.reports.push(rep);

    if (cluster.reports.some(r => r.status === 'NOVO')) {
      cluster.status = 'NOVO';
    } else if (cluster.reports.some(r => r.status === 'EM_ANALISE')) {
      cluster.status = 'EM_ANALISE';
    } else if (cluster.reports.some(r => r.status === 'ATRIBUIDO')) {
      cluster.status = 'ATRIBUIDO';
    } else if (cluster.reports.every(r => r.status === 'RESOLVIDO')) {
      cluster.status = 'RESOLVIDO';
    } else if (cluster.reports.every(r => r.status === 'REJEITADO')) {
      cluster.status = 'REJEITADO';
    }
  }

  const clusters = Array.from(clustersMap.values());

  return {
    reports: rawReports,
    clusters,
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

    const { data: rep } = await locals.db
      .from('reports')
      .select('reporter_id, target_type')
      .eq('id', reportId)
      .maybeSingle();

    const { error } = await locals.db
      .from('reports')
      .update(updatePayload)
      .eq('id', reportId);

    if (error) {
      return fail(500, { error: 'Erro ao atualizar denúncia: ' + error.message });
    }

    if (rep?.reporter_id) {
      try {
        const statusLabel = newStatus === 'RESOLVIDO' ? 'resolvida' : newStatus === 'EM_ANALISE' ? 'em análise' : newStatus === 'REJEITADO' ? 'encerrada' : 'atualizada';
        await locals.db.from('notifications').insert({
          user_id: rep.reporter_id,
          kind: 'report',
          body: `Sua denúncia foi marcada como ${statusLabel} pela equipe editorial.`,
          href: '/notificacoes',
          dedupe_key: `report:${reportId}:${newStatus}`
        });
      } catch {
        // Notification failure should not abort report resolution
      }
    }

    return { success: true };
  },

  resolveBatch: async ({ request, locals }) => {
    if (!locals.user || !['ADMIN', 'EDITOR'].includes(locals.role || '')) {
      return fail(403, { error: 'Não autorizado.' });
    }

    const formData = await request.formData();
    const rawIds = formData.get('reportIds') as string;
    const newStatus = formData.get('status') as string;
    const notes = (formData.get('notes') as string || '').trim();

    const reportIds = rawIds ? rawIds.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (reportIds.length === 0 || !['NOVO', 'EM_ANALISE', 'ATRIBUIDO', 'RESOLVIDO', 'REJEITADO'].includes(newStatus)) {
      return fail(400, { error: 'Requisição inválida.' });
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

    const { data: reps } = await locals.db
      .from('reports')
      .select('id, reporter_id')
      .in('id', reportIds);

    const { error } = await locals.db
      .from('reports')
      .update(updatePayload)
      .in('id', reportIds);

    if (error) {
      return fail(500, { error: 'Erro ao atualizar denúncias: ' + error.message });
    }

    if (reps && reps.length > 0) {
      try {
        const statusLabel = newStatus === 'RESOLVIDO' ? 'resolvida' : newStatus === 'EM_ANALISE' ? 'em análise' : newStatus === 'REJEITADO' ? 'encerrada' : 'atualizada';
        const notifs = reps.map((r: any) => ({
          user_id: r.reporter_id,
          kind: 'report',
          body: `Sua denúncia foi marcada como ${statusLabel} pela equipe editorial.`,
          href: '/notificacoes',
          dedupe_key: `report:${r.id}:${newStatus}`
        }));
        await locals.db.from('notifications').insert(notifs);
      } catch {
        // Notification failure should not abort report resolution
      }
    }

    return { success: true, count: reportIds.length };
  }
};

