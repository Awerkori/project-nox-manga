import { error } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import {
  resolveBotDownloadClient,
  normalizeBotReference,
  deduceMangaShardFromFileId
} from '$lib/server/storage-router';
import { TelegramStorageError } from '$lib/server/telegram';
import { extractFullAuthCookie, decodeSessionJwt, resolveSessionData } from '$lib/server/session-cache';
import { fetchMediaMetadataFromYugabyte } from '$lib/server/yugabyte';

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
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }

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
          verifiedSession = await resolveSessionData(locals.db, jwt, accessToken, platform?.env);
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
    const { data, error: problem } = await db.storage.from('nox-media').download(media.provider_key);
    if (problem || !data) {
      return new Response(JSON.stringify({ error: 'Arquivo temporariamente indisponível' }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }
    body = data;
  } else {
    let botRef = media.bot_reference;
    let shardId = media.storage_shard_id;

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
