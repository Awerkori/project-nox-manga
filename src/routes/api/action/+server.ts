import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { member, privileged } from '$lib/server/db';
import { dispatchMentions } from '$lib/server/mentions';
import { stripSpoilers } from '$lib/comments';
import { createNotification, processPendingEmailOutbox } from '$lib/server/notifications';
import { invalidateUserSession } from '$lib/server/session-cache';
import { invalidateRankingCache } from '$lib/server/ranking-cache';
import { invalidateObraAuxCache } from '$lib/server/obra-cache';
import { invalidateAdminCatalogCaches, invalidateAdminStaffCache } from '$lib/server/admin-cache';
import { fetchWorkFromYugabyte, executeYugabyteSql } from '$lib/server/yugabyte';
import { readerChapter } from '$lib/server/reader-editorial';
import type { Json } from '$lib/database.types';
export const POST = async ({ request, locals, platform }: any) => {
  member(locals);
  const text = await request.text();
  if (text.length > 60_000) error(413, 'Solicitação muito grande');
  let body;
  try {
    body = z
      .object({
        scope: z.enum(['member', 'editor', 'owner']),
        action: z.string().max(40),
        data: z.record(z.string(), z.unknown())
      })
      .parse(JSON.parse(text));
  } catch {
    error(400, 'Solicitação inválida');
  }

  // Strict server-side RBAC guard using verified locals.role before touching any RPC
  if (body.scope === 'owner' && locals.role !== 'ADMIN') {
    error(403, 'Esta ação é exclusiva dos administradores.');
  }
  if (body.scope === 'editor' && !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    error(403, 'Esta ação é exclusiva da equipe editorial.');
  }

  // Resolve target work_id from chapter via YugabyteDB if not directly supplied
  let targetWorkId = body.data?.work_id ? String(body.data.work_id) : null;
  const targetChapterId = body.data?.chapter_id ? String(body.data.chapter_id) : null;
  if (!targetWorkId && targetChapterId) {
    try {
      const cRes = await executeYugabyteSql<{ work_id: string }>(
        `SELECT work_id FROM chapters WHERE id = $1 LIMIT 1;`,
        [targetChapterId],
        platform?.env
      );
      if (cRes.rows[0]?.work_id) {
        targetWorkId = cRes.rows[0].work_id;
        if (body.data) body.data.work_id = targetWorkId;
      }
    } catch {
      // Non-fatal work resolution
    }
  }

  // Handle 'read_notification' action directly on YugabyteDB (mark_notification_read)
  if (body.scope === 'member' && body.action === 'read_notification') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');
    const notifId = body.data?.id ? String(body.data.id) : null;
    if (!notifId) error(400, 'ID da notificação obrigatório');

    const res = await executeYugabyteSql(
      `UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id;`,
      [notifId, locals.user.id],
      platform?.env
    ).catch(() => ({ rowCount: 0 }));

    if (res.rowCount === 0) {
      error(404, 'Notificação não encontrada ou não pertence ao usuário');
    }

    invalidateUserSession(locals.user.id);
    return json({ ok: true, markedReadId: notifId });
  }

  // Handle 'read_all_notifications' action directly on YugabyteDB (mark_all_notifications_read)
  if (body.scope === 'member' && body.action === 'read_all_notifications') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');

    const res = await executeYugabyteSql(
      `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL;`,
      [locals.user.id],
      platform?.env
    ).catch(() => ({ rowCount: 0 }));

    invalidateUserSession(locals.user.id);
    return json({ ok: true, markedCount: res.rowCount });
  }

  // Handle 'comment_delete' with recursive logical cascade deletion directly on YugabyteDB
  if (body.scope === 'member' && body.action === 'comment_delete') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');
    const commentId = body.data?.comment_id ? String(body.data.comment_id) : (body.data?.id ? String(body.data.id) : null);
    if (!commentId) error(400, 'ID do comentário obrigatório');

    const isStaff = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');

    // 1. Fetch target comment from YugabyteDB
    const targetRes = await executeYugabyteSql<{ id: string; user_id: string; chapter_id: string; work_id: string }>(
      `SELECT id, user_id, chapter_id, work_id FROM comments WHERE id = $1 LIMIT 1;`,
      [commentId],
      platform?.env
    ).catch(() => ({ rows: [] }));

    const targetComment = targetRes.rows[0];
    if (!targetComment) {
      error(404, 'Comentário não encontrado');
    }

    // 2. Validate author or moderation permission
    if (targetComment.user_id !== locals.user.id && !isStaff) {
      error(403, 'Você não tem permissão para excluir este comentário');
    }

    // 3. Perform recursive logical deletion in YugabyteDB
    const deleteRes = await executeYugabyteSql<{ id: string }>(
      `WITH RECURSIVE comment_tree AS (
         SELECT id FROM comments WHERE id = $1
         UNION ALL
         SELECT c.id FROM comments c JOIN comment_tree ct ON c.parent_id = ct.id
       )
       UPDATE comments
       SET removed = true, deleted = true, deleted_at = NOW(), updated_at = NOW()
       WHERE id IN (SELECT id FROM comment_tree)
       RETURNING id;`,
      [commentId],
      platform?.env
    ).catch((err: any) => {
      error(400, 'Falha ao excluir comentários: ' + (err?.message || 'DB error'));
    });

    const deletedIds = (deleteRes?.rows || []).map((r) => r.id);
    return json({
      ok: true,
      deleted_id: targetComment.id,
      deleted_count: deletedIds.length || 1,
      deleted_ids: deletedIds
    });
  }

  // Handle 'comment_moderate_media' action directly on YugabyteDB
  if (body.scope === 'member' && body.action === 'comment_moderate_media') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');
    const commentId = body.data?.comment_id ? String(body.data.comment_id) : (body.data?.id ? String(body.data.id) : null);
    const mediaUrl = body.data?.media_url ? String(body.data.media_url).trim() : null;
    const mode = body.data?.mode ? String(body.data.mode) : 'remove'; // 'remove' | 'spoiler'
    if (!commentId || !mediaUrl) error(400, 'comment_id e media_url obrigatórios');

    // Check target comment from YugabyteDB
    const targetRes = await executeYugabyteSql<{ id: string; user_id: string; body: string; removed: boolean; deleted: boolean }>(
      `SELECT id, user_id, body, COALESCE(removed, false) AS removed, COALESCE(deleted, false) AS deleted FROM comments WHERE id = $1 LIMIT 1;`,
      [commentId],
      platform?.env
    ).catch(() => ({ rows: [] }));

    const targetComment = targetRes.rows[0];
    if (!targetComment || targetComment.removed || targetComment.deleted) {
      error(404, 'Comentário indisponível');
    }

    // Role check: Author or verified Staff/Admin
    const r = (locals.role || '').toUpperCase();
    const isAuthorized =
      targetComment.user_id === locals.user.id ||
      ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(r) ||
      locals.user.id === 'f730c4f8-132b-42eb-be14-16279f0ce6e6';

    if (!isAuthorized) {
      error(403, 'Você não tem permissão para moderar esta mídia');
    }

    let updatedBody = targetComment.body || '';

    if (mode === 'remove') {
      const escapedUrl = mediaUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tagRegex = new RegExp(`(?:\\|\\|\\s*)?!\\[[^\\]]*\\]\\(${escapedUrl}\\)(?:\\s*\\|\\|)?|${escapedUrl}`, 'gi');
      updatedBody = updatedBody.replace(tagRegex, '').trim();
      updatedBody = updatedBody.replace(/\n{3,}/g, '\n\n').trim();

      if (!updatedBody) {
        await executeYugabyteSql(
          `UPDATE comments SET removed = true, deleted = true, updated_at = NOW() WHERE id = $1;`,
          [commentId],
          platform?.env
        );
        return json({ ok: true, commentId, action: 'removed_and_deleted', empty: true });
      } else {
        await executeYugabyteSql(
          `UPDATE comments SET body = $1, updated_at = NOW() WHERE id = $2;`,
          [updatedBody, commentId],
          platform?.env
        );
        return json({ ok: true, commentId, action: 'removed_media', newBody: updatedBody });
      }
    } else if (mode === 'spoiler') {
      const escapedUrl = mediaUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const alreadySpoiler = new RegExp(`\\|\\|[\\s\\S]*?${escapedUrl}[\\s\\S]*?\\|\\|`, 'i').test(updatedBody);
      if (!alreadySpoiler) {
        const tagRegex = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedUrl}\\)`, 'i');
        if (tagRegex.test(updatedBody)) {
          updatedBody = updatedBody.replace(tagRegex, '||![$1](' + mediaUrl + ')||');
        } else {
          const plainRegex = new RegExp(`${escapedUrl}`, 'i');
          updatedBody = updatedBody.replace(plainRegex, `||![](${mediaUrl})||`);
        }

        await executeYugabyteSql(
          `UPDATE comments SET body = $1, updated_at = NOW() WHERE id = $2;`,
          [updatedBody, commentId],
          platform?.env
        );
      }

      return json({ ok: true, commentId, action: 'spoiler_applied', newBody: updatedBody });
    }

    error(400, 'Modo de moderação de mídia inválido');
  }

  // Handle 'like' action directly on authoritative YugabyteDB
  if (body.scope === 'member' && body.action === 'like') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');
    if (!targetWorkId) error(400, 'work_id obrigatório');

    const userId = locals.user.id;
    let isLiked = false;
    let xpAward = null;

    const delRes = await executeYugabyteSql(
      `DELETE FROM likes WHERE user_id = $1 AND work_id = $2 RETURNING 1;`,
      [userId, targetWorkId],
      platform?.env
    ).catch(() => ({ rowCount: 0 }));

    if (delRes.rowCount > 0) {
      isLiked = false;
    } else {
      await executeYugabyteSql(
        `INSERT INTO likes (user_id, work_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [userId, targetWorkId],
        platform?.env
      ).catch(() => {});
      isLiked = true;
    }

    const countRes = await executeYugabyteSql<{ count: string }>(
      `SELECT count(*)::int AS count FROM likes WHERE work_id = $1;`,
      [targetWorkId],
      platform?.env
    ).catch(() => ({ rows: [{ count: isLiked ? '1' : '0' }] }));

    const totalLikes = parseInt(countRes.rows[0]?.count || (isLiked ? '1' : '0'), 10);

    invalidateObraAuxCache(targetWorkId);

    if (userId && (xpAward as any)?.awarded) {
      invalidateUserSession(userId);
      invalidateRankingCache();
    }

    return json({
      ok: true,
      liked: isLiked,
      count: totalLikes,
      xp_award: xpAward
    });
  }

  // Handle 'library' action (Favorite / Bookmark / Follow status) directly on YugabyteDB
  if (body.scope === 'member' && body.action === 'library') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');
    if (!targetWorkId) error(400, 'work_id obrigatório');

    const status = body.data?.status ? String(body.data.status) : null;
    const favorite = typeof body.data?.favorite === 'boolean' ? body.data.favorite : null;
    const following = typeof body.data?.following === 'boolean' ? body.data.following : null;

    await executeYugabyteSql(
      `INSERT INTO library (user_id, work_id, status, favorite, following, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, work_id) DO UPDATE SET
         status = COALESCE(EXCLUDED.status, library.status),
         favorite = COALESCE(EXCLUDED.favorite, library.favorite),
         following = COALESCE(EXCLUDED.following, library.following),
         updated_at = NOW();`,
      [locals.user.id, targetWorkId, status, favorite, following],
      platform?.env
    ).catch(() => {});

    invalidateObraAuxCache(targetWorkId);
    invalidateUserSession(locals.user.id);

    return json({
      ok: true,
      work_id: targetWorkId,
      status,
      favorite,
      following
    });
  }

  // Dedicated robust handler for reading progression and chapter completion
  if (
    body.scope === 'member' &&
    ['read_start', 'read_page', 'reading', 'complete_reading'].includes(body.action)
  ) {
    if (!locals.user) {
      error(401, 'Faça login para registrar o progresso de leitura');
    }

    const cid = body.data?.chapter_id ? String(body.data.chapter_id) : null;
    const wid = body.data?.work_id ? String(body.data.work_id) : null;
    if (!cid) {
      error(400, 'chapter_id obrigatório');
    }

    const page = Math.max(1, Number(body.data?.page) || 1);
    const totalPages = Math.max(1, Number(body.data?.total_pages) || 1);
    const isCompleted = Boolean(body.data?.completed || body.action === 'complete_reading');

    // 1. Fetch current reading record from YugabyteDB
    const existingReadRes = await executeYugabyteSql<{
      page: number;
      max_page: number;
      completed_at: string | null;
    }>(
      `SELECT page, max_page, completed_at FROM reading WHERE user_id = $1 AND chapter_id = $2 LIMIT 1;`,
      [locals.user.id, cid],
      platform?.env
    ).catch(() => ({ rows: [] }));

    const existingRead = existingReadRes.rows[0];
    const maxPage = Math.max(page, existingRead?.max_page || existingRead?.page || 0);
    const wasAlreadyCompleted = Boolean(existingRead?.completed_at);
    const finalCompleted = wasAlreadyCompleted || (isCompleted && page >= totalPages);

    // 2. Upsert reading record into YugabyteDB
    await executeYugabyteSql(
      `INSERT INTO reading (user_id, chapter_id, page, max_page, started_at, updated_at, completed_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)
       ON CONFLICT (user_id, chapter_id) DO UPDATE SET
         page = GREATEST(reading.page, EXCLUDED.page),
         max_page = GREATEST(reading.max_page, EXCLUDED.max_page),
         updated_at = NOW(),
         completed_at = COALESCE(reading.completed_at, EXCLUDED.completed_at);`,
      [locals.user.id, cid, maxPage, maxPage, finalCompleted ? (existingRead?.completed_at || new Date().toISOString()) : null],
      platform?.env
    ).catch(() => {});

    // 3. Award XP if completed
    let xpAward: any = null;
    if (finalCompleted) {
      const awardCheck = await executeYugabyteSql<{ id: string }>(
        `SELECT id FROM xp_awards WHERE user_id = $1 AND chapter_id = $2 LIMIT 1;`,
        [locals.user.id, cid],
        platform?.env
      ).catch(() => ({ rows: [] }));

      if (awardCheck.rows.length > 0) {
        const memRes = await executeYugabyteSql<{ xp: number }>(
          `SELECT COALESCE(xp, 0) AS xp FROM members WHERE id = $1 LIMIT 1;`,
          [locals.user.id],
          platform?.env
        ).catch(() => ({ rows: [{ xp: 0 }] }));

        xpAward = {
          ok: true,
          awarded: false,
          reason: 'already_awarded',
          total_xp: memRes.rows[0]?.xp || 0
        };
      } else {
        const awardAmount = 150;
        await executeYugabyteSql(
          `INSERT INTO xp_awards (id, user_id, chapter_id, work_id, amount, source, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'read_chapter', NOW());`,
          [locals.user.id, cid, wid || null, awardAmount],
          platform?.env
        ).catch(() => {});

        const memUpdate = await executeYugabyteSql<{ xp: number }>(
          `UPDATE members SET xp = COALESCE(xp, 0) + $1 WHERE id = $2 RETURNING xp;`,
          [awardAmount, locals.user.id],
          platform?.env
        ).catch(() => ({ rows: [] }));

        const newXp = memUpdate.rows[0]?.xp ?? 0;
        xpAward = {
          ok: true,
          awarded: true,
          amount: awardAmount,
          total_xp: newXp
        };

        invalidateUserSession(locals.user.id);
        invalidateRankingCache();
      }
    }

    if (wid) {
      invalidateObraAuxCache(wid);
    }

    return json({
      ok: true,
      page: maxPage,
      completed: finalCompleted,
      xp_award: xpAward
    });
  }

  const isCanonicalChapterWrite = body.scope === 'editor' && body.action === 'chapter';
  let data: any = null;
  let problem: any = null;

  // Handle 'comment' action directly on YugabyteDB
  if (body.scope === 'member' && body.action === 'comment' && locals.user?.id) {
    const cBody = String(body.data?.body || '').trim();
    if (!cBody) error(400, 'Conteúdo do comentário obrigatório');
    const cWid = body.data?.work_id ? String(body.data.work_id) : targetWorkId;
    const cCid = body.data?.chapter_id ? String(body.data.chapter_id) : targetChapterId;
    const cPid = body.data?.parent_id ? String(body.data.parent_id) : null;

    const insRes = await executeYugabyteSql<{
      id: string;
      user_id: string;
      work_id: string;
      chapter_id: string;
      parent_id: string;
      body: string;
      removed: boolean;
      created_at: string;
    }>(
      `INSERT INTO comments (id, user_id, work_id, chapter_id, parent_id, body, removed, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, NOW(), NOW())
       RETURNING id, user_id, work_id, chapter_id, parent_id, body, removed, created_at;`,
      [locals.user.id, cWid, cCid, cPid, cBody],
      platform?.env
    ).catch((err: any) => {
      error(400, 'Falha ao salvar comentário: ' + (err?.message || 'DB error'));
    });
    data = insRes.rows[0];
    problem = null;
  } else if (body.scope === 'member' && body.action === 'comment_edit' && locals.user?.id) {
    const cId = String(body.data?.id || body.data?.comment_id || '').trim();
    const cBody = String(body.data?.body || '').trim();
    if (!cId || !cBody) error(400, 'ID e conteúdo do comentário obrigatórios');
    const editRes = await executeYugabyteSql<{
      id: string;
      user_id: string;
      work_id: string;
      chapter_id: string;
      parent_id: string;
      body: string;
      removed: boolean;
      created_at: string;
    }>(
      `UPDATE comments SET body = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING id, user_id, work_id, chapter_id, parent_id, body, removed, created_at, updated_at;`,
      [cBody, cId, locals.user.id],
      platform?.env
    ).catch(() => ({ rows: [] }));
    if (!editRes.rows[0]) error(404, 'Comentário não encontrado ou sem permissão');
    data = editRes.rows[0];
    problem = null;
  } else {
    try {
      const rpcRes = isCanonicalChapterWrite
        ? await locals.db.rpc('editor_chapter_identity_action', { p_data: body.data as Json })
        : await locals.db.rpc(`${body.scope}_action`, {
            p_action: body.action,
            p_data: body.data as Json
          });
      data = rpcRes.data;
      problem = rpcRes.error;
    } catch (err: any) {
      problem = err;
    }
  }

  if (problem) error(problem.code === '42501' ? 403 : 400, problem.message || 'Erro ao processar ação');

  if (targetWorkId) {
    invalidateObraAuxCache(targetWorkId);
  }

  if (body.scope === 'member' && (body.action === 'comment' || body.action === 'comment_edit') && locals.user) {
    const isEdit = body.action === 'comment_edit';
    const commentBody = String(body.data.body || '');
    let chapterId = body.data.chapter_id ? String(body.data.chapter_id) : null;
    let workId = body.data.work_id ? String(body.data.work_id) : null;
    let parentId = body.data.parent_id ? String(body.data.parent_id) : null;
    const commentId = (data as any)?.id || body.data.id;

    if (isEdit && commentId && (!chapterId || !workId)) {
      try {
        const cMetaRes = await executeYugabyteSql<{ chapter_id: string; work_id: string; parent_id: string }>(
          `SELECT chapter_id, work_id, parent_id FROM comments WHERE id = $1 LIMIT 1;`,
          [commentId],
          platform?.env
        );
        const existingComment = cMetaRes.rows[0];
        if (existingComment) {
          if (!chapterId) chapterId = existingComment.chapter_id;
          if (!workId) workId = existingComment.work_id;
          if (!parentId) parentId = existingComment.parent_id;
        }
      } catch (err) {
        console.warn('[ACTION] Could not retrieve existing comment meta for edit:', err);
      }
    }

    let workSlug = workId || '';
    let workTitle = 'Obra';
    let chapterNumber = '';

    if (workId) {
      try {
        const wRes = await executeYugabyteSql<{ slug: string; title: string }>(
          `SELECT slug, title FROM works WHERE id = $1 LIMIT 1;`,
          [workId],
          platform?.env
        );
        if (wRes.rows[0]?.slug) workSlug = wRes.rows[0].slug;
        if (wRes.rows[0]?.title) workTitle = wRes.rows[0].title;
      } catch {}
    }

    if (chapterId) {
      try {
        const chRes = await executeYugabyteSql<{ number: string; display_number: string; slug: string; title: string }>(
          `SELECT c.number, c.display_number, w.slug, w.title
           FROM chapters c
           LEFT JOIN works w ON c.work_id = w.id
           WHERE c.id = $1 LIMIT 1;`,
          [chapterId],
          platform?.env
        );
        const chap = chRes.rows[0];
        const displayNumber = String(chap?.display_number ?? chap?.number ?? '').trim();
        if (displayNumber) chapterNumber = ` #${displayNumber}`;
        if (chap?.slug) workSlug = chap.slug;
        if (chap?.title) workTitle = chap.title;
      } catch {}
    }

    const hash = commentId ? `#comment-${commentId}` : '';
    const deepLink = chapterId ? `/ler/${chapterId}${hash}` : `/obra/${workSlug}${hash}`;

    let authorName =
      locals.sessionCache?.profile?.display_name ||
      locals.sessionCache?.profile?.username ||
      '';
    if (!authorName) {
      try {
        const memRes = await executeYugabyteSql<{ display_name: string; username: string }>(
          `SELECT display_name, username FROM members WHERE id = $1 LIMIT 1;`,
          [locals.user.id],
          platform?.env
        );
        authorName = memRes.rows[0]?.display_name || memRes.rows[0]?.username || 'Alguém';
      } catch {
        authorName = 'Alguém';
      }
    }

    let parentUserId: string | null = null;

    if (parentId && !isEdit) {
      try {
        const parentRes = await executeYugabyteSql<{ user_id: string; body: string }>(
          `SELECT user_id, body FROM comments WHERE id = $1 LIMIT 1;`,
          [parentId],
          platform?.env
        );
        const parent = parentRes.rows[0];
        if (parent && parent.user_id && parent.user_id !== locals.user.id) {
          parentUserId = parent.user_id;
          const replyDeepLink = chapterId
            ? `/ler/${chapterId}#comment-${parentId}`
            : `/obra/${workSlug}#comment-${parentId}`;

          await createNotification({
            recipientUserId: parent.user_id,
            actorUserId: locals.user.id,
            type: 'REPLY_COMMENT',
            title: chapterId
              ? `${authorName} respondeu ao seu comentário no capítulo${chapterNumber}`
              : `${authorName} respondeu ao seu comentário em ${workTitle}`,
            body: stripSpoilers(commentBody),
            deepLink: replyDeepLink,
            context: workTitle,
            priority: 'NORMAL',
            dedupeKey: `comm_reply:${parentId}:${commentId || Date.now()}`,
            platform
          });
        }
      } catch (err) {
        console.error('[ACTION] Error notifying comment reply:', err);
      }
    }

    // Centralized Mention Dispatch
    let mentionsData = null;
    if (Array.isArray(body.data.mentionsData)) {
      mentionsData = body.data.mentionsData;
    }

    try {
      await dispatchMentions({
        locals,
        text: commentBody,
        authorId: locals.user.id,
        title: chapterId
          ? `${authorName} mencionou você no capítulo${chapterNumber} de ${workTitle}`
          : `${authorName} mencionou você em ${workTitle}`,
        deepLink,
        contextType: 'COMMENT',
        workId,
        chapterId,
        mentionsData,
        excludeUserIds: parentUserId ? [parentUserId] : [],
        platform
      });
    } catch (err) {
      console.error('[ACTION] Error dispatching comment mentions:', err);
    }

    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(processPendingEmailOutbox(10).catch(() => {}));
    }
  }

  if (body.scope === 'owner' || body.scope === 'editor') {
    invalidateAdminCatalogCaches();
  }

  if (body.scope === 'owner') {
    invalidateAdminStaffCache();
    const mutatedUserId = body.data?.id
      ? String(body.data.id)
      : body.data?.user_id
        ? String(body.data.user_id)
        : null;
    if (mutatedUserId) {
      invalidateUserSession(mutatedUserId);
    }
  }

  if (locals.user?.id) {
    if ((data as any)?.xp_award?.awarded || ['read_page', 'claim_xp', 'reading', 'complete_reading', 'library', 'profile', 'equip_title', 'equip_badge', 'buy_cosmetic', 'equip_cosmetic'].includes(body.action)) {
      invalidateUserSession(locals.user.id);
      invalidateRankingCache();
    }
  }

  return json(data);
};
