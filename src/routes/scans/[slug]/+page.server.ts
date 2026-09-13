import { error, fail, redirect } from "@sveltejs/kit";
import { WORK_FIELDS } from "$lib/server/db";
import { createNotification } from "$lib/server/notifications";
import type { PageServerLoad, Actions } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const { data: scan } = await locals.db
    .from("scans")
    .select("*")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!scan) {
    // Check slug history for 301 redirection
    const { data: hist } = await locals.db
      .from("scan_slug_history")
      .select("scan_id, scans(slug)")
      .eq("old_slug", params.slug)
      .maybeSingle();

    if (hist?.scans?.slug) {
      throw redirect(301, `/scans/${hist.scans.slug}`);
    }

    error(404, "Scan não encontrada");
  }

  const [worksRes, chaptersRes, membersRes, positionsRes, openingsRes, activitiesRes, userAppsRes, commentsRes, questionsRes] = await Promise.all([
    locals.db
      .from("work_scans")
      .select(`
        is_primary,
        status,
        works!inner(${WORK_FIELDS})
      `)
      .eq("scan_id", scan.id)
      .eq("works.published", true),
    locals.db
      .from("chapter_scans")
      .select(`
        chapters!inner(
          id,
          number,
          title,
          published_at,
          work_id,
          views_total,
          works!inner(id, slug, title, cover_id, content_rating)
        )
      `)
      .eq("scan_id", scan.id)
      .not("chapters.published_at", "is", null)
      .order("chapters(published_at)", { ascending: false })
      .limit(30),
    locals.db
      .from("scan_members")
      .select(`
        role,
        created_at,
        members!inner(
          id,
          username,
          display_name,
          avatar_id,
          xp,
          avatar_frame_id,
          name_color
        )
      `)
      .eq("scan_id", scan.id)
      .order("role", { ascending: true }),
    locals.db
      .from("scan_member_positions")
      .select("scan_id, user_id, is_primary, position:scan_positions(id, name, display_order)")
      .eq("scan_id", scan.id),
    locals.db
      .from("scan_recruitment_openings")
      .select("*, position:scan_positions(id, name, display_order)")
      .eq("scan_id", scan.id)
      .eq("status", "OPEN")
      .order("created_at", { ascending: false }),
    locals.db
      .from("scan_activity")
      .select("*, user:members(id, username, display_name, avatar_id)")
      .eq("scan_id", scan.id)
      .order("created_at", { ascending: false })
      .limit(20),
    locals.user
      ? locals.db
          .from("scan_applications")
          .select("id, opening_id, status, created_at")
          .eq("scan_id", scan.id)
          .eq("user_id", locals.user.id)
      : Promise.resolve({ data: [] }),
    locals.db
      .from("scan_comments")
      .select(`
        id,
        scan_id,
        user_id,
        parent_id,
        body,
        removed,
        pinned,
        created_at,
        updated_at,
        members:user_id(
          id,
          username,
          display_name,
          avatar_id,
          avatar_frame_id,
          name_color
        ),
        scan_comment_likes(user_id)
      `)
      .eq("scan_id", scan.id)
      .eq("removed", false)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    locals.db
      .from("scan_recruitment_questions")
      .select("*")
      .eq("scan_id", scan.id)
      .order("display_order", { ascending: true })
  ]);

  const works = (worksRes.data || []).map((row: any) => ({
    ...row.works,
    scan_status: row.status || "ACTIVE",
    is_primary: row.is_primary
  })).filter(Boolean);

  const chapters = (chaptersRes.data || []).map((row: any) => row.chapters).filter(Boolean);

  // Map member positions
  const positionsByUser = new Map<string, any[]>();
  for (const p of (positionsRes.data || []) as any[]) {
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

  const members = (membersRes.data || []).map((row: any) => {
    const userPositions = positionsByUser.get(row.members?.id) || [];
    const primary = userPositions.find((p: any) => p.is_primary) || userPositions[0] || null;
    return {
      role: row.role,
      joined_at: row.created_at,
      ...row.members,
      frame_id: row.members?.avatar_frame_id,
      positions: userPositions,
      primaryPosition: primary
    };
  });

  const openings = (openingsRes.data || []).map((o: any) => ({
    ...o,
    positionName: o.position?.name || "Geral"
  }));

  const activities = (activitiesRes.data || []).map((a: any) => ({
    ...a,
    userName: a.user?.display_name || a.user?.username || null
  }));

  const userApplications = userAppsRes.data || [];
  const userAppOpenings = new Set(userApplications.map((a: any) => a.opening_id));

  // Calculate total views for this scan works
  const totalViews = works.reduce((sum: number, w: any) => sum + Number(w.views_total || 0), 0);

  const rawComments = (commentsRes.data || []) as any[];
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
    recruitmentQuestions: questionsRes.data || [],
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
  apply: async ({ request, locals }) => {
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

    const { data, error: rpcErr } = await locals.db.rpc("apply_for_scan_opening", {
      p_opening_id: openingId,
      p_experience: experience,
      p_availability: availability,
      p_presentation: presentation,
      p_portfolio_url: portfolioUrl,
      p_contact_info: contactInfo
    });

    if (rpcErr) {
      return fail(400, { message: rpcErr.message });
    }

    const applicationId = (data as any)?.application_id;
    if (applicationId) {
      const answersToInsert: Array<{ application_id: string; question_id: string; answer: string }> = [];
      for (const [key, value] of formData.entries()) {
        if (key.startsWith("question_") && typeof value === "string" && value.trim()) {
          const qId = key.replace("question_", "");
          answersToInsert.push({
            application_id: applicationId,
            question_id: qId,
            answer: value.trim()
          });
        }
      }
      if (answersToInsert.length > 0) {
        await locals.db.from("scan_application_answers").insert(answersToInsert);
      }
    }

    // Notify Scan Leaders
    try {
      const { data: op } = await locals.db
        .from('scan_openings')
        .select('title, scan_id, scans(name)')
        .eq('id', openingId)
        .maybeSingle();

      if (op) {
        const { data: leads } = await locals.db
          .from('scan_members')
          .select('user_id')
          .eq('scan_id', op.scan_id)
          .in('role', ['OWNER', 'ADMIN']);

        for (const lead of (leads || [])) {
          if (lead.user_id !== locals.user.id) {
            await createNotification({
              recipientUserId: lead.user_id,
              actorUserId: locals.user.id,
              type: 'APPLICATION',
              title: `Nova candidatura: ${op.title}`,
              body: `Um membro enviou candidatura para a vaga de ${op.title} na Scan ${(op.scans as any)?.name || ''}.`,
              deepLink: `/scan?id=${op.scan_id}&tab=inbox`,
              scanId: op.scan_id,
              priority: 'NORMAL',
              dedupeKey: `app:${applicationId}:${lead.user_id}`
            }).catch(e => console.error('Error notifying lead:', e));
          }
        }
      }
    } catch (e) {
      console.error('Error in apply notification:', e);
    }

    return { success: true, applicationSent: true, data };
  },

  postComment: async ({ request, locals, params }) => {
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

    const { data, error: rpcErr } = await locals.db.rpc("post_scan_comment", {
      p_scan_id: scanId,
      p_body: body,
      p_parent_id: parentId
    });

    if (rpcErr) {
      return fail(400, { message: rpcErr.message });
    }

    // Notify parent comment author
    if (parentId) {
      try {
        const { data: parent } = await locals.db
          .from("scan_comments")
          .select("user_id, body")
          .eq("id", parentId)
          .maybeSingle();

        if (parent && parent.user_id && parent.user_id !== locals.user.id) {
          await createNotification({
            recipientUserId: parent.user_id,
            actorUserId: locals.user.id,
            type: "REPLY_COMMENT",
            title: "Responderam ao seu comentário na página da Scan",
            body: body,
            deepLink: `/scans/${params.slug}#comment-${parentId}`,
            scanId,
            priority: "NORMAL",
            dedupeKey: `scan_comm_reply:${parentId}:${locals.user.id}:${Date.now()}`
          }).catch(e => console.error("Error notifying comment reply:", e));
        }
      } catch (e) {
        console.error("Error in postComment notification:", e);
      }
    }

    return { success: true, commentPosted: true, data };
  },

  likeComment: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { message: "Você precisa estar conectado para curtir." });
    }
    const formData = await request.formData();
    const commentId = formData.get("comment_id") as string;

    if (!commentId) {
      return fail(400, { message: "Comentário não informado." });
    }

    const { data, error: rpcErr } = await locals.db.rpc("like_scan_comment", {
      p_comment_id: commentId
    });

    if (rpcErr) {
      return fail(400, { message: rpcErr.message });
    }

    return { success: true, likeResult: data };
  },

  moderateComment: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { message: "Acesso negado." });
    }
    const formData = await request.formData();
    const commentId = formData.get("comment_id") as string;
    const actionType = formData.get("action_type") as string; // 'REMOVE' | 'RESTORE' | 'PIN' | 'UNPIN'

    if (!commentId || !actionType) {
      return fail(400, { message: "Dados insuficientes para moderação." });
    }

    const { data, error: rpcErr } = await locals.db.rpc("moderate_scan_comment", {
      p_comment_id: commentId,
      p_action: actionType
    });

    if (rpcErr) {
      return fail(400, { message: rpcErr.message });
    }

    return { success: true, moderateResult: data };
  },

  reportComment: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { message: "Você precisa estar conectado para denunciar." });
    }
    const formData = await request.formData();
    const commentId = formData.get("comment_id") as string;
    const reason = (formData.get("reason") as string)?.trim() || "";

    if (!commentId || !reason || reason.length < 2) {
      return fail(400, { message: "Informe um motivo de denúncia válido." });
    }

    const { data, error: rpcErr } = await locals.db.rpc("report_scan_comment", {
      p_comment_id: commentId,
      p_reason: reason
    });

    if (rpcErr) {
      return fail(400, { message: rpcErr.message });
    }

    return { success: true, reportSent: true, data };
  }
};
