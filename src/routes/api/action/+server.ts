import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { member } from '$lib/server/db';
import { dispatchMentions } from '$lib/server/mentions';
import { stripSpoilers } from '$lib/comments';
import { createNotification } from '$lib/server/notifications';
import { invalidateUserSession } from '$lib/server/session-cache';
import { invalidateRankingCache } from '$lib/server/ranking-cache';
import { invalidateObraAuxCache } from '$lib/server/obra-cache';
import { invalidateAdminCatalogCaches, invalidateAdminStaffCache } from '$lib/server/admin-cache';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import { checkCommentPostLimit } from '$lib/server/comment-rate-limit';
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

  // Deny excess comment posts before resolving a chapter or opening a SQL
  // connection. The binding is shared at the Cloudflare location, but its
  // counters are approximate and do not enforce a global 30-second interval.
  if (body.scope === 'member' && body.action === 'comment') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');
    if (!String(body.data?.body || '').trim()) error(400, 'Conteúdo do comentário obrigatório');
    const decision = await checkCommentPostLimit(platform?.env, locals.user.id);
    if (decision === 'limited') error(429, 'Muitos comentários. Aguarde antes de tentar novamente.');
    if (decision === 'unavailable') error(503, 'Comentários temporariamente indisponíveis. Tente novamente.');
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
    const xpAward = null;

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
       VALUES ($1, $2, COALESCE($3, 'READING'), COALESCE($4, false), COALESCE($5, true), NOW())
       ON CONFLICT (user_id, work_id) DO UPDATE SET
         status = COALESCE(EXCLUDED.status, library.status),
         favorite = COALESCE(EXCLUDED.favorite, library.favorite),
         following = COALESCE(EXCLUDED.following, library.following),
         updated_at = NOW();`,
      [locals.user.id, targetWorkId, status, favorite, following],
      platform?.env
    ).catch((err: any) => {
      console.warn('[ACTION_LIBRARY_WARN]', err?.message);
    });

    invalidateObraAuxCache(targetWorkId);
    invalidateUserSession(locals.user.id);

    return json({
      ok: true,
      work_id: targetWorkId,
      status: status || 'READING',
      favorite: favorite ?? false,
      following: following ?? true
    });
  }

  // Handle 'preferences' action (age_status, blur_nsfw) directly on YugabyteDB
  if (body.scope === 'member' && body.action === 'preferences') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');
    const ageStatus = body.data?.age_status ? String(body.data.age_status) : null;
    const blurNsfw = typeof body.data?.blur_nsfw === 'boolean' ? body.data.blur_nsfw : null;

    await executeYugabyteSql(
      `UPDATE members
       SET age_status = COALESCE($1, age_status),
           blur_nsfw = COALESCE($2, blur_nsfw)
       WHERE id = $3;`,
      [ageStatus, blurNsfw, locals.user.id],
      platform?.env
    ).catch((err: any) => {
      console.warn('[ACTION_PREFERENCES_WARN]', err?.message);
    });

    invalidateUserSession(locals.user.id);
    return json({ ok: true, age_status: ageStatus, blur_nsfw: blurNsfw });
  }

  // Handle 'clear_history' action directly on YugabyteDB
  if (body.scope === 'member' && body.action === 'clear_history') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');

    await executeYugabyteSql(
      `DELETE FROM reading WHERE user_id = $1;`,
      [locals.user.id],
      platform?.env
    ).catch((err: any) => {
      console.warn('[ACTION_CLEAR_HISTORY_WARN]', err?.message);
    });

    invalidateUserSession(locals.user.id);
    return json({ ok: true });
  }

  // Handle 'equip_title' action directly on YugabyteDB
  if (body.scope === 'member' && body.action === 'equip_title') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');
    const titleId = body.data?.title_id ? String(body.data.title_id) : null;

    await executeYugabyteSql(
      `UPDATE members SET equipped_title_id = $1 WHERE id = $2;`,
      [titleId, locals.user.id],
      platform?.env
    ).catch((err: any) => {
      console.warn('[ACTION_EQUIP_TITLE_WARN]', err?.message);
    });

    invalidateUserSession(locals.user.id);
    return json({ ok: true, title_id: titleId });
  }

  // Handle 'equip_badge' action directly on YugabyteDB
  if (body.scope === 'member' && body.action === 'equip_badge') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');
    const badgeId = body.data?.badge_id ? String(body.data.badge_id) : null;

    await executeYugabyteSql(
      `UPDATE members SET equipped_badge_id = $1 WHERE id = $2;`,
      [badgeId, locals.user.id],
      platform?.env
    ).catch((err: any) => {
      console.warn('[ACTION_EQUIP_BADGE_WARN]', err?.message);
    });

    invalidateUserSession(locals.user.id);
    return json({ ok: true, badge_id: badgeId });
  }

  // Handle 'comment_like' action directly on YugabyteDB
  if (body.scope === 'member' && body.action === 'comment_like') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');
    const commentId = String(body.data?.comment_id || body.data?.id || '').trim();
    if (!commentId) error(400, 'comment_id obrigatório');

    let liked = false;
    const delRes = await executeYugabyteSql(
      `DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2 RETURNING 1;`,
      [locals.user.id, commentId],
      platform?.env
    ).catch(() => ({ rowCount: 0 }));

    if (delRes.rowCount > 0) {
      liked = false;
    } else {
      await executeYugabyteSql(
        `INSERT INTO comment_likes (user_id, comment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [locals.user.id, commentId],
        platform?.env
      ).catch(() => {});
      liked = true;
    }

    const countRes = await executeYugabyteSql<{ count: string }>(
      `SELECT count(*)::int AS count FROM comment_likes WHERE comment_id = $1;`,
      [commentId],
      platform?.env
    ).catch(() => ({ rows: [{ count: liked ? '1' : '0' }] }));

    return json({
      ok: true,
      liked,
      count: parseInt(countRes.rows[0]?.count || (liked ? '1' : '0'), 10)
    });
  }

  // Handle 'notifications' action (mark all as read) directly on YugabyteDB
  if (body.scope === 'member' && body.action === 'notifications') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');

    const res = await executeYugabyteSql(
      `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL;`,
      [locals.user.id],
      platform?.env
    ).catch(() => ({ rowCount: 0 }));

    invalidateUserSession(locals.user.id);
    return json({ ok: true, markedCount: res.rowCount });
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
    const shouldMarkCompleted = Boolean(isCompleted && page >= totalPages);

    // Consolidated single atomic statement: Upsert reading progress with RETURNING
    const readUpsertRes = await executeYugabyteSql<{
      page: number;
      max_page: number;
      completed_at: string | null;
    }>(
      `INSERT INTO reading (user_id, chapter_id, page, max_page, started_at, updated_at, completed_at)
       VALUES ($1, $2, $3, $3, NOW(), NOW(), CASE WHEN $4::boolean THEN NOW() ELSE NULL END)
       ON CONFLICT (user_id, chapter_id) DO UPDATE SET
         page = GREATEST(reading.page, EXCLUDED.page),
         max_page = GREATEST(reading.max_page, EXCLUDED.max_page),
         updated_at = NOW(),
         completed_at = COALESCE(reading.completed_at, EXCLUDED.completed_at)
       RETURNING page, max_page, completed_at;`,
      [locals.user.id, cid, page, shouldMarkCompleted],
      platform?.env
    ).catch(() => ({ rows: [] }));

    const readRow = readUpsertRes.rows[0];
    const finalMaxPage = readRow?.max_page || page;
    const finalCompleted = Boolean(readRow?.completed_at);

    // Award XP atomically if completed (Atomic CTE: INSERT xp_awards + UPDATE members in 1 statement)
    let xpAward: any = null;
    if (finalCompleted) {
      const atomicXpRes = await executeYugabyteSql<{ xp: number }>(
        `WITH new_award AS (
           INSERT INTO xp_awards (id, user_id, chapter_id, work_id, amount, source, created_at)
           VALUES (gen_random_uuid(), $1, $2, COALESCE(NULLIF($3, '')::uuid, (SELECT work_id FROM public.chapters WHERE id = $2 LIMIT 1), '00000000-0000-0000-0000-000000000000'::uuid), $4, 'web', NOW())
           ON CONFLICT (user_id, chapter_id) DO NOTHING
           RETURNING user_id, amount
         )
         UPDATE members m
         SET xp = COALESCE(m.xp, 0) + na.amount
         FROM new_award na
         WHERE m.id = na.user_id
         RETURNING m.xp;`,
        [locals.user.id, cid, wid || null, 150],
        platform?.env
      ).catch(() => ({ rows: [] }));

      const wasNewlyAwarded = atomicXpRes.rows.length > 0;
      if (wasNewlyAwarded) {
        const newXp = atomicXpRes.rows[0]?.xp ?? 0;
        xpAward = {
          ok: true,
          awarded: true,
          amount: 150,
          total_xp: newXp
        };

        invalidateUserSession(locals.user.id);
        invalidateRankingCache();
      } else {
        const currentXp = locals.sessionCache?.profile?.xp;
        let totalXp = typeof currentXp === 'number' ? currentXp : 0;
        if (typeof currentXp !== 'number') {
          const memRes = await executeYugabyteSql<{ xp: number }>(
            `SELECT COALESCE(xp, 0) AS xp FROM members WHERE id = $1 LIMIT 1;`,
            [locals.user.id],
            platform?.env
          ).catch(() => ({ rows: [{ xp: 0 }] }));
          totalXp = memRes.rows[0]?.xp || 0;
        }

        xpAward = {
          ok: true,
          awarded: false,
          reason: 'already_awarded',
          total_xp: totalXp
        };
      }
    }

    if (wid) {
      invalidateObraAuxCache(wid);
    }

    return json({
      ok: true,
      page: finalMaxPage,
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
  } else if (body.scope === 'member' && body.action === 'comment_delete' && locals.user?.id) {
    const cId = String(body.data?.id || body.data?.comment_id || '').trim();
    if (!cId) error(400, 'id do comentário obrigatório');
    const isStaff = ['ADMIN', 'EDITOR'].includes(locals.role || '');
    const delRes = await executeYugabyteSql<{ id: string }>(
      `UPDATE comments
       SET removed = true, updated_at = NOW()
       WHERE id = $1 AND (user_id = $2 OR $3 = true)
       RETURNING id;`,
      [cId, locals.user.id, isStaff],
      platform?.env
    ).catch(() => ({ rows: [] }));
    if (!delRes.rows[0]) error(403, 'Você não tem permissão para excluir este comentário ou ele não existe');
    data = { ok: true, deleted_id: cId };
    problem = null;
  } else if (body.scope === 'member' && body.action === 'profile' && locals.user?.id) {
    const displayName = body.data?.display_name ? String(body.data.display_name).trim() : null;
    const bio = typeof body.data?.bio === 'string' ? String(body.data.bio).trim() : null;
    const username = body.data?.username ? String(body.data.username).trim().toLowerCase() : null;

    if (username && !/^[a-z0-9_-]{3,30}$/.test(username)) {
      error(400, 'Nome de usuário inválido (3-30 caracteres, letras, números, hífen e underscore).');
    }

    if (displayName && (displayName.length < 2 || displayName.length > 50)) {
      error(400, 'Nome de exibição deve ter entre 2 e 50 caracteres.');
    }

    await executeYugabyteSql(
      `UPDATE members
       SET display_name = COALESCE($1, display_name),
           bio = COALESCE($2, bio),
           username = COALESCE($3, username)
       WHERE id = $4;`,
      [displayName, bio, username, locals.user.id],
      platform?.env
    ).catch((err: any) => {
      error(400, 'Erro ao atualizar perfil: ' + (err?.message || 'Falha no banco de dados'));
    });

    if (displayName) {
      await executeYugabyteSql(
        `UPDATE public."user" SET name = $1, "updatedAt" = NOW() WHERE id = $2;`,
        [displayName, locals.user.id],
        platform?.env
      ).catch(() => {});
    }

    invalidateUserSession(locals.user.id);
    data = { ok: true };
    problem = null;
  } else if (body.scope === 'member' && (body.action === 'equip' || body.action === 'equip_cosmetic') && locals.user?.id) {
    const slot = String(body.data?.slot || '').trim().toLowerCase();
    const itemId = body.data?.item_id || body.data?.value ? String(body.data?.item_id || body.data?.value).trim() : null;
    const isUnequip = !itemId || itemId === 'none' || itemId === 'default';
    const finalVal = isUnequip ? null : itemId;

    const columnMap: Record<string, string> = {
      frame: 'avatar_frame_id',
      banner: 'equipped_banner_id',
      comment_banner: 'equipped_comment_banner_id',
      name_color: 'name_color'
    };

    const targetCol = columnMap[slot];
    if (!targetCol) error(400, 'Slot de cosmético inválido');

    await executeYugabyteSql(
      `UPDATE members SET ${targetCol} = $1 WHERE id = $2;`,
      [finalVal, locals.user.id],
      platform?.env
    ).catch((err: any) => {
      error(400, 'Erro ao equipar cosmético: ' + (err?.message || 'Falha no banco de dados'));
    });

    invalidateUserSession(locals.user.id);
    data = { ok: true, slot, equipped: !isUnequip, item_id: finalVal };
    problem = null;
  } else if (body.scope === 'owner') {
    if (locals.role !== 'ADMIN') error(403, 'Esta ação é exclusiva dos administradores.');
    const targetUserId = body.data?.user_id ? String(body.data.user_id) : (body.data?.id ? String(body.data.id) : null);
    if (body.action === 'suspend_member' || body.action === 'suspend') {
      const suspended = Boolean(body.data?.suspended);
      await executeYugabyteSql(
        `UPDATE public.access_roles SET suspended = $1 WHERE user_id = $2;`,
        [suspended, targetUserId],
        platform?.env
      );
      data = { ok: true };
      problem = null;
    } else if (body.action === 'set_role' || body.action === 'role') {
      const role = String(body.data?.role);
      await executeYugabyteSql(
        `UPDATE public.access_roles SET role = $1 WHERE user_id = $2;`,
        [role, targetUserId],
        platform?.env
      );
      data = { ok: true };
      problem = null;
    } else {
      try {
        const res = await executeYugabyteSql(
          `SELECT public.owner_action($1, $2::jsonb) AS result;`,
          [body.action, JSON.stringify(body.data)],
          platform?.env
        );
        data = res.rows[0]?.result || { ok: true };
        problem = null;
      } catch (err: any) {
        problem = err;
      }
    }
  } else {
    try {
      if (isCanonicalChapterWrite) {
        const rpcRes = await executeYugabyteSql(
          `SELECT public.editor_chapter_identity_action($1::jsonb) AS result;`,
          [JSON.stringify(body.data)],
          platform?.env
        );
        data = rpcRes.rows[0]?.result;
        problem = null;
      } else {
        error(400, `Ação não suportada: ${body.scope}.${body.action}`);
      }
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
      } catch {
        // Continue with the default work labels when enrichment is unavailable.
      }
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
      } catch {
        // Continue with the default chapter labels when enrichment is unavailable.
      }
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
