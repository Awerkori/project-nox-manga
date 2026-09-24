import { svelteKitHandler } from "better-auth/svelte-kit";
import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import {
  resolveSessionData,
  extractSessionToken,
  getCachedAuthSession,
  setCachedAuthSession,
  invalidateAuthSession
} from '$lib/server/session-cache';
import { withDbScope } from '$lib/server/db';

import { withTimeout } from '$lib/server/resilience';
import { verifySessionUploadToken } from '$lib/server/staff-tokens';

export const handle: Handle = async ({ event, resolve }) => {
  return await withDbScope(async () => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.request.method)) {
    const isInternal = event.url.pathname.startsWith('/api/internal/');
    const isApiCompat = event.url.pathname.startsWith('/api/compat/');
    const isStaffApi = event.url.pathname.startsWith('/api/staff/');
    const hasBearer = (event.request.headers.get('authorization') || '').toLowerCase().startsWith('bearer ');
    const origin = event.request.headers.get('origin');

    // Only enforce strict browser Origin header on web browser requests with cookies, not external API clients
    if (!isInternal && !isApiCompat && !(isStaffApi && hasBearer)) {
      if (origin && origin !== event.url.origin) error(403, 'Origem inválida');
    }

    const isScanProductionUpload = event.url.pathname === '/api/scan/production/upload';
    const isPageUpload =
      event.url.pathname.startsWith('/api/staff/uploads/') ||
      event.url.pathname.startsWith('/api/compat/mangadex/upload');
    const max = isScanProductionUpload
      ? 524_288_000
      : isPageUpload ||
        event.url.pathname === '/api/upload' ||
        event.url.pathname === '/api/internal/storage/upload' ||
        event.url.pathname === '/api/avatar' ||
        event.url.pathname === '/api/banner'
        ? 52_428_800
        : 10_000_000;
    if (Number(event.request.headers.get('content-length') || 0) > max)
      error(413, 'Arquivo ou solicitação acima do limite');
  }

  // Fast path 1: Session-scoped upload token for high-throughput page uploads (0 DB queries)
  if (event.url.pathname.startsWith('/api/staff/uploads/')) {
    const uploadTokenHeader = event.request.headers.get('x-upload-token') || '';
    const authHdr = event.request.headers.get('authorization') || '';
    const candidateUpt = uploadTokenHeader || (authHdr.toLowerCase().startsWith('bearer nox_upt_') ? authHdr.slice(7).trim() : '');

    if (candidateUpt.startsWith('nox_upt_')) {
      const verified = verifySessionUploadToken(candidateUpt);
      if (verified) {
        event.locals.session = null;
        event.locals.user = { id: verified.userId } as any;
        event.locals.profile = { username: 'staff' } as any;
        event.locals.role = verified.role;
        event.locals.userScans = [];
        event.locals.unread = 0;
        event.locals.authTimeout = false;

        const response = await resolve(event);
        response.headers.set('X-Nox-Deploy', 'auth-fix-final-v2');
        return response;
      }
    }
  }

  // Fast path 2: Session resolution with Token Cache (0 DB queries on cache hit) and resilient timeout fallback
  let session: any = null;
  let authTimedOut = false;
  const cookieHeader = event.request.headers.get('cookie') || '';
  const authHeader = event.request.headers.get('authorization') || '';
  const hasPossibleSession = cookieHeader.includes('better-auth') || cookieHeader.includes('session') || authHeader.length > 0;
  const sessionToken = hasPossibleSession ? extractSessionToken(event.request.headers) : null;

  if (hasPossibleSession) {
    // 1. Try hot in-memory session cache first (0 DB queries, 0ms latency)
    if (sessionToken) {
      const cached = getCachedAuthSession(sessionToken);
      if (cached && !cached.isStale) {
        session = cached.session;
      }
    }

    // 2. If not hot in cache, verify via Better-Auth with generous timeout
    if (!session) {
      try {
        session = await withTimeout(
          auth.api.getSession({
            headers: event.request.headers
          }),
          2500,
          '__AUTH_TIMEOUT__' as any,
          'better_auth_session',
          'AUTH'
        );

        if (session === '__AUTH_TIMEOUT__') {
          authTimedOut = true;
          session = null;
          // Fallback to stale cached session if available during DB latency spike
          if (sessionToken) {
            const staleCached = getCachedAuthSession(sessionToken);
            if (staleCached) {
              session = staleCached.session;
            }
          }
        } else if (session && sessionToken) {
          setCachedAuthSession(sessionToken, session);
        } else if (!session && sessionToken) {
          // Explicitly unauthenticated: invalidate cache
          invalidateAuthSession(sessionToken);
        }
      } catch {
        session = null;
        if (sessionToken) {
          const staleCached = getCachedAuthSession(sessionToken);
          if (staleCached) {
            session = staleCached.session;
          } else {
            authTimedOut = true;
          }
        }
      }
    }
  }

  event.locals.authTimeout = authTimedOut && !session;

  if (session && session.user) {
    try {
      const sessionData = await withTimeout(
        resolveSessionData(session),
        1500,
        { profile: null, role: null, userScans: [], unread: 0 } as any,
        'resolve_session_data',
        'AUTH'
      );
      event.locals.session = session.session;
      event.locals.user = session.user;
      event.locals.profile = sessionData.profile;
      event.locals.role = sessionData.role;
      event.locals.userScans = sessionData.userScans || [];
      event.locals.unread = sessionData.unread || 0;
      event.locals.sessionCache = sessionData;
    } catch {
      event.locals.session = session.session;
      event.locals.user = session.user;
      event.locals.profile = null;
      event.locals.role = null;
      event.locals.userScans = [];
      event.locals.unread = 0;
      event.locals.sessionCache = null;
    }
  } else {
    event.locals.session = null;
    event.locals.user = null;
    event.locals.profile = null;
    event.locals.role = null;
    event.locals.sessionCache = null;
    event.locals.userScans = [];
    event.locals.unread = 0;
  }

  
  const response = await svelteKitHandler({ event, resolve, auth });
  response.headers.set('X-Nox-Deploy', 'auth-fix-final-v1');

  if (event.url.pathname.startsWith('/admin') || event.url.pathname.startsWith('/api/admin')) {
    response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
  }

  return response;
  });
};
