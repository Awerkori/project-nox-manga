import { error, fail, redirect } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import { parsePartnerRequestMeta } from '$lib/scans';
import { createNotification } from '$lib/server/notifications';
import { invalidateScansDirectoryCache } from '$lib/server/scans-directory-cache';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    throw redirect(303, '/entrar?redirect=/admin/tickets');
  }

  const isAdmin = locals.role === 'ADMIN';
  const requestedTab = url.searchParams.get('tab') || 'relatorios';

  // Strict permission guard: non-admin users cannot access 'scans' or 'moderacao'
  if (!isAdmin && (requestedTab === 'scans' || requestedTab === 'moderacao')) {
    throw redirect(303, '/admin/tickets?tab=relatorios');
  }

  const activeTab = (requestedTab === 'scans' && isAdmin)
    ? 'scans'
    : (requestedTab === 'moderacao' && isAdmin)
    ? 'moderacao'
    : 'relatorios';

  const statusFilter = url.searchParams.get('status') || 'ALL';
  const typeFilter = url.searchParams.get('type') || 'ALL';
  const searchQuery = (url.searchParams.get('q') || '').trim().toLowerCase();

  const db = locals.db || privileged();

  // 1. Content Reports Query (Work & Chapter issues)
  let contentQuery = db
    .from('reports')
    .select(`
      id,
      target_type,
      work_id,
      chapter_id,
      reason,
      details,
      status,
      resolution_notes,
      created_at,
      updated_at,
      reporter:members!reports_reporter_id_fkey(id, username, display_name, avatar_id, avatar_crop),
      assigned:members!reports_assigned_to_fkey(id, username, display_name),
      work:works(id, title, slug, cover_id),
      chapter:chapters(id, number, display_number, title, work_id, works(id, title, slug, cover_id))
    `)
    .not('target_type', 'in', '("COMMENT","USER")')
    .order('created_at', { ascending: false })
    .limit(200);

  if (activeTab === 'relatorios') {
    if (statusFilter !== 'ALL') contentQuery = contentQuery.eq('status', statusFilter);
    if (typeFilter !== 'ALL') contentQuery = contentQuery.eq('target_type', typeFilter);
  }

  // 2. Scan Partner Requests Query (ADMIN ONLY)
  let partnerQuery = isAdmin
    ? db
        .from('scan_partner_requests')
        .select(`
          *,
          applicant:members!user_id(id, username, display_name, avatar_id, avatar_crop)
        `)
        .order('created_at', { ascending: false })
        .limit(100)
    : Promise.resolve({ data: [] });

  if (isAdmin && activeTab === 'scans' && statusFilter !== 'ALL') {
    partnerQuery = (partnerQuery as any).eq('status', statusFilter);
  }

  // 3. Moderation Reports Query (Comment & User issues, ADMIN ONLY)
  let moderationQuery = isAdmin
    ? db
        .from('reports')
        .select(`
          id,
          target_type,
          work_id,
          chapter_id,
          comment_id,
          reason,
          details,
          status,
          resolution_notes,
          created_at,
          updated_at,
          reporter:members!reports_reporter_id_fkey(id, username, display_name, avatar_id, avatar_crop),
          assigned:members!reports_assigned_to_fkey(id, username, display_name),
          comment:comments(
            id,
            body,
            user_id,
            parent_id,
            removed,
            created_at,
            author:members!comments_user_id_fkey(id, username, display_name, avatar_id, avatar_crop),
            work:works(id, title, slug),
            chapter:chapters(id, number, display_number, title, works(id, title, slug))
          ),
          target_user:members!reports_target_user_id_fkey(id, username, display_name, avatar_id, avatar_crop)
        `)
        .in('target_type', ['COMMENT', 'USER'])
        .order('created_at', { ascending: false })
        .limit(100)
    : Promise.resolve({ data: [] });

  if (isAdmin && activeTab === 'moderacao' && statusFilter !== 'ALL') {
    moderationQuery = (moderationQuery as any).eq('status', statusFilter);
  }

  // 4. Overall counts for badges and stats
  const [contentReportsRes, partnerReqsRes, moderationReportsRes, allReportsCountRes] = await Promise.all([
    contentQuery,
    partnerQuery,
    moderationQuery,
    db.from('reports').select('id, status, target_type')
  ]);

  const rawReports = (contentReportsRes.data as any[]) || [];
  const rawScans = (partnerReqsRes.data as any[]) || [];
  const rawModeration = (moderationReportsRes.data as any[]) || [];
  const allReportsMeta = (allReportsCountRes.data as any[]) || [];

  // Categorize counts
  const contentReportsList = allReportsMeta.filter(r => !['COMMENT', 'USER'].includes(r.target_type));
  const moderationReportsList = allReportsMeta.filter(r => ['COMMENT', 'USER'].includes(r.target_type));

  const contentStatusCounts = {
    ALL: contentReportsList.length,
    NOVO: contentReportsList.filter(r => r.status === 'NOVO').length,
    EM_ANALISE: contentReportsList.filter(r => r.status === 'EM_ANALISE').length,
    RESOLVIDO: contentReportsList.filter(r => r.status === 'RESOLVIDO').length,
    REJEITADO: contentReportsList.filter(r => r.status === 'REJEITADO').length
  };

  const partnerStatusCounts = {
    ALL: rawScans.length,
    PENDING: rawScans.filter((s: any) => s.status === 'PENDING').length,
    APPROVED: rawScans.filter((s: any) => s.status === 'APPROVED').length,
    REJECTED: rawScans.filter((s: any) => s.status === 'REJECTED').length
  };

  const moderationStatusCounts = {
    ALL: moderationReportsList.length,
    NOVO: moderationReportsList.filter(r => r.status === 'NOVO').length,
    EM_ANALISE: moderationReportsList.filter(r => r.status === 'EM_ANALISE').length,
    RESOLVIDO: moderationReportsList.filter(r => r.status === 'RESOLVIDO').length,
    REJEITADO: moderationReportsList.filter(r => r.status === 'REJEITADO').length
  };

  // Enrich Content Reports with specific Work, Chapter, and Page context
  const enrichedReports = rawReports.map((rep: any) => {
    const pageMatch = rep.details?.match(/\[Página\s+(\d+)\]/i) || rep.details?.match(/\bp[áa]gina\s+(\d+)\b/i);
    const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : null;
    const cleanDetails = rep.details ? rep.details.replace(/^\[Página\s+\d+\]\s*/i, '').trim() : '';

    const effectiveWork = rep.chapter?.works || rep.work;
    const workTitle = effectiveWork?.title || (rep.target_type === 'CHAPTER' ? 'Obra do Capítulo' : 'Obra do Catálogo');
    const workSlug = effectiveWork?.slug || '';
    const coverId = effectiveWork?.cover_id || null;

    let chapterDisplay: string | null = null;
    let chapterTitle: string | null = null;
    let problemLink = '';

    if (rep.target_type === 'CHAPTER') {
      if (rep.chapter) {
        const num = rep.chapter.display_number ?? rep.chapter.number;
        chapterDisplay = num !== null && num !== undefined ? `${num}` : 'Especial';
        chapterTitle = rep.chapter.title || null;
        const pageParam = pageNumber ? `?page=${pageNumber}#pagina-${pageNumber}` : '';
        problemLink = `/ler/${rep.chapter.id}${pageParam}`;
      } else if (effectiveWork?.slug) {
        problemLink = `/obra/${effectiveWork.slug}`;
      }
    } else if (rep.target_type === 'WORK') {
      if (effectiveWork?.slug) {
        problemLink = `/obra/${effectiveWork.slug}`;
      }
    }

    return {
      ...rep,
      workTitle,
      workSlug,
      coverId,
      chapterDisplay,
      chapterTitle,
      pageNumber,
      cleanDetails: cleanDetails || rep.details || '',
      problemLink
    };
  });

  // Group Content Reports into clusters
  const clustersMap = new Map<string, any>();
  for (const rep of enrichedReports) {
    let key = `SINGLE:${rep.id}`;
    let clusterTitle = rep.workTitle;
    let link = rep.problemLink;
    let coverId = rep.coverId;

    if (rep.target_type === 'CHAPTER' && rep.chapter) {
      key = `CHAPTER:${rep.chapter.id}`;
      clusterTitle = `${rep.workTitle} — Cap. ${rep.chapterDisplay}${rep.chapterTitle ? ` (${rep.chapterTitle})` : ''}`;
    } else if (rep.target_type === 'WORK' && rep.work) {
      key = `WORK:${rep.work.id}`;
      clusterTitle = `Obra: ${rep.workTitle}`;
    }

    let cluster = clustersMap.get(key);
    if (!cluster) {
      cluster = {
        clusterKey: key,
        targetType: rep.target_type,
        targetTitle: clusterTitle,
        workTitle: rep.workTitle,
        chapterDisplay: rep.chapterDisplay,
        targetLink: link,
        coverId,
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

    if (cluster.reports.some((r: any) => r.status === 'NOVO')) {
      cluster.status = 'NOVO';
    } else if (cluster.reports.some((r: any) => r.status === 'EM_ANALISE')) {
      cluster.status = 'EM_ANALISE';
    } else if (cluster.reports.every((r: any) => r.status === 'RESOLVIDO')) {
      cluster.status = 'RESOLVIDO';
    } else if (cluster.reports.every((r: any) => r.status === 'REJEITADO')) {
      cluster.status = 'REJEITADO';
    }
  }

  let clusters = Array.from(clustersMap.values());
  if (searchQuery) {
    clusters = clusters.filter(c =>
      c.targetTitle.toLowerCase().includes(searchQuery) ||
      c.workTitle.toLowerCase().includes(searchQuery) ||
      c.reasons.some((r: string) => r.toLowerCase().includes(searchQuery))
    );
  }

  // Parse partner scan metadata
  const partnerRequests = rawScans.map((r: any) => ({
    ...r,
    meta: parsePartnerRequestMeta(r.sample_links)
  }));

  // Fetch parent comments for replies in moderation
  const parentCommentIds = rawModeration
    .map((r: any) => r.comment?.parent_id)
    .filter((id: string | null | undefined): id is string => Boolean(id));

  const parentCommentsMap = new Map<string, any>();
  if (parentCommentIds.length > 0) {
    const { data: parentRows } = await db
      .from('comments')
      .select(`
        id,
        body,
        removed,
        created_at,
        author:members!comments_user_id_fkey(id, username, display_name, avatar_id, avatar_crop)
      `)
      .in('id', parentCommentIds);
    if (parentRows) {
      for (const p of parentRows) {
        parentCommentsMap.set(p.id, p);
      }
    }
  }

  // Fetch suspended status for users involved in moderation
  const userIdsToCheck = rawModeration
    .map((r: any) => r.comment?.user_id || r.target_user?.id)
    .filter((id: string | null | undefined): id is string => Boolean(id));

  const suspendedMap = new Map<string, boolean>();
  if (userIdsToCheck.length > 0) {
    const { data: roleRows } = await db
      .from('access_roles')
      .select('user_id, suspended')
      .in('user_id', userIdsToCheck);
    if (roleRows) {
      for (const role of roleRows) {
        suspendedMap.set(role.user_id, Boolean(role.suspended));
      }
    }
  }

  // Enrich moderation reports
  let enrichedModeration = rawModeration.map((r: any) => {
    const comm = r.comment;
    const authorId = comm?.user_id || r.target_user?.id;
    const isAuthorSuspended = authorId ? suspendedMap.get(authorId) || false : false;

    let parentComment = null;
    if (comm?.parent_id) {
      parentComment = parentCommentsMap.get(comm.parent_id) || null;
    }

    let siteLink = '';
    let locationLabel = 'Conteúdo Geral';
    let workTitle = '';
    let chapterDisplay = '';

    if (comm?.chapter) {
      workTitle = comm.chapter.works?.title || 'Obra';
      chapterDisplay = comm.chapter.display_number ?? comm.chapter.number ?? '';
      locationLabel = `${workTitle} — Cap. ${chapterDisplay}`;
      siteLink = `/ler/${comm.chapter.id}#comment-${comm.id}`;
    } else if (comm?.work) {
      workTitle = comm.work.title || 'Obra';
      locationLabel = `Obra: ${workTitle}`;
      siteLink = `/obra/${comm.work.slug}#comment-${comm.id}`;
    }

    let visibilityStatus: 'VISIBLE' | 'HIDDEN' | 'DELETED' = 'VISIBLE';
    if (!comm) {
      visibilityStatus = 'DELETED';
    } else if (comm.removed) {
      visibilityStatus = 'HIDDEN';
    } else {
      visibilityStatus = 'VISIBLE';
    }

    return {
      ...r,
      parentComment,
      isAuthorSuspended,
      siteLink,
      locationLabel,
      workTitle,
      chapterDisplay,
      visibilityStatus
    };
  });

  if (searchQuery) {
    enrichedModeration = enrichedModeration.filter((m: any) =>
      m.reason?.toLowerCase().includes(searchQuery) ||
      m.details?.toLowerCase().includes(searchQuery) ||
      m.comment?.body?.toLowerCase().includes(searchQuery) ||
      m.comment?.author?.username?.toLowerCase().includes(searchQuery) ||
      m.comment?.author?.display_name?.toLowerCase().includes(searchQuery) ||
      m.locationLabel?.toLowerCase().includes(searchQuery)
    );
  }

  const pendingReportsCount = contentStatusCounts.NOVO + contentStatusCounts.EM_ANALISE;
  const pendingScansCount = partnerStatusCounts.PENDING;
  const pendingModerationCount = moderationStatusCounts.NOVO + moderationStatusCounts.EM_ANALISE;
  const totalTicketsCount = pendingReportsCount + (isAdmin ? (pendingScansCount + pendingModerationCount) : 0);

  return {
    isAdmin,
    activeTab,
    statusFilter,
    typeFilter,
    searchQuery,
    contentReports: enrichedReports,
    clusters,
    contentStatusCounts,
    partnerRequests,
    partnerStatusCounts,
    moderationReports: enrichedModeration,
    moderationStatusCounts,
    ticketStats: {
      totalTicketsCount,
      pendingReportsCount,
      pendingScansCount,
      pendingModerationCount
    }
  };
};

export const actions: Actions = {
  updateReportStatus: async ({ request, locals }) => {
    if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
      return fail(403, { error: 'Não autorizado.' });
    }

    const formData = await request.formData();
    const reportId = formData.get('reportId') as string;
    const newStatus = formData.get('status') as string;
    const notes = (formData.get('notes') as string || '').trim();

    if (!reportId || !['NOVO', 'EM_ANALISE', 'RESOLVIDO', 'REJEITADO'].includes(newStatus)) {
      return fail(400, { error: 'Status ou id inválidos.' });
    }

    const updatePayload: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (newStatus === 'EM_ANALISE') {
      updatePayload.assigned_to = locals.user.id;
    }
    if (notes) {
      updatePayload.resolution_notes = notes;
    }

    const db = locals.db || privileged();

    const { data: rep } = await db
      .from('reports')
      .select('reporter_id, target_type')
      .eq('id', reportId)
      .maybeSingle();

    const { error: updErr } = await db
      .from('reports')
      .update(updatePayload)
      .eq('id', reportId);

    if (updErr) {
      return fail(500, { error: 'Erro ao atualizar relatório: ' + updErr.message });
    }

    if (rep?.reporter_id) {
      try {
        const statusLabel = newStatus === 'RESOLVIDO' ? 'resolvido' : newStatus === 'EM_ANALISE' ? 'em análise' : newStatus === 'REJEITADO' ? 'encerrado' : 'atualizado';
        await db.from('notifications').insert({
          user_id: rep.reporter_id,
          kind: 'report',
          body: `Seu relatório sobre o item foi marcado como ${statusLabel} pela equipe editorial.`,
          href: '/notificacoes',
          dedupe_key: `report:${reportId}:${newStatus}`
        });
      } catch {}
    }

    return { success: true };
  },

  resolveBatchReports: async ({ request, locals }) => {
    if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
      return fail(403, { error: 'Não autorizado.' });
    }

    const formData = await request.formData();
    const rawIds = formData.get('reportIds') as string;
    const newStatus = formData.get('status') as string;
    const notes = (formData.get('notes') as string || '').trim();

    const reportIds = rawIds ? rawIds.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (reportIds.length === 0 || !['NOVO', 'EM_ANALISE', 'RESOLVIDO', 'REJEITADO'].includes(newStatus)) {
      return fail(400, { error: 'Requisição inválida.' });
    }

    const updatePayload: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (newStatus === 'EM_ANALISE') {
      updatePayload.assigned_to = locals.user.id;
    }
    if (notes) {
      updatePayload.resolution_notes = notes;
    }

    const db = locals.db || privileged();

    const { data: reps } = await db
      .from('reports')
      .select('id, reporter_id')
      .in('id', reportIds);

    const { error: updErr } = await db
      .from('reports')
      .update(updatePayload)
      .in('id', reportIds);

    if (updErr) {
      return fail(500, { error: 'Erro ao atualizar relatórios em lote: ' + updErr.message });
    }

    if (reps && reps.length > 0) {
      try {
        const statusLabel = newStatus === 'RESOLVIDO' ? 'resolvido' : newStatus === 'EM_ANALISE' ? 'em análise' : newStatus === 'REJEITADO' ? 'encerrado' : 'atualizado';
        const notifs = reps.map((r: any) => ({
          user_id: r.reporter_id,
          kind: 'report',
          body: `Seu relatório foi marcado como ${statusLabel} pela equipe editorial.`,
          href: '/notificacoes',
          dedupe_key: `report:${r.id}:${newStatus}`
        }));
        await db.from('notifications').insert(notifs);
      } catch {}
    }

    return { success: true, count: reportIds.length };
  },

  reviewScanPartner: async ({ request, locals, platform }) => {
    // STRICT ACCESS: Only global ADMIN can review Scan Partner applications
    if (locals.role !== 'ADMIN') {
      return fail(403, { message: 'Acesso negado. Apenas Administradores Globais podem avaliar solicitações de scan.' });
    }

    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;
    const actionType = formData.get('action') as string;
    const reason = (formData.get('reason') as string)?.trim() || null;

    if (!requestId || !['APPROVE', 'REJECT'].includes(actionType)) {
      return fail(400, { message: 'Dados de avaliação de parceria inválidos.' });
    }

    const db = locals.db || privileged();

    // 1. Fetch current request to know candidate details & meta
    const { data: partnerReq, error: reqErr } = await db
      .from('scan_partner_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (reqErr || !partnerReq) {
      return fail(404, { message: 'Solicitação de parceria não encontrada.' });
    }

    // 2. Call RPC to approve or reject
    const { data, error: rpcErr } = await locals.db.rpc('review_scan_partner_request', {
      p_request_id: requestId,
      p_action: actionType,
      p_reason: reason || undefined
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });

    const meta = parsePartnerRequestMeta(partnerReq.sample_links);

    // Keep YSQL partner requests table in sync
    try {
      if (actionType === 'APPROVE') {
        await executeYugabyteSql(
          `UPDATE public.scan_partner_requests
           SET status = 'APPROVED', reviewed_by = $2, reviewed_at = now()
           WHERE id = $1`,
          [requestId, locals.user!.id],
          platform?.env
        );
      } else {
        await executeYugabyteSql(
          `UPDATE public.scan_partner_requests
           SET status = 'REJECTED', reviewed_by = $2, reviewed_at = now(), rejection_reason = $3
           WHERE id = $1`,
          [requestId, locals.user!.id, reason],
          platform?.env
        );
      }
    } catch (e: any) {
      console.warn('YSQL partner request sync error (non-fatal):', e?.message);
    }

    if (actionType === 'APPROVE') {
      const createdScanId = data?.scan_id;

      // 3. Attach candidate Logo & Banner if provided
      if (createdScanId && (meta.logo_id || meta.banner_id)) {
        try {
          await db
            .from('scans')
            .update({
              logo_id: meta.logo_id || null,
              banner_id: meta.banner_id || null
            })
            .eq('id', createdScanId);

          await executeYugabyteSql(
            `UPDATE public.scans
             SET logo_id = COALESCE($2::uuid, logo_id),
                 banner_id = COALESCE($3::uuid, banner_id),
                 updated_at = now()
             WHERE id = $1`,
            [createdScanId, meta.logo_id || null, meta.banner_id || null],
            platform?.env
          );
        } catch (e: any) {
          console.warn('Failed to attach candidate media to approved scan:', e?.message);
        }
      }

      invalidateScansDirectoryCache();

      // 4. Dispatch congratulatory in-app notification
      try {
        await createNotification({
          recipientUserId: partnerReq.user_id,
          type: 'SYSTEM_ANNOUNCEMENT',
          title: 'Parceria de Scan Aprovada! 🎉',
          body: `Parabéns! Sua solicitação para a scan "${partnerReq.scan_name}" foi aprovada pela administração do Project Nox. Seu painel de gestão (/scan) já está liberado!`,
          deepLink: '/scan',
          scanId: createdScanId
        }, platform);
      } catch (e: any) {
        console.warn('Failed to send approval notification:', e?.message);
      }
    } else {
      // Dispatch rejection notification with reason
      try {
        await createNotification({
          recipientUserId: partnerReq.user_id,
          type: 'SYSTEM_ANNOUNCEMENT',
          title: 'Solicitação de Parceria de Scan',
          body: `Sua solicitação para a scan "${partnerReq.scan_name}" foi recusada pela administração.${reason ? ` Motivo: ${reason}` : ''}`,
          deepLink: '/scans/cadastrar'
        }, platform);
      } catch (e: any) {
        console.warn('Failed to send rejection notification:', e?.message);
      }
    }

    return { success: true, reviewedPartner: data };
  },

  moderateComment: async ({ request, locals }) => {
    // STRICT ACCESS: Only global ADMIN can execute moderation actions
    if (locals.role !== 'ADMIN') {
      return fail(403, { message: 'Acesso negado. Apenas Administradores Globais podem moderar a comunidade.' });
    }

    const formData = await request.formData();
    const reportId = formData.get('report_id') as string;
    const commentId = formData.get('comment_id') as string;
    const actionType = formData.get('action') as string; // 'hide', 'unhide', 'delete', 'suspend_user', 'dismiss_report', 'resolve_report'
    const notes = (formData.get('notes') as string || '').trim();

    const db = locals.db || privileged();

    if (actionType === 'hide') {
      if (!commentId) return fail(400, { message: 'Comentário inválido.' });
      await db.from('comments').update({ removed: true }).eq('id', commentId);
      if (reportId) {
        await db.from('reports').update({
          status: 'RESOLVIDO',
          resolution_notes: notes || 'Comentário ocultado pela moderação.',
          assigned_to: locals.user!.id,
          updated_at: new Date().toISOString()
        }).eq('id', reportId);
      }
      return { success: true, action: 'hide' };
    }

    if (actionType === 'unhide') {
      if (!commentId) return fail(400, { message: 'Comentário inválido.' });
      await db.from('comments').update({ removed: false }).eq('id', commentId);
      return { success: true, action: 'unhide' };
    }

    if (actionType === 'delete') {
      if (!commentId) return fail(400, { message: 'Comentário inválido.' });
      await db.from('comments').delete().eq('id', commentId);
      if (reportId) {
        await db.from('reports').update({
          status: 'RESOLVIDO',
          resolution_notes: notes || 'Comentário excluído definitivamente pela moderação.',
          assigned_to: locals.user!.id,
          updated_at: new Date().toISOString()
        }).eq('id', reportId);
      }
      return { success: true, action: 'delete' };
    }

    if (actionType === 'suspend_user') {
      const targetUserId = formData.get('target_user_id') as string;
      if (!targetUserId) return fail(400, { message: 'Usuário alvo inválido.' });
      await db.from('access_roles').update({ suspended: true }).eq('user_id', targetUserId);
      if (reportId) {
        await db.from('reports').update({
          status: 'RESOLVIDO',
          resolution_notes: notes || 'Usuário suspenso pela moderação.',
          assigned_to: locals.user!.id,
          updated_at: new Date().toISOString()
        }).eq('id', reportId);
      }
      return { success: true, action: 'suspend_user' };
    }

    if (actionType === 'dismiss_report') {
      if (!reportId) return fail(400, { message: 'Denúncia inválida.' });
      await db.from('reports').update({
        status: 'REJEITADO',
        resolution_notes: notes || 'Denúncia dispensada pela moderação.',
        assigned_to: locals.user!.id,
        updated_at: new Date().toISOString()
      }).eq('id', reportId);
      return { success: true, action: 'dismiss_report' };
    }

    if (actionType === 'resolve_report') {
      if (!reportId) return fail(400, { message: 'Denúncia inválida.' });
      await db.from('reports').update({
        status: 'RESOLVIDO',
        resolution_notes: notes || 'Ocorrência resolvida pela moderação.',
        assigned_to: locals.user!.id,
        updated_at: new Date().toISOString()
      }).eq('id', reportId);
      return { success: true, action: 'resolve_report' };
    }

    return fail(400, { message: 'Ação de moderação desconhecida.' });
  }
};
