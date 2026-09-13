import { createServerClient } from '@supabase/ssr';
import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import type { Database } from '$lib/database.types';
import { processPendingEmailOutbox } from '$lib/server/notifications';
import { withTimeout } from '$lib/server/resilience';

import { extractFullAuthCookie, decodeSessionJwt, resolveSessionData } from '$lib/server/session-cache';

let lastOpportunisticSweep = 0;

export const handle: Handle = async ({ event, resolve }) => {
  const reqStart = performance.now();
  if (!env.PUBLIC_SUPABASE_URL || !env.PUBLIC_SUPABASE_ANON_KEY)
    error(503, 'A plataforma está em manutenção. Volte em instantes.');
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.request.method)) {
    const isInternal = event.url.pathname.startsWith('/api/internal/');
    if (!isInternal && event.request.headers.get('origin') !== event.url.origin) error(403, 'Origem inválida');
    const isScanProductionUpload = event.url.pathname === '/api/scan/production/upload';
    const max = isScanProductionUpload
      ? 524_288_000 // 500 MB for private pipeline RAWs and artifacts
      : event.url.pathname === '/api/upload' ||
        event.url.pathname === '/api/internal/storage/upload' ||
        event.url.pathname === '/api/avatar' ||
        event.url.pathname === '/api/banner'
        ? 52_428_800
        : 10_000_000;
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

  const allCookies = event.cookies.getAll();
  const rawAuthCookie = extractFullAuthCookie(allCookies);
  const hasAuthCookie = Boolean(rawAuthCookie);

  let user: any = null;
  let role: string | null = null;
  let authState: 'ANONYMOUS' | 'AUTH_PENDING' | 'AUTHENTICATED' | 'AUTH_ERROR' = 'ANONYMOUS';
  let sessionData: any = null;
  const authStart = performance.now();

  if (!hasAuthCookie || !rawAuthCookie) {
    authState = 'ANONYMOUS';
    user = null;
    role = null;
  } else {
    const { jwt, accessToken } = decodeSessionJwt(rawAuthCookie);
    const nowSec = Math.floor(Date.now() / 1000);
    const isNotExpired = Boolean(jwt?.exp && jwt.exp > nowSec);

    if (jwt && isNotExpired) {
      try {
        sessionData = await resolveSessionData(event.locals.db, jwt, accessToken);
        user = sessionData.user;
        role = sessionData.role;
        authState = 'AUTHENTICATED';
        event.locals.sessionCache = sessionData;
      } catch {
        // Fallback using decoded JWT without breaking authenticated UI
        user = { id: jwt.sub, email: jwt.email, user_metadata: jwt.user_metadata };
        authState = 'AUTH_PENDING';
        role = null;
      }
    } else if (hasAuthCookie) {
      // Token parsing failed or token expired: fallback to server-side getUser()
      try {
        const authResult = await withTimeout(
          event.locals.db.auth.getUser(),
          1500,
          { data: { user: null }, error: new Error('AUTH_TIMEOUT') } as any,
          'auth_get_user_refresh'
        );
        if (authResult?.data?.user) {
          user = authResult.data.user;
          authState = 'AUTHENTICATED';
          sessionData = await resolveSessionData(event.locals.db, { sub: user.id, email: user.email, exp: nowSec + 3600 }, accessToken || '');
          role = sessionData.role;
          event.locals.sessionCache = sessionData;
        } else {
          authState = 'ANONYMOUS';
          user = null;
          role = null;
        }
      } catch {
        authState = 'ANONYMOUS';
        user = null;
        role = null;
      }
    } else {
      authState = 'ANONYMOUS';
      user = null;
      role = null;
    }
  }

  const authDuration = Math.round(performance.now() - authStart);

  event.locals.user = user;
  event.locals.authState = authState;
  event.locals.role = role;

  // Strict fail-closed security for administrative areas
  if (event.url.pathname.startsWith('/admin')) {
    if (event.locals.authState === 'AUTH_PENDING' || event.locals.authState === 'AUTH_ERROR') {
      error(503, 'A verificação da equipe está temporariamente em recuperação. Tente novamente em instantes.');
    }
    if (!['STAFF_SITE', 'ADMIN', 'EDITOR'].includes(event.locals.role || '')) {
      error(403, 'Esta área é exclusiva da equipe editorial.');
    }
    if (event.url.pathname.startsWith('/admin/gestao') && event.locals.role !== 'ADMIN') {
      error(403, 'Esta área é exclusiva dos administradores.');
    }
  }

  const response = await resolve(event, {
    filterSerializedResponseHeaders: (name) => name === 'content-range' || name === 'x-supabase-api-version'
  });
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (event.url.protocol === 'https:') response.headers.set('Strict-Transport-Security', 'max-age=31536000');
  
  const totalDuration = Math.round(performance.now() - reqStart);
  const renderDuration = Math.max(0, totalDuration - authDuration);
  response.headers.set('Server-Timing', `auth;dur=${authDuration}, render;dur=${renderDuration}, total;dur=${totalDuration}`);

  // Never cache HTML responses at the edge to guarantee 100% accurate SSR auth state on every request
  const isHtml = response.headers.get('content-type')?.includes('text/html') || event.request.headers.get('accept')?.includes('text/html');
  if (isHtml || user || hasAuthCookie || event.url.pathname.startsWith('/admin') || event.url.pathname.startsWith('/auth') || event.url.pathname.startsWith('/me') || event.url.pathname.startsWith('/scan')) {
    response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    response.headers.set('Vary', 'Cookie, Accept');
  } else if (response.status >= 400) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  }
  if (
    /^\/(?:admin|auth|api|entrar|cadastrar|recuperar|redefinir|perfil|biblioteca|favoritos|historico|notificacoes|ler)(?:\/|$)/.test(
      event.url.pathname
    )
  )
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');

  // Varredura oportunista e não bloqueante da outbox (máximo 1x por minuto)
  if (event.platform?.context?.waitUntil && Date.now() - lastOpportunisticSweep > 60_000) {
    lastOpportunisticSweep = Date.now();
    event.platform.context.waitUntil(processPendingEmailOutbox(15).catch(() => {}));
  }

  return response;
};
