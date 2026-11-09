// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Project Nox Contributors & Awerkori

import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { withYugabyteReadSession } from '$lib/server/yugabyte';

import { building } from '$app/environment';
import { extractFullAuthCookie, decodeSessionJwt, resolveSessionData } from '$lib/server/session-cache';
import { setAuthCookie, clearAllAuthCookies, signSessionJwt, getAuthSecret, type AuthSession } from '$lib/server/yugabyte-auth';

async function handleRequest(event: any, resolve: any, reqStart: number) {
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

  const allCookies = event.cookies.getAll();
  const rawAuthCookie = extractFullAuthCookie(allCookies);
  const hasAuthCookie = Boolean(rawAuthCookie);

  let user: any = null;
  let role: string | null = null;
  let authState: 'ANONYMOUS' | 'AUTH_PENDING' | 'AUTHENTICATED' | 'AUTH_ERROR' = 'ANONYMOUS';
  let sessionData: any;
  const authStart = performance.now();

  const isMedia = event.url.pathname.startsWith('/media/');
  const isStaticAsset =
    event.url.pathname.startsWith('/_app/') ||
    event.url.pathname.startsWith('/brand/') ||
    event.url.pathname === '/favicon.ico' ||
    event.url.pathname === '/robots.txt' ||
    event.url.pathname === '/sitemap.xml';

  if (isMedia || isStaticAsset) {
    // Public assets need no session. Private media verifies identity after its access class is known.
  } else if (!hasAuthCookie || !rawAuthCookie) {
    authState = 'ANONYMOUS';
    user = null;
    role = null;
    if (allCookies.some((c: any) => /^sb-.*-auth-token(?:\.\d+)?$/.test(c.name) || c.name === 'sb-izregkwaqdygwioqzwwo-auth-token')) {
      clearAllAuthCookies(event.cookies);
    }
  } else {
    const { jwt, accessToken } = decodeSessionJwt(rawAuthCookie);
    const nowSec = Math.floor(Date.now() / 1000);
    const isNotExpired = Boolean(jwt?.exp && jwt.exp > nowSec);

    if (jwt && isNotExpired) {
      try {
        sessionData = await resolveSessionData(jwt, accessToken, event.platform?.env);
        if (sessionData?.user) {
          user = sessionData.user;
          role = sessionData.role;
          authState = 'AUTHENTICATED';
          event.locals.sessionCache = sessionData;
          event.locals.user = user;
          event.locals.role = role;

          // Sliding session renewal: if less than 7 days left on 30-day session, renew
          if (jwt.exp && jwt.exp - nowSec < 60 * 60 * 24 * 7) {
            try {
              const secret = getAuthSecret(event.platform?.env);
              const freshExp = nowSec + (60 * 60 * 24 * 30);
              const freshJwt = await signSessionJwt({ ...jwt, iat: nowSec, exp: freshExp }, secret);
              const freshSession: AuthSession = {
                access_token: freshJwt,
                refresh_token: crypto.randomUUID(),
                token_type: 'bearer',
                expires_in: 60 * 60 * 24 * 30,
                expires_at: freshExp,
                user
              };
              const isSecure = event.url.protocol === 'https:' || !['localhost', '127.0.0.1'].includes(event.url.hostname);
              setAuthCookie(event.cookies, freshSession, isSecure);
            } catch {
              // Non-fatal sliding renewal error; keep current valid session.
            }
          }
        } else {
          // Token claims unverified or member row missing in YugabyteDB
          user = null;
          authState = 'ANONYMOUS';
          role = null;
          clearAllAuthCookies(event.cookies);
        }
      } catch {
        // Cryptographic signature invalid, expired, or verification error.
        // Immediately treat as anonymous and clear the broken cookie to prevent infinite syncing loop.
        user = null;
        authState = 'ANONYMOUS';
        role = null;
        clearAllAuthCookies(event.cookies);
      }
    } else {
      // Token missing, expired, or invalid. Clear cookie cleanly.
      authState = 'ANONYMOUS';
      user = null;
      role = null;
      clearAllAuthCookies(event.cookies);
    }
  }

  const authDuration = Math.round(performance.now() - authStart);

  event.locals.user = user
    ? {
        ...user,
        ...(sessionData?.profile || {}),
        id: user.id,
        avatar_id: sessionData?.profile?.avatar_id ?? user.avatar_id ?? null,
        avatar_crop: sessionData?.profile?.avatar_crop ?? user.avatar_crop ?? null,
        avatar_frame_id: sessionData?.profile?.avatar_frame_id ?? user.avatar_frame_id ?? null,
        display_name: sessionData?.profile?.display_name ?? user.display_name ?? null
      }
    : null;
  event.locals.profile = sessionData?.profile || null;
  event.locals.authState = authState;
  event.locals.role = role;

  // Strict fail-closed security for administrative areas
  if (event.url.pathname.startsWith('/admin')) {
    if (event.locals.authState === 'AUTH_PENDING' || event.locals.authState === 'AUTH_ERROR') {
      return new Response(JSON.stringify({ message: 'A verificação da equipe está temporariamente em recuperação. Tente novamente em instantes.' }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    if (!event.locals.user) {
      return new Response(null, {
        status: 303,
        headers: {
          'Location': `/entrar?redirect=${encodeURIComponent(event.url.pathname + event.url.search)}`,
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    if (!['STAFF_SITE', 'ADMIN', 'EDITOR', 'GERENTE'].includes(event.locals.role || '')) {
      return new Response(JSON.stringify({ message: 'Esta área é exclusiva da equipe editorial.' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    if (event.url.pathname.startsWith('/admin/gestao') && event.locals.role !== 'ADMIN') {
      return new Response(JSON.stringify({ message: 'Esta área é exclusiva dos administradores.' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
  }

  const resolved = await resolve(event, {
    filterSerializedResponseHeaders: (name: string) => name === 'content-range'
  });

  // Media and static assets handle their own caching and security headers; return immediately
  if (isMedia || isStaticAsset) {
    return resolved;
  }

  const response = new Response(resolved.body, resolved);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (event.url.protocol === 'https:') response.headers.set('Strict-Transport-Security', 'max-age=31536000');
  
  const totalDuration = Math.round(performance.now() - reqStart);
  const renderDuration = Math.max(0, totalDuration - authDuration);
  response.headers.set('Server-Timing', `auth;dur=${authDuration}, render;dur=${renderDuration}, total;dur=${totalDuration}`);

  // Only the default anonymous Home document is safe to share. Personalized
  // pages (including anonymous age/blur preferences) remain strictly private.
  // Static assets and media endpoints handle their own caching headers.
  if (!isMedia && !isStaticAsset) {
    const isHtml = response.headers.get('content-type')?.includes('text/html') || event.request.headers.get('accept')?.includes('text/html');
    const hasHomePreference = Boolean(event.cookies.get('nox-age-status') || event.cookies.get('nox-blur-nsfw'));
    const isSharedAnonymousHome =
      isHtml &&
      event.request.method === 'GET' &&
      event.url.pathname === '/' &&
      !event.url.search &&
      !user &&
      !hasAuthCookie &&
      !hasHomePreference;

    const isPrivateArea =
      user ||
      hasAuthCookie ||
      event.url.pathname.startsWith('/admin') ||
      event.url.pathname.startsWith('/auth') ||
      event.url.pathname.startsWith('/me') ||
      event.url.pathname === '/scan' ||
      event.url.pathname.startsWith('/scan/') ||
      event.url.pathname.startsWith('/perfil') ||
      event.url.pathname.startsWith('/biblioteca') ||
      event.url.pathname.startsWith('/favoritos') ||
      event.url.pathname.startsWith('/historico') ||
      event.url.pathname.startsWith('/notificacoes');

    const existingCacheControl = response.headers.get('Cache-Control') || '';
    const isExplicitlyPublic = existingCacheControl.includes('public');
    const hasExplicitCache = existingCacheControl.length > 0 && !existingCacheControl.includes('no-store');

    if (isPrivateArea) {
      response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      response.headers.set('Vary', 'Cookie, Accept');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    } else if (isExplicitlyPublic) {
      // Preserve explicit public caching configured by public routes (+page.server.ts)
      response.headers.set('Vary', 'Accept');
    } else if (hasExplicitCache) {
      // Preserve explicit private max-age caching (e.g. for anonymous user with adult/blur preferences)
      response.headers.set('Vary', 'Cookie, Accept');
    } else if (isSharedAnonymousHome) {
      response.headers.set('Cache-Control', 'public, max-age=30, s-maxage=30, stale-while-revalidate=60');
      response.headers.set('Vary', 'Accept');
    } else if (response.status >= 400) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    } else if (isHtml) {
      response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      response.headers.set('Vary', 'Cookie, Accept');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    }
  }
  if (
    /^\/(?:admin|auth|api|entrar|cadastrar|recuperar|redefinir|perfil|biblioteca|favoritos|historico|notificacoes|ler)(?:\/|$)/.test(
      event.url.pathname
    )
  )
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');

  return response;
}

export const handle: Handle = async ({ event, resolve }) => {
  const reqStart = performance.now();

  const isPrerenderableStatic = building || event.url.pathname === '/sobre' || event.url.pathname === '/privacidade';
  if (isPrerenderableStatic) {
    return handleRequest(event, resolve, reqStart);
  }

  return withYugabyteReadSession(
    event.platform?.env,
    async (sessionEnv) => {
      const platform = event.platform as any;
      const previousEnv = platform?.env;
      if (platform && sessionEnv) {
        platform.env = sessionEnv;
      }
      try {
        return await handleRequest(event, resolve, reqStart);
      } finally {
        // event.platform can be shared by workerd/test:browser. Do not retain
        // a request-scoped (and soon closed) read session on it.
        if (platform && sessionEnv) {
          platform.env = previousEnv;
        }
      }
    },
    2
  );
};

export const handleError = ({ error, event }: any) => {
  console.error('[UNHANDLED SERVER ERROR]:', error, event?.url?.href);
  return {
    message: (error as any)?.message || 'Erro interno no servidor'
  };
};

