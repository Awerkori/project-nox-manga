import { error } from '@sveltejs/kit';
import {
  resolveBotDownloadClient,
  normalizeBotReference,
  deduceMangaShardFromFileId
} from '$lib/server/storage-router';
import { TelegramStorageError } from '$lib/server/telegram';
import { extractFullAuthCookie, decodeSessionJwt, resolveSessionData } from '$lib/server/session-cache';
import { fetchMediaMetadataFromYugabyte, executeYugabyteSql } from '$lib/server/yugabyte';
import { classifyMediaAccess } from '$lib/server/media-revocation';

const PRIVATE_MEDIA_IDLE_TIMEOUT_MS = 12_000;

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

/**
 * Dedicated private/authenticated media endpoint.
 * Intentionally outside /media/* to guarantee that Cloudflare zone Cache Rules
 * NEVER cache, store, or distribute private/staff/internal images on edge.
 */
export const GET = async ({ locals, params, request, platform, cookies }: any) => {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) error(404);

  const media: any = await fetchMediaMetadataFromYugabyte(params.id, platform?.env);
  if (!media || media.storage_ready === false || media.status === 'DELETED') {
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

  const accessClassification = classifyMediaAccess(media);
  const isPublic = accessClassification.isPublic;

  // For non-public media, require authentic cryptographic verification
  if (!isPublic) {
    let verifiedSession = null;
    const rawCookie = extractFullAuthCookie(cookies.getAll());
    const authHeader = request.headers.get('authorization') || '';
    const token = rawCookie || (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');

    if (token) {
      const { jwt, accessToken } = decodeSessionJwt(token);
      if (jwt) {
        try {
          verifiedSession = await resolveSessionData(null, jwt, accessToken, platform?.env);
        } catch {
          // Identity unverified
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
    'ETag': `"${media.sha256}"`,
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Media-Privacy': isPublic ? 'PUBLIC' : 'PRIVATE-AUTHENTICATED'
  };

  if (request.headers.get('if-none-match') === headers.ETag) {
    return new Response(null, { status: 304, headers });
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
    let shardId = media.storage_shard_id;

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
        shardId = shardId || deduced.shardId;
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

  if (media.bytes && Number(media.bytes) > 0) {
    headers['Content-Length'] = String(media.bytes);
  }

  return new Response(body, { status: 200, headers });
};
