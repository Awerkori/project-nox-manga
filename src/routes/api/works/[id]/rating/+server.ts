import { json, type RequestHandler } from '@sveltejs/kit';
import { getWorkRating, setWorkRating, removeWorkRating } from '$lib/server/ratings';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// In-memory sliding-window rate limiter per visitor/IP to prevent vote flooding
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit = 10, windowMs = 30_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
}

// Periodic cleanup of rate limiter to avoid memory growth
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of rateLimitMap.entries()) {
      if (now > v.resetAt) rateLimitMap.delete(k);
    }
  }, 60_000);
}

function resolveVisitorId(locals: App.Locals, cookies: any): string {
  if (locals.user?.id) return locals.user.id;
  let vid = cookies.get('nox-vid');
  if (!vid || !UUID_REGEX.test(vid)) {
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

export const POST: RequestHandler = async ({ params, request, locals, cookies, getClientAddress, platform }) => {
  const workId = params.id;
  if (!workId) return json({ error: 'workId é obrigatório' }, { status: 400 });

  const visitorId = resolveVisitorId(locals, cookies);
  const userId = locals.user?.id;

  // Anti-abuse rate limiting (IP + visitorId)
  let ip = 'unknown-ip';
  try {
    const clientIp = getClientAddress();
    if (clientIp) ip = clientIp;
  } catch (err) {
    void err;
  }
  const rateLimitKey = `${ip}:${visitorId}`;
  if (!checkRateLimit(rateLimitKey, 10, 30_000)) {
    return json(
      { error: 'Muitas requisições de avaliação. Por favor, aguarde alguns instantes.' },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const rating = body.rating;

  if (rating === undefined || rating === null || typeof rating !== 'number' || !Number.isInteger(rating) || rating < 0 || rating > 5) {
    return json({ error: 'A avaliação deve ser um número inteiro de 0 a 5 estrelas.' }, { status: 400 });
  }

  try {
    const summary = await setWorkRating(workId, visitorId, rating, userId, platform?.env);
    return json({ success: true, ...summary });
  } catch (err: any) {
    return json({ error: err.message || 'Falha ao registrar avaliação' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params, locals, cookies, getClientAddress, platform }) => {
  const workId = params.id;
  if (!workId) return json({ error: 'workId é obrigatório' }, { status: 400 });

  const visitorId = resolveVisitorId(locals, cookies);
  const userId = locals.user?.id;

  let ip = 'unknown-ip';
  try {
    const clientIp = getClientAddress();
    if (clientIp) ip = clientIp;
  } catch (err) {
    void err;
  }
  const rateLimitKey = `${ip}:${visitorId}`;
  if (!checkRateLimit(rateLimitKey, 10, 30_000)) {
    return json(
      { error: 'Muitas requisições. Por favor, aguarde alguns instantes.' },
      { status: 429 }
    );
  }

  try {
    const summary = await removeWorkRating(workId, visitorId, userId, platform?.env);
    return json({ success: true, ...summary });
  } catch (err: any) {
    return json({ error: err.message || 'Falha ao remover avaliação' }, { status: 500 });
  }
};
