import { json, type RequestHandler } from '@sveltejs/kit';
import { getWorkRating, setWorkRating, removeWorkRating } from '$lib/server/ratings';

function resolveVisitorId(locals: App.Locals, cookies: any): string {
  if (locals.user?.id) return locals.user.id;
  let vid = cookies.get('nox-vid');
  if (!vid) {
    vid = crypto.randomUUID();
    cookies.set('nox-vid', vid, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 31536000 // 1 year
    });
  }
  return vid;
}

export const GET: RequestHandler = async ({ params, locals, cookies, platform }) => {
  const workId = params.id;
  if (!workId) return json({ error: 'workId é obrigatório' }, { status: 400 });

  const visitorId = resolveVisitorId(locals, cookies);
  const userId = locals.user?.id;

  try {
    const summary = await getWorkRating(workId, visitorId, userId, platform?.env);
    return json({ success: true, ...summary });
  } catch (err: any) {
    return json({ error: err.message || 'Falha ao buscar avaliação' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ params, request, locals, cookies, platform }) => {
  const workId = params.id;
  if (!workId) return json({ error: 'workId é obrigatório' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const rating = body.rating;

  if (rating === undefined || rating === null || typeof rating !== 'number' || !Number.isInteger(rating) || rating < 0 || rating > 5) {
    return json({ error: 'A avaliação deve ser um número inteiro de 0 a 5 estrelas.' }, { status: 400 });
  }

  const visitorId = resolveVisitorId(locals, cookies);
  const userId = locals.user?.id;

  try {
    const summary = await setWorkRating(workId, visitorId, rating, userId, platform?.env);
    return json({ success: true, ...summary });
  } catch (err: any) {
    return json({ error: err.message || 'Falha ao registrar avaliação' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params, locals, cookies, platform }) => {
  const workId = params.id;
  if (!workId) return json({ error: 'workId é obrigatório' }, { status: 400 });

  const visitorId = resolveVisitorId(locals, cookies);
  const userId = locals.user?.id;

  try {
    const summary = await removeWorkRating(workId, visitorId, userId, platform?.env);
    return json({ success: true, ...summary });
  } catch (err: any) {
    return json({ error: err.message || 'Falha ao remover avaliação' }, { status: 500 });
  }
};
