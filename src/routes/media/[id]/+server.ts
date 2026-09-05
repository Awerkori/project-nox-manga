import { error } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { env } from '$env/dynamic/private';
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
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: media.provider_key })
  });
  const result = (await response.json()) as { ok: boolean; result?: { file_path?: string } };
  const path = result.result?.file_path;
  if (!result.ok || !path || !/^documents\/[a-zA-Z0-9_.-]+$/.test(path))
    error(502, 'Página temporariamente indisponível');
  const file = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${path}`);
  if (!file.ok) error(502, 'Página temporariamente indisponível');
  return new Response(file.body, { headers });
};
