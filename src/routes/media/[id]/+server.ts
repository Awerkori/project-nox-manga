import { error } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import { telegramStorage } from '$lib/server/telegram';

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
  if (!media || media.storage_ready === false) error(404);

  const isStaff = ['EDITOR', 'ADMIN'].includes(locals.role || '');
  let isPublic = false;

  if (!isStaff) {
    const [cover, pages, avatar] = await Promise.all([
      locals.db.from('works').select('id').eq('published', true).eq('cover_id', params.id).limit(1),
      locals.db.from('pages').select('chapter_id').eq('media_id', params.id).limit(1),
      locals.db.from('members').select('id').eq('avatar_id', params.id).limit(1)
    ]);
    isPublic = !!(cover.data?.length || pages.data?.length || avatar.data?.length);
    if (!isPublic) error(404);
  } else {
    // If staff, verify if the asset is also publicly accessible
    const [cover, pages, avatar] = await Promise.all([
      db.from('works').select('id').eq('published', true).eq('cover_id', params.id).limit(1),
      db.from('pages').select('chapter_id').eq('media_id', params.id).limit(1),
      db.from('members').select('id').eq('avatar_id', params.id).limit(1)
    ]);
    isPublic = !!(cover.data?.length || pages.data?.length || avatar.data?.length);
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
    if (!env.TELEGRAM_BOT_TOKEN) error(503, 'Armazenamento temporariamente indisponível');
    try {
      const stream = await telegramStorage(env.TELEGRAM_BOT_TOKEN, '').download(media.provider_key);
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
