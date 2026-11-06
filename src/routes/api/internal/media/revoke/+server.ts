import { json, error, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { revokeMedia, unrevokeMedia } from '$lib/server/media-revocation';
import { extractFullAuthCookie, decodeSessionJwt, resolveSessionData } from '$lib/server/session-cache';

function safeTokenCompare(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(provided);
  const b = encoder.encode(expected);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export const POST: RequestHandler = async ({ request, url, platform, cookies }) => {
  const expectedToken = platform?.env?.NOX_STORAGE_BRIDGE_TOKEN || env.NOX_STORAGE_BRIDGE_TOKEN;
  const authHeader = request.headers.get('authorization') || '';
  let isAuthorized = false;

  // 1. Check bridge token
  if (expectedToken && authHeader.startsWith('Bearer ') && safeTokenCompare(authHeader.slice(7).trim(), expectedToken)) {
    isAuthorized = true;
  }

  // 2. Check admin session cookie if bridge token was not provided
  if (!isAuthorized) {
    const rawCookie = extractFullAuthCookie(cookies.getAll());
    const token = rawCookie || (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');
    if (token) {
      const { jwt, accessToken } = decodeSessionJwt(token);
      if (jwt) {
        try {
          const session = await resolveSessionData(null, jwt, accessToken, platform?.env);
          if (['STAFF_SITE', 'ADMIN', 'EDITOR'].includes(session?.role || '')) {
            isAuthorized = true;
          }
        } catch {}
      }
    }
  }

  if (!isAuthorized) {
    error(401, 'Não autorizado');
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    error(400, 'JSON inválido');
  }

  const mediaIds: string[] = Array.isArray(body?.mediaIds)
    ? body.mediaIds
    : body?.mediaId
    ? [body.mediaId]
    : [];

  if (mediaIds.length === 0) {
    error(400, 'mediaId ou mediaIds obrigatório');
  }

  const cache = typeof caches !== 'undefined' && (caches as any).default ? (caches as any).default : null;
  const kv = platform?.env?.COVER_THUMBNAILS;
  const results = [];

  for (const id of mediaIds) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
    const res = await revokeMedia(id, {
      kv,
      cache,
      origin: url.origin,
      reason: body.reason || 'MANUAL_REVOCATION',
      accessClass: body.accessClass,
      status: body.status
    });
    results.push(res);
  }

  return json({
    success: true,
    revokedCount: results.length,
    results
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  });
};
