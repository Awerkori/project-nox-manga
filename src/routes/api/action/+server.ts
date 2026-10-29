import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { member, privileged } from '$lib/server/db';
import { dispatchMentions } from '$lib/server/mentions';
import { stripSpoilers } from '$lib/comments';
import { createNotification, processPendingEmailOutbox } from '$lib/server/notifications';
import { invalidateUserSession } from '$lib/server/session-cache';
import { invalidateRankingCache } from '$lib/server/ranking-cache';
import { invalidateObraAuxCache } from '$lib/server/obra-cache';
import { fetchWorkFromYugabyte } from '$lib/server/yugabyte';
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

  // Ensure work & chapter exist in Supabase for relational integrity and foreign keys
  const targetWorkId = body.data?.work_id ? String(body.data.work_id) : null;
  const targetChapterId = body.data?.chapter_id ? String(body.data.chapter_id) : null;
  if (
    body.scope === 'member' &&
    (targetWorkId || targetChapterId) &&
    ['like', 'library', 'comment', 'rate_work', 'read_start', 'read_page'].includes(body.action)
  ) {
    try {
      const adminDb = privileged();
      let resolvedWorkId = targetWorkId;

      // 1. If chapter is provided, verify against Yugabyte and bridge into Supabase
      if (targetChapterId) {
        const { data: cExists } = await adminDb
          .from('chapters')
          .select('id, work_id, published_at')
          .eq('id', targetChapterId)
          .maybeSingle();

        if (!cExists) {
          try {
            const { data: ybChap } = await readerChapter(targetChapterId, false, platform?.env);
            if (ybChap) {
              resolvedWorkId = ybChap.work_id || resolvedWorkId;

              // Ensure work exists before inserting chapter (foreign key constraint)
              if (resolvedWorkId) {
                const { data: wExists } = await adminDb.from('works').select('id').eq('id', resolvedWorkId).maybeSingle();
                if (!wExists) {
                  const cw = (ybChap.works as any) || {};
                  let cleanSlug = cw.slug || body.data?.work_slug || `obra-${resolvedWorkId.slice(0, 8)}`;
                  let cleanTitle = cw.title || body.data?.work_title || 'Obra';
                  let sanitizedSlug = cleanSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                  if (!sanitizedSlug) sanitizedSlug = `obra-${resolvedWorkId.slice(0, 8)}`;

                  await adminDb.from('works').upsert(
                    {
                      id: resolvedWorkId,
                      slug: sanitizedSlug,
                      title: cleanTitle.slice(0, 200),
                      published: true,
                      content_rating: cw.content_rating || 'GENERAL',
                      kind: cw.kind || 'MANHWA',
                      status: 'ONGOING'
                    },
                    { onConflict: 'id' }
                  );
                }
              }

              // Insert verified chapter stub into Supabase
              await adminDb.from('chapters').upsert(
                {
                  id: ybChap.id,
                  work_id: resolvedWorkId,
                  number: ybChap.number ?? 1,
                  title: ybChap.title || `Capítulo ${ybChap.display_number || ybChap.number || ''}`,
                  published_at: ybChap.published_at || new Date().toISOString(),
                  canonical_chapter_key: ybChap.canonical_chapter_key || null,
                  display_number: ybChap.display_number || String(ybChap.number || ''),
                  chapter_order_key: ybChap.chapter_order_key || null,
                  chapter_kind: ybChap.chapter_kind || 'chapter',
                  edition: ybChap.edition || 'default',
                  language: ybChap.language || 'und',
                  origin: 'MANUAL'
                },
                { onConflict: 'id' }
              );

              if (body.data) {
                body.data.work_id = resolvedWorkId;
                body.data.chapter_number = ybChap.number;
                body.data.chapter_title = ybChap.title;
                body.data.display_number = ybChap.display_number;
              }
            } else {
              // Chapter does not exist or is unpublished in authoritative Yugabyte catalog
              error(404, 'Capítulo indisponível');
            }
          } catch (fetchErr: any) {
            if (fetchErr?.status === 404) throw fetchErr;
            console.warn('[ACTION] Yugabyte fetch error for chapter stub:', fetchErr);
          }
        } else if (cExists.work_id && body.data && !body.data.work_id) {
          body.data.work_id = cExists.work_id;
        }
      }

      // 2. Ensure work exists in Supabase if resolvedWorkId is present
      if (resolvedWorkId) {
        const { data: wExists } = await adminDb.from('works').select('id').eq('id', resolvedWorkId).maybeSingle();
        if (!wExists) {
          let cleanSlug = body.data?.work_slug ? String(body.data.work_slug) : null;
          let cleanTitle = body.data?.work_title ? String(body.data.work_title) : null;

          try {
            const ybWork = await fetchWorkFromYugabyte(resolvedWorkId, platform?.env);
            if (ybWork) {
              cleanSlug = ybWork.slug || cleanSlug;
              cleanTitle = ybWork.title || cleanTitle;
            }
          } catch (fetchErr) {
            console.warn('[ACTION] Yugabyte fetch error for work stub:', fetchErr);
          }

          let sanitizedSlug = (cleanSlug || resolvedWorkId)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          if (!sanitizedSlug) sanitizedSlug = `obra-${resolvedWorkId.slice(0, 8)}`;

          const { data: slugOwner } = await adminDb.from('works').select('id').eq('slug', sanitizedSlug).maybeSingle();
          if (slugOwner && slugOwner.id !== resolvedWorkId) {
            sanitizedSlug = `${sanitizedSlug}-${resolvedWorkId.slice(0, 6)}`;
          }

          await adminDb.from('works').upsert(
            {
              id: resolvedWorkId,
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
      }
    } catch (err: any) {
      if (err?.status) throw err;
      console.error('[ACTION] Error ensuring work/chapter exists in Supabase:', err);
    }
  }

  // Handle 'read_notification' action
  if (body.scope === 'member' && body.action === 'read_notification') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');
    const notifId = body.data?.id ? String(body.data.id) : null;
    if (!notifId) error(400, 'ID da notificação obrigatório');
    const { error: notifErr } = await locals.db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notifId)
      .eq('user_id', locals.user.id);
    if (notifErr) error(400, notifErr.message);
    invalidateUserSession(locals.user.id);
    return json({ ok: true, markedReadId: notifId });
  }

  // Handle 'read_all_notifications' action
  if (body.scope === 'member' && body.action === 'read_all_notifications') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');
    const { error: notifErr } = await locals.db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', locals.user.id)
      .is('read_at', null);
    if (notifErr) error(400, notifErr.message);
    invalidateUserSession(locals.user.id);
    return json({ ok: true });
  }

  // Handle 'comment_moderate_media' action (Granular moderation of attachments / spoilers)
  if (body.scope === 'member' && body.action === 'comment_moderate_media') {
    if (!locals.user?.id) error(401, 'Entre em sua conta');
    const commentId = body.data?.comment_id ? String(body.data.comment_id) : (body.data?.id ? String(body.data.id) : null);
    const mediaUrl = body.data?.media_url ? String(body.data.media_url).trim() : null;
    const mode = body.data?.mode ? String(body.data.mode) : 'remove'; // 'remove' | 'spoiler'
    if (!commentId || !mediaUrl) error(400, 'comment_id e media_url obrigatórios');

    // Check user permissions
    const adminDb = privileged();
    const { data: targetComment } = await adminDb
      .from('comments')
      .select('id, user_id, body, removed, deleted, chapter_id, work_id')
      .eq('id', commentId)
      .maybeSingle();

    if (!targetComment || targetComment.removed || targetComment.deleted) {
      error(404, 'Comentário indisponível');
    }

    // Role check: Author or Staff/Admin
    let isAuthorized = targetComment.user_id === locals.user.id;
    if (!isAuthorized) {
      const { data: roleRow } = await adminDb
        .from('access_roles')
        .select('role')
        .eq('user_id', locals.user.id)
        .maybeSingle();
      const r = (roleRow?.role || '').toUpperCase();
      isAuthorized = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(r) || locals.user.id === 'f730c4f8-132b-42eb-be14-16279f0ce6e6';
    }

    if (!isAuthorized) {
      error(403, 'Você não tem permissão para moderar esta mídia');
    }

    let updatedBody = targetComment.body || '';

    if (mode === 'remove') {
      // Remove specific media markdown: ![alt](url) or ||![alt](url)|| or direct url
      const escapedUrl = mediaUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tagRegex = new RegExp(`(?:\\|\\|\\s*)?!\\[[^\\]]*\\]\\(${escapedUrl}\\)(?:\\s*\\|\\|)?|${escapedUrl}`, 'gi');
      updatedBody = updatedBody.replace(tagRegex, '').trim();

      // Clean up multiple line breaks left behind
      updatedBody = updatedBody.replace(/\n{3,}/g, '\n\n').trim();

      if (!updatedBody) {
        // Safe policy when comment had ONLY this media and no text:
        // Soft delete the comment so it doesn't leave an empty broken shell
        const { error: delErr } = await adminDb
          .from('comments')
          .update({ removed: true, deleted: true, updated_at: new Date().toISOString() })
          .eq('id', commentId);
        if (delErr) error(400, delErr.message);

        return json({ ok: true, commentId, action: 'removed_and_deleted', empty: true });
      } else {
        const { error: upErr } = await adminDb
          .from('comments')
          .update({ body: updatedBody, updated_at: new Date().toISOString() })
          .eq('id', commentId);
        if (upErr) error(400, upErr.message);

        return json({ ok: true, commentId, action: 'removed_media', newBody: updatedBody });
      }
    } else if (mode === 'spoiler') {
      // Wrap media in spoiler ||![alt](url)|| if not already wrapped
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

        const { error: upErr } = await adminDb
          .from('comments')
          .update({ body: updatedBody, updated_at: new Date().toISOString() })
          .eq('id', commentId);
        if (upErr) error(400, upErr.message);
      }

      return json({ ok: true, commentId, action: 'spoiler_applied', newBody: updatedBody });
    }

    error(400, 'Modo de moderação de mídia inválido');
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

  // Chapter reading and progression aliases for backwards and forward compatibility
  if (body.scope === 'member') {
    if (body.action === 'reading') {
      body.action = 'read_page';
    } else if (body.action === 'complete_reading') {
      body.action = 'claim_xp';
    }
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

  if (body.scope === 'member' && (body.action === 'comment' || body.action === 'comment_edit') && locals.user) {
    const isEdit = body.action === 'comment_edit';
    const commentBody = String(body.data.body || '');
    let chapterId = body.data.chapter_id ? String(body.data.chapter_id) : null;
    let workId = body.data.work_id ? String(body.data.work_id) : null;
    let parentId = body.data.parent_id ? String(body.data.parent_id) : null;
    const commentId = (data as any)?.id || body.data.id;

    if (isEdit && commentId && (!chapterId || !workId)) {
      try {
        const { data: existingComment } = await locals.db
          .from('comments')
          .select('chapter_id, work_id, parent_id')
          .eq('id', commentId)
          .maybeSingle();
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

    let parentUserId: string | null = null;

    // Notify parent comment author if replying (apenas para novos comentários, não para edições)
    if (parentId && !isEdit) {
      try {
        const { data: parent } = await locals.db
          .from('comments')
          .select('user_id, body')
          .eq('id', parentId)
          .maybeSingle();

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

  if (locals.user?.id) {
    if ((data as any)?.xp_award?.awarded || ['read_page', 'claim_xp', 'reading', 'complete_reading', 'library', 'profile'].includes(body.action)) {
      invalidateUserSession(locals.user.id);
      invalidateRankingCache();
    }
  }

  return json(data);
};
