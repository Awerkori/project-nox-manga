import { fail, redirect } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, desc, inArray, and } from 'drizzle-orm';

export const load = async ({ locals, url }) => {
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    throw redirect(303, '/entrar?redirect=/admin/reports');
  }

  const statusFilter = url.searchParams.get('status') || 'ALL';
  const typeFilter = url.searchParams.get('type') || 'ALL';

  let conditions = [];
  if (statusFilter !== 'ALL') conditions.push(eq(schema.reports.status, statusFilter));
  if (typeFilter !== 'ALL') conditions.push(eq(schema.reports.targetType, typeFilter));

  const query = db.select().from(schema.reports);
  const reportsRes = await safeQuery(
    conditions.length > 0 
      ? query.where(and(...conditions)).orderBy(desc(schema.reports.createdAt)).limit(200)
      : query.orderBy(desc(schema.reports.createdAt)).limit(200)
  );

  const countsRes = await safeQuery(db.select({ status: schema.reports.status, targetType: schema.reports.targetType }).from(schema.reports));

  const allReports = countsRes.success ? countsRes.data : [];
  const statusCounts = {
    ALL: allReports.length,
    NOVO: allReports.filter((r: any) => r.status === 'NOVO').length,
    EM_ANALISE: allReports.filter((r: any) => r.status === 'EM_ANALISE').length,
    ATRIBUIDO: allReports.filter((r: any) => r.status === 'ATRIBUIDO').length,
    RESOLVIDO: allReports.filter((r: any) => r.status === 'RESOLVIDO').length,
    REJEITADO: allReports.filter((r: any) => r.status === 'REJEITADO').length
  };

  const rawReports = reportsRes.success ? reportsRes.data : [];

  const clustersMap = new Map<string, any>();

  for (const rep of rawReports) {
    let key = `SINGLE:${rep.id}`;
    let title = 'Conteúdo Geral';
    let link = '';

    if (rep.targetType === 'CHAPTER' && rep.chapterId) {
      key = `CHAPTER:${rep.chapterId}`;
      title = `Obra — Cap.`;
      link = `/ler/${rep.chapterId}`;
    } else if (rep.targetType === 'WORK' && rep.workId) {
      key = `WORK:${rep.workId}`;
      title = `Obra: `;
      link = `/obra/${rep.workId}`;
    } else if (rep.targetType === 'COMMENT' && rep.commentId) {
      key = `COMMENT:${rep.commentId}`;
      title = `Comentário`;
    } else if (rep.targetType === 'USER' && rep.targetUserId) {
      key = `USER:${rep.targetUserId}`;
      title = `Perfil de Usuário`;
    }

    let cluster = clustersMap.get(key);
    if (!cluster) {
      cluster = {
        clusterKey: key,
        targetType: rep.targetType,
        targetTitle: title,
        targetLink: link,
        count: 0,
        newCount: 0,
        status: rep.status,
        latestCreatedAt: rep.createdAt,
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

    if (cluster.reports.some((r: any) => r.status === 'NOVO')) {
      cluster.status = 'NOVO';
    } else if (cluster.reports.some((r: any) => r.status === 'EM_ANALISE')) {
      cluster.status = 'EM_ANALISE';
    } else if (cluster.reports.some((r: any) => r.status === 'ATRIBUIDO')) {
      cluster.status = 'ATRIBUIDO';
    } else if (cluster.reports.every((r: any) => r.status === 'RESOLVIDO')) {
      cluster.status = 'RESOLVIDO';
    } else if (cluster.reports.every((r: any) => r.status === 'REJEITADO')) {
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
    if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
      return fail(403, { error: 'Não autorizado.' });
    }

    const formData = await request.formData();
    const reportId = formData.get('reportId') as string;
    const newStatus = formData.get('status') as string;
    const notes = (formData.get('notes') as string || '').trim();

    if (!reportId || !['NOVO', 'EM_ANALISE', 'ATRIBUIDO', 'RESOLVIDO', 'REJEITADO'].includes(newStatus)) {
      return fail(400, { error: 'Status inválido.' });
    }

    const updatePayload: any = { status: newStatus, updatedAt: new Date().toISOString() };

    if (newStatus === 'ATRIBUIDO' || newStatus === 'EM_ANALISE') {
      updatePayload.assignedTo = locals.user!.id;
    }
    if (notes) {
      updatePayload.resolutionNotes = notes;
    }

    const repRes = await safeQuerySingle(db.select({ reporterId: schema.reports.reporterId, targetType: schema.reports.targetType }).from(schema.reports).where(eq(schema.reports.id, reportId)));
    const rep = repRes.success ? repRes.data : null;

    const res = await safeQuery(db.update(schema.reports).set(updatePayload).where(eq(schema.reports.id, reportId)));

    if (!res.success) {
      return fail(500, { error: 'Erro ao atualizar denúncia: ' + res.error.message });
    }

    return { success: true };
  },

  resolveBatch: async ({ request, locals }) => {
    if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
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

    const updatePayload: any = { status: newStatus, updatedAt: new Date().toISOString() };

    if (newStatus === 'ATRIBUIDO' || newStatus === 'EM_ANALISE') {
      updatePayload.assignedTo = locals.user!.id;
    }
    if (notes) {
      updatePayload.resolutionNotes = notes;
    }

    const repsRes = await safeQuery(db.select({ id: schema.reports.id, reporterId: schema.reports.reporterId }).from(schema.reports).where(inArray(schema.reports.id, reportIds)));
    const reps = repsRes.success ? repsRes.data : [];

    const res = await safeQuery(db.update(schema.reports).set(updatePayload).where(inArray(schema.reports.id, reportIds)));

    if (!res.success) {
      return fail(500, { error: 'Erro ao atualizar denúncias: ' + res.error.message });
    }

    return { success: true, count: reportIds.length };
  }
};
