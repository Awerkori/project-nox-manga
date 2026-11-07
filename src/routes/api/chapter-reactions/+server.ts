import { json, type RequestHandler } from '@sveltejs/kit';
import { executeYugabyteSql, withYugabyteReadSession } from '$lib/server/yugabyte';

const REACTION_COUNTS_TTL_MS = 30_000;
const MAX_REACTION_CACHE_ENTRIES = 500;
const reactionCountsCache = new Map<string, { counts: Record<string, number>; timestamp: number }>();

export const GET: RequestHandler = async ({ url, locals, cookies, platform }: any) => {
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

  return withYugabyteReadSession(platform?.env, async (platformEnv) => {
    try {
    const now = Date.now();
    let counts: Record<string, number> | null = null;
    const cachedEntry = reactionCountsCache.get(chapterId);
    if (cachedEntry && now - cachedEntry.timestamp < REACTION_COUNTS_TTL_MS) {
      counts = cachedEntry.counts;
    }

    const countsPromise = counts
      ? Promise.resolve(null)
      : executeYugabyteSql(
          `SELECT emoji, count(*)::int AS cnt FROM public.chapter_reactions WHERE chapter_id = $1 GROUP BY emoji;`,
          [chapterId],
          platformEnv
        );

    const userPromise = executeYugabyteSql(
      `SELECT emoji FROM public.chapter_reactions WHERE chapter_id = $1 AND visitor_id = $2;`,
      [chapterId, visitorId],
      platformEnv
    );

    const [countsRes, userRes] = await Promise.all([countsPromise, userPromise]);

    if (!counts && countsRes) {
      counts = {};
      for (const row of countsRes.rows) {
        counts[row.emoji] = row.cnt;
      }
      if (reactionCountsCache.size >= MAX_REACTION_CACHE_ENTRIES) {
        const oldest = reactionCountsCache.keys().next().value;
        if (oldest) reactionCountsCache.delete(oldest);
      }
      reactionCountsCache.set(chapterId, { counts, timestamp: Date.now() });
    }

    const userReactions = userRes.rows.map((r: any) => r.emoji);
    return json({ counts: counts || {}, userReactions });
  } catch (err: any) {
    return json({ error: err?.message || 'Falha ao buscar reações' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, locals, cookies, platform }: any) => {
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

  const platformEnv = platform?.env;

  try {
    const existing = await executeYugabyteSql(
      `SELECT id FROM public.chapter_reactions WHERE chapter_id = $1 AND visitor_id = $2 AND emoji = $3 LIMIT 1;`,
      [chapterId, visitorId, emoji],
      platformEnv
    );

    if (existing.rows.length > 0) {
      await executeYugabyteSql(
        `DELETE FROM public.chapter_reactions WHERE id = $1;`,
        [existing.rows[0].id],
        platformEnv
      );
    } else {
      await executeYugabyteSql(
        `INSERT INTO public.chapter_reactions (id, chapter_id, visitor_id, emoji, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, now());`,
        [chapterId, visitorId, emoji],
        platformEnv
      );
    }

    // Invalidate cached counts for this chapter
    reactionCountsCache.delete(chapterId);

    const [countsRes, userRes] = await Promise.all([
      executeYugabyteSql(
        `SELECT emoji, count(*)::int AS cnt FROM public.chapter_reactions WHERE chapter_id = $1 GROUP BY emoji;`,
        [chapterId],
        platformEnv
      ),
      executeYugabyteSql(
        `SELECT emoji FROM public.chapter_reactions WHERE chapter_id = $1 AND visitor_id = $2;`,
        [chapterId, visitorId],
        platformEnv
      )
    ]);

    const counts: Record<string, number> = {};
    for (const row of countsRes.rows) {
      counts[row.emoji] = row.cnt;
    }
    reactionCountsCache.set(chapterId, { counts, timestamp: Date.now() });

    const userReactions = userRes.rows.map((r: any) => r.emoji);
    return json({ counts, userReactions });
  } catch (err: any) {
    return json({ error: err?.message || 'Falha ao alternar reação' }, { status: 500 });
  }
};
