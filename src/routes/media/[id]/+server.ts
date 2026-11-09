import { error } from '@sveltejs/kit';
import { matchesETag } from '$lib/server/mihon';
import {
  resolveBotDownloadClient,
  normalizeBotReference,
  deduceMangaShardFromFileId
} from '$lib/server/storage-router';
import { TelegramStorageError } from '$lib/server/telegram';
import { extractFullAuthCookie, decodeSessionJwt, resolveSessionData } from '$lib/server/session-cache';
import { generateThumbnail } from '$lib/server/thumbnail';
import { fetchMediaMetadataFromYugabyte, executeYugabyteSql, invalidateMediaMetadataCache } from '$lib/server/yugabyte';
import {
  MAX_COVER_THUMBNAIL_BYTES,
  persistCoverThumbnail,
  readBoundedCoverResponse,
  readCoverThumbnail
} from '$lib/server/cover-thumbnail-cache';
import { isMediaRevoked, purgeMediaVariants, classifyMediaAccess } from '$lib/server/media-revocation';

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

const COVER_BODY_IDLE_TIMEOUT_MS = 12_000;
const storageShardBotCache = new Map<string, string>();

async function downloadCoverWithTransientRetry(
  client: { download: (fileId: string) => Promise<ReadableStream<Uint8Array>> },
  fileId: string
) {
  try {
    return await client.download(fileId);
  } catch (failure) {
    const status = failure instanceof TelegramStorageError ? failure.status : undefined;
    // A single bounded retry covers transient Telegram/network failures without
    // turning a broken cover into an unbounded request loop or rate-limit storm.
    if (status === undefined || status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return client.download(fileId);
    }
    throw failure;
  }
}

async function toUint8Array(body: BodyInit, idleTimeoutMs = COVER_BODY_IDLE_TIMEOUT_MS): Promise<Uint8Array> {
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (body && typeof (body as any).getReader === 'function') {
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const next = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('cover body timed out')), idleTimeoutMs);
          })
        ]).finally(() => {
          if (timer) clearTimeout(timer);
        });
        const { done, value } = next;
        if (done) break;
        if (value) {
          chunks.push(value);
          total += value.length;
        }
      }
    } catch (failure) {
      await reader.cancel().catch(() => {});
      throw failure;
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      result.set(c, offset);
      offset += c.length;
    }
    return result;
  }
  return new Uint8Array();
}

async function downloadTelegramMedia(
  client: { download: (fileId: string) => Promise<ReadableStream<Uint8Array>> },
  providerKey: string
): Promise<ReadableStream<Uint8Array> | Uint8Array> {
  if (providerKey.startsWith('tgc:')) {
    const rawChunks = providerKey.slice(4).split(',');
    const downloaded: Uint8Array[] = [];
    for (const chunk of rawChunks) {
      const fileId = chunk.split(':')[0].trim();
      if (!fileId) continue;
      const stream = await downloadCoverWithTransientRetry(client, fileId);
      const bytes = await toUint8Array(stream);
      downloaded.push(bytes);
    }
    const totalBytes = downloaded.reduce((acc, c) => acc + c.length, 0);
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const c of downloaded) {
      combined.set(c, offset);
      offset += c.length;
    }
    return combined;
  }
  return downloadCoverWithTransientRetry(client, providerKey);
}

