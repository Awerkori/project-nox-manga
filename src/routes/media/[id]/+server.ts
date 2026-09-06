import { error } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import { telegramStorage } from '$lib/server/telegram';
export const GET = async ({ locals, params, request }) => {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) error(404);
  const db = privileged();
  const { data: media } = await db.from('media').select('*').eq('id', params.id).maybeSingle();
  if (!media || media.storage_ready === false) error(404);
  let allowed = ['EDITOR', 'ADMIN'].includes(locals.role || '');
  if (!allowed) {
    const [cover, pages, avatar] = await Promise.all([
      locals.db.from('works').select('id').eq('published', true).eq('cover_id', params.id).limit(1),
      locals.db.from('pages').select('chapter_id').eq('media_id', params.id).limit(1),
      locals.db.from('members').select('id').eq('avatar_id', params.id).limit(1)
    ]);
    allowed = !!cover.data?.length || !!pages.data?.length || !!avatar.data?.length;
  }
  if (!allowed) error(404);
  // Recheck publication on every request; a shared cache must not keep unpublished material accessible.
  const headers = {
    'Content-Type': media.mime,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-cache',
    ETag: `"${media.sha256}"`,
    'Content-Security-Policy': "default-src 'none'; sandbox"
  };
  if (request.headers.get('if-none-match') === headers.ETag)
    return new Response(null, { status: 304, headers });
  if (media.provider === 'supabase') {
    const { data, error: problem } = await db.storage.from('nox-media').download(media.provider_key);
    if (problem || !data) error(502, 'Página temporariamente indisponível');
    return new Response(data, { headers });
  }
  if (!env.TELEGRAM_BOT_TOKEN) error(503, 'Armazenamento temporariamente indisponível');
  try {
    const body = await telegramStorage(env.TELEGRAM_BOT_TOKEN, '').download(media.provider_key);
    return new Response(body, { headers });
  } catch {
    error(502, 'Página temporariamente indisponível');
  }
};
