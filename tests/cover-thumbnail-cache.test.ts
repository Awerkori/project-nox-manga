import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  coverThumbnailKey,
  persistCoverThumbnail,
  readBoundedCoverResponse,
  readCoverThumbnail,
  warmCoverThumbnail
} from '../src/lib/server/cover-thumbnail-cache';

const mediaId = '11111111-1111-4111-8111-111111111111';

function memoryKv() {
  const records = new Map<string, { value: ArrayBuffer; metadata: Record<string, string> }>();
  return {
    records,
    getWithMetadata: vi.fn(async (key: string) => records.get(key) || null),
    put: vi.fn(async (key: string, value: ArrayBuffer, options: { metadata: Record<string, string> }) => {
      records.set(key, { value, metadata: options.metadata });
    })
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('cover thumbnail KV', () => {
  it('serves an immutable image without reaching Yugabyte or Telegram', async () => {
    const kv = memoryKv();
    await kv.put(coverThumbnailKey(mediaId), new Uint8Array([1, 2, 3]).buffer, {
      metadata: { contentType: 'image/webp', contentLength: '3', etag: '"cover"' }
    });

    const response = await readCoverThumbnail(kv, mediaId, null);
    expect(response?.status).toBe(200);
    expect(response?.headers.get('X-Media-Cache')).toBe('COVER_THUMBNAIL_KV');
    expect(response?.headers.get('Cache-Control')).toContain('immutable');
    expect(new Uint8Array(await response!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('delegates a cold warm to /media without a second KV read or write', async () => {
    const kv = memoryKv();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([9, 8, 7]), {
      headers: { 'Content-Type': 'image/jpeg', 'ETag': '"thumb"', 'Content-Length': '3', 'X-Media-Cache': 'MISS' }
    })));

    await expect(warmCoverThumbnail(kv, 'https://nox.test', mediaId, 'thumb', 'internal-token')).resolves.toBe('warmed');
    expect(kv.getWithMetadata).not.toHaveBeenCalled();
    expect(kv.put).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/media/${mediaId}?size=thumb&v=3`),
      expect.objectContaining({ headers: { Authorization: 'Bearer internal-token' } })
    );
  });

  it('keeps the hero derivative separate from a card thumbnail', async () => {
    const kv = memoryKv();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([7, 2, 0]), {
      headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '3', 'X-Media-Cache': 'MISS' }
    })));

    await expect(warmCoverThumbnail(kv, 'https://nox.test', mediaId, 'hero', 'internal-token')).resolves.toBe('warmed');
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('persists an already-produced valid cover without another fetch', async () => {
    const kv = memoryKv();
    await expect(persistCoverThumbnail(kv, mediaId, new Uint8Array([3, 2, 1]).buffer, {
      contentType: 'image/jpeg', etag: '"hero"'
    }, 'hero')).resolves.toBe('stored');
    expect(kv.records.get(coverThumbnailKey(mediaId, 'hero'))?.metadata.contentLength).toBe('3');
  });

  it('does not retain an unknown-length image beyond the cover budget', async () => {
    const tooLarge = new Uint8Array(2 * 1024 * 1024 + 1);
    await expect(readBoundedCoverResponse(new Response(tooLarge))).resolves.toBeNull();
  });

  it('bounds a response whose body stops after headers', async () => {
    const response = new Response(new ReadableStream<Uint8Array>({
      pull() {
        // Deliberately never enqueue or close.
      }
    }));

    await expect(readBoundedCoverResponse(response, 5)).resolves.toBeNull();
  });

  it('does not cache oversized thumbnail responses', async () => {
    const kv = memoryKv();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1]), {
      headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(3 * 1024 * 1024) }
    })));

    await expect(warmCoverThumbnail(kv, 'https://nox.test', mediaId, 'thumb', 'internal-token')).resolves.toBe('skipped');
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('coalesces concurrent warm requests for the same cover variant', async () => {
    const kv = memoryKv();
    let resolveFetch: ((response: Response) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })));

    const first = warmCoverThumbnail(kv, 'https://nox.test', mediaId, 'thumb', 'internal-token');
    const second = warmCoverThumbnail(kv, 'https://nox.test', mediaId, 'thumb', 'internal-token');
    expect(fetch).toHaveBeenCalledTimes(1);
    resolveFetch?.(new Response(new Uint8Array([1]), {
      headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1', 'X-Media-Cache': 'MISS' }
    }));
    await expect(Promise.all([first, second])).resolves.toEqual(['warmed', 'warmed']);
  });
});
