import { error } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import {
  resolveBotDownloadClient,
  normalizeBotReference,
  deduceMangaShardFromFileId
} from '$lib/server/storage-router';
import { TelegramStorageError } from '$lib/server/telegram';
import { getMediaMetadata, setMediaMetadata } from '$lib/server/media-cache';
export const GET = async ({ params, request, platform, locals }: any) => {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) error(404);


  // 1. Check Cloudflare Edge Cache first for instantaneous sub-millisecond response
  const url = new URL(request.url);
  const canonicalUrl = `${url.origin}/media/${params.id}`;
  const cacheKey = new Request(canonicalUrl, { method: 'GET' });
  const cache = typeof caches !== 'undefined' && (caches as any).default ? (caches as any).default : null;
  if (cache) {
    
    if (!privateEnv.TELEGRAM_BOT_TOKEN) {
      // MOCK for E2E testing without Telegram Token
      const transparentPng = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137,0,0,0,11,73,68,65,84,8,153,99,96,0,2,0,0,5,0,1,233,224,196,24,0,0,0,0,73,69,78,68,174,66,96,130]);
      return new Response(transparentPng, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    }

    try {

      const cached = await cache.match(cacheKey);
      if (cached && cached.status === 200) {
        const etag = cached.headers.get('ETag');
        if (etag && request.headers.get('if-none-match') === etag) {
          return new Response(null, { status: 304, headers: cached.headers });
        }
        const hitHeaders = new Headers(cached.headers);
        hitHeaders.set('X-Media-Cache', 'HIT');
        return new Response(cached.body, { status: 200, headers: hitHeaders });
      }
    } catch {
      // Fall through to standard retrieval on cache check failure
    }
  }

  
  let media: any = getMediaMetadata(params.id);
  if (!media) {
    const { data: dbMedia } = await safeQuerySingle(
      db.select().from(schema.media).where(eq(schema.media!.id, params.id))
    );
    media = dbMedia;
    if (media) {
      setMediaMetadata(params.id, media);
    }
  }

  if (!media || media.storageReady === false || media.status === 'DELETED') {
    return new Response(JSON.stringify({ error: 'Mídia não encontrada' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  }

  
  // Public media includes all editorial assets, covers, avatars, banners, and any media marked PUBLIC
  const isPublic =
    media.accessClass === 'PUBLIC' ||
    media.purpose === 'editorial' ||
    media.purpose === 'avatar' ||
    media.purpose === 'banner' ||
    media.purpose === 'scan_logo' ||
    media.purpose === 'scan_banner' ||
    !media.accessClass;

  if (!isPublic) {
    const verifiedSession = locals;
    const isStaff = ['STAFF_SITE', 'ADMIN', 'EDITOR'].includes(verifiedSession?.role || '');
    const isOwner = Boolean(verifiedSession?.user?.id && media.createdBy === verifiedSession.user.id);
    const isAuthenticatedAllowed = media.accessClass === 'AUTHENTICATED' && Boolean(verifiedSession?.user?.id);
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
    if (!media!.providerKey) {
      return new Response(JSON.stringify({ error: 'Página temporariamente indisponível' }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }
    const supabaseUrl = env.PUBLIC_SUPABASE_URL;
    const supabaseKey = privateEnv.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Armazenamento temporariamente indisponível' }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data, error: problem } = await supabase.storage.from('nox-media').download(media!.providerKey);
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
    let botRef = media.botReference;
    let shardId = media.storageShardId;

    // 1. If storageShardId is present and botRef is missing or default 'primary', lookup shard definition
    if (shardId && (!botRef || botRef === 'primary')) {
      const { data: shardRow } = await safeQuerySingle(
        db.select({ botReference: schema.storageShards.botReference })
          .from(schema.storageShards)
          .where(eq(schema.storageShards.id, shardId))
      );
      if (shardRow?.botReference) {
        botRef = shardRow.botReference;
      }
    }

    // 2. If botRef is still primary or null, deduce from file_id channel signature
    if (!botRef || botRef === 'primary') {
      if (media!.providerKey) {
        const deduced = deduceMangaShardFromFileId(media!.providerKey);
        if (deduced) {
          botRef = deduced.botRef;
          shardId = shardId || deduced.shardId;
        }
      }
    }

    botRef = normalizeBotReference(botRef);

    try {
      if (!media!.providerKey) throw new Error('Missing provider key');
      
      if (!privateEnv.TELEGRAM_BOT_TOKEN) {
        const transparentPng = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137,0,0,0,11,73,68,65,84,8,153,99,96,0,2,0,0,5,0,1,233,224,196,24,0,0,0,0,73,69,78,68,174,66,96,130]);
        return new Response(transparentPng, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable'
          }
        });
      }
      const client = resolveBotDownloadClient(botRef as string);

      const stream = await client.download(media!.providerKey as string);
      body = stream;
    } catch (firstErr) {
      const isTg400 = firstErr instanceof TelegramStorageError && firstErr.status === 400;
      if (isTg400 && media?.providerKey) {
        // Bot mismatch (wrong fileId) - attempt alternative bots across all 6 storage bots
        const candidateBots = [
          'MANGA_STORAGE_01',
          'MANGA_STORAGE_2',
          'MANGA_STORAGE_03',
          'MANGA_STORAGE_04',
          'MANGA_STORAGE_05',
          'MANGA_STORAGE_06'
        ].filter((b) => b !== botRef);

        let recovered = false;
        for (const altBotRef of candidateBots) {
          try {
            const altClient = resolveBotDownloadClient(altBotRef);
            const stream = await altClient.download(media!.providerKey as string);
            body = stream;
            botRef = altBotRef;
            recovered = true;
            // Self-heal DB mapping in background
            const healingUpdate = { botReference: altBotRef };
            if ((platform as any)?.context?.waitUntil) {
              (platform as any).context.waitUntil(
                safeQuery(db.update(schema.media).set(healingUpdate).where(eq(schema.media!.id, media!.id)))
              );
            } else {
              safeQuery(db.update(schema.media).set(healingUpdate).where(eq(schema.media!.id, media!.id)));
            }
            break;
          } catch {
            // Continue trying other candidate bots
          }
        }

        if (!recovered) {
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

  // Only cache valid HTTP 200 public responses in Cloudflare edge cache
  if (cache && isPublic) {
    try {
      const cacheResponse = response.clone();
      if ((platform as any)?.context?.waitUntil) {
        (platform as any).context.waitUntil(cache.put(cacheKey, cacheResponse));
      } else {
        await cache.put(cacheKey, cacheResponse);
      }
    } catch (cacheErr) {
      console.warn('Edge cache put failed:', cacheErr);
    }
  }

  return response;
};
