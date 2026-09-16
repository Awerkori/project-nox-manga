import { json, type RequestHandler } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url, locals, cookies }) => {
  const chapterId = url.searchParams.get('chapterId');
  if (!chapterId) {
    return json({ error: 'chapterId é obrigatório' }, { status: 400 });
  }

  let visitorId = locals.user?.id;
  if (!visitorId) {
    visitorId = cookies.get('nox-vid');
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      cookies.set('nox-vid', visitorId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 31536000 // 1 year
      });
    }
  }

  const { data: allReactions, error } = await safeQuery(
    db.select({ emoji: schema.chapterReactions.emoji, visitorId: schema.chapterReactions.visitorId })
      .from(schema.chapterReactions)
      .where(eq(schema.chapterReactions.chapterId, chapterId))
  );

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  const counts: Record<string, number> = {};
  const userReactions: string[] = [];

  for (const r of allReactions || []) {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    if (r.visitorId === visitorId) {
      userReactions.push(r.emoji);
    }
  }

  return json({ counts, userReactions });
};

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
  const body = await request.json().catch(() => ({}));
  const { chapterId, emoji } = body;

  if (!chapterId || !emoji) {
    return json({ error: 'chapterId e emoji são obrigatórios' }, { status: 400 });
  }

  const validEmojis = ['heart', 'fire', 'cry', 'shock', 'laugh'];
  if (!validEmojis.includes(emoji)) {
    return json({ error: 'Emoji inválido' }, { status: 400 });
  }

  let visitorId = locals.user?.id;
  if (!visitorId) {
    visitorId = cookies.get('nox-vid');
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      cookies.set('nox-vid', visitorId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 31536000
      });
    }
  }

  const { data: existing, error: existingError } = await safeQuerySingle(
    db.select({ id: schema.chapterReactions.id })
      .from(schema.chapterReactions)
      .where(and(
        eq(schema.chapterReactions.chapterId, chapterId),
        eq(schema.chapterReactions.visitorId, visitorId),
        eq(schema.chapterReactions.emoji, emoji)
      ))
  );

  if (existingError) {
    return json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    await safeQuery(
      db.delete(schema.chapterReactions).where(eq(schema.chapterReactions.id, existing.id))
    );
  } else {
    await safeQuery(
      db.insert(schema.chapterReactions).values({
        id: crypto.randomUUID(),
        chapterId,
        visitorId,
        emoji,
        createdAt: new Date().toISOString()
      })
    );
  }

  // Refetch counts to return updated state
  const { data: allReactions } = await safeQuery(
    db.select({ emoji: schema.chapterReactions.emoji, visitorId: schema.chapterReactions.visitorId })
      .from(schema.chapterReactions)
      .where(eq(schema.chapterReactions.chapterId, chapterId))
  );

  const counts: Record<string, number> = {};
  const userReactions: string[] = [];

  for (const r of allReactions || []) {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    if (r.visitorId === visitorId) {
      userReactions.push(r.emoji);
    }
  }

  return json({ counts, userReactions });
};
