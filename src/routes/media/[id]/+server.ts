import { error } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import { telegramStorage } from '$lib/server/telegram';

export const GET = async ({ locals, params, request }: any) => {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) error(404);

  const db = privileged();
  const { data: media } = await db.from('media').select('*').eq('id', params.id).maybeSingle();
  if (!media || media.storage_ready === false) error(404);

  const isStaff = ['EDITOR', 'ADMIN'].includes(locals.role || '');
  if (!isStaff) {
    const [cover, pages, avatar] = await Promise.all([
      locals.db.from('works').select('id').eq('published', true).eq('cover_id', params.id).limit(1),
      locals.db.from('pages').select('chapter_id').eq('media_id', params.id).limit(1),
      locals.db.from('members').select('id').eq('avatar_id', params.id).limit(1)
    ]);
    const isPublic = !!(cover.data?.length || pages.data?.length || avatar.data?.length);
    if (!isPublic) error(404);
  }

  const headers: Record<string, string> = {
    'Content-Type': media.mime || 'image/jpeg',
    'X-Content-Type-Options': 'nosniff',
    // Publication, moderation and age decisions must be revocable immediately.
    // ETag still avoids sending the body, but only after authorization is rechecked.
    'Cache-Control': 'private, no-store',
    ETag: `"${media.sha256}"`,
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

  return new Response(body, { status: 200, headers });
};
