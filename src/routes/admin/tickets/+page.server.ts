import { fail, redirect } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import { parsePartnerRequestMeta } from '$lib/scans';
import { createNotification } from '$lib/server/notifications';
import { invalidateScansDirectoryCache } from '$lib/server/scans-directory-cache';
import {
  adminTicketsCache,
  adminTicketsFlights,
  invalidateAdminScansCache,
  invalidateAdminTicketsCache,
  withSingleFlightCache
} from '$lib/server/admin-cache';
import { invalidateUserSession } from '$lib/server/session-cache';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR', 'GERENTE'].includes(locals.role || '')) {
    throw redirect(303, '/entrar?redirect=/admin/tickets');
  }

  const isAdmin = locals.role === 'ADMIN';
  const isSiteManager = locals.role === 'ADMIN' || locals.role === 'GERENTE';
  const requestedTab = url.searchParams.get('tab') || 'relatorios';

  // Strict permission guard: non-admin users cannot access 'scans' or 'moderacao',
  // and non-managers cannot access 'obras'
  if (!isSiteManager && requestedTab === 'obras') {
    throw redirect(303, '/admin/tickets?tab=relatorios');
  }
  if (!isAdmin && (requestedTab === 'scans' || requestedTab === 'moderacao')) {
    throw redirect(303, '/admin/tickets?tab=relatorios');
  }

  const activeTab = (requestedTab === 'scans' && isAdmin)
    ? 'scans'
    : (requestedTab === 'moderacao' && isAdmin)
    ? 'moderacao'
    : (requestedTab === 'obras' && isSiteManager)
    ? 'obras'
    : 'relatorios';

  const requestedStatus = url.searchParams.get('status');
  const defaultStatus = (activeTab === 'scans' || activeTab === 'obras') ? 'PENDING' : 'NOVO';
  const statusFilter = requestedStatus || defaultStatus;
  const typeFilter = url.searchParams.get('type') || 'ALL';
  const searchQuery = (url.searchParams.get('q') || '').trim().toLowerCase();

  const cacheKey = `${locals.role}:${activeTab}:${statusFilter}:${typeFilter}:${searchQuery}`;
  return withSingleFlightCache(
    adminTicketsCache,
    adminTicketsFlights,
    cacheKey,
    15_000,
    async () => {
      // 1. Content Reports Query (Work & Chapter issues — only fetched when tab === 'relatorios')
      let rawReports: any[] = [];
      if (activeTab === 'relatorios') {
        let query = `
          SELECT 
            r.id, r.target_type, r.work_id, r.chapter_id, r.reason, r.details, r.status,
            r.resolution_notes, r.assigned_to, r.assigned_at, r.resolved_by, r.resolved_at,
            r.created_at, r.updated_at,
            CASE WHEN rep.id IS NOT NULL THEN json_build_object('id', rep.id, 'username', rep.username, 'display_name', rep.display_name, 'avatar_id', rep.avatar_id, 'avatar_crop', rep.avatar_crop) ELSE NULL END AS reporter,
            CASE WHEN ass.id IS NOT NULL THEN json_build_object('id', ass.id, 'username', ass.username, 'display_name', ass.display_name, 'avatar_id', ass.avatar_id, 'avatar_crop', ass.avatar_crop) ELSE NULL END AS assigned,
            CASE WHEN res.id IS NOT NULL THEN json_build_object('id', res.id, 'username', res.username, 'display_name', res.display_name, 'avatar_id', res.avatar_id, 'avatar_crop', res.avatar_crop) ELSE NULL END AS resolver,
            CASE WHEN w.id IS NOT NULL THEN json_build_object('id', w.id, 'title', w.title, 'slug', w.slug, 'cover_id', w.cover_id) ELSE NULL END AS work,
            CASE WHEN ch.id IS NOT NULL THEN json_build_object('id', ch.id, 'number', ch.number, 'display_number', ch.display_number, 'title', ch.title, 'work_id', ch.work_id, 'works', CASE WHEN w2.id IS NOT NULL THEN json_build_object('id', w2.id, 'title', w2.title, 'slug', w2.slug, 'cover_id', w2.cover_id) ELSE NULL END) ELSE NULL END AS chapter
          FROM public.reports r
          LEFT JOIN public.members rep ON rep.id = r.reporter_id
          LEFT JOIN public.members ass ON ass.id = r.assigned_to
          LEFT JOIN public.members res ON res.id = r.resolved_by
          LEFT JOIN public.works w ON w.id = r.work_id
          LEFT JOIN public.chapters ch ON ch.id = r.chapter_id
          LEFT JOIN public.works w2 ON w2.id = ch.work_id
          WHERE r.deleted_at IS NULL AND r.target_type NOT IN ('COMMENT', 'USER')
        `;
        const params: any[] = [];
        if (statusFilter !== 'ALL') {
          params.push(statusFilter);
          query += ` AND r.status = $${params.length}`;
        }
        if (typeFilter !== 'ALL') {
          params.push(typeFilter);
          query += ` AND r.target_type = $${params.length}`;
        }
        query += ` ORDER BY r.created_at DESC LIMIT 120;`;
        const res = await executeYugabyteSql(query, params, platform?.env).catch(() => ({ rows: [] }));
        rawReports = res.rows;
      }

      // 2. Scan Partner Requests Query (ADMIN ONLY — only fetched when tab === 'scans')
      let rawScans: any[] = [];
      if (isAdmin && activeTab === 'scans') {
        let query = `
          SELECT 
            p.*,
            CASE WHEN m.id IS NOT NULL THEN json_build_object('id', m.id, 'username', m.username, 'display_name', m.display_name, 'avatar_id', m.avatar_id, 'avatar_crop', m.avatar_crop) ELSE NULL END AS applicant,
            CASE WHEN ass.id IS NOT NULL THEN json_build_object('id', ass.id, 'username', ass.username, 'display_name', ass.display_name, 'avatar_id', ass.avatar_id, 'avatar_crop', ass.avatar_crop) ELSE NULL END AS assignee,
            CASE WHEN rev.id IS NOT NULL THEN json_build_object('id', rev.id, 'username', rev.username, 'display_name', rev.display_name, 'avatar_id', rev.avatar_id, 'avatar_crop', rev.avatar_crop) ELSE NULL END AS reviewer
          FROM public.scan_partner_requests p
          LEFT JOIN public.members m ON m.id = p.user_id
          LEFT JOIN public.members ass ON ass.id = p.assigned_to
          LEFT JOIN public.members rev ON rev.id = p.reviewed_by
          WHERE p.deleted_at IS NULL
        `;
        const params: any[] = [];
        if (statusFilter !== 'ALL') {
          if (statusFilter === 'PENDING') {
            query += ` AND p.status = 'PENDING' AND p.assigned_to IS NULL`;
          } else if (statusFilter === 'EM_ANALISE') {
            query += ` AND p.status = 'PENDING' AND p.assigned_to IS NOT NULL`;
          } else {
            params.push(statusFilter);
            query += ` AND p.status = $${params.length}`;
          }
        }
        query += ` ORDER BY p.created_at DESC LIMIT 100;`;
        const res = await executeYugabyteSql(query, params, platform?.env).catch(() => ({ rows: [] }));
        rawScans = res.rows;
      }

      // 3. Moderation Reports Query (Comment & User issues, ADMIN ONLY — only fetched when tab === 'moderacao')
      let rawModeration: any[] = [];
      if (isAdmin && activeTab === 'moderacao') {
        let query = `
          SELECT 
            r.id, r.target_type, r.work_id, r.chapter_id, r.comment_id, r.reason, r.details, r.status,
            r.resolution_notes, r.assigned_to, r.assigned_at, r.resolved_by, r.resolved_at,
            r.created_at, r.updated_at,
            CASE WHEN rep.id IS NOT NULL THEN json_build_object('id', rep.id, 'username', rep.username, 'display_name', rep.display_name, 'avatar_id', rep.avatar_id, 'avatar_crop', rep.avatar_crop) ELSE NULL END AS reporter,
            CASE WHEN ass.id IS NOT NULL THEN json_build_object('id', ass.id, 'username', ass.username, 'display_name', ass.display_name, 'avatar_id', ass.avatar_id, 'avatar_crop', ass.avatar_crop) ELSE NULL END AS assigned,
            CASE WHEN res.id IS NOT NULL THEN json_build_object('id', res.id, 'username', res.username, 'display_name', res.display_name, 'avatar_id', res.avatar_id, 'avatar_crop', res.avatar_crop) ELSE NULL END AS resolver,
            CASE WHEN tu.id IS NOT NULL THEN json_build_object('id', tu.id, 'username', tu.username, 'display_name', tu.display_name, 'avatar_id', tu.avatar_id, 'avatar_crop', tu.avatar_crop) ELSE NULL END AS target_user,
            CASE WHEN c.id IS NOT NULL THEN json_build_object(
              'id', c.id, 'body', c.body, 'user_id', c.user_id, 'parent_id', c.parent_id, 'removed', c.removed, 'deleted', c.deleted, 'created_at', c.created_at,
              'author', CASE WHEN ca.id IS NOT NULL THEN json_build_object('id', ca.id, 'username', ca.username, 'display_name', ca.display_name, 'avatar_id', ca.avatar_id, 'avatar_crop', ca.avatar_crop) ELSE NULL END,
              'work', CASE WHEN cw.id IS NOT NULL THEN json_build_object('id', cw.id, 'title', cw.title, 'slug', cw.slug) ELSE NULL END,
              'chapter', CASE WHEN cch.id IS NOT NULL THEN json_build_object('id', cch.id, 'number', cch.number, 'display_number', cch.display_number, 'title', cch.title, 'works', CASE WHEN cchw.id IS NOT NULL THEN json_build_object('id', cchw.id, 'title', cchw.title, 'slug', cchw.slug) ELSE NULL END) ELSE NULL END
            ) ELSE NULL END AS comment
          FROM public.reports r
          LEFT JOIN public.members rep ON rep.id = r.reporter_id
          LEFT JOIN public.members ass ON ass.id = r.assigned_to
          LEFT JOIN public.members res ON res.id = r.resolved_by
          LEFT JOIN public.members tu ON tu.id = r.target_user_id
          LEFT JOIN public.comments c ON c.id = r.comment_id
          LEFT JOIN public.members ca ON ca.id = c.user_id
          LEFT JOIN public.works cw ON cw.id = c.work_id
          LEFT JOIN public.chapters cch ON cch.id = c.chapter_id
          LEFT JOIN public.works cchw ON cchw.id = cch.work_id
          WHERE r.deleted_at IS NULL AND r.target_type IN ('COMMENT', 'USER')
        `;
        const params: any[] = [];
        if (statusFilter !== 'ALL') {
          params.push(statusFilter);
          query += ` AND r.status = $${params.length}`;
        }
        query += ` ORDER BY r.created_at DESC LIMIT 100;`;
        const res = await executeYugabyteSql(query, params, platform?.env).catch(() => ({ rows: [] }));
        rawModeration = res.rows;
      }

      // 4. Scan Work Requests Query (SITE MANAGERS: ADMIN OR GERENTE — only fetched when tab === 'obras')
      let rawWorkRequests: any[] = [];
      if (isSiteManager && activeTab === 'obras') {
        let query = `
          SELECT 
            r.id, r.scan_id, r.work_id, r.user_id, r.message, r.status,
            r.reviewed_by, r.reviewed_at, r.rejection_reason, r.created_at,
            jsonb_build_object(
              'id', s.id,
              'name', s.name,
              'slug', s.slug,
              'logo_id', s.logo_id,
              'is_official', s.is_official
            ) AS scan,
            jsonb_build_object(
              'id', w.id,
              'title', w.title,
              'slug', w.slug,
              'cover_id', w.cover_id,
              'kind', w.kind,
              'status', w.status,
              'author', w.author
            ) AS work,
            jsonb_build_object(
              'id', m.id,
              'username', m.username,
              'display_name', m.display_name,
              'avatar_id', m.avatar_id,
              'avatar_crop', m.avatar_crop
            ) AS requester,
            (
              SELECT sm.role FROM public.scan_members sm
              WHERE sm.scan_id = r.scan_id AND sm.user_id = r.user_id
              LIMIT 1
            ) AS requester_role,
            CASE WHEN rev.id IS NOT NULL THEN jsonb_build_object(
              'id', rev.id,
              'username', rev.username,
              'display_name', rev.display_name,
              'avatar_id', rev.avatar_id,
              'avatar_crop', rev.avatar_crop
            ) ELSE NULL END AS reviewer,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', es.id,
                'name', es.name,
                'slug', es.slug,
                'is_primary', ews.is_primary,
                'status', ews.status
              ))
              FROM public.work_scans ews
              JOIN public.scans es ON es.id = ews.scan_id
              WHERE ews.work_id = r.work_id
            ), '[]'::jsonb) AS existing_work_scans
          FROM public.scan_project_requests r
          JOIN public.scans s ON s.id = r.scan_id
          JOIN public.works w ON w.id = r.work_id
          JOIN public.members m ON m.id = r.user_id
          LEFT JOIN public.members rev ON rev.id = r.reviewed_by
          WHERE 1=1
        `;
        const params: any[] = [];
        if (statusFilter !== 'ALL') {
          params.push(statusFilter);
          query += ` AND r.status = $${params.length}`;
        }
        if (searchQuery) {
          params.push(`%${searchQuery}%`);
          query += ` AND (s.name ILIKE $${params.length} OR w.title ILIKE $${params.length} OR m.username ILIKE $${params.length} OR m.display_name ILIKE $${params.length})`;
        }
        query += ` ORDER BY r.created_at DESC LIMIT 100;`;
        const res = await executeYugabyteSql(query, params, platform?.env).catch(() => ({ rows: [] }));
        rawWorkRequests = res.rows || [];
      }

      // 5. Overall counts for badges and stats
      const [allReportsRes, allScansRes, allWorkRequestsRes] = await Promise.all([
        executeYugabyteSql(`SELECT id, status, target_type, assigned_to FROM public.reports WHERE deleted_at IS NULL;`, [], platform?.env).catch(() => ({ rows: [] })),
        isAdmin ? executeYugabyteSql(`SELECT id, status, assigned_to FROM public.scan_partner_requests WHERE deleted_at IS NULL;`, [], platform?.env).catch(() => ({ rows: [] })) : Promise.resolve({ rows: [] }),
        isSiteManager ? executeYugabyteSql(`SELECT id, status FROM public.scan_project_requests;`, [], platform?.env).catch(() => ({ rows: [] })) : Promise.resolve({ rows: [] })
      ]);

      const allReportsMeta = allReportsRes.rows || [];
      const allScansMeta = allScansRes.rows || [];
      const allWorkRequestsMeta = allWorkRequestsRes.rows || [];

      // Categorize counts
      const contentReportsList = allReportsMeta.filter((r: any) => !['COMMENT', 'USER'].includes(r.target_type));
      const moderationReportsList = allReportsMeta.filter((r: any) => ['COMMENT', 'USER'].includes(r.target_type));

      const contentStatusCounts = {
        NOVO: contentReportsList.filter((r: any) => r.status === 'NOVO').length,
        EM_ANALISE: contentReportsList.filter((r: any) => r.status === 'EM_ANALISE').length,
        RESOLVIDO: contentReportsList.filter((r: any) => r.status === 'RESOLVIDO').length,
        REJEITADO: contentReportsList.filter((r: any) => r.status === 'REJEITADO').length,
        ALL: contentReportsList.length
      };

      const partnerStatusCounts = {
        PENDING: allScansMeta.filter((s: any) => s.status === 'PENDING' && !s.assigned_to).length,
        EM_ANALISE: allScansMeta.filter((s: any) => s.status === 'PENDING' && Boolean(s.assigned_to)).length,
        APPROVED: allScansMeta.filter((s: any) => s.status === 'APPROVED').length,
        REJECTED: allScansMeta.filter((s: any) => s.status === 'REJECTED').length,
        ALL: allScansMeta.length
      };

      const moderationStatusCounts = {
        NOVO: moderationReportsList.filter((r: any) => r.status === 'NOVO').length,
        EM_ANALISE: moderationReportsList.filter((r: any) => r.status === 'EM_ANALISE').length,
        RESOLVIDO: moderationReportsList.filter((r: any) => r.status === 'RESOLVIDO').length,
        REJEITADO: moderationReportsList.filter((r: any) => r.status === 'REJEITADO').length,
        ALL: moderationReportsList.length
      };

      const workRequestStatusCounts = {
        PENDING: allWorkRequestsMeta.filter((s: any) => s.status === 'PENDING').length,
        APPROVED: allWorkRequestsMeta.filter((s: any) => s.status === 'APPROVED').length,
        REJECTED: allWorkRequestsMeta.filter((s: any) => s.status === 'REJECTED').length,
        CANCELLED: allWorkRequestsMeta.filter((s: any) => s.status === 'CANCELLED').length,
        ALL: allWorkRequestsMeta.length
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
        const link = rep.problemLink;
        const coverId = rep.coverId;

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
            assigned: rep.assigned,
            assigned_at: rep.assigned_at,
            resolver: rep.resolver,
            resolved_at: rep.resolved_at,
            reasons: [],
            reportIds: [],
            reports: []
          };
          clustersMap.set(key, cluster);
        }

        if (!cluster.assigned && rep.assigned) {
          cluster.assigned = rep.assigned;
          cluster.assigned_at = rep.assigned_at;
        }
        if (!cluster.resolver && rep.resolver) {
          cluster.resolver = rep.resolver;
          cluster.resolved_at = rep.resolved_at;
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
        const parentRes = await executeYugabyteSql(
          `SELECT 
             c.id, c.body, c.removed, c.created_at,
             CASE WHEN m.id IS NOT NULL THEN json_build_object('id', m.id, 'username', m.username, 'display_name', m.display_name, 'avatar_id', m.avatar_id, 'avatar_crop', m.avatar_crop) ELSE NULL END AS author
           FROM public.comments c
           LEFT JOIN public.members m ON m.id = c.user_id
           WHERE c.id = ANY($1::uuid[]);`,
          [parentCommentIds],
          platform?.env
        ).catch(() => ({ rows: [] }));
        for (const p of parentRes.rows) {
          parentCommentsMap.set(p.id, p);
        }
      }

      // Fetch suspended status for users involved in moderation
      const userIdsToCheck = rawModeration
        .map((r: any) => r.comment?.user_id || r.target_user?.id)
        .filter((id: string | null | undefined): id is string => Boolean(id));

      const suspendedMap = new Map<string, boolean>();
      if (userIdsToCheck.length > 0) {
        const roleRes = await executeYugabyteSql(
          `SELECT user_id, suspended FROM public.access_roles WHERE user_id = ANY($1::uuid[]);`,
          [userIdsToCheck],
          platform?.env
        ).catch(() => ({ rows: [] }));
        for (const role of roleRes.rows) {
          suspendedMap.set(role.user_id, Boolean(role.suspended));
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

        let visibilityStatus: 'VISIBLE' | 'HIDDEN' | 'DELETED';
        if (!comm || comm.deleted) {
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
      const pendingWorkRequestsCount = workRequestStatusCounts.PENDING;
      const totalTicketsCount = pendingReportsCount + (isAdmin ? (pendingScansCount + pendingModerationCount) : 0) + (isSiteManager ? pendingWorkRequestsCount : 0);

      return {
        isAdmin,
        isSiteManager,
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
        workRequests: rawWorkRequests,
        workRequestStatusCounts,
        ticketStats: {
          totalTicketsCount,
          pendingReportsCount,
          pendingScansCount,
          pendingModerationCount,
          pendingWorkRequestsCount
        }
      };
    }
  );
};

export const actions: Actions = {
  updateReportStatus: async ({ request, locals, platform }) => {
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

    const repRes = await executeYugabyteSql(
      `SELECT id, reporter_id, target_type, assigned_to FROM public.reports WHERE id = $1 LIMIT 1;`,
      [reportId],
      platform?.env
    ).catch(() => ({ rows: [] }));

    const rep = repRes.rows[0];
    if (!rep) {
      return fail(404, { error: 'Relatório não encontrado.' });
    }

    // MANDATORY WORKFLOW GUARD: Must assume ticket before issuing a verdict (resolving/rejecting)
    if (newStatus === 'RESOLVIDO' || newStatus === 'REJEITADO') {
      if (!rep.assigned_to) {
        return fail(400, { error: 'Você precisa assumir este ticket antes de emitir um veredito (Resolver ou Rejeitar).' });
      }
      if (rep.assigned_to !== locals.user.id && locals.role !== 'ADMIN') {
        return fail(403, { error: 'Apenas o operador responsável pode resolver ou rejeitar este ticket.' });
      }
    }

    let resolvedBy = null;
    let resolvedAt = null;
    if (newStatus === 'RESOLVIDO' || newStatus === 'REJEITADO') {
      resolvedBy = locals.user.id;
      resolvedAt = new Date().toISOString();
    }
    let assignedTo = rep.assigned_to;
    let assignedAt = null;
    if (newStatus === 'EM_ANALISE') {
      assignedTo = locals.user.id;
      assignedAt = new Date().toISOString();
    }

    await executeYugabyteSql(
      `UPDATE public.reports
       SET status = $1,
           resolution_notes = COALESCE($2, resolution_notes),
           resolved_by = COALESCE($3, resolved_by),
           resolved_at = COALESCE($4::timestamptz, resolved_at),
           assigned_to = COALESCE($5, assigned_to),
           assigned_at = COALESCE($6::timestamptz, assigned_at),
           updated_at = now()
       WHERE id = $7;`,
      [newStatus, notes || null, resolvedBy, resolvedAt, assignedTo, assignedAt, reportId],
      platform?.env
    );

    if (rep?.reporter_id) {
      try {
        const statusLabel = newStatus === 'RESOLVIDO' ? 'resolvido' : newStatus === 'EM_ANALISE' ? 'em análise' : newStatus === 'REJEITADO' ? 'encerrado' : 'atualizado';
        await executeYugabyteSql(
          `INSERT INTO public.notifications (user_id, kind, body, href, dedupe_key)
           VALUES ($1, 'report', $2, '/notificacoes', $3)
           ON CONFLICT DO NOTHING;`,
          [rep.reporter_id, `Seu relatório sobre o item foi marcado como ${statusLabel} pela equipe editorial.`, `report:${reportId}:${newStatus}`],
          platform?.env
        );
      } catch {}
    }

    invalidateAdminTicketsCache();
    return { success: true };
  },

  resolveBatchReports: async ({ request, locals, platform }) => {
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

    const repsRes = await executeYugabyteSql(
      `SELECT id, reporter_id, assigned_to FROM public.reports WHERE id = ANY($1::uuid[]);`,
      [reportIds],
      platform?.env
    ).catch(() => ({ rows: [] }));

    const reps = repsRes.rows;
    if (!reps || reps.length === 0) {
      return fail(404, { error: 'Relatórios não encontrados.' });
    }

    if (newStatus === 'RESOLVIDO' || newStatus === 'REJEITADO') {
      const unassigned = reps.find((r: any) => !r.assigned_to);
      if (unassigned) {
        return fail(400, { error: 'Todos os tickets do lote precisam ser assumidos antes de emitir um veredito.' });
      }
      const otherAssigned = reps.find((r: any) => r.assigned_to !== locals.user.id);
      if (otherAssigned && locals.role !== 'ADMIN') {
        return fail(403, { error: 'Você só pode resolver relatórios atribuídos a você.' });
      }
    }

    let resolvedBy = null;
    let resolvedAt = null;
    if (newStatus === 'RESOLVIDO' || newStatus === 'REJEITADO') {
      resolvedBy = locals.user.id;
      resolvedAt = new Date().toISOString();
    }
    let assignedTo = null;
    let assignedAt = null;
    if (newStatus === 'EM_ANALISE') {
      assignedTo = locals.user.id;
      assignedAt = new Date().toISOString();
    }

    await executeYugabyteSql(
      `UPDATE public.reports
       SET status = $1,
           resolution_notes = COALESCE($2, resolution_notes),
           resolved_by = COALESCE($3, resolved_by),
           resolved_at = COALESCE($4::timestamptz, resolved_at),
           assigned_to = COALESCE($5, assigned_to),
           assigned_at = COALESCE($6::timestamptz, assigned_at),
           updated_at = now()
       WHERE id = ANY($7::uuid[]);`,
      [newStatus, notes || null, resolvedBy, resolvedAt, assignedTo, assignedAt, reportIds],
      platform?.env
    );

    if (reps && reps.length > 0) {
      try {
        const statusLabel = newStatus === 'RESOLVIDO' ? 'resolvido' : newStatus === 'EM_ANALISE' ? 'em análise' : newStatus === 'REJEITADO' ? 'encerrado' : 'atualizado';
        for (const r of reps) {
          if (r.reporter_id) {
            await executeYugabyteSql(
              `INSERT INTO public.notifications (user_id, kind, body, href, dedupe_key)
               VALUES ($1, 'report', $2, '/notificacoes', $3)
               ON CONFLICT DO NOTHING;`,
              [r.reporter_id, `Seu relatório foi marcado como ${statusLabel} pela equipe editorial.`, `report:${r.id}:${newStatus}`],
              platform?.env
            );
          }
        }
      } catch {}
    }

    invalidateAdminTicketsCache();
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

    // 1. Fetch current request to know candidate details & meta
    const reqRes = await executeYugabyteSql(
      `SELECT * FROM public.scan_partner_requests WHERE id = $1 LIMIT 1;`,
      [requestId],
      platform?.env
    ).catch(() => ({ rows: [] }));

    const partnerReq = reqRes.rows[0];
    if (!partnerReq) {
      return fail(404, { message: 'Solicitação de parceria não encontrada.' });
    }

    // MANDATORY WORKFLOW GUARD: Must assume ticket before issuing a verdict (Approve/Reject)
    if (!partnerReq.assigned_to) {
      return fail(400, { message: 'Você precisa assumir esta candidatura antes de emitir um veredito (Aprovar ou Recusar).' });
    }
    if (partnerReq.assigned_to !== locals.user.id && locals.role !== 'ADMIN') {
      return fail(403, { message: 'Apenas o operador responsável pode avaliar esta candidatura.' });
    }

    const meta = parsePartnerRequestMeta(partnerReq.sample_links);
    let createdScanId: string | null = null;

    try {
      if (actionType === 'APPROVE') {
        const slug = partnerReq.scan_name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '') || `scan-${Date.now().toString(36)}`;

        const scanInsert = await executeYugabyteSql(
          `INSERT INTO public.scans (name, slug, description, website, discord, status, logo_id, banner_id)
           VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $7)
           ON CONFLICT (slug) DO UPDATE SET status = 'ACTIVE'
           RETURNING id;`,
          [
            partnerReq.scan_name,
            slug,
            partnerReq.description || '',
            partnerReq.website || null,
            partnerReq.discord || null,
            meta.logo_id || null,
            meta.banner_id || null
          ],
          platform?.env
        );

        createdScanId = scanInsert.rows[0]?.id;

        if (createdScanId && partnerReq.user_id) {
          await executeYugabyteSql(
            `INSERT INTO public.scan_members (scan_id, user_id, role)
             VALUES ($1, $2, 'OWNER')
             ON CONFLICT (scan_id, user_id) DO UPDATE SET role = 'OWNER';`,
            [createdScanId, partnerReq.user_id],
            platform?.env
          );
        }

        await executeYugabyteSql(
          `UPDATE public.scan_partner_requests
           SET status = 'APPROVED', reviewed_by = $2, reviewed_at = now()
           WHERE id = $1;`,
          [requestId, locals.user!.id],
          platform?.env
        );

        invalidateScansDirectoryCache();
        invalidateAdminScansCache();
        if (partnerReq.user_id) {
          invalidateUserSession(partnerReq.user_id);
        }

        try {
          await createNotification({
            recipientUserId: partnerReq.user_id,
            type: 'SYSTEM_ANNOUNCEMENT',
            title: 'Parceria de Scan Aprovada! 🎉',
            body: `Parabéns! Sua solicitação para a scan "${partnerReq.scan_name}" foi aprovada pela administração do Project Nox. Seu painel de gestão (/scan) já está liberado!`,
            deepLink: '/scan',
            scanId: createdScanId
          }, platform);
        } catch {}
      } else {
        await executeYugabyteSql(
          `UPDATE public.scan_partner_requests
           SET status = 'REJECTED', reviewed_by = $2, reviewed_at = now(), rejection_reason = $3
           WHERE id = $1;`,
          [requestId, locals.user!.id, reason],
          platform?.env
        );

        try {
          await createNotification({
            recipientUserId: partnerReq.user_id,
            type: 'SYSTEM_ANNOUNCEMENT',
            title: 'Solicitação de Parceria de Scan',
            body: `Sua solicitação para a scan "${partnerReq.scan_name}" foi recusada pela administração.${reason ? ` Motivo: ${reason}` : ''}`,
            deepLink: '/scans/cadastrar'
          }, platform);
        } catch {}
      }
    } catch (e: any) {
      return fail(500, { message: 'Erro ao avaliar parceria: ' + (e?.message || e) });
    }

    invalidateAdminTicketsCache();
    return { success: true, reviewedPartner: { scan_id: createdScanId } };
  },

  moderateComment: async ({ request, locals, platform }) => {
    // STRICT ACCESS: Only global ADMIN can execute moderation actions
    if (locals.role !== 'ADMIN') {
      return fail(403, { message: 'Acesso negado. Apenas Administradores Globais podem moderar a comunidade.' });
    }

    const formData = await request.formData();
    const reportId = formData.get('report_id') as string;
    const commentId = formData.get('comment_id') as string;
    const actionType = formData.get('action') as string;
    const notes = (formData.get('notes') as string || '').trim();

    // MANDATORY WORKFLOW GUARD: If operating on a report, must assume it before taking verdict actions
    if (reportId) {
      const repRes = await executeYugabyteSql(
        `SELECT id, assigned_to, status FROM public.reports WHERE id = $1 LIMIT 1;`,
        [reportId],
        platform?.env
      ).catch(() => ({ rows: [] }));
      const rep = repRes.rows[0];

      if (rep && !rep.assigned_to) {
        return fail(400, { message: 'Você precisa assumir esta denúncia antes de executar ações de moderação ou emitir um veredito.' });
      }
      if (rep && rep.assigned_to !== locals.user.id && locals.role !== 'ADMIN') {
        return fail(403, { message: 'Apenas o moderador responsável pode executar decisões nesta denúncia.' });
      }
    }

    if (actionType === 'hide') {
      if (!commentId) return fail(400, { message: 'Comentário inválido.' });
      await executeYugabyteSql(`UPDATE public.comments SET removed = true WHERE id = $1;`, [commentId], platform?.env);
      if (reportId) {
        await executeYugabyteSql(
          `UPDATE public.reports SET status = 'RESOLVIDO', resolution_notes = $1, assigned_to = $2, updated_at = now() WHERE id = $3;`,
          [notes || 'Comentário ocultado pela moderação.', locals.user!.id, reportId],
          platform?.env
        );
      }
      invalidateAdminTicketsCache();
      return { success: true, action: 'hide' };
    }

    if (actionType === 'unhide') {
      if (!commentId) return fail(400, { message: 'Comentário inválido.' });
      await executeYugabyteSql(
        `UPDATE public.comments SET removed = false, deleted = false, deleted_at = NULL WHERE id = $1;`,
        [commentId],
        platform?.env
      );
      invalidateAdminTicketsCache();
      return { success: true, action: 'unhide' };
    }

    if (actionType === 'delete') {
      if (!commentId) return fail(400, { message: 'Comentário inválido.' });

      await executeYugabyteSql(
        `UPDATE public.comments SET removed = true, deleted = true, deleted_at = now() WHERE id = $1;`,
        [commentId],
        platform?.env
      );

      const resolutionNotes = notes || 'Comentário excluído definitivamente pela moderação.';
      await executeYugabyteSql(
        `UPDATE public.reports SET status = 'RESOLVIDO', resolution_notes = $1, assigned_to = $2, updated_at = now() WHERE comment_id = $3 AND status IN ('NOVO', 'EM_ANALISE');`,
        [resolutionNotes, locals.user!.id, commentId],
        platform?.env
      );

      if (reportId) {
        await executeYugabyteSql(
          `UPDATE public.reports SET status = 'RESOLVIDO', resolution_notes = $1, assigned_to = $2, updated_at = now() WHERE id = $3;`,
          [resolutionNotes, locals.user!.id, reportId],
          platform?.env
        );
      }

      invalidateAdminTicketsCache();
      return { success: true, action: 'delete' };
    }

    if (actionType === 'suspend_user') {
      const targetUserId = formData.get('target_user_id') as string;
      if (!targetUserId) return fail(400, { message: 'Usuário alvo inválido.' });
      await executeYugabyteSql(`UPDATE public.access_roles SET suspended = true WHERE user_id = $1;`, [targetUserId], platform?.env);
      invalidateUserSession(targetUserId);
      if (reportId) {
        await executeYugabyteSql(
          `UPDATE public.reports SET status = 'RESOLVIDO', resolution_notes = $1, assigned_to = $2, updated_at = now() WHERE id = $3;`,
          [notes || 'Usuário suspenso pela moderação.', locals.user!.id, reportId],
          platform?.env
        );
      }
      invalidateAdminTicketsCache();
      return { success: true, action: 'suspend_user' };
    }

    if (actionType === 'dismiss_report') {
      if (!reportId) return fail(400, { message: 'Denúncia inválida.' });
      await executeYugabyteSql(
        `UPDATE public.reports SET status = 'REJEITADO', resolution_notes = $1, assigned_to = $2, updated_at = now() WHERE id = $3;`,
        [notes || 'Denúncia dispensada pela moderação.', locals.user!.id, reportId],
        platform?.env
      );
      invalidateAdminTicketsCache();
      return { success: true, action: 'dismiss_report' };
    }

    if (actionType === 'resolve_report') {
      if (!reportId) return fail(400, { message: 'Denúncia inválida.' });
      await executeYugabyteSql(
        `UPDATE public.reports SET status = 'RESOLVIDO', resolution_notes = $1, assigned_to = $2, updated_at = now() WHERE id = $3;`,
        [notes || 'Ocorrência resolvida pela moderação.', locals.user!.id, reportId],
        platform?.env
      );
      invalidateAdminTicketsCache();
      return { success: true, action: 'resolve_report' };
    }

    return fail(400, { message: 'Ação de moderação desconhecida.' });
  },

  claimTicket: async ({ request, locals, platform }) => {
    if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
      return fail(403, { message: 'Não autorizado.' });
    }

    const formData = await request.formData();
    const ticketId = formData.get('ticket_id') as string;
    const ticketType = formData.get('ticket_type') as string;

    if (!ticketId || !ticketType) {
      return fail(400, { message: 'Dados incompletos para assumir ticket.' });
    }

    const isAdmin = locals.role === 'ADMIN';

    if ((ticketType === 'scan' || ticketType === 'moderation') && !isAdmin) {
      return fail(403, { message: 'Apenas Administradores Globais podem assumir este tipo de ticket.' });
    }

    if (ticketType === 'scan') {
      const scanRes = await executeYugabyteSql(
        `SELECT id, assigned_to FROM public.scan_partner_requests WHERE id = $1 LIMIT 1;`,
        [ticketId],
        platform?.env
      ).catch(() => ({ rows: [] }));
      const current = scanRes.rows[0];

      if (!current) return fail(404, { message: 'Solicitação de scan não encontrada.' });
      if (current.assigned_to && current.assigned_to !== locals.user.id && !isAdmin) {
        return fail(409, { message: 'Este ticket já está sendo atendido por outro operador.' });
      }

      await executeYugabyteSql(
        `UPDATE public.scan_partner_requests SET assigned_to = $1, assigned_at = now() WHERE id = $2;`,
        [locals.user.id, ticketId],
        platform?.env
      );

      try {
        await executeYugabyteSql(
          `INSERT INTO public.audit_log (actor_id, action, target_id, metadata) VALUES ($1, 'ticket_claim', $2, $3::jsonb);`,
          [locals.user.id, ticketId, JSON.stringify({ ticket_type: 'scan' })],
          platform?.env
        );
      } catch {}

      invalidateAdminTicketsCache();
      return { success: true, action: 'claim', ticketId };
    } else {
      const ids = ticketId.split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length === 0) return fail(400, { message: 'Nenhum ID de relatório fornecido.' });

      const repsRes = await executeYugabyteSql(
        `SELECT id, assigned_to, status FROM public.reports WHERE id = ANY($1::uuid[]);`,
        [ids],
        platform?.env
      ).catch(() => ({ rows: [] }));
      const currents = repsRes.rows;

      if (!currents || currents.length === 0) return fail(404, { message: 'Relatório não encontrado.' });
      
      const alreadyAssignedOther = currents.find((c: any) => c.assigned_to && c.assigned_to !== locals.user.id);
      if (alreadyAssignedOther && !isAdmin) {
        return fail(409, { message: 'Este ticket já está sendo atendido por outro operador.' });
      }

      await executeYugabyteSql(
        `UPDATE public.reports
         SET assigned_to = $1,
             assigned_at = now(),
             updated_at = now(),
             status = CASE WHEN status = 'NOVO' THEN 'EM_ANALISE' ELSE status END
         WHERE id = ANY($2::uuid[]);`,
        [locals.user.id, ids],
        platform?.env
      );

      try {
        await executeYugabyteSql(
          `INSERT INTO public.audit_log (actor_id, action, target_id, metadata) VALUES ($1, 'ticket_claim', $2, $3::jsonb);`,
          [locals.user.id, ids[0], JSON.stringify({ ticket_type: ticketType, count: ids.length, ids })],
          platform?.env
        );
      } catch {}

      invalidateAdminTicketsCache();
      return { success: true, action: 'claim', ticketId };
    }
  },

  releaseTicket: async ({ request, locals, platform }) => {
    if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
      return fail(403, { message: 'Não autorizado.' });
    }

    const formData = await request.formData();
    const ticketId = formData.get('ticket_id') as string;
    const ticketType = formData.get('ticket_type') as string;

    if (!ticketId || !ticketType) {
      return fail(400, { message: 'Dados incompletos para liberar ticket.' });
    }

    const isAdmin = locals.role === 'ADMIN';

    if (ticketType === 'scan') {
      const scanRes = await executeYugabyteSql(
        `SELECT id, assigned_to FROM public.scan_partner_requests WHERE id = $1 LIMIT 1;`,
        [ticketId],
        platform?.env
      ).catch(() => ({ rows: [] }));
      const current = scanRes.rows[0];

      if (!current) return fail(404, { message: 'Solicitação não encontrada.' });
      if (current.assigned_to !== locals.user.id && !isAdmin) {
        return fail(403, { message: 'Você não tem permissão para liberar o ticket de outro operador.' });
      }

      await executeYugabyteSql(
        `UPDATE public.scan_partner_requests SET assigned_to = NULL, assigned_at = NULL WHERE id = $1;`,
        [ticketId],
        platform?.env
      );

      try {
        await executeYugabyteSql(
          `INSERT INTO public.audit_log (actor_id, action, target_id, metadata) VALUES ($1, 'ticket_release', $2, $3::jsonb);`,
          [locals.user.id, ticketId, JSON.stringify({ ticket_type: 'scan' })],
          platform?.env
        );
      } catch {}

      invalidateAdminTicketsCache();
      return { success: true, action: 'release', ticketId };
    } else {
      const ids = ticketId.split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length === 0) return fail(400, { message: 'Nenhum ID de relatório fornecido.' });

      const repsRes = await executeYugabyteSql(
        `SELECT id, assigned_to, status FROM public.reports WHERE id = ANY($1::uuid[]);`,
        [ids],
        platform?.env
      ).catch(() => ({ rows: [] }));
      const currents = repsRes.rows;

      if (!currents || currents.length === 0) return fail(404, { message: 'Relatório não encontrado.' });
      
      const assignedToOther = currents.find((c: any) => c.assigned_to && c.assigned_to !== locals.user.id);
      if (assignedToOther && !isAdmin) {
        return fail(403, { message: 'Você não tem permissão para liberar o ticket de outro operador.' });
      }

      await executeYugabyteSql(
        `UPDATE public.reports
         SET assigned_to = NULL,
             assigned_at = NULL,
             status = CASE WHEN status = 'EM_ANALISE' THEN 'NOVO' ELSE status END,
             updated_at = now()
         WHERE id = ANY($1::uuid[]);`,
        [ids],
        platform?.env
      );

      try {
        await executeYugabyteSql(
          `INSERT INTO public.audit_log (actor_id, action, target_id, metadata) VALUES ($1, 'ticket_release', $2, $3::jsonb);`,
          [locals.user.id, ids[0], JSON.stringify({ ticket_type: ticketType, count: ids.length, ids })],
          platform?.env
        );
      } catch {}

      invalidateAdminTicketsCache();
      return { success: true, action: 'release', ticketId };
    }
  },

  deleteTicket: async ({ request, locals, platform }) => {
    // STRICT ACCESS: Only Global ADMIN can delete tickets
    if (locals.role !== 'ADMIN') {
      return fail(403, { message: 'Apenas Administradores Globais podem excluir tickets.' });
    }

    const formData = await request.formData();
    const ticketId = formData.get('ticket_id') as string;
    const ticketType = formData.get('ticket_type') as string;
    const confirmation = (formData.get('confirmation') as string || '').trim().toUpperCase();
    const reason = (formData.get('reason') as string || '').trim();

    if (!ticketId || !ticketType) {
      return fail(400, { message: 'Identificador do ticket não informado.' });
    }

    if (confirmation !== 'EXCLUIR') {
      return fail(400, { message: 'Confirmação incorreta. Digite EXCLUIR para confirmar a exclusão do ticket.' });
    }

    if (ticketType === 'scan') {
      await executeYugabyteSql(
        `UPDATE public.scan_partner_requests
         SET deleted_at = now(), deleted_by = $1, deletion_reason = $2
         WHERE id = $3;`,
        [locals.user.id, reason || 'Exclusão administrativa de ticket', ticketId],
        platform?.env
      );

      try {
        await executeYugabyteSql(
          `INSERT INTO public.audit_log (actor_id, action, target_id, metadata) VALUES ($1, 'ticket_delete', $2, $3::jsonb);`,
          [locals.user.id, ticketId, JSON.stringify({ ticket_type: 'scan', reason })],
          platform?.env
        );
      } catch {}

      invalidateAdminTicketsCache();
      return { success: true, action: 'delete', ticketId };
    } else {
      const ids = ticketId.split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length === 0) return fail(400, { message: 'Nenhum ID informado para exclusão.' });

      await executeYugabyteSql(
        `UPDATE public.reports
         SET deleted_at = now(), deleted_by = $1, deletion_reason = $2
         WHERE id = ANY($3::uuid[]);`,
        [locals.user.id, reason || 'Exclusão administrativa de ticket', ids],
        platform?.env
      );

      try {
        await executeYugabyteSql(
          `INSERT INTO public.audit_log (actor_id, action, target_id, metadata) VALUES ($1, 'ticket_delete', $2, $3::jsonb);`,
          [locals.user.id, ids[0], JSON.stringify({ ticket_type: ticketType, count: ids.length, ids, reason })],
          platform?.env
        );
      } catch {}

      invalidateAdminTicketsCache();
      return { success: true, action: 'delete', ticketId };
    }
  },

  reviewWorkRequest: async ({ request, locals, platform }) => {
    if (!locals.user || !['ADMIN', 'GERENTE'].includes(locals.role || '')) {
      return fail(403, { message: 'Acesso negado. Apenas administradores e gerentes do site possuem autorização para avaliar adesão de obras.' });
    }

    const formData = await request.formData();
    const requestId = (formData.get('request_id') as string)?.trim();
    const actionType = (formData.get('action') as string)?.trim();
    const reason = (formData.get('reason') as string)?.trim() || null;
    const isPrimary = formData.get('is_primary') === 'true';

    if (!requestId || !['APPROVE', 'REJECT'].includes(actionType)) {
      return fail(400, { message: 'Dados de avaliação da solicitação inválidos.' });
    }

    if (actionType === 'REJECT' && !reason) {
      return fail(400, { message: 'A justificativa administrativa é obrigatória para rejeitar a solicitação.' });
    }

    // 1. Fetch current request state
    const reqRes = await executeYugabyteSql<any>(
      `SELECT r.*, w.title as work_title, s.name as scan_name
       FROM public.scan_project_requests r
       JOIN public.works w ON w.id = r.work_id
       JOIN public.scans s ON s.id = r.scan_id
       WHERE r.id = $1`,
      [requestId],
      platform?.env
    ).catch(() => ({ rows: [] }));

    const targetReq = reqRes.rows[0];
    if (!targetReq) {
      return fail(404, { message: 'Solicitação de obra não encontrada.' });
    }

    if (targetReq.status !== 'PENDING') {
      return fail(400, {
        message: `Esta solicitação já foi finalizada anteriormente (Status atual: ${targetReq.status}).`
      });
    }

    try {
      if (actionType === 'APPROVE') {
        // Atomic approval: update request status checking status = 'PENDING'
        const updateRes = await executeYugabyteSql(
          `UPDATE public.scan_project_requests
           SET status = 'APPROVED', reviewed_by = $2, reviewed_at = now()
           WHERE id = $1 AND status = 'PENDING'
           RETURNING id;`,
          [requestId, locals.user.id],
          platform?.env
        );

        if (!updateRes.rows || updateRes.rows.length === 0) {
          return fail(409, { message: 'Esta solicitação já foi respondida ou alterada por outro administrador.' });
        }

        // If marked as primary, ensure other scans for this work are not primary
        if (isPrimary) {
          await executeYugabyteSql(
            `UPDATE public.work_scans SET is_primary = false WHERE work_id = $1;`,
            [targetReq.work_id],
            platform?.env
          ).catch(() => {});
        }

        // Insert or update link in work_scans
        await executeYugabyteSql(
          `INSERT INTO public.work_scans (work_id, scan_id, is_primary, status)
           VALUES ($1, $2, $3, 'ACTIVE')
           ON CONFLICT (work_id, scan_id) DO UPDATE
           SET status = 'ACTIVE', is_primary = EXCLUDED.is_primary;`,
          [targetReq.work_id, targetReq.scan_id, isPrimary],
          platform?.env
        );

        // Audit log
        try {
          await executeYugabyteSql(
            `INSERT INTO public.audit_log (actor_id, action, target_id, metadata)
             VALUES ($1, 'scan_project_request_approve', $2, $3::jsonb);`,
            [
              locals.user.id,
              requestId,
              JSON.stringify({
                work_id: targetReq.work_id,
                scan_id: targetReq.scan_id,
                is_primary: isPrimary
              })
            ],
            platform?.env
          );
        } catch {}

        // Send approval notification
        try {
          await createNotification({
            recipientUserId: targetReq.user_id,
            type: 'SYSTEM',
            title: 'Obra vinculada com sucesso!',
            body: `Sua solicitação para vincular a obra "${targetReq.work_title}" à scan "${targetReq.scan_name}" foi aprovada pela administração.`,
            deepLink: '/scan?tab=obras'
          }, platform);
        } catch (e: any) {
          console.warn('Failed to send work approval notification:', e?.message);
        }

        invalidateAdminTicketsCache();
        invalidateAdminScansCache();
        invalidateScansDirectoryCache();

        return {
          success: true,
          action: 'APPROVE',
          requestId,
          workTitle: targetReq.work_title,
          scanName: targetReq.scan_name
        };
      } else {
        // Atomic rejection: update request status with reason checking status = 'PENDING'
        const updateRes = await executeYugabyteSql(
          `UPDATE public.scan_project_requests
           SET status = 'REJECTED', reviewed_by = $2, reviewed_at = now(), rejection_reason = $3
           WHERE id = $1 AND status = 'PENDING'
           RETURNING id;`,
          [requestId, locals.user.id, reason],
          platform?.env
        );

        if (!updateRes.rows || updateRes.rows.length === 0) {
          return fail(409, { message: 'Esta solicitação já foi respondida ou alterada por outro administrador.' });
        }

        // Audit log
        try {
          await executeYugabyteSql(
            `INSERT INTO public.audit_log (actor_id, action, target_id, metadata)
             VALUES ($1, 'scan_project_request_reject', $2, $3::jsonb);`,
            [
              locals.user.id,
              requestId,
              JSON.stringify({
                work_id: targetReq.work_id,
                scan_id: targetReq.scan_id,
                reason
              })
            ],
            platform?.env
          );
        } catch {}

        // Send rejection notification with reason
        try {
          await createNotification({
            recipientUserId: targetReq.user_id,
            type: 'SYSTEM',
            title: 'Solicitação de obra recusada',
            body: `Sua solicitação para vincular a obra "${targetReq.work_title}" à scan "${targetReq.scan_name}" foi recusada pela administração. Motivo: ${reason}`,
            deepLink: '/scan?tab=obras'
          }, platform);
        } catch (e: any) {
          console.warn('Failed to send work rejection notification:', e?.message);
        }

        invalidateAdminTicketsCache();
        invalidateAdminScansCache();

        return {
          success: true,
          action: 'REJECT',
          requestId,
          workTitle: targetReq.work_title,
          scanName: targetReq.scan_name
        };
      }
    } catch (err: any) {
      console.error('Error reviewing work request:', err);
      return fail(500, { message: err?.message || 'Falha ao processar avaliação do pedido de obra.' });
    }
  }
};
