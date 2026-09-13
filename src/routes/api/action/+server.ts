import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { member } from '$lib/server/db';
import { dispatchMentions } from '$lib/server/mentions';
import { createNotification, processPendingEmailOutbox } from '$lib/server/notifications';
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
  const { data, error: problem } = await locals.db.rpc(`${body.scope}_action`, {
    p_action: body.action,
    p_data: body.data as Json
  });
  if (problem) error(problem.code === '42501' ? 403 : 400, problem.message);

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
        .select('number, works(slug, title)')
        .eq('id', chapterId)
        .maybeSingle();
      if (chap?.number !== undefined && chap?.number !== null) chapterNumber = ` #${chap.number}`;
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

  return json(data);
};
