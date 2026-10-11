import { error, fail, redirect } from "@sveltejs/kit";
import { createScanNotification } from "$lib/server/scan-notifications";
import { executeYugabyteSql } from "$lib/server/yugabyte";
import type { PageServerLoad, Actions } from "./$types";

export const load: PageServerLoad = async ({ locals, params, platform }) => {
  const scanResult = await executeYugabyteSql<any>(
    `SELECT id, name, slug, description, display_preposition,
            logo_id, banner_id, website, discord, fluxer,
            is_official, status, created_at
     FROM public.scans
     WHERE slug = $1
     LIMIT 1`,
    [params.slug],
    platform?.env
  );
  const scan = scanResult.rows[0] || null;

  if (!scan) {
    // Check slug history for 301 redirection
    const historyResult = await executeYugabyteSql<{ slug: string }>(`
      SELECT current_scan.slug
      FROM public.scan_slug_history history
      JOIN public.scans current_scan ON current_scan.id = history.scan_id
      WHERE history.old_slug = $1
      LIMIT 1
    `, [params.slug], platform?.env);
    const redirectSlug = historyResult.rows[0]?.slug;

    if (redirectSlug) {
      throw redirect(301, `/scans/${redirectSlug}`);
    }

    error(404, "Scan não encontrada");
  }

  const [worksRes, chaptersRes, membersRes, positionsRes, openingsRes, activitiesRes, userAppsRes, commentsRes, questionsRes] = await Promise.all([
    executeYugabyteSql<any>(`
      SELECT work_scan.is_primary, work_scan.status,
             jsonb_build_object(
               'id', work.id, 'slug', work.slug, 'title', work.title, 'aliases', work.aliases,
               'synopsis', work.synopsis, 'description', work.description, 'author', work.author,
               'artist', work.artist, 'kind', work.kind, 'status', work.status, 'year', work.year,
               'age_rating', work.age_rating, 'published', work.published, 'featured', work.featured,
               'cover_id', work.cover_id, 'updated_at', work.updated_at, 'created_at', work.created_at,
               'content_rating', work.content_rating, 'views_total', work.views_total
             ) AS work
      FROM public.work_scans work_scan
      JOIN public.works work ON work.id = work_scan.work_id AND work.published = true
      WHERE work_scan.scan_id = $1
    `, [scan.id], platform?.env),
    executeYugabyteSql<any>(`
      SELECT jsonb_build_object(
        'id', chapter.id, 'number', chapter.number, 'title', chapter.title,
        'published_at', chapter.published_at, 'work_id', chapter.work_id, 'views_total', chapter.views_total,
        'works', jsonb_build_object('id', work.id, 'slug', work.slug, 'title', work.title,
          'cover_id', work.cover_id, 'content_rating', work.content_rating)
      ) AS chapter
      FROM public.chapter_scans chapter_scan
      JOIN public.chapters chapter ON chapter.id = chapter_scan.chapter_id AND chapter.published_at IS NOT NULL
      JOIN public.works work ON work.id = chapter.work_id
      WHERE chapter_scan.scan_id = $1
      ORDER BY chapter.published_at DESC
      LIMIT 30
    `, [scan.id], platform?.env),
    executeYugabyteSql<any>(`
      SELECT scan_member.role, scan_member.created_at,
             jsonb_build_object('id', member.id, 'username', member.username,
               'display_name', member.display_name, 'avatar_id', member.avatar_id, 'avatar_crop', member.avatar_crop, 'xp', member.xp,
               'avatar_frame_id', member.avatar_frame_id, 'name_color', member.name_color) AS member
      FROM public.scan_members scan_member
      JOIN public.members member ON member.id = scan_member.user_id
      WHERE scan_member.scan_id = $1
      ORDER BY scan_member.role ASC, scan_member.created_at ASC
    `, [scan.id], platform?.env),
    executeYugabyteSql<any>(`
      SELECT member_position.scan_id, member_position.user_id, member_position.is_primary,
             jsonb_build_object('id', position.id, 'name', position.name, 'display_order', position.display_order) AS position
      FROM public.scan_member_positions member_position
      JOIN public.scan_positions position ON position.id = member_position.position_id
      WHERE member_position.scan_id = $1
    `, [scan.id], platform?.env),
    executeYugabyteSql<any>(`
      SELECT opening.*, jsonb_build_object('id', position.id, 'name', position.name, 'display_order', position.display_order) AS position
      FROM public.scan_recruitment_openings opening
      JOIN public.scan_positions position ON position.id = opening.position_id
      WHERE opening.scan_id = $1 AND opening.status = 'OPEN'
      ORDER BY opening.created_at DESC
    `, [scan.id], platform?.env),
    executeYugabyteSql<any>(`
      SELECT activity.*, jsonb_build_object('id', member.id, 'username', member.username,
        'display_name', member.display_name, 'avatar_id', member.avatar_id, 'avatar_crop', member.avatar_crop) AS activity_user
      FROM public.scan_activity activity
      LEFT JOIN public.members member ON member.id = activity.user_id
      WHERE activity.scan_id = $1
      ORDER BY activity.created_at DESC
      LIMIT 20
    `, [scan.id], platform?.env),
    locals.user
      ? executeYugabyteSql<any>(`
          SELECT id, opening_id, status, created_at
          FROM public.scan_applications
          WHERE scan_id = $1 AND user_id = $2
        `, [scan.id, locals.user.id], platform?.env)
      : Promise.resolve({ rows: [] as any[] }),
    executeYugabyteSql<any>(`
      SELECT comment.id, comment.scan_id, comment.user_id, comment.parent_id, comment.body,
        comment.removed, comment.pinned, comment.created_at, comment.updated_at,
        jsonb_build_object('id', member.id, 'username', member.username, 'display_name', member.display_name,
          'avatar_id', member.avatar_id, 'avatar_crop', member.avatar_crop, 'avatar_frame_id', member.avatar_frame_id, 'name_color', member.name_color) AS members,
        COALESCE(jsonb_agg(jsonb_build_object('user_id', comment_like.user_id))
          FILTER (WHERE comment_like.user_id IS NOT NULL), '[]'::jsonb) AS scan_comment_likes
      FROM public.scan_comments comment
      LEFT JOIN public.members member ON member.id = comment.user_id
      LEFT JOIN public.scan_comment_likes comment_like ON comment_like.comment_id = comment.id
      WHERE comment.scan_id = $1 AND comment.removed = false
      GROUP BY comment.id, member.id
      ORDER BY comment.pinned DESC, comment.created_at DESC
    `, [scan.id], platform?.env),
    executeYugabyteSql<any>(`
      SELECT * FROM public.scan_recruitment_questions
      WHERE scan_id = $1
      ORDER BY display_order ASC
    `, [scan.id], platform?.env)
  ]);

  const works = (worksRes.rows || []).map((row: any) => ({
    ...row.work,
    scan_status: row.status || "ACTIVE",
    is_primary: row.is_primary
  })).filter(Boolean);

  const attributedChapters = (chaptersRes.rows || []).map((row: any) => row.chapter).filter(Boolean);

  // `chapter_scans` is optional attribution metadata. Public releases owned by
  // a scan's work must still appear when that compatibility table has not yet
  // received a row. Read the public catalog directly from Yugabyte and merge
  // it with attributed releases so old records remain visible too.
  let catalogChapters: any[] = [];
  try {
    const result = await executeYugabyteSql<{
      id: string;
      number: number | string;
      title: string | null;
      published_at: string;
      work_id: string;
      views_total: number | string | null;
      work_slug: string;
      work_title: string;
      work_cover_id: string | null;
      work_content_rating: string | null;
    }>(`
      SELECT chapter.id, chapter.number, chapter.title, chapter.published_at,
             chapter.work_id, chapter.views_total,
             work.slug AS work_slug, work.title AS work_title,
             work.cover_id AS work_cover_id, work.content_rating AS work_content_rating
      FROM public.work_scans work_scan
      JOIN public.works work
        ON work.id = work_scan.work_id AND work.published = true
      JOIN public.chapters chapter
        ON chapter.work_id = work_scan.work_id AND chapter.published_at IS NOT NULL
      WHERE work_scan.scan_id = $1
      ORDER BY chapter.published_at DESC
      LIMIT 30
    `, [scan.id], platform?.env);
    catalogChapters = result.rows.map((chapter) => ({
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      published_at: chapter.published_at,
      work_id: chapter.work_id,
      views_total: Number(chapter.views_total || 0),
      works: {
        id: chapter.work_id,
        slug: chapter.work_slug,
        title: chapter.work_title,
        cover_id: chapter.work_cover_id,
        content_rating: chapter.work_content_rating
      }
    }));
  } catch (error: any) {
    console.warn('public_scan_chapters_ysql_fallback', {
      scanId: scan.id,
      message: String(error?.message || 'unknown').slice(0, 240)
    });
  }

  const chaptersById = new Map<string, any>();
  for (const chapter of [...catalogChapters, ...attributedChapters]) {
    if (chapter?.id && !chaptersById.has(chapter.id)) chaptersById.set(chapter.id, chapter);
  }
  const chapters = Array.from(chaptersById.values())
    .sort((a: any, b: any) => Date.parse(b.published_at || '') - Date.parse(a.published_at || ''))
    .slice(0, 30);

  // Map member positions
  const positionsByUser = new Map<string, any[]>();
  for (const p of (positionsRes.rows || []) as any[]) {
    if (!positionsByUser.has(p.user_id)) positionsByUser.set(p.user_id, []);
    if (p.position) {
      positionsByUser.get(p.user_id)!.push({
        id: p.position.id,
        name: p.position.name,
        display_order: p.position.display_order,
        is_primary: p.is_primary
      });
    }
  }

  const members = (membersRes.rows || []).map((row: any) => {
    const userPositions = positionsByUser.get(row.member?.id) || [];
    const primary = userPositions.find((p: any) => p.is_primary) || userPositions[0] || null;
    return {
      role: row.role,
      joined_at: row.created_at,
      ...row.member,
      frame_id: row.member?.avatar_frame_id,
      positions: userPositions,
      primaryPosition: primary
    };
  });

  const openings = (openingsRes.rows || []).map((o: any) => ({
    ...o,
    positionName: o.position?.name || "Geral"
  }));

  const activities = (activitiesRes.rows || []).map((a: any) => ({
    ...a,
    userName: a.activity_user?.display_name || a.activity_user?.username || null
  }));

  const userApplications = userAppsRes.rows || [];
  const userAppOpenings = new Set(userApplications.map((a: any) => a.opening_id));

  // Calculate total views for this scan works
  const totalViews = works.reduce((sum: number, w: any) => sum + Number(w.views_total || 0), 0);

  const rawComments = (commentsRes.rows || []) as any[];
  const memberUserIds = new Set(members.map((m: any) => m.id));
  const viewerId = locals.user?.id;
  const isViewerScanAdmin = members.some((m: any) => m.id === viewerId && ['OWNER', 'ADMIN'].includes(m.role));
  const isViewerGlobalAdmin = ['ADMIN', 'EDITOR', 'STAFF_SITE'].includes(locals.role || '');
  const canModerateComments = isViewerScanAdmin || isViewerGlobalAdmin;

  const comments = rawComments.map((c: any) => {
    const likes = c.scan_comment_likes || [];
    return {
      id: c.id,
      scan_id: c.scan_id,
      user_id: c.user_id,
      parent_id: c.parent_id,
      body: c.body,
      pinned: !!c.pinned,
      created_at: c.created_at,
      updated_at: c.updated_at,
      author: c.members || { username: 'desconhecido', display_name: 'Usuário' },
      likesCount: likes.length,
      isLiked: viewerId ? likes.some((l: any) => l.user_id === viewerId) : false,
      isStaff: memberUserIds.has(c.user_id),
      canDelete: canModerateComments || c.user_id === viewerId,
      canModerate: canModerateComments
    };
  });

  return {
    scan,
    works,
    chapters,
    members,
    openings,
    activities,
    comments,
    canModerateComments,
    userApplications,
    userAppOpenings: Array.from(userAppOpenings),
    recruitmentQuestions: questionsRes.rows || [],
    totalViews,
    viewer: locals.user
      ? {
          id: locals.user.id,
          username: (locals.user as any).username || "",
          displayName: (locals.user as any).display_name || "",
          avatarId: (locals.user as any).avatar_id || null,
          role: locals.role || null
        }
      : null
  };
};

