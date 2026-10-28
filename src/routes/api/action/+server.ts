import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { member, privileged } from '$lib/server/db';
import { dispatchMentions } from '$lib/server/mentions';
import { createNotification, processPendingEmailOutbox } from '$lib/server/notifications';
import { invalidateUserSession } from '$lib/server/session-cache';
import { invalidateRankingCache } from '$lib/server/ranking-cache';
import { invalidateObraAuxCache } from '$lib/server/obra-cache';
import { fetchWorkFromYugabyte } from '$lib/server/yugabyte';
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

  // Ensure work exists in Supabase public.works for foreign key integrity
  const targetWorkId = body.data?.work_id ? String(body.data.work_id) : null;
  if (body.scope === 'member' && targetWorkId && ['like', 'library', 'comment', 'rate_work'].includes(body.action)) {
    try {
      const adminDb = privileged();
      const { data: wExists } = await adminDb.from('works').select('id').eq('id', targetWorkId).maybeSingle();
      if (!wExists) {
        let cleanSlug = body.data?.work_slug ? String(body.data.work_slug) : null;
        let cleanTitle = body.data?.work_title ? String(body.data.work_title) : null;

        try {
          const ybWork = await fetchWorkFromYugabyte(targetWorkId, platform?.env);
          if (ybWork) {
            cleanSlug = ybWork.slug || cleanSlug;
            cleanTitle = ybWork.title || cleanTitle;
          }
        } catch (fetchErr) {
          console.warn('[ACTION] Yugabyte fetch error for work stub:', fetchErr);
        }

        // Sanitize slug to match constraint ^[a-z0-9]+(-[a-z0-9]+)*$
        let sanitizedSlug = (cleanSlug || targetWorkId)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        if (!sanitizedSlug) sanitizedSlug = `obra-${targetWorkId.slice(0, 8)}`;

        // Verify uniqueness of slug
        const { data: slugOwner } = await adminDb.from('works').select('id').eq('slug', sanitizedSlug).maybeSingle();
        if (slugOwner && slugOwner.id !== targetWorkId) {
          sanitizedSlug = `${sanitizedSlug}-${targetWorkId.slice(0, 6)}`;
        }

        await adminDb.from('works').upsert(
          {
            id: targetWorkId,
            slug: sanitizedSlug,
            title: (cleanTitle || 'Obra').slice(0, 200),
            published: true,
            content_rating: 'GENERAL',
            kind: 'MANHWA',
            status: 'ONGOING'
          },
          { onConflict: 'id' }
        );
      }
    } catch (err) {
      console.error('[ACTION] Error ensuring work exists in Supabase:', err);
    }
  }

  // Handle 'read_notification' action
  if (body.scope === 'member' && body.action === 'read_notification') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');
    const notifId = body.data?.id ? String(body.data.id) : null;
    if (!notifId) error(400, 'ID da notificação obrigatório');

    let updatedCount = 0;
    // Prefer atomic SECURITY DEFINER RPC
    const { data: rpcRes, error: rpcErr } = await locals.db.rpc('mark_notification_read', {
      p_notification_id: notifId
    });

    if (!rpcErr && rpcRes && (rpcRes as any).success) {
      updatedCount = 1;
    } else {
      // Fallback: direct update under RLS with modified row validation
      const { data: updatedRows, error: notifErr } = await locals.db
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notifId)
        .eq('user_id', locals.user.id)
        .select('id');

      if (notifErr) error(400, notifErr.message);
      updatedCount = updatedRows?.length || 0;
    }

    if (updatedCount === 0) {
      error(404, 'Notificação não encontrada ou não pertence ao usuário');
    }

    invalidateUserSession(locals.user.id);
    return json({ ok: true, markedReadId: notifId });
  }

  // Handle 'read_all_notifications' action
  if (body.scope === 'member' && body.action === 'read_all_notifications') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');

    // Prefer atomic SECURITY DEFINER RPC
    const { data: rpcRes, error: rpcErr } = await locals.db.rpc('mark_all_notifications_read');

    if (rpcErr) {
      // Fallback: direct update under RLS
      const { error: notifErr } = await locals.db
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', locals.user.id)
        .is('read_at', null);

      if (notifErr) error(400, notifErr.message);
    }

    invalidateUserSession(locals.user.id);
    return json({ ok: true, markedCount: (rpcRes as any)?.marked_count ?? null });
  }

  // Handle 'like' action using member_action RPC
  if (body.scope === 'member' && body.action === 'like') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');
    if (!targetWorkId) error(400, 'work_id obrigatório');

    const { data: rpcRes, error: rpcProblem } = await locals.db.rpc('member_action', {
      p_action: 'like',
      p_data: {
        work_id: targetWorkId,
        work_slug: body.data?.work_slug,
        work_title: body.data?.work_title
      }
    });
    if (rpcProblem) error(rpcProblem.code === '42501' ? 403 : 400, rpcProblem.message);

    const { count: totalLikes } = await locals.db
      .from('likes')
      .select('user_id', { count: 'exact', head: true })
      .eq('work_id', targetWorkId);

    invalidateObraAuxCache(targetWorkId);

    if (locals.user?.id && (rpcRes as any)?.xp_award?.awarded) {
      invalidateUserSession(locals.user.id);
      invalidateRankingCache();
    }

    const isLiked = Boolean((rpcRes as any)?.liked);
    return json({
      ok: true,
      liked: isLiked,
      count: totalLikes ?? (isLiked ? 1 : 0),
      xp_award: (rpcRes as any)?.xp_award
    });
  }

  const isCanonicalChapterWrite = body.scope === 'editor' && body.action === 'chapter';
  const { data, error: problem } = isCanonicalChapterWrite
    ? await locals.db.rpc('editor_chapter_identity_action', { p_data: body.data as Json })
    : await locals.db.rpc(`${body.scope}_action`, {
        p_action: body.action,
        p_data: body.data as Json
      });
  if (problem) error(problem.code === '42501' ? 403 : 400, problem.message);

  if (targetWorkId) {
    invalidateObraAuxCache(targetWorkId);
  }

  if (body.scope === 'member' && body.action === 'comment' && locals.user) {
    const commentBody = String(body.data.body || '');
    const chapterId = body.data.chapter_id ? String(body.data.chapter_id) : null;
    const workId = body.data.work_id ? String(body.data.work_id) : null;
    const parentId = body.data.parent_id ? String(body.data.parent_id) : null;
    const commentId = (data as any)?.id;

    let workSlug = workId || '';
    let workTitle = 'Obra';
    let chapterNumber = '';

    if (workId) {
      const { data: w } = await locals.db
        .from('works')
        .select('slug, title')
        .eq('id', workId)
        .maybeSingle();
      if (w?.slug) workSlug = w.slug;
      if (w?.title) workTitle = w.title;
    }

    if (chapterId) {
      const { data: chap } = await locals.db
        .from('chapters')
        .select('number, display_number, works(slug, title)')
        .eq('id', chapterId)
        .maybeSingle();
      const displayNumber = String(chap?.display_number ?? chap?.number ?? '').trim();
      if (displayNumber) chapterNumber = ` #${displayNumber}`;
      if (chap?.works) {
        const cw = chap.works as any;
        if (cw.slug) workSlug = cw.slug;
        if (cw.title) workTitle = cw.title;
      }
    }

    const hash = commentId ? `#comment-${commentId}` : '';
    const deepLink = chapterId ? `/ler/${chapterId}${hash}` : `/obra/${workSlug}${hash}`;

    // Buscar nome do autor
    let authorName = 'Alguém';
    const { data: authorMem } = await locals.db
      .from('members')
      .select('display_name, username')
      .eq('id', locals.user.id)
      .maybeSingle();
    if (authorMem) {
      authorName = authorMem.display_name || authorMem.username || 'Alguém';
    }

    // Notify parent comment author if replying
    if (parentId) {
      try {
        const { data: parent } = await locals.db
          .from('comments')
          .select('user_id, body')
          .eq('id', parentId)
          .maybeSingle();

        if (parent && parent.user_id && parent.user_id !== locals.user.id) {
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
            body: commentBody,
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
        platform
      });
    } catch (err) {
      console.error('[ACTION] Error dispatching comment mentions:', err);
    }

    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(processPendingEmailOutbox(10).catch(() => {}));
    }
  }

  if (locals.user?.id) {
    if ((data as any)?.xp_award?.awarded || ['read_page', 'library', 'profile'].includes(body.action)) {
      invalidateUserSession(locals.user.id);
      invalidateRankingCache();
    }
  }

  return json(data);
};
