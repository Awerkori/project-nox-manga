import { json } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, and, gt, sql } from 'drizzle-orm';

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const POST = async ({ params, locals, request, getClientAddress }) => {
  const chapterId = params.id;
  if (!chapterId) {
    return json({ counted: false, error: 'Captulo no informado' }, { status: 400 });
  }

  const userId = locals.user?.id || null;
  let anonHash: string | null = null;

  if (!userId) {
    try {
      const ip = getClientAddress() || '';
      const ua = request.headers.get('user-agent') || '';
      anonHash = await hashString(`${ip}-${ua}`);
    } catch {
      anonHash = 'anonymous-visitor';
    }
  }

  // 1. Fetch chapter
  const { data: chapter, error: chErr } = await safeQuerySingle(
    db.select({
      id: schema.chapters.id,
      workId: schema.chapters.workId,
      viewsTotal: schema.chapters.viewsTotal
    })
    .from(schema.chapters)
    .where(eq(schema.chapters.id, chapterId))
  );

  if (chErr) {
    return json({ counted: false, error: (chErr as any).message || 'Erro ao consultar captulo' }, { status: 500 });
  }

  if (!chapter) {
    return json({ counted: false, reason: 'chapter_not_found' });
  }

  // 2. Anti-inflation 30-minute deduplication check
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  let recentFilter = and(
    eq(schema.chapterViews.chapterId, chapterId),
    gt(schema.chapterViews.viewedAt, thirtyMinutesAgo)
  );

  if (userId) {
    recentFilter = and(recentFilter, eq(schema.chapterViews.userId, userId));
  } else if (anonHash) {
    recentFilter = and(recentFilter, eq(schema.chapterViews.anonymousHash, anonHash));
  }

  const { data: recentView, error: recentErr } = await safeQuerySingle(
    db.select({ id: schema.chapterViews.id })
      .from(schema.chapterViews)
      .where(recentFilter)
      .limit(1)
  );

  if (recentErr) {
    return json({ counted: false, error: (recentErr as any).message || 'Erro ao validar visualizao' }, { status: 500 });
  }

  if (recentView) {
    return json({ counted: false, reason: 'deduplicated' });
  }

  // 3. Record the view
  const { error: insertErr } = await safeQuery(
    db.insert(schema.chapterViews).values({
      chapterId,
      workId: chapter.workId,
      userId: userId ?? undefined,
      anonymousHash: anonHash ?? undefined,
      origin: 'WEB',
      viewedAt: new Date().toISOString()
    })
  );

  if (insertErr) {
    return json({ counted: false, error: (insertErr as any).message || 'Erro ao registrar visualizao' }, { status: 500 });
  }

  const newChapterViews = (chapter.viewsTotal || 0) + 1;

  await safeQuery(
    db.update(schema.chapters)
      .set({ viewsTotal: newChapterViews })
      .where(eq(schema.chapters.id, chapterId))
  );

  await safeQuery(
    db.update(schema.works)
      .set({ viewsTotal: sql`${schema.works.viewsTotal} + 1` })
      .where(eq(schema.works.id, chapter.workId))
  );

  return json({
    counted: true,
    chapter_views: newChapterViews
  });
};
