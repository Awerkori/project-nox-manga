import { error } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import {
  resolveBotDownloadClient,
  normalizeBotReference,
  deduceMangaShardFromFileId
} from '$lib/server/storage-router';
import { TelegramStorageError } from '$lib/server/telegram';
import { extractFullAuthCookie, decodeSessionJwt, resolveSessionData } from '$lib/server/session-cache';

export const GET = async ({ locals, params, request, platform, cookies }: any) => {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) error(404);


  // 1. Check Cloudflare Edge Cache first for instantaneous sub-millisecond response
  const url = new URL(request.url);
  const sizeParam = url.searchParams.get('size');
  const canonicalUrl = sizeParam ? `${url.origin}/media/${params.id}?size=${sizeParam}` : `${url.origin}/media/${params.id}`;
  const cacheKey = new Request(canonicalUrl, { method: 'GET' });
  const cache = typeof caches !== 'undefined' && (caches as any).default ? (caches as any).default : null;
  if (cache) {
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

  const db = privileged();
  const { data: media } = await db.from('media').select('*').eq('id', params.id).maybeSingle();
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

    try {
      const client = resolveBotDownloadClient(botRef);
      const stream = await client.download(media.provider_key);
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

  if (media.bytes && Number(media.bytes) > 0) {
    headers['Content-Length'] = String(media.bytes);
  } else if (body instanceof ArrayBuffer) {
    headers['Content-Length'] = String(body.byteLength);
  } else if (body instanceof Blob) {
    headers['Content-Length'] = String(body.size);
  }

  const response = new Response(body, { status: 200, headers });

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
