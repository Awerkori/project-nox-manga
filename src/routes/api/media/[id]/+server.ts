import { error } from '@sveltejs/kit';
import { matchesETag } from '$lib/server/mihon';
import {
  resolveBotDownloadClient,
  normalizeBotReference,
  deduceMangaShardFromFileId
} from '$lib/server/storage-router';
import { TelegramStorageError } from '$lib/server/telegram';
import { extractFullAuthCookie, decodeSessionJwt, resolveSessionData } from '$lib/server/session-cache';
import { fetchMediaMetadataFromYugabyte, executeYugabyteSql, invalidateMediaMetadataCache } from '$lib/server/yugabyte';
import { classifyMediaAccess, purgeMediaVariants, isMediaRevoked } from '$lib/server/media-revocation';

async function downloadWithTransientRetry(
  client: { download: (fileId: string) => Promise<ReadableStream<Uint8Array>> },
  fileId: string
) {
  try {
    return await client.download(fileId);
  } catch (failure) {
    const status = failure instanceof TelegramStorageError ? failure.status : undefined;
    if (status === undefined || status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return client.download(fileId);
    }
    throw failure;
  }
}

async function isAuthorizedForMedia(
  mediaMeta: any,
  classification: ReturnType<typeof classifyMediaAccess>,
  cookies: any,
  request: Request,
  platformEnv?: any
): Promise<{
  allowed: boolean;
  isAdultRestricted: boolean;
  isAdultAllowed: boolean;
  isStaff: boolean;
  isOwner: boolean;
  isAuthenticatedAllowed: boolean;
}> {
  if (classification.isPublic) {
    return {
      allowed: true,
      isAdultRestricted: false,
      isAdultAllowed: false,
      isStaff: false,
      isOwner: false,
      isAuthenticatedAllowed: false
    };
  }
  let verifiedSession = null;
  const rawCookie = extractFullAuthCookie(cookies.getAll());
  const authHeader = request.headers.get('authorization') || '';
  const token = rawCookie || (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');
  if (token) {
    const { jwt, accessToken } = decodeSessionJwt(token);
    if (jwt) {
      try {
        verifiedSession = await resolveSessionData(null, jwt, accessToken, platformEnv);
      } catch {
        // Authentication resolution failure
      }
    }
  }
  const isStaff = ['STAFF_SITE', 'ADMIN', 'EDITOR'].includes(verifiedSession?.role || '');
  const isOwner = Boolean(verifiedSession?.user?.id && mediaMeta.created_by === verifiedSession.user.id);
  const isAuthenticatedAllowed = mediaMeta.access_class === 'AUTHENTICATED' && Boolean(verifiedSession?.user?.id);
  const isAdultRestricted = classification.category === 'RESTRICTED' && classification.reason === 'CONTENT_RATING_ADULT_18';
  let isAdultAllowed = false;
  if (isAdultRestricted) {
    const ageCookie = cookies.get('nox-age-status');
    const sessionAgeStatus = verifiedSession?.profile?.age_status;
    if (isStaff || isOwner || ageCookie === 'ADULT' || sessionAgeStatus === 'ADULT') {
      isAdultAllowed = true;
    }
  }
  const allowed = isStaff || isOwner || isAuthenticatedAllowed || isAdultAllowed;
  return { allowed, isAdultRestricted, isAdultAllowed, isStaff, isOwner, isAuthenticatedAllowed };
}

/**
 * Dedicated private/authenticated media endpoint.
 * Intentionally outside /media/* to guarantee that Cloudflare zone Cache Rules
 * NEVER cache, store, or distribute private/staff/internal images on edge.
 */
export const GET = async ({ locals: _locals, params, request, platform, cookies }: any) => {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) error(404);

  const media: any = await fetchMediaMetadataFromYugabyte(params.id, platform?.env, { forceFresh: true });
  if (!media || media.storage_ready !== true || media.status !== 'ACTIVE') {
    if (media && media.status !== 'ACTIVE') {
      invalidateMediaMetadataCache(params.id);
      const cache = platform?.caches?.default || (typeof caches !== 'undefined' && (caches as any).default ? (caches as any).default : null);
      if (cache || platform?.context?.cache) {
        const reqUrl = new URL(request.url);
        const purgeTask = purgeMediaVariants(params.id, {
          cache,
          ctx: platform?.context || platform?.ctx,
          origin: reqUrl.origin,
          requirePurgeDispatch: true
        }).catch(() => {});
        if (platform?.context?.waitUntil) {
          platform.context.waitUntil(purgeTask);
        }
      }
    }
    return new Response(JSON.stringify({ error: 'Mídia não encontrada' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }

  if (await isMediaRevoked(params.id, platform?.env?.COVER_THUMBNAILS, { checkTombstone: true, allowActivePrivate: true })) {
    return new Response(request.method === 'HEAD' ? null : JSON.stringify({ error: 'Acesso não autorizado' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }

  const accessClassification = classifyMediaAccess(media);
  const isPublic = accessClassification.isPublic;

  // For non-public media, require authentic cryptographic verification
  if (!isPublic) {
    const authCheck = await isAuthorizedForMedia(media, accessClassification, cookies, request, platform?.env);
    if (!authCheck.allowed) {
      return new Response(request.method === 'HEAD' ? null : JSON.stringify({
        error: authCheck.isAdultRestricted ? 'Conteúdo restrito a maiores de 18 anos' : 'Acesso não autorizado',
        age_restricted: authCheck.isAdultRestricted
      }), {
        status: authCheck.isAdultRestricted ? 403 : 404,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
          'CDN-Cache-Control': 'no-store',
          'Cloudflare-CDN-Cache-Control': 'no-store',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Vary': 'Cookie, Authorization'
        }
      });
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': media.mime || 'image/jpeg',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Vary': 'Cookie, Authorization',
    'Accept-Ranges': 'bytes',
    'ETag': `"${media.sha256}"`,
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Media-Privacy': isPublic ? 'PUBLIC' : 'PRIVATE-AUTHENTICATED'
  };

  if (matchesETag(request.headers.get('if-none-match'), headers.ETag)) {
    return new Response(null, { status: 304, headers });
  }

  const ifMatch = request.headers.get('if-match');
  if (ifMatch && ifMatch !== '*' && headers.ETag) {
    const matchEtags = ifMatch.split(',').map((s: string) => s.trim());
    if (!matchEtags.includes(headers.ETag.trim()) || headers.ETag.startsWith('W/')) {
      return new Response(null, { status: 412, headers });
    }
  }

  if (request.method === 'HEAD') {
    if (media.bytes && Number(media.bytes) > 0) {
      headers['Content-Length'] = String(media.bytes);
    }
    return new Response(null, { status: 200, headers });
  }

  let body: BodyInit;
  if (media.provider === 'supabase') {
    return new Response(JSON.stringify({ error: 'Mídia legada descontinuada' }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  } else {
    let botRef = media.bot_reference;
    const shardId = media.storage_shard_id;

    if (shardId && (!botRef || botRef === 'primary')) {
      const shardRes = await executeYugabyteSql(
        'SELECT bot_reference FROM storage_shards WHERE id = $1 LIMIT 1;',
        [shardId],
        platform?.env
      ).catch(() => ({ rows: [] as any[] }));
      if (shardRes.rows[0]?.bot_reference) {
        botRef = shardRes.rows[0].bot_reference;
      }
    }

    if (!botRef || botRef === 'primary') {
      const deduced = deduceMangaShardFromFileId(media.provider_key);
      if (deduced) {
        botRef = deduced.botRef;
      }
    }

    botRef = normalizeBotReference(botRef);
    const client = resolveBotDownloadClient(botRef);

    try {
      body = await downloadWithTransientRetry(client, media.provider_key);
    } catch {
      return new Response(JSON.stringify({ error: 'Arquivo temporariamente indisponível' }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }
  }

  // Re-verify authoritative revocation status after download to prevent leaking in-flight revoked media
  let isRevoked = await isMediaRevoked(params.id, platform?.env?.COVER_THUMBNAILS, { checkTombstone: true, allowActivePrivate: true });

  if (!isRevoked) {
    try {
      const freshMeta: any = await fetchMediaMetadataFromYugabyte(params.id, platform?.env, { forceFresh: true });
      if (!freshMeta || freshMeta.storage_ready !== true || freshMeta.status !== 'ACTIVE') {
        isRevoked = true;
        invalidateMediaMetadataCache(params.id);
      } else {
        const freshClassification = classifyMediaAccess(freshMeta);
        if (!freshClassification.isPublic) {
          const authCheck = await isAuthorizedForMedia(freshMeta, freshClassification, cookies, request, platform?.env);
          if (!authCheck.allowed) {
            isRevoked = true;
            invalidateMediaMetadataCache(params.id);
          }
        }
      }
    } catch {
      isRevoked = true;
    }
  }

  if (isRevoked) {
    return new Response(request.method === 'HEAD' ? null : JSON.stringify({ error: 'Acesso não autorizado' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }

  if (media.bytes && Number(media.bytes) > 0) {
    headers['Content-Length'] = String(media.bytes);
  }

  const rangeHeader = request.headers.get('range');
  const ifRange = request.headers.get('if-range');
  const currentEtag = headers['ETag'] ? String(headers['ETag']).trim() : null;
  let evaluateRange = Boolean(rangeHeader && request.method === 'GET');
  if (evaluateRange && ifRange) {
    // RFC 9110 §13.1.5: Strong validator comparison only. Weak ETags MUST NOT match.
    if (!currentEtag || ifRange.trim().startsWith('W/') || ifRange.trim() !== currentEtag) {
      evaluateRange = false;
    }
  }

  // Parse single byte range. Multi-range or invalid syntax is ignored per RFC 9110 §14.1.1 & §14.2
  const rangeMatch = evaluateRange && rangeHeader ? rangeHeader.trim().match(/^bytes=(\d*)-(\d*)$/) : null;
  const isRangeValid = Boolean(rangeMatch && (rangeMatch[1] !== '' || rangeMatch[2] !== ''));

  if (isRangeValid && rangeMatch) {
    const toUint8Array = async (b: BodyInit): Promise<Uint8Array> => {
      if (b instanceof Uint8Array) return b;
      if (b instanceof ArrayBuffer) return new Uint8Array(b);
      if (b && typeof (b as any).getReader === 'function') {
        const reader = (b as ReadableStream<Uint8Array>).getReader();
        const chunks: Uint8Array[] = [];
        let totalLen = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            totalLen += value.length;
          }
        }
        const combined = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          combined.set(c, offset);
          offset += c.length;
        }
        return combined;
      }
      return new Uint8Array();
    };

    const bytes = body instanceof Uint8Array ? body : await toUint8Array(body);
    const total = bytes.byteLength;
    let start: number;
    let end: number;
    if (rangeMatch[1] === '' && rangeMatch[2] !== '') {
      const suffixLen = parseInt(rangeMatch[2], 10);
      if (suffixLen === 0 || total === 0) {
        return new Response(null, {
          status: 416,
          headers: { ...headers, 'Content-Range': `bytes */${total}` }
        });
      }
      start = Math.max(0, total - suffixLen);
      end = total - 1;
    } else {
      start = rangeMatch[1] ? parseInt(rangeMatch[1], 10) : 0;
      end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : total - 1;
    }

    if (start >= total || start > end || total === 0) {
      return new Response(null, {
        status: 416,
        headers: { ...headers, 'Content-Range': `bytes */${total}` }
      });
    }

    const actualEnd = Math.min(end, total - 1);
    const sliced = bytes.subarray(start, actualEnd + 1);
    const rangeHeaders = {
      ...headers,
      'Content-Range': `bytes ${start}-${actualEnd}/${total}`,
      'Content-Length': String(sliced.byteLength)
    };
    return new Response(sliced, { status: 206, headers: rangeHeaders });
  }

  return new Response(body, { status: 200, headers });
};

export const HEAD = GET;
