export const MAX_COVER_THUMBNAIL_BYTES = 2 * 1024 * 1024;
const COVER_BODY_IDLE_TIMEOUT_MS = 12_000;

type ThumbnailMetadata = {
  contentType?: string;
  etag?: string;
  contentLength?: string;
};

export type CoverVariant = 'thumb' | 'hero';

type ThumbnailKv = {
  getWithMetadata(key: string, options: { type: 'arrayBuffer' }): Promise<{
    value: ArrayBuffer | null;
    metadata: ThumbnailMetadata | null;
  } | null>;
  put(key: string, value: ArrayBuffer, options: { metadata: ThumbnailMetadata }): Promise<void>;
};

// Publication can be retried or observed by more than one request in the same
// Worker isolate. Coalesce only the explicit event-driven warm operation; this
// is not a distributed lock and deliberately does not turn every cover read
// into KV coordination.
const inFlightWarms = new Map<string, Promise<'warmed' | 'already_warm' | 'skipped' | 'failed'>>();

export const coverThumbnailKey = (mediaId: string, variant: CoverVariant = 'thumb') => `cover-${variant}:v1:${mediaId}`;

export function isMediaId(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

/**
 * Persist a response already produced by /media.  This deliberately has no
 * fetch of its own: publication warming and a real reader share the same
 * bounded response, preventing a second Telegram round-trip for a new cover.
 */
export async function persistCoverThumbnail(
  kv: ThumbnailKv | null | undefined,
  mediaId: string,
  bytes: ArrayBuffer,
  metadata: ThumbnailMetadata,
  variant: CoverVariant = 'thumb'
): Promise<'stored' | 'skipped'> {
  if (!kv || !isMediaId(mediaId) || bytes.byteLength === 0 || bytes.byteLength > MAX_COVER_THUMBNAIL_BYTES) {
    return 'skipped';
  }
  if (!metadata.contentType?.startsWith('image/')) return 'skipped';
  await kv.put(coverThumbnailKey(mediaId, variant), bytes, {
    metadata: {
      contentType: metadata.contentType,
      contentLength: String(bytes.byteLength),
      etag: metadata.etag
    }
  });
  return 'stored';
}

/** Read an un-sized image stream without retaining more than the cover budget. */
export async function readBoundedCoverResponse(
  response: Response,
  idleTimeoutMs = COVER_BODY_IDLE_TIMEOUT_MS
): Promise<ArrayBuffer | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const next = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('cover body timed out')), idleTimeoutMs);
        })
      ]).finally(() => {
        if (timer) clearTimeout(timer);
      });
      const { done, value } = next;
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_COVER_THUMBNAIL_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    if (total === 0) return null;
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes.buffer;
  } catch {
    // Do not let a peer that stopped sending its body hold the publication
    // warmer forever. Cancellation is best-effort and must not delay recovery.
    void reader.cancel().catch(() => {});
    return null;
  }
}

export async function readCoverThumbnail(
  kv: ThumbnailKv | null | undefined,
  mediaId: string,
  ifNoneMatch: string | null,
  variant: CoverVariant = 'thumb'
): Promise<Response | null> {
  if (!kv || !isMediaId(mediaId)) return null;
  const cached = await kv.getWithMetadata(coverThumbnailKey(mediaId, variant), { type: 'arrayBuffer' }).catch(() => null);
  if (!cached?.value) return null;

  const metadata = cached.metadata || {};
  const headers = new Headers({
    'Content-Type': metadata.contentType || 'image/jpeg',
    'Content-Length': metadata.contentLength || String(cached.value.byteLength),
    'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'X-Media-Cache': 'COVER_THUMBNAIL_KV',
    'X-Thumbnail-Strategy': 'prewarmed',
    'X-Cover-Variant': variant
  });
  if (metadata.etag) headers.set('ETag', metadata.etag);
  if (metadata.etag && ifNoneMatch === metadata.etag) return new Response(null, { status: 304, headers });
  return new Response(cached.value, { status: 200, headers });
}

export async function warmCoverThumbnail(
  kv: ThumbnailKv | null | undefined,
  origin: string,
  mediaId: string,
  variant: CoverVariant = 'thumb',
  internalToken?: string
): Promise<'warmed' | 'already_warm' | 'skipped' | 'failed'> {
  if (!kv || !isMediaId(mediaId) || !internalToken) return 'skipped';

  const key = `${coverThumbnailKey(mediaId, variant)}:warm`;
  const existing = inFlightWarms.get(key);
  if (existing) return existing;

  const warm = (async (): Promise<'warmed' | 'already_warm' | 'skipped' | 'failed'> => {
    // /media is the *only* owner of thumbnail persistence. Its authenticated
    // warm path makes one KV read and, on a miss, exactly one KV write. The
    // former helper also read and wrote KV here, creating a double-write.
    const response = await fetch(`${origin.replace(/\/$/, '')}/media/${mediaId}?size=${variant}&v=3`, {
      headers: { Authorization: `Bearer ${internalToken}` },
      signal: AbortSignal.timeout(12_000)
    }).catch(() => null);
    if (!response?.ok || !response.body) return 'failed';

    const contentType = response.headers.get('content-type') || '';
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (!contentType.startsWith('image/') || (declaredLength > MAX_COVER_THUMBNAIL_BYTES && declaredLength > 0)) {
      return 'skipped';
    }

    // Persistence has completed before the authenticated /media response is
    // returned. Cancel only this client branch; it avoids retaining cover
    // bytes in the warmer while the canonical route owns the cache entry.
    await response.body.cancel().catch(() => {});
    return response.headers.get('X-Media-Cache') === 'COVER_THUMBNAIL_KV'
      ? 'already_warm'
      : response.headers.get('X-Cover-Warm') === 'skipped' ? 'skipped' : 'warmed';
  })();
  inFlightWarms.set(key, warm);
  try {
    return await warm;
  } finally {
    inFlightWarms.delete(key);
  }
}
