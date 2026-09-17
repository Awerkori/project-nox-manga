import { error, fail, redirect } from "@sveltejs/kit";
import { WORK_FIELDS, db, schema, safeQuery, safeQuerySingle } from "$lib/server/db";
import { eq, inArray, desc, asc, isNotNull, sql, and } from "drizzle-orm";
import { createNotification } from "$lib/server/notifications";
import type { PageServerLoad, Actions } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const { data: scan } = await safeQuerySingle(
    db.select().from(schema.scans).where(eq(schema.scans.slug, params.slug))
  );

  if (!scan) {
    // Check slug history for 301 redirection
    const { data: hist } = await safeQuerySingle(
      db.select({
        scanId: schema.scanSlugHistory.scanId,
        slug: schema.scans.slug
      })
      .from(schema.scanSlugHistory)
      .leftJoin(schema.scans, eq(schema.scans.id, schema.scanSlugHistory.scanId))
      .where(eq(schema.scanSlugHistory.oldSlug, params.slug))
    );

    if (hist?.slug) {
      throw redirect(301, `/scans/${hist.slug}`);
    }

    error(404, "Scan no encontrada");
  }

  const [
    worksRes,
    chaptersRes,
    membersRes,
    positionsRes,
    openingsRes,
    activitiesRes,
    userAppsRes,
    commentsRes,
    questionsRes
  ] = await Promise.all([
    safeQuery(
      db.select({
        isPrimary: schema.workScans.isPrimary,
        status: schema.workScans.status,
        works: schema.works
      })
      .from(schema.workScans)
      .innerJoin(schema.works, eq(schema.works.id, schema.workScans.workId))
      .where(and(eq(schema.workScans.scanId, scan.id), eq(schema.works.published, true)))
    ),
    safeQuery(
      db.select({
        chapters: schema.chapters,
        works: {
          id: schema.works.id,
          slug: schema.works.slug,
          title: schema.works.title,
          coverId: schema.works.coverId,
          contentRating: schema.works.contentRating
        }
      })
      .from(schema.chapterScans)
      .innerJoin(schema.chapters, eq(schema.chapters.id, schema.chapterScans.chapterId))
      .innerJoin(schema.works, eq(schema.works.id, schema.chapters.workId))
      .where(
        and(
          eq(schema.chapterScans.scanId, scan.id),
          isNotNull(schema.chapters.publishedAt)
        )
      )
      .orderBy(desc(schema.chapters.publishedAt))
      .limit(30)
    ),
    safeQuery(
      db.select({
        role: schema.scanMembers.role,
        createdAt: schema.scanMembers.createdAt,
        members: {
          id: schema.members.id,
          username: schema.members.username,
          displayName: schema.members.displayName,
          avatarId: schema.members.avatarId,
          xp: schema.members.xp,
          avatarFrameId: schema.members.avatarFrameId,
          nameColor: schema.members.nameColor
        }
      })
      .from(schema.scanMembers)
      .innerJoin(schema.members, eq(schema.members.id, schema.scanMembers.userId))
      .where(eq(schema.scanMembers.scanId, scan.id))
      .orderBy(asc(schema.scanMembers.role))
    ),
    safeQuery(
      db.select({
        scanId: schema.scanMemberPositions.scanId,
        userId: schema.scanMemberPositions.userId,
        isPrimary: schema.scanMemberPositions.isPrimary,
        position: schema.scanPositions
      })
      .from(schema.scanMemberPositions)
      .leftJoin(schema.scanPositions, eq(schema.scanPositions.id, schema.scanMemberPositions.positionId))
      .where(eq(schema.scanMemberPositions.scanId, scan.id))
    ),
    safeQuery(
      db.select({
        opening: schema.scanRecruitmentOpenings,
        position: schema.scanPositions
      })
      .from(schema.scanRecruitmentOpenings)
      .leftJoin(schema.scanPositions, eq(schema.scanPositions.id, schema.scanRecruitmentOpenings.positionId))
      .where(
        and(
          eq(schema.scanRecruitmentOpenings.scanId, scan.id),
          eq(schema.scanRecruitmentOpenings.status, "OPEN")
        )
      )
      .orderBy(desc(schema.scanRecruitmentOpenings.createdAt))
    ),
    safeQuery(
      db.select({
        activity: schema.scanActivity,
        user: {
          id: schema.members.id,
          username: schema.members.username,
          displayName: schema.members.displayName,
          avatarId: schema.members.avatarId
        }
      })
      .from(schema.scanActivity)
      .leftJoin(schema.members, eq(schema.members.id, schema.scanActivity.userId))
      .where(eq(schema.scanActivity.scanId, scan.id))
      .orderBy(desc(schema.scanActivity.createdAt))
      .limit(20)
    ),
    locals.user
      ? safeQuery(
          db.select({
            id: schema.scanApplications.id,
            openingId: schema.scanApplications.openingId,
            status: schema.scanApplications.status,
            createdAt: schema.scanApplications.createdAt
          })
          .from(schema.scanApplications)
          .where(
            and(
              eq(schema.scanApplications.scanId, scan.id),
              eq(schema.scanApplications.userId, locals.user.id)
            )
          )
        )
      : Promise.resolve({ data: [], error: null }),
    safeQuery(
      db.select({
        comment: schema.scanComments,
        members: {
          id: schema.members.id,
          username: schema.members.username,
          displayName: schema.members.displayName,
          avatarId: schema.members.avatarId,
          avatarFrameId: schema.members.avatarFrameId,
          nameColor: schema.members.nameColor
        },
        likeUserId: schema.scanCommentLikes.userId
      })
      .from(schema.scanComments)
      .leftJoin(schema.members, eq(schema.members.id, schema.scanComments.userId))
      .leftJoin(schema.scanCommentLikes, eq(schema.scanCommentLikes.commentId, schema.scanComments.id))
      .where(
        and(
          eq(schema.scanComments.scanId, scan.id),
          eq(schema.scanComments.removed, false)
        )
      )
      .orderBy(desc(schema.scanComments.pinned), desc(schema.scanComments.createdAt))
    ),
    safeQuery(
      db.select()
        .from(schema.scanRecruitmentQuestions)
        .where(eq(schema.scanRecruitmentQuestions.scanId, scan.id))
        .orderBy(asc(schema.scanRecruitmentQuestions.displayOrder))
    )
  ]);

  const works = (worksRes.data || []).map((row: any) => ({
    ...row.works,
    scan_status: row.status || "ACTIVE",
    isPrimary: row.isPrimary
  })).filter(Boolean);

  const chapters = (chaptersRes.data || []).map((row: any) => ({
    ...row.chapters,
    works: row.works
  })).filter(Boolean);

  // Map member positions
  const positionsByUser = new Map<string, any[]>();
  for (const p of (positionsRes.data || []) as any[]) {
    if (!positionsByUser.has(p.userId)) positionsByUser.set(p.userId, []);
    if (p.position) {
      positionsByUser.get(p.userId)!.push({
        id: p.position.id,
        name: p.position.name,
        displayOrder: p.position.displayOrder,
        isPrimary: p.isPrimary
      });
    }
  }

  const members = (membersRes.data || []).map((row: any) => {
    const userPositions = positionsByUser.get(row.members?.id) || [];
    const primary = userPositions.find((p: any) => p.isPrimary) || userPositions[0] || null;
    return {
      role: row.role,
      joined_at: row.createdAt,
      ...row.members,
      frame_id: row.members?.avatarFrameId,
      positions: userPositions,
      primaryPosition: primary
    };
  });

  const openings = (openingsRes.data || []).map((row: any) => ({
    ...row.opening,
    positionName: row.position?.name || "Geral"
  }));

  const activities = (activitiesRes.data || []).map((row: any) => ({
    ...row.activity,
    userName: row.user?.displayName || row.user?.username || null
  }));

  const userApplications = userAppsRes.data || [];
  const userAppOpenings = new Set(userApplications.map((a: any) => a.openingId));

  // Calculate total views for this scan works
  const totalViews = works.reduce((sum: number, w: any) => sum + Number(w.viewsTotal || 0), 0);

  // Group comments by their likes because of left join
  const rawCommentsMap = new Map<string, any>();
  for (const row of (commentsRes.data || [])) {
    if (!rawCommentsMap.has(row.comment.id)) {
      rawCommentsMap.set(row.comment.id, {
        ...row.comment,
        members: row.members,
        likes: []
      });
    }
    if (row.likeUserId) {
      rawCommentsMap.get(row.comment.id).likes.push({ userId: row.likeUserId });
    }
  }
  const rawComments = Array.from(rawCommentsMap.values());

  const memberUserIds = new Set(members.map((m: any) => m.id));
  const viewerId = locals.user?.id;
  const isViewerScanAdmin = members.some((m: any) => m.id === viewerId && ['OWNER', 'ADMIN'].includes(m.role));
  const isViewerGlobalAdmin = ['ADMIN', 'EDITOR', 'STAFF_SITE'].includes(locals.role || '');
  const canModerateComments = isViewerScanAdmin || isViewerGlobalAdmin;

  const comments = rawComments.map((c: any) => {
    const likes = c.likes || [];
    return {
      id: c.id,
      scanId: c.scanId,
      userId: c.userId,
      parentId: c.parentId,
      body: c.body,
      pinned: !!c.pinned,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      author: c.members || { username: 'desconhecido', displayName: 'Usurio'},
      likesCount: likes.length,
      isLiked: viewerId ? likes.some((l: any) => l.userId === viewerId) : false,
      isStaff: memberUserIds.has(c.userId),
      canDelete: canModerateComments || c.userId === viewerId,
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
          id: locals.user!.id,
          username: (locals.user as any).username || "",
          displayName: (locals.user as any).displayName || "",
          avatarId: (locals.user as any).avatarId || null,
          role: locals.role || null
        }
      : null
  };
};

