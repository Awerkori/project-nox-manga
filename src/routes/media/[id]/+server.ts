import { error } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import {
  resolveBotDownloadClient,
  normalizeBotReference,
  deduceMangaShardFromFileId
} from '$lib/server/storage-router';
import { TelegramStorageError } from '$lib/server/telegram';
import { extractFullAuthCookie, decodeSessionJwt, resolveSessionData } from '$lib/server/session-cache';
import { generateThumbnail } from '$lib/server/thumbnail';
import { fetchMediaMetadataFromYugabyte } from '$lib/server/yugabyte';
import {
  MAX_COVER_THUMBNAIL_BYTES,
  persistCoverThumbnail,
  readBoundedCoverResponse,
  readCoverThumbnail
} from '$lib/server/cover-thumbnail-cache';

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

const COVER_BODY_IDLE_TIMEOUT_MS = 12_000;

async function downloadCoverWithTransientRetry(
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

export const GET = async ({ locals, params, request, platform, cookies }: any) => {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) error(404);


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
  const cache = typeof caches !== 'undefined' && (caches as any).default ? (caches as any).default : null;
  if (cache && !internalCoverWarm) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached && cached.status === 200) {
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

  // Cover thumbnails are derived public media. Unlike the per-PoP Worker cache,
  // KV lets a freshly imported cover avoid a first-reader Telegram round-trip
  // on another region/device. Never use it for full pages or private media.
  if (coverVariant) {
    const prewarmed = await readCoverThumbnail(
      platform?.env?.COVER_THUMBNAILS,
      params.id,
      request.headers.get('if-none-match'),
      coverVariant
    );
    if (prewarmed) return prewarmed;
  }

  const db = privileged();
  let media: any = await fetchMediaMetadataFromYugabyte(params.id, platform?.env);
  if (!media) {
    const { data: supaMedia } = await db.from('media').select('*').eq('id', params.id).maybeSingle();
    media = supaMedia;
  }
  if (!media || media.storage_ready === false || media.status === 'DELETED') {
    return new Response(JSON.stringify({ error: 'Mídia não encontrada' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  }

  // Security: staff_manual and staff_chapter must NEVER be treated as public!
  const isStaffPurpose = media.purpose === 'staff_manual' || media.purpose === 'staff_chapter';
  const isPublic =
    !isStaffPurpose &&
    (media.access_class === 'PUBLIC' ||
      media.purpose === 'editorial' ||
      media.purpose === 'avatar' ||
      media.purpose === 'banner' ||
      media.purpose === 'scan_logo' ||
      media.purpose === 'scan_banner' ||
      !media.access_class);

  if (!isPublic) {
    let verifiedSession = null;
    const raw = extractFullAuthCookie(cookies.getAll());
    if (raw) {
      const { jwt, accessToken } = decodeSessionJwt(raw);
      if (jwt) {
        try {
          verifiedSession = await resolveSessionData(locals.db, jwt, accessToken);
        } catch {
          // ignore session resolution failure for anonymous fallback
        }
      }
    }
    const isStaff = ['STAFF_SITE', 'ADMIN', 'EDITOR'].includes(verifiedSession?.role || '');
    const isOwner = Boolean(verifiedSession?.user?.id && media.created_by === verifiedSession.user.id);
    const isAuthenticatedAllowed = media.access_class === 'AUTHENTICATED' && Boolean(verifiedSession?.user?.id);
    if (!isStaff && !isOwner && !isAuthenticatedAllowed) {
      return new Response(JSON.stringify({ error: 'Acesso não autorizado' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': media.mime || 'image/jpeg',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': isPublic
      ? 'public, max-age=31536000, s-maxage=31536000, immutable'
      : 'private, no-cache',
    'ETag': `"${media.sha256}"`,
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Media-Cache': 'MISS'
  };

  if (request.headers.get('if-none-match') === headers.ETag) {
    return new Response(null, { status: 304, headers });
  }

  let body: BodyInit;
  let downloadBotRef = media.bot_reference;
  if (media.provider === 'supabase') {
    const { data, error: problem } = await db.storage.from('nox-media').download(media.provider_key);
    if (problem || !data) {
      return new Response(JSON.stringify({ error: 'Página temporariamente indisponível' }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }
    body = data;
  } else {
    // Determine exact bot with strict Bot Affinity
    let botRef = media.bot_reference;
    let shardId = media.storage_shard_id;

    // 1. If storage_shard_id is present and botRef is missing or default 'primary', lookup shard definition
    if (shardId && (!botRef || botRef === 'primary')) {
      const { data: shardRow } = await db
        .from('storage_shards')
        .select('bot_reference')
        .eq('id', shardId)
        .maybeSingle();
      if (shardRow?.bot_reference) {
        botRef = shardRow.bot_reference;
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

    try {
      const client = resolveBotDownloadClient(botRef);
      const stream = await downloadCoverWithTransientRetry(client, media.provider_key);
      body = stream;
    } catch (firstErr) {
      const isTg400 = firstErr instanceof TelegramStorageError && firstErr.status === 400;
      if (isTg400) {
        // Bot mismatch (wrong file_id) - attempt alternative bot
        const altBotRef = botRef === 'MANGA_STORAGE_2' ? 'MANGA_STORAGE_01' : 'MANGA_STORAGE_2';
        try {
          const altClient = resolveBotDownloadClient(altBotRef);
          const stream = await altClient.download(media.provider_key);
          body = stream;
          botRef = altBotRef;
          // Self-heal DB mapping in background
          const healingUpdate = { bot_reference: altBotRef };
          if (platform?.context?.waitUntil) {
            platform.context.waitUntil(
              db.from('media').update(healingUpdate).eq('id', media.id)
            );
          } else {
            db.from('media').update(healingUpdate).eq('id', media.id).then();
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
    // A cold thumbnail used to wait for Telegram, then buffer and run a pure-JS
    // decode/resize/encode. For normal covers this added seconds of blank UI.
    // Small originals are cheaper to transfer once than to hold the request open;
    // unsupported formats must also remain streamed rather than buffered only to
    // fall back to the original. The immutable v3 URL is cached at the edge.
    const streamOriginal = !canResize || (coverVariant === 'thumb' && bytes > 0 && bytes <= 1_000_000 && pixels > 2_000_000);
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
          body = await downloadCoverWithTransientRetry(retryClient, media.provider_key);
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
    } else if (body instanceof ArrayBuffer) {
      headers['Content-Length'] = String(body.byteLength);
    } else if (body instanceof Blob) {
      headers['Content-Length'] = String(body.size);
    }
  }

  const response = new Response(body, { status: 200, headers });

  // Only the authenticated publication event may create a global KV entry.
  // Interactive requests still read a hot entry, but never write one: that
  // prevents a cold edge or concurrent browser views from exhausting the KV
  // free-tier write budget. Large/full reader pages never enter this path.
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

  // Only cache valid HTTP 200 public responses in Cloudflare edge cache (up to 10MB)
  const isCachableAtEdge = Boolean(media.bytes ? Number(media.bytes) <= 10_485_760 : true);
  if (cache && isPublic && isCachableAtEdge) {
    try {
      const cacheResponse = response.clone();
      if (platform?.context?.waitUntil) {
        platform.context.waitUntil(cache.put(cacheKey, cacheResponse));
      } else {
        await cache.put(cacheKey, cacheResponse);
      }
    } catch (cacheErr) {
      console.warn('Edge cache put failed:', cacheErr);
    }
  }

  return response;
};
