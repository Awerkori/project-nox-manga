import { json, type RequestHandler } from '@sveltejs/kit';

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

  const { data, error } = await locals.db.rpc('get_chapter_reactions', {
    p_chapter_id: chapterId,
    p_visitor_id: visitorId
  });

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  return json(data || { counts: {}, userReactions: [] });
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

  const { data, error } = await locals.db.rpc('toggle_chapter_reaction', {
    p_chapter_id: chapterId,
    p_visitor_id: visitorId,
    p_emoji: emoji
  });

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  return json(data);
};