export const actions: Actions = {
  apply: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { message: "Voc precisa estar conectado para se candidatar." });
    }
    const formData = await request.formData();
    const openingId = formData.get("opening_id") as string;
    const experience = (formData.get("experience") as string)?.trim() || "";
    const availability = (formData.get("availability") as string)?.trim() || "";
    const presentation = (formData.get("presentation") as string)?.trim() || "";
    const portfolioUrl = (formData.get("portfolio_url") as string)?.trim() || null;
    const contactInfo = (formData.get("contact_info") as string)?.trim() || "";

    if (!openingId) {
      return fail(400, { message: "Vaga no especificada." });
    }

    let applicationId = null;
    try {
      const res = await (db as any).execute(sql`SELECT * FROM apply_for_scan_opening(
        ${openingId},
        ${experience},
        ${availability},
        ${presentation},
        ${portfolioUrl},
        ${contactInfo}
      )`);
      if (res && res.rows && res.rows[0]) {
        applicationId = (res.rows[0] as any).applicationId || (res.rows[0] as any).application_id;
      }
    } catch (e: any) {
      return fail(400, { message: (e as any).message || "Erro ao se candidatar." });
    }

    if (applicationId) {
      const answersToInsert: Array<{ applicationId: string; questionId: string; answer: string}> = [];
      for (const [key, value] of formData.entries()) {
        if (key.startsWith("question_") && typeof value === "string" && value.trim()) {
          const qId = key.replace("question_", "");
          answersToInsert.push({
            applicationId: applicationId,
            questionId: qId,
            answer: value.trim()
          });
        }
      }
      if (answersToInsert.length > 0) {
        await safeQuery(db.insert(schema.scanApplicationAnswers).values(answersToInsert));
      }
    }

    // Notify Scan Leaders
    try {
      const { data: opRes } = await safeQuery(
        db.select({
          title: schema.scanRecruitmentOpenings.title,
          scanId: schema.scanRecruitmentOpenings.scanId,
          scanName: schema.scans.name
        })
        .from(schema.scanRecruitmentOpenings)
        .leftJoin(schema.scans, eq(schema.scans.id, schema.scanRecruitmentOpenings.scanId))
        .where(eq(schema.scanRecruitmentOpenings.id, openingId))
      );
      
      const op = opRes?.[0];

      if (op) {
        const { data: leads } = await safeQuery(
          db.select({ userId: schema.scanMembers.userId })
          .from(schema.scanMembers)
          .where(
            and(
              eq(schema.scanMembers.scanId, op.scanId),
              inArray(schema.scanMembers.role, ['OWNER', 'ADMIN'])
            )
          )
        );

        for (const lead of (leads || [])) {
          if (lead.userId !== locals.user!.id) {
            await createNotification({
              recipientUserId: lead.userId,
              actorUserId: locals.user!.id,
              type: 'APPLICATION',
              title: `Nova candidatura: ${op.title}`,
              body: `Um membro enviou candidatura para a vaga de ${op.title} na Scan ${op.scanName || ''}.`,
              deepLink: `/scan?id=${op.scanId}&tab=inbox`,
              scanId: op.scanId,
              priority: 'NORMAL',
              dedupeKey: `app:${applicationId}:${lead.userId}`
            }).catch(e => console.error('Error notifying lead:', e));
          }
        }
      }
    } catch (e) {
      console.error('Error in apply notification:', e);
    }

    return { success: true, applicationSent: true, data: { applicationId } };
  },

  postComment: async ({ request, locals, params }) => {
    if (!locals.user) {
      return fail(401, { message: "Voc precisa estar conectado para comentar." });
    }
    const formData = await request.formData();
    const scanId = formData.get("scan_id") as string;
    const body = (formData.get("body") as string)?.trim() || "";
    const parentId = (formData.get("parent_id") as string) || null;

    if (!scanId || !body) {
      return fail(400, { message: "Comentrio no pode estar em branco." });
    }

    try {
      await (db as any).execute(sql`SELECT post_scan_comment(
        ${scanId},
        ${body},
        ${parentId}
      )`);
    } catch (e: any) {
      return fail(400, { message: (e as any).message || "Erro ao postar comentrio." });
    }

    // Notify parent comment author
    if (parentId) {
      try {
        const { data: parent } = await safeQuerySingle(
          db.select({
            userId: schema.scanComments.userId,
            body: schema.scanComments.body
          })
          .from(schema.scanComments)
          .where(eq(schema.scanComments.id, parentId))
        );

        if (parent && parent.userId && parent.userId !== locals.user!.id) {
          await createNotification({
            recipientUserId: parent.userId,
            actorUserId: locals.user!.id,
            type: "REPLY_COMMENT",
            title: "Responderam ao seu comentrio na pgina da Scan",
            body: body,
            deepLink: `/scans/${params.slug}#comment-${parentId}`,
            scanId,
            priority: "NORMAL",
            dedupeKey: `scan_comm_reply:${parentId}:${locals.user!.id}:${Date.now()}`
          }).catch(e => console.error("Error notifying comment reply:", e));
        }
      } catch (e) {
        console.error("Error in postComment notification:", e);
      }
    }

    return { success: true, commentPosted: true };
  },

  likeComment: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { message: "Voc precisa estar conectado para curtir." });
    }
    const formData = await request.formData();
    const commentId = formData.get("comment_id") as string;

    if (!commentId) {
      return fail(400, { message: "Comentrio no informado." });
    }

    try {
      await (db as any).execute(sql`SELECT like_scan_comment(${commentId})`);
    } catch (e: any) {
      return fail(400, { message: (e as any).message || "Erro ao curtir." });
    }

    return { success: true };
  },

  moderateComment: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { message: "Acesso negado." });
    }
    const formData = await request.formData();
    const commentId = formData.get("comment_id") as string;
    const actionType = formData.get("action_type") as string; // 'REMOVE' | 'RESTORE' | 'PIN' | 'UNPIN'

    if (!commentId || !actionType) {
      return fail(400, { message: "Dados insuficientes para moderao." });
    }

    try {
      await (db as any).execute(sql`SELECT moderate_scan_comment(${commentId}, ${actionType})`);
    } catch (e: any) {
      return fail(400, { message: (e as any).message || "Erro ao moderar." });
    }

    return { success: true };
  },

  reportComment: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { message: "Voc precisa estar conectado para denunciar." });
    }
    const formData = await request.formData();
    const commentId = formData.get("comment_id") as string;
    const reason = (formData.get("reason") as string)?.trim() || "";

    if (!commentId || !reason || reason.length < 2) {
      return fail(400, { message: "Informe um motivo de denncia vlido." });
    }

    try {
      await (db as any).execute(sql`SELECT report_scan_comment(${commentId}, ${reason})`);
    } catch (e: any) {
      return fail(400, { message: (e as any).message || "Erro ao denunciar." });
    }

    return { success: true, reportSent: true };
  }
};