export const GET = async ({ locals: _locals, params, request, platform, cookies }: any) => {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) error(404);

  // Preserve heavy 31MB uncompressed original and typo alias by redirecting to the 5.6MB optimized animated avatar
  if (params.id === 'bdaa2c94-260c-4f9c-85dc-edfc196815f1' || params.id === '4c812f93-6bb1-40f9-9151-dc2d20e86e5e') {
    const isRevoked = await isMediaRevoked(params.id, platform?.env?.COVER_THUMBNAILS);
    if (isRevoked) {
      return new Response(JSON.stringify({ error: 'Acesso não autorizado' }), {
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
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/media/4c86bd8d-1ad8-4142-a660-55fc0824b22a',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400'
      }
    });
  }

  // 1. Check Cloudflare Edge Cache first for instantaneous sub-millisecond response
  const url = new URL(request.url);
  const sizeParam = url.searchParams.get('size');
  const coverVariant = sizeParam === 'thumb' || sizeParam === 'hero' ? sizeParam : null;
  const expectedWarmToken = platform?.env?.NOX_STORAGE_BRIDGE_TOKEN;
  const auth = request.headers.get('authorization') || '';
  const internalCoverWarm = Boolean(
    coverVariant && expectedWarmToken && auth.startsWith('Bearer ') &&
    safeTokenCompare(auth.slice(7).trim(), expectedWarmToken)
  );
  // Do not reuse immutable v1/v2 thumbnails. v3 also avoids the old cold path
  // that buffered a complete small original merely to make a thumbnail.
  const canonicalUrl = coverVariant ? `${url.origin}/media/${params.id}?size=${coverVariant}&v=3` : `${url.origin}/media/${params.id}`;
  const cacheKey = new Request(canonicalUrl, { method: 'GET' });
  const cache = platform?.caches?.default || (typeof caches !== 'undefined' && (caches as any).default ? (caches as any).default : null);
  const hasAuth = Boolean(auth) || Boolean(extractFullAuthCookie(cookies.getAll()));
  const ctx = platform?.context || platform?.ctx;
  const waitUntil = typeof ctx?.waitUntil === 'function' ? ctx.waitUntil.bind(ctx) : undefined;
  if (cache && !internalCoverWarm && !hasAuth) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached && cached.status === 200) {
        const isRevoked = await isMediaRevoked(params.id, platform?.env?.COVER_THUMBNAILS, { failClosed: true });
        if (isRevoked) {
          const purgeOptions = {
            cache,
            ctx,
            origin: url.origin,
            currentUrl: request.url,
            requirePurgeDispatch: true
          };
          if (waitUntil) {
            waitUntil(purgeMediaVariants(params.id, purgeOptions));
          } else {
            await purgeMediaVariants(params.id, purgeOptions);
          }
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
        const etag = cached.headers.get('ETag');
        if (etag && request.headers.get('if-none-match') === etag) {
          const res = new Response(null, { status: 304, headers: cached.headers });
          res.headers.set('X-Media-Cache', 'HIT');
          return res;
        }
        const res = new Response(cached.body, cached);
        res.headers.set('X-Media-Cache', 'HIT');
        return res;
      }
    } catch {
      // Fall through to standard retrieval on cache check failure
    }
  }

  const media: any = await fetchMediaMetadataFromYugabyte(params.id, platform?.env, { forceFresh: true });
  if (!media || media.storage_ready !== true || media.status !== 'ACTIVE') {
    if (media && media.status !== 'ACTIVE') {
      invalidateMediaMetadataCache(params.id);
      if (cache || platform?.context?.cache) {
        const purgeTask = purgeMediaVariants(params.id, {
          cache,
          ctx,
          origin: url.origin,
          requirePurgeDispatch: true
        }).catch(() => {});
        if (waitUntil) {
          waitUntil(purgeTask);
        }
      }
    }
    return new Response(request.method === 'HEAD' ? null : JSON.stringify({ error: 'Mídia não encontrada' }), {
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

  if (await isMediaRevoked(params.id, platform?.env?.COVER_THUMBNAILS, { checkTombstone: true })) {
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

  // Authoritative Media Access Classification
  const accessClassification = classifyMediaAccess(media);
  let isPublic = accessClassification.isPublic;

  if (!isPublic) {
    const authCheck = await isAuthorizedForMedia(media, accessClassification, cookies, request, platform?.env);
    if (!authCheck.allowed) {
      // NOTE: Leitura não autorizada NÃO é revogação administrativa; não grava tombstone nem altera manifesto KV.
      // Porém, purga qualquer cache público residual da borda para garantir fail-closed contra entradas antigas.
      if (cache || platform?.context?.cache) {
        const purgePromise = purgeMediaVariants(params.id, {
          cache,
          ctx,
          origin: url.origin,
          currentUrl: request.url,
          requirePurgeDispatch: true
        }).catch(() => {});
        if (waitUntil) {
          waitUntil(purgePromise);
        }
      }
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

    if (authCheck.isAdultAllowed && !authCheck.isStaff && !authCheck.isOwner && !authCheck.isAuthenticatedAllowed) {
      // Proceed to serve the media, but ensure headers are strictly private
    } else if (media.access_class !== 'PUBLIC' && !authCheck.isAdultRestricted) {
      // Authorized access to non-public media: redirect to dedicated private endpoint
      // to strictly prevent edge CDN caching under the /media/* zone rule.
      return new Response(null, {
        status: 307,
        headers: {
          'Location': `/api/media/${params.id}${url.search}`,
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

  const isPrivateDelivery = !isPublic || accessClassification.category === 'RESTRICTED';
  const headers: Record<string, string> = {
    'Content-Type': media.mime || 'image/jpeg',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
    'CDN-Cache-Control': 'public, max-age=31536000',
    'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000',
    'Cache-Tag': `media-${params.id},media-public`,
    'X-Cache-Tag': `media-${params.id},media-public`,
    'ETag': `"${media.sha256}"`,
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Access-Control-Allow-Origin': '*',
    'Accept-Ranges': 'bytes',
    'X-Media-Cache': 'MISS'
  };

  if (isPrivateDelivery) {
    headers['Cache-Control'] = 'private, no-cache, no-store, must-revalidate, max-age=0';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
    headers['CDN-Cache-Control'] = 'no-store';
    headers['Cloudflare-CDN-Cache-Control'] = 'no-store';
    headers['Vary'] = 'Cookie, Authorization';
    delete headers['Cache-Tag'];
    delete headers['X-Cache-Tag'];
  }

  // Cover thumbnails are derived public media. When verified active and public via authoritative DB,
  // prewarmed KV thumbnails eliminate cold Telegram round-trips and CPU resize operations.
  // Never serve KV thumbnails for private, restricted, or unverified media.
  if (coverVariant && isPublic && platform?.env?.COVER_THUMBNAILS) {
    const prewarmed = await readCoverThumbnail(
      platform.env.COVER_THUMBNAILS,
      params.id,
      request.headers.get('if-none-match'),
      coverVariant
    );
    if (prewarmed) {
      if (request.method === 'HEAD') {
        return new Response(null, { status: prewarmed.status, headers: prewarmed.headers });
      }
      // Populate edge cache so subsequent requests hit Worker edge cache with 0 KV reads and 0 YSQL queries
      if (cache && prewarmed.status === 200 && !internalCoverWarm) {
        const cacheResponse = prewarmed.clone();
        const cachePutTask = async () => {
          if (await isMediaRevoked(params.id, platform?.env?.COVER_THUMBNAILS, { checkTombstone: true })) {
            return;
          }
          await cache.put(cacheKey, cacheResponse);
          if (await isMediaRevoked(params.id, platform?.env?.COVER_THUMBNAILS, { checkTombstone: true })) {
            await cache.delete(cacheKey);
          }
        };
        if (waitUntil) {
          waitUntil(cachePutTask());
        } else {
          await cachePutTask();
        }
      }
      return prewarmed;
    }
  }

  if (media.bytes && Number(media.bytes) > 0) {
    headers['Content-Length'] = String(media.bytes);
  }

  if (matchesETag(request.headers.get('if-none-match'), headers.ETag)) {
    return new Response(null, { status: 304, headers });
  }

  const ifMatch = request.headers.get('if-match');
  if (ifMatch && ifMatch !== '*' && headers.ETag) {
    const matchEtags = ifMatch.split(',').map((s) => s.trim());
    if (!matchEtags.includes(headers.ETag.trim()) || headers.ETag.startsWith('W/')) {
      return new Response(null, { status: 412, headers });
    }
  }

  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers });
  }

  let body: BodyInit;
  let downloadBotRef: string | undefined;
  if (media.provider === 'supabase') {
    return new Response(JSON.stringify({ error: 'Mídia legada descontinuada' }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  } else {
    // Determine exact bot with strict Bot Affinity
    let botRef = media.bot_reference;
    let shardId = media.storage_shard_id;

    // 1. If storage_shard_id is present and botRef is missing or default 'primary', lookup shard definition
    if (shardId && (!botRef || botRef === 'primary')) {
      if (storageShardBotCache.has(shardId)) {
        botRef = storageShardBotCache.get(shardId)!;
      } else {
        const shardRes = await executeYugabyteSql(
          'SELECT bot_reference FROM storage_shards WHERE id = $1 LIMIT 1;',
          [shardId],
          platform?.env
        ).catch(() => ({ rows: [] as any[] }));
        if (shardRes.rows[0]?.bot_reference) {
          botRef = shardRes.rows[0].bot_reference;
          storageShardBotCache.set(shardId, botRef);
        }
      }
    }

    // 2. If botRef is still primary or null, deduce from file_id channel signature
    if (!botRef || botRef === 'primary') {
      const deduced = deduceMangaShardFromFileId(media.provider_key);
      if (deduced) {
        botRef = deduced.botRef;
        shardId = shardId || deduced.shardId;
      }
    }

    botRef = normalizeBotReference(botRef);
    downloadBotRef = botRef;

    const client = resolveBotDownloadClient(botRef);
    try {
      const stream = await downloadTelegramMedia(client, media.provider_key);
      body = stream;
    } catch (firstErr) {
      const isTg400 = firstErr instanceof TelegramStorageError && firstErr.status === 400;
      if (isTg400) {
        // Bot mismatch (wrong file_id) - attempt alternative bot
        const altBotRef = botRef === 'MANGA_STORAGE_2' ? 'MANGA_STORAGE_01' : 'MANGA_STORAGE_2';
        try {
          const altClient = resolveBotDownloadClient(altBotRef);
          const stream = await downloadTelegramMedia(altClient, media.provider_key);
          body = stream;
          botRef = altBotRef;
          downloadBotRef = altBotRef;
          // Self-heal DB mapping synchronously within request lifecycle
          try {
            await executeYugabyteSql(
              'UPDATE media SET bot_reference = $1 WHERE id = $2;',
              [altBotRef, media.id],
              platform?.env
            );
          } catch (e: any) {
            console.warn('[MEDIA_HEAL_WARN]', e?.message);
          }
        } catch {
          console.error('[MEDIA_DOWNLOAD_FAILED]', {
            id: params.id,
            botRef,
            shardId,
            stage: firstErr instanceof TelegramStorageError ? firstErr.stage : 'unknown',
            status: firstErr instanceof TelegramStorageError ? firstErr.status : undefined
          });
          return new Response(JSON.stringify({ error: 'Página temporariamente indisponível' }), {
            status: 502,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
            }
          });
        }
      } else {
        console.error('[MEDIA_DOWNLOAD_FAILED]', {
          id: params.id,
          botRef,
          shardId,
          stage: firstErr instanceof TelegramStorageError ? firstErr.stage : 'unknown',
          status: firstErr instanceof TelegramStorageError ? firstErr.status : undefined
        });
        return new Response(JSON.stringify({ error: 'Página temporariamente indisponível' }), {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
          }
        });
      }
    }
  }

  if (coverVariant) {
    const bytes = Number(media.bytes) || 0;
    const mime = String(media.mime || '').toLowerCase();
    const pixels = Math.max(0, Number(media.width) || 0) * Math.max(0, Number(media.height) || 0);
    const canResize = mime === 'image/jpeg' || mime === 'image/png';
    const isChapterPage = media.purpose === 'chapter_page';
    const streamOriginal =
      !canResize ||
      isChapterPage ||
      (coverVariant === 'thumb' &&
        !internalCoverWarm &&
        bytes > 0 &&
        bytes <= 1_000_000 &&
        pixels > 2_000_000);
    if (streamOriginal) {
      headers['X-Thumbnail-Strategy'] = 'stream-original';
      if (bytes > 0) headers['Content-Length'] = String(bytes);
    } else {
      try {
        const rawBytes = await toUint8Array(body);
        const thumb = await generateThumbnail(rawBytes, media.mime,
          coverVariant === 'hero' ? { maxWidth: 720, maxHeight: 1020 } : undefined);
        body = thumb.data;
        headers['Content-Type'] = thumb.mime;
        headers['Content-Length'] = String(thumb.data.length);
        if (thumb.resized) {
          headers['ETag'] = `"${media.sha256}-thumb-v3"`;
        }
        headers['X-Thumbnail-Strategy'] = 'resized';
      } catch (thumbErr) {
        // The first Telegram stream is one-shot. Reopen it once so a stalled
        // decoder/read degrades to a valid original instead of a broken image.
        console.warn('[THUMBNAIL_FALLBACK_TO_ORIGINAL]', {
          id: params.id,
          reason: (thumbErr as Error)?.message
        });
        try {
          const retryClient = resolveBotDownloadClient(downloadBotRef);
          body = await downloadTelegramMedia(retryClient, media.provider_key);
          headers['X-Thumbnail-Strategy'] = 'fallback-original';
          if (bytes > 0) headers['Content-Length'] = String(bytes);
        } catch {
          return new Response(JSON.stringify({ error: 'Capa temporariamente indisponível' }), {
            status: 502,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
            }
          });
        }
      }
    }
  } else {
    if (media.bytes && Number(media.bytes) > 0) {
      headers['Content-Length'] = String(media.bytes);
    } else if (body instanceof Uint8Array) {
      headers['Content-Length'] = String(body.byteLength);
    } else if (body instanceof ArrayBuffer) {
      headers['Content-Length'] = String(body.byteLength);
    } else if (body instanceof Blob) {
      headers['Content-Length'] = String(body.size);
    }
  }

  // 1. Authoritative post-download re-verification BEFORE Range evaluation, internal cover warm, and edge cache.put:
  // Checks KV tombstone and in-memory revocation sets first, then re-verifies authoritative
  // Yugabyte metadata to ensure that if public.media.status was changed to DELETED or if access_class
  // was changed to PRIVATE/RESTRICTED while download was in-flight but remote PoP KV is lagging/outdated,
  // the media is NEVER returned (neither 200 nor 206) and NEVER cached.
  let isRevoked = await isMediaRevoked(params.id, platform?.env?.COVER_THUMBNAILS, { checkTombstone: true });

  if (!isRevoked) {
    try {
      const freshMeta: any = await fetchMediaMetadataFromYugabyte(params.id, platform?.env, { forceFresh: true });
      if (!freshMeta || freshMeta.storage_ready !== true || freshMeta.status !== 'ACTIVE') {
        isRevoked = true;
        invalidateMediaMetadataCache(params.id);
      } else {
        const freshClassification = classifyMediaAccess(freshMeta);
        isPublic = isPublic && freshClassification.isPublic;
        if (!freshClassification.isPublic) {
          const authCheck = await isAuthorizedForMedia(freshMeta, freshClassification, cookies, request, platform?.env);
          if (!authCheck.allowed) {
            isRevoked = true;
            invalidateMediaMetadataCache(params.id);
          }
        }
      }
    } catch {
      // Fail closed for caching: if database status cannot be re-verified after download,
      // fail closed by treating as revoked to strictly prevent committing stale media to cache
      isRevoked = true;
    }
  }

  if (isRevoked) {
    if (cache || platform?.context?.cache) {
      const purgeTask = purgeMediaVariants(params.id, {
        cache,
        ctx,
        origin: url.origin,
        requirePurgeDispatch: true
      }).catch(() => {});
      if (waitUntil) {
        waitUntil(purgeTask);
      }
    }
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

  if (evaluateRange && rangeHeader) {
    const bytes = body instanceof Uint8Array ? body : await toUint8Array(body);
    const total = bytes.byteLength;
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      let start: number;
      let end: number;
      if (match[1] === '' && match[2] !== '') {
        // RFC 9110 suffix range: bytes=-N
        const suffixLen = parseInt(match[2], 10);
        if (suffixLen === 0 || total === 0) {
          return new Response(null, {
            status: 416,
            headers: { ...headers, 'Content-Range': `bytes */${total}` }
          });
        }
        start = Math.max(0, total - suffixLen);
        end = total - 1;
      } else {
        start = match[1] ? parseInt(match[1], 10) : 0;
        end = match[2] ? parseInt(match[2], 10) : total - 1;
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
  }

  const response = new Response(body, { status: 200, headers });

  // 2. Only the authenticated publication event may create a global KV entry.
  // Interactive requests still read a hot entry, but never write one: that
  // prevents a cold edge or concurrent browser views from exhausting the KV
  // free-tier write budget. Large/full reader pages never enter this path.
  // Executed ONLY IF verified not revoked.
  const kv = platform?.env?.COVER_THUMBNAILS;
  const responseBytes = Number(headers['Content-Length'] || 0);
  if (internalCoverWarm && isPublic && kv && (!responseBytes || responseBytes <= MAX_COVER_THUMBNAIL_BYTES)) {
    const persist = readBoundedCoverResponse(response.clone())
      .then((bytes) => bytes && persistCoverThumbnail(kv, params.id, bytes, {
        contentType: headers['Content-Type'],
        etag: headers['ETag'],
        contentLength: headers['Content-Length']
      }, coverVariant))
      .catch(() => 'skipped');
    // The event endpoint observes a completed warm only after this single KV
    // write is done; user-facing media never waits for it.
    const persisted = await persist;
    response.headers.set('X-Cover-Warm', persisted === 'stored' ? 'stored' : 'skipped');
  }

  // 3. Only cache valid HTTP 200 public responses in Cloudflare edge cache (up to 10MB)
  const isCachableAtEdge = Boolean(media.bytes ? Number(media.bytes) <= 10_485_760 : true);
  if (cache && isPublic && isCachableAtEdge && !isRevoked) {
    try {
      const cacheResponse = response.clone();
      const putTask = async () => {
        // Pre-put guard: check if media was revoked while the response was preparing
        if (await isMediaRevoked(params.id, platform?.env?.COVER_THUMBNAILS, { checkTombstone: true })) {
          return;
        }
        await cache.put(cacheKey, cacheResponse);
        // Post-put guard: if an administrative revocation occurred concurrently during cache.put,
        // purge the entry immediately so the late-completing put cannot resurrect stale public cache
        if (await isMediaRevoked(params.id, platform?.env?.COVER_THUMBNAILS, { checkTombstone: true })) {
          await cache.delete(cacheKey);
        }
      };
      if (waitUntil) {
        waitUntil(putTask());
      } else {
        await putTask();
      }
    } catch (cacheErr) {
      console.warn('Edge cache put failed:', cacheErr);
    }
  }

  return response;
};
