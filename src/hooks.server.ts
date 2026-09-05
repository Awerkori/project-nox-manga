import { createServerClient } from '@supabase/ssr';
import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import type { Database } from '$lib/database.types';

export const handle: Handle = async ({ event, resolve }) => {
  if (!env.PUBLIC_SUPABASE_URL || !env.PUBLIC_SUPABASE_ANON_KEY)
    error(503, 'A plataforma está em manutenção. Volte em instantes.');
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.request.method)) {
    if (event.request.headers.get('origin') !== event.url.origin) error(403, 'Origem inválida');
    const max =
      event.url.pathname === '/api/upload'
        ? 19_100_000
        : event.url.pathname === '/api/avatar'
          ? 300_000
          : 65_536;
    if (Number(event.request.headers.get('content-length') || 0) > max)
      error(413, 'Arquivo ou solicitação acima do limite');
  }
  event.locals.db = createServerClient<Database>(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookies) =>
        cookies.forEach(({ name, value, options }) =>
          event.cookies.set(name, value, {
            ...options,
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: event.url.protocol === 'https:'
          })
        )
    }
  });
  const {
    data: { user }
  } = await event.locals.db.auth.getUser();
  event.locals.user = user;
  event.locals.role = user ? (await event.locals.db.rpc('current_role')).data : null;
  if (event.url.pathname.startsWith('/admin') && !['EDITOR', 'ADMIN'].includes(event.locals.role || ''))
    error(403, 'Esta área é exclusiva da equipe editorial.');
  if (event.url.pathname.startsWith('/admin/gestao') && event.locals.role !== 'ADMIN')
    error(403, 'Esta área é exclusiva dos administradores.');
  const response = await resolve(event, {
    filterSerializedResponseHeaders: (name) => name === 'content-range' || name === 'x-supabase-api-version'
  });
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (event.url.protocol === 'https:') response.headers.set('Strict-Transport-Security', 'max-age=31536000');
  if (user || event.url.pathname.startsWith('/admin') || event.url.pathname.startsWith('/auth'))
    response.headers.set('Cache-Control', 'private, no-store');
  return response;
};
