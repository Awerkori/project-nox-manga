import { json, error, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { revokeMedia, unrevokeMedia } from '$lib/server/media-revocation';
import { invalidateMediaMetadataCache } from '$lib/server/yugabyte';

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

  const rawIds: string[] = Array.isArray(body?.mediaIds)
    ? body.mediaIds
    : body?.mediaId
    ? [body.mediaId]
    : [];

  if (rawIds.length === 0) {
    error(400, 'mediaId ou mediaIds obrigatório');
  }

  const cache = typeof caches !== 'undefined' && (caches as any).default ? (caches as any).default : null;
  const kv = platform?.env?.COVER_THUMBNAILS;

  const isUnrevoke = body?.action === 'unrevoke' || body?.action === 'restore';
  const processedIds: string[] = [];
  const revokedIds: string[] = [];
  const restoredIds: string[] = [];
  const pendingIds: string[] = [];
  const invalidIds: string[] = [];
  const errors: Array<{ mediaId: string; error: string }> = [];
  const results: any[] = [];

  for (const rawId of rawIds) {
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      invalidIds.push(id);
      continue;
    }

    processedIds.push(id);
    invalidateMediaMetadataCache(id);
    try {
      const res = isUnrevoke
        ? await unrevokeMedia(id, {
            kv,
            cache,
            ctx: platform?.context || platform?.ctx,
            origin: url.origin,
            reason: body.reason || 'MANUAL_RESTORATION'
          })
        : await revokeMedia(id, {
            kv,
            cache,
            ctx: platform?.context || platform?.ctx,
            origin: url.origin,
            reason: body.reason || 'MANUAL_REVOCATION',
            accessClass: body.accessClass,
            status: body.status,
            requirePurgeDispatch: true
          });

      if (res.success && res.errors.length === 0) {
        if (isUnrevoke) {
          restoredIds.push(id);
        } else {
          revokedIds.push(id);
        }
      } else {
        pendingIds.push(id);
        errors.push({ mediaId: id, error: res.errors.join('; ') || (isUnrevoke ? 'PARTIAL_RESTORATION_FAILURE' : 'PARTIAL_REVOCATION_FAILURE') });
      }
      results.push(res);
    } catch (err: any) {
      pendingIds.push(id);
      errors.push({ mediaId: id, error: err?.message || (isUnrevoke ? 'RESTORATION_FAILED' : 'REVOCATION_FAILED') });
    }
  }

  const allSucceeded = errors.length === 0 && invalidIds.length === 0;

  return json({
    success: allSucceeded,
    action: isUnrevoke ? 'unrevoke' : 'revoke',
    revokedCount: revokedIds.length,
    restoredCount: restoredIds.length,
    totalRequested: rawIds.length,
    processedIds,
    revokedIds,
    restoredIds,
    pendingIds,
    invalidIds,
    errors,
    retryRequired: errors.length > 0,
    results
  }, {
    status: allSucceeded ? 200 : 207,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  });
};
