import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { member, db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, sql } from 'drizzle-orm';
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
  const { data: rpcData, error: problem } = await safeQuery(
    db.execute(sql`SELECT ${sql.raw(body.scope + '_action')}(${body.action}, ${JSON.stringify(body.data)}) as result`)
  );
  const data = (rpcData as any[])?.[0]?.result;
  if (problem) error(problem.code === '42501' ? 403 : 400, problem.message);

  if (body.scope === 'member' && body.action === 'comment' && locals.user) {
    const commentBody = String(body.data.body || '');
    const chapterId = body.data.chapterId ? String(body.data.chapterId) : null;
    const workId = body.data.workId ? String(body.data.workId) : null;
    const parentId = body.data.parentId ? String(body.data.parentId) : null;
    const commentId = (data as any)?.id;

    let workSlug = workId || '';
    let workTitle = 'Obra';
    let chapterNumber = '';

    if (workId) {
      const { data: ws } = await safeQuerySingle(
        db.select({ slug: schema.works.slug, title: schema.works.title })
          .from(schema.works)
          .where(eq(schema.works.id, workId))
      );
      const w = ws?.[0];
      if (w?.slug) workSlug = w.slug;
      if (w?.title) workTitle = w.title;
    }

    if (chapterId) {
      const { data: chaps } = await safeQuerySingle(
        db.select({
          number: schema.chapters.number,
          slug: schema.works.slug,
          title: schema.works.title
        })
        .from(schema.chapters)
        .leftJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
        .where(eq(schema.chapters.id, chapterId))
      );
      const chap = chaps?.[0];
      if (chap?.number !== undefined && chap?.number !== null) chapterNumber = ` #${chap.number}`;
      if (chap?.slug) workSlug = chap.slug;
      if (chap?.title) workTitle = chap.title;

    }

    const hash = commentId ? `#comment-${commentId}` : '';
    const deepLink = chapterId ? `/ler/${chapterId}${hash}` : `/obra/${workSlug}${hash}`;

    // Buscar nome do autor
    let authorName = 'Alguém';
    const { data: authorMem } = await locals.db
      .from('members')
      .select('display_name, username')
      .eq('id', locals.user!.id)
      .maybeSingle();
    if (authorMem) {
      authorName = authorMem.displayName || authorMem.username || 'Alguém';
    }

    // Notify parent comment author if replying
    if (parentId) {
      try {
        const { data: parents } = await safeQuerySingle(
          db.select({ userId: schema.comments.userId, body: schema.comments.body })
            .from(schema.comments)
            .where(eq(schema.comments.id, parentId))
        );
        const parent = parents?.[0];

        if (parent && parent.userId && parent.userId !== locals.user!.id) {
          const replyDeepLink = chapterId
            ? `/ler/${chapterId}#comment-${parentId}`
            : `/obra/${workSlug}#comment-${parentId}`;

          await createNotification({
            recipientUserId: parent.userId,
            actorUserId: locals.user!.id,
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
        authorId: locals.user!.id,
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
