import { json, error, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { isMediaId, warmCoverThumbnail } from '$lib/server/cover-thumbnail-cache';

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

  // Warming is event-driven: the importer names the just-published cover
  // using its existing bridge token. Never poll Yugabyte/KV looking for one.
  const requestedCoverId = url.searchParams.get('coverId');
  const candidate: string | null = tokenValid && requestedCoverId && isMediaId(requestedCoverId)
    ? requestedCoverId
    : null;

  if (!candidate) return json({ ok: true, result: 'event_required' });

  // One cover at a time and sequential variants: cache maintenance remains
  // strictly below interactive YSQL/Telegram traffic.
  const thumb = await warmCoverThumbnail(kv, url.origin, candidate, 'thumb', expected);
  const hero = await warmCoverThumbnail(kv, url.origin, candidate, 'hero', expected);
  return json({ ok: true, result: { thumb, hero } });
};
