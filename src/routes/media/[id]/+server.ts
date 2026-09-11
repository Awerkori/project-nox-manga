import { error } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { resolveBotDownloadClient } from '$lib/server/storage-router';

export const GET = async ({ locals, params, request, platform }: any) => {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) error(404);

  // 1. Check Cloudflare Edge Cache first for instantaneous sub-millisecond response
  const cacheKey = new Request(request.url, { method: 'GET' });
  const cache = typeof caches !== 'undefined' && (caches as any).default ? (caches as any).default : null;
  if (cache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached && cached.status === 200) {
        const etag = cached.headers.get('ETag');
        if (etag && request.headers.get('if-none-match') === etag) {
          return new Response(null, { status: 304, headers: cached.headers });
        }
        return cached;
      }
    } catch {
      // Fall through to standard retrieval on cache check failure
    }
  }

  const db = privileged();
  const { data: media } = await db.from('media').select('*').eq('id', params.id).maybeSingle();
  if (!media || media.storage_ready === false || media.status === 'DELETED') error(404);

  const isStaff = ['STAFF_SITE', 'ADMIN', 'EDITOR'].includes(locals.role || '');
  let isPublic = false;

  // Verify access authorization across public media consumers
  const checkPublicConsumers = async (database: any) => {
    const [cover, pages, avatar, banner, scan, shop] = await Promise.all([
      database.from('works').select('id').eq('published', true).eq('cover_id', params.id).limit(1),
      database.from('pages').select('chapter_id').eq('media_id', params.id).limit(1),
      database.from('members').select('id').eq('avatar_id', params.id).limit(1),
      database.from('members').select('id').eq('banner_id', params.id).limit(1),
      database.from('scans').select('id').or(`logo_id.eq.${params.id},banner_id.eq.${params.id}`).limit(1),
      database.from('shop_items').select('id').eq('media_id', params.id).limit(1)
    ]);
    return Boolean(
      cover.data?.length ||
      pages.data?.length ||
      avatar.data?.length ||
      banner.data?.length ||
      scan.data?.length ||
      shop.data?.length
    );
  };

  if (!isStaff) {
    isPublic = await checkPublicConsumers(locals.db);
    if (!isPublic) {
      // Allow uploader to view their own uploaded asset
      const isOwner = Boolean(locals.user?.id && media.created_by === locals.user.id);
      if (!isOwner) {
        error(404);
      }
    }
  } else {
    // If staff, also check if public for CDN caching optimization
    isPublic = await checkPublicConsumers(db);
  }

  const headers: Record<string, string> = {
    'Content-Type': media.mime || 'image/jpeg',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': isPublic
      ? 'public, max-age=31536000, s-maxage=31536000, immutable'
      : 'private, no-cache',
    'ETag': `"${media.sha256}"`,
    'Content-Security-Policy': "default-src 'none'; sandbox"
  };

  if (request.headers.get('if-none-match') === headers.ETag) {
    return new Response(null, { status: 304, headers });
  }

  let body: BodyInit;
  if (media.provider === 'supabase') {
    const { data, error: problem } = await db.storage.from('nox-media').download(media.provider_key);
    if (problem || !data) error(502, 'Página temporariamente indisponível');
    body = data;
  } else {
    try {
      const botRef = media.bot_reference || 'primary';
      const client = resolveBotDownloadClient(botRef);
      const stream = await client.download(media.provider_key);
      body = await new Response(stream).arrayBuffer();
    } catch {
      error(502, 'Página temporariamente indisponível');
    }
  }

  if (body instanceof ArrayBuffer) {
    headers['Content-Length'] = String(body.byteLength);
  } else if (body instanceof Blob) {
    headers['Content-Length'] = String(body.size);
  }

  const response = new Response(body, { status: 200, headers });

  // Only cache valid HTTP 200 public responses in Cloudflare edge cache
  if (cache && isPublic) {
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
