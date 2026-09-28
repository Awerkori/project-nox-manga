import { json, error, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import { hasCoverThumbnail, warmCoverThumbnail } from '$lib/server/cover-thumbnail-cache';

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

export const GET: RequestHandler = async ({ request, url, platform }) => {
  const expected = platform?.env?.NOX_STORAGE_BRIDGE_TOKEN || env.NOX_STORAGE_BRIDGE_TOKEN;
  const auth = request.headers.get('authorization') || '';
  // The scheduled handler invokes SvelteKit directly with this private platform
  // marker; it is not representable by an external HTTP request. Normal HTTP
  // access remains protected by the bridge token.
  const scheduledInvocation = (platform as any)?.scheduledInvocation === true;
  const tokenValid = Boolean(expected && auth.startsWith('Bearer ') && safeTokenCompare(auth.slice(7).trim(), expected));
  if (!scheduledInvocation && !tokenValid) {
    error(401, 'Unauthorized');
  }

  const kv = platform?.env?.COVER_THUMBNAILS;
  if (!kv) return json({ ok: true, result: 'disabled' });

  // One missing cover per cron cycle: this is a cache warmer, never a second
  // importer. It keeps YSQL/Telegram maintenance below interactive traffic.
  const limit = Math.min(12, Math.max(1, Number(url.searchParams.get('limit') || 8)));
  const rows = await executeYugabyteSql<{ cover_id: string }>(
    `SELECT cover_id
       FROM works
      WHERE published = true AND cover_id IS NOT NULL
      ORDER BY latest_chapter_published_at DESC NULLS LAST
      LIMIT $1`,
    [limit],
    platform?.env
  );
  const candidate = (await Promise.all(rows.rows.map(async ({ cover_id }) =>
    (await hasCoverThumbnail(kv, cover_id)) ? null : cover_id
  ))).find(Boolean);
  if (!candidate) return json({ ok: true, result: 'already_warm' });

  const result = await warmCoverThumbnail(kv, url.origin, candidate);
  return json({ ok: true, result });
};