export const actions: Actions = {
  apply: async ({ request, locals, platform }) => {
    if (!locals.user) {
      return fail(401, { message: "Você precisa estar conectado para se candidatar." });
    }
    const formData = await request.formData();
    const openingId = formData.get("opening_id") as string;
    const experience = (formData.get("experience") as string)?.trim() || "";
    const availability = (formData.get("availability") as string)?.trim() || "";
    const presentation = (formData.get("presentation") as string)?.trim() || "";
    const portfolioUrl = (formData.get("portfolio_url") as string)?.trim() || null;
    const contactInfo = (formData.get("contact_info") as string)?.trim() || "";

    if (!openingId) {
      return fail(400, { message: "Vaga não especificada." });
    }

    const answers: Array<{ question_id: string; answer: string }> = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("question_") && typeof value === "string" && value.trim()) {
        answers.push({ question_id: key.replace("question_", ""), answer: value.trim() });
      }
    }

    let data: any;
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.apply_for_scan_opening_ysql($1, $2, $3, $4, $5, $6, $7, $8::jsonb) AS result`,
        [openingId, locals.user.id, experience, availability, presentation, portfolioUrl, contactInfo, JSON.stringify(answers)],
        platform?.env
      );
      data = result.rows[0]?.result;
      if (!data?.success) throw new Error('YSQL_APPLICATION_EMPTY_RESULT');
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_recruitment_apply_ysql_failed', {
        openingId,
        actorId: locals.user.id,
        code: typeof error?.code === 'string' ? error.code : null,
        message: detail.slice(0, 240)
      });
      const conflict = /OPENING_NOT_OPEN|APPLICATION_ALREADY_ACTIVE|APPLICATION_RATE_LIMITED/.test(detail);
      const validation = /OPENING_REQUIRED|OPENING_NOT_FOUND|PORTFOLIO_URL_INVALID|APPLICATION_(ANSWERS_INVALID|ANSWER_DUPLICATE|ANSWER_INVALID|REQUIRED_ANSWER_MISSING)/.test(detail);
      return fail(conflict ? 409 : validation ? 400 : 503, {
        message: detail.includes('APPLICATION_ALREADY_ACTIVE')
          ? 'Você já possui uma candidatura em análise para esta vaga.'
          : detail.includes('OPENING_NOT_OPEN')
            ? 'Esta vaga não está mais recebendo candidaturas.'
            : detail.includes('APPLICATION_RATE_LIMITED')
              ? 'Limite de candidaturas por hora atingido. Aguarde antes de tentar novamente.'
              : validation
                ? 'Revise os campos e as perguntas obrigatórias da candidatura.'
                : 'Não foi possível registrar sua candidatura com segurança agora. Nenhuma alteração foi aplicada.'
      });
    }

    const applicationId = data.application_id as string;

    // Notify Scan Leaders
    try {
      const leaders = Array.isArray(data.leader_ids) ? data.leader_ids : [];
      for (const leaderId of leaders) {
        if (typeof leaderId === 'string' && leaderId !== locals.user.id) {
            await createScanNotification({
              recipientUserId: leaderId,
              actorUserId: locals.user.id,
              type: 'APPLICATION',
              title: `Nova candidatura: ${data.opening_title || data.position_name || 'Vaga'}`,
              body: `Um membro enviou candidatura para a vaga de ${data.opening_title || data.position_name || 'vaga'} na Scan ${data.scan_name || ''}.`,
              deepLink: `/scan?id=${data.scan_id}&tab=inbox`,
              scanId: data.scan_id,
              priority: 'NORMAL',
              dedupeKey: `app:${applicationId}:${leaderId}`,
              platform
            }).catch(e => console.error('Error notifying lead:', e));
        }
      }
    } catch (e) {
      console.error('Error in apply notification:', e);
    }

    return { success: true, applicationSent: true, data };
  },

  postComment: async ({ request, locals, params, platform }) => {
    if (!locals.user) {
      return fail(401, { message: "Você precisa estar conectado para comentar." });
    }
    const formData = await request.formData();
    const scanId = formData.get("scan_id") as string;
    const body = (formData.get("body") as string)?.trim() || "";
    const parentId = (formData.get("parent_id") as string) || null;

    if (!scanId || !body) {
      return fail(400, { message: "Comentário não pode estar em branco." });
    }

    let data: any;
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.post_scan_comment_ysql($1, $2, $3, $4) AS result`,
        [scanId, locals.user.id, body, parentId],
        platform?.env
      );
      data = result.rows[0]?.result;
      if (!data?.success) throw new Error('YSQL_COMMENT_EMPTY_RESULT');
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_public_comment_ysql_failed', {
        scanId, actorId: locals.user.id,
        code: typeof error?.code === 'string' ? error.code : null,
        message: detail.slice(0, 240)
      });
      const invalid = /COMMENT_BODY_INVALID|COMMENT_PARENT_NOT_FOUND|SCAN_NOT_FOUND/.test(detail);
      return fail(invalid ? 400 : 503, {
        message: invalid
          ? 'O comentário é inválido ou a conversa foi alterada. Atualize a página.'
          : 'Não foi possível publicar o comentário com segurança agora. Nenhuma alteração foi aplicada.'
      });
    }

    // Notify parent comment author
    if (parentId) {
      try {
        if (data.parent_author_id && data.parent_author_id !== locals.user.id) {
          await createScanNotification({
            recipientUserId: data.parent_author_id,
            actorUserId: locals.user.id,
            type: "REPLY_COMMENT",
            title: "Responderam ao seu comentário na página da Scan",
            body: body,
            deepLink: `/scans/${params.slug}#comment-${parentId}`,
            scanId,
            priority: "NORMAL",
            dedupeKey: `scan_comm_reply:${parentId}:${locals.user.id}:${Date.now()}`,
            platform
          }).catch(e => console.error("Error notifying comment reply:", e));
        }
      } catch (e) {
        console.error("Error in postComment notification:", e);
      }
    }

    return { success: true, commentPosted: true, data };
  },

  likeComment: async ({ request, locals, platform }) => {
    if (!locals.user) {
      return fail(401, { message: "Você precisa estar conectado para curtir." });
    }
    const formData = await request.formData();
    const commentId = formData.get("comment_id") as string;

    if (!commentId) {
      return fail(400, { message: "Comentário não informado." });
    }

    let data: any;
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.toggle_scan_comment_like_ysql($1, $2) AS result`,
        [commentId, locals.user.id],
        platform?.env
      );
      data = result.rows[0]?.result;
      if (!data?.success) throw new Error('YSQL_COMMENT_LIKE_EMPTY_RESULT');
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_public_comment_like_ysql_failed', { commentId, actorId: locals.user.id, message: detail.slice(0, 240) });
      return fail(/COMMENT_NOT_FOUND/.test(detail) ? 404 : 503, {
        message: /COMMENT_NOT_FOUND/.test(detail)
          ? 'Este comentário não está mais disponível.'
          : 'Não foi possível atualizar a reação com segurança agora.'
      });
    }

    return { success: true, likeResult: data };
  },

  moderateComment: async ({ request, locals, platform }) => {
    if (!locals.user) {
      return fail(401, { message: "Acesso negado." });
    }
    const formData = await request.formData();
    const commentId = formData.get("comment_id") as string;
    const actionType = formData.get("action_type") as string; // 'REMOVE' | 'RESTORE' | 'PIN' | 'UNPIN'

    if (!commentId || !actionType) {
      return fail(400, { message: "Dados insuficientes para moderação." });
    }

    let data: any;
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.moderate_scan_comment_ysql($1, $2, $3, $4) AS result`,
        [commentId, locals.user.id, ['ADMIN', 'EDITOR', 'STAFF_SITE'].includes(locals.role || ''), actionType],
        platform?.env
      );
      data = result.rows[0]?.result;
      if (!data?.success) throw new Error('YSQL_COMMENT_MODERATION_EMPTY_RESULT');
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_public_comment_moderation_ysql_failed', { commentId, actorId: locals.user.id, message: detail.slice(0, 240) });
      const forbidden = /COMMENT_MODERATION_FORBIDDEN/.test(detail);
      return fail(forbidden ? 403 : /COMMENT_NOT_FOUND/.test(detail) ? 404 : 503, {
        message: forbidden
          ? 'Você não tem permissão para moderar comentários desta Scan.'
          : 'Não foi possível moderar o comentário com segurança agora.'
      });
    }

    return { success: true, moderateResult: data };
  },

  reportComment: async ({ request, locals, platform }) => {
    if (!locals.user) {
      return fail(401, { message: "Você precisa estar conectado para denunciar." });
    }
    const formData = await request.formData();
    const commentId = formData.get("comment_id") as string;
    const reason = (formData.get("reason") as string)?.trim() || "";

    if (!commentId || !reason || reason.length < 2) {
      return fail(400, { message: "Informe um motivo de denúncia válido." });
    }

    let data: any;
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.report_scan_comment_ysql($1, $2, $3) AS result`,
        [commentId, locals.user.id, reason],
        platform?.env
      );
      data = result.rows[0]?.result;
      if (!data?.success) throw new Error('YSQL_COMMENT_REPORT_EMPTY_RESULT');
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_public_comment_report_ysql_failed', { commentId, actorId: locals.user.id, message: detail.slice(0, 240) });
      const invalid = /COMMENT_REPORT_REASON_INVALID|COMMENT_NOT_FOUND/.test(detail);
      return fail(invalid ? 400 : 503, {
        message: invalid
          ? 'O comentário não está mais disponível ou o motivo informado é inválido.'
          : 'Não foi possível enviar a denúncia com segurança agora.'
      });
    }

    return { success: true, reportSent: true, data };
  }
};
