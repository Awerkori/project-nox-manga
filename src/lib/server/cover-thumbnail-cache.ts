const MAX_COVER_THUMBNAIL_BYTES = 2 * 1024 * 1024;

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

export const coverThumbnailKey = (mediaId: string, variant: CoverVariant = 'thumb') => `cover-${variant}:v1:${mediaId}`;

export function isMediaId(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export async function hasCoverThumbnail(kv: ThumbnailKv | null | undefined, mediaId: string, variant: CoverVariant = 'thumb'): Promise<boolean> {
  if (!kv || !isMediaId(mediaId)) return false;
  const cached = await kv.getWithMetadata(coverThumbnailKey(mediaId, variant), { type: 'arrayBuffer' }).catch(() => null);
  return Boolean(cached?.value);
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
  variant: CoverVariant = 'thumb'
): Promise<'warmed' | 'already_warm' | 'skipped' | 'failed'> {
  if (!kv || !isMediaId(mediaId)) return 'skipped';
  const key = coverThumbnailKey(mediaId, variant);
  const existing = await kv.getWithMetadata(key, { type: 'arrayBuffer' }).catch(() => null);
  if (existing?.value) return 'already_warm';

  const response = await fetch(`${origin.replace(/\/$/, '')}/media/${mediaId}?size=${variant}&v=3`, {
    signal: AbortSignal.timeout(12_000)
  }).catch(() => null);
  if (!response?.ok || !response.body) return 'failed';

  const contentType = response.headers.get('content-type') || '';
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (!contentType.startsWith('image/') || (declaredLength > MAX_COVER_THUMBNAIL_BYTES && declaredLength > 0)) {
    return 'skipped';
  }

  const bytes = await response.arrayBuffer().catch(() => null);
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength > MAX_COVER_THUMBNAIL_BYTES) return 'skipped';
  await kv.put(key, bytes, {
    metadata: {
      contentType,
      contentLength: String(bytes.byteLength),
      etag: response.headers.get('etag') || undefined
    }
  });
  return 'warmed';
}
