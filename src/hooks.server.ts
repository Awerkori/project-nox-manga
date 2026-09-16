import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { resolveSessionData } from '$lib/server/session-cache';

export const handle: Handle = async ({ event, resolve }) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.request.method)) {
    const isInternal = event.url.pathname.startsWith('/api/internal/');
    if (!isInternal && event.request.headers.get('origin') !== event.url.origin) error(403, 'Origem inválida');
    const isScanProductionUpload = event.url.pathname === '/api/scan/production/upload';
    const max = isScanProductionUpload
      ? 524_288_000
      : event.url.pathname === '/api/upload' ||
        event.url.pathname === '/api/internal/storage/upload' ||
        event.url.pathname === '/api/avatar' ||
        event.url.pathname === '/api/banner'
        ? 52_428_800
        : 10_000_000;
    if (Number(event.request.headers.get('content-length') || 0) > max)
      error(413, 'Arquivo ou solicitação acima do limite');
  }

  // Better Auth integration
  const session = await auth.api.getSession({
    headers: event.request.headers
  });

  if (session && session.user) {
    const sessionData = await resolveSessionData(session);
    event.locals.session = sessionData.user ? session.session : null;
    event.locals.user = sessionData.user || null;
    event.locals.profile = sessionData.profile;
    event.locals.role = sessionData.role;
    event.locals.userScans = sessionData.userScans;
    event.locals.unread = sessionData.unread;
  } else {
    event.locals.session = null;
    event.locals.user = null;
    event.locals.profile = null;
    event.locals.role = null;
    event.locals.userScans = [];
    event.locals.unread = 0;
  }

  return resolve(event);
};
