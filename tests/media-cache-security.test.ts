import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const download = vi.fn();
  const resolveBotClient = vi.fn((_botRef?: string) => ({ download }));
  return {
    download,
    resolveBotClient,
    resolveSessionData: vi.fn(),
    extractFullAuthCookie: vi.fn(),
    decodeSessionJwt: vi.fn(),
    dbFrom: vi.fn(),
    fetchMediaMetadataFromYugabyte: vi.fn(),
    mediaRecord: null as any
  };
});

vi.mock('$lib/server/db', () => ({
  privileged: () => ({
    from: mocks.dbFrom,
    storage: {
      from: () => ({
        download: vi.fn().mockResolvedValue({ data: null, error: new Error('Download failed') })
      })
    }
  })
}));

vi.mock('$lib/server/storage-router', () => ({
  resolveBotDownloadClient: (botRef?: string) => mocks.resolveBotClient(botRef),
  normalizeBotReference: (x: string) => x,
  deduceMangaShardFromFileId: () => null
}));

vi.mock('$lib/server/session-cache', () => ({
  extractFullAuthCookie: mocks.extractFullAuthCookie,
  decodeSessionJwt: mocks.decodeSessionJwt,
  resolveSessionData: mocks.resolveSessionData
}));

vi.mock('$lib/server/yugabyte', () => ({
  fetchMediaMetadataFromYugabyte: mocks.fetchMediaMetadataFromYugabyte,
  executeYugabyteSql: vi.fn(async () => ({ rows: [] }))
}));

import { GET } from '../src/routes/media/[id]/+server';
import { TelegramStorageError } from '../src/lib/server/telegram';

describe('Media Security and Cache Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveBotClient.mockImplementation((_botRef?: string) => ({ download: mocks.download }));
    mocks.fetchMediaMetadataFromYugabyte.mockImplementation(async () => mocks.mediaRecord);
    // Default mock DB behavior
    mocks.dbFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mocks.mediaRecord })
        })
      })
    });
  });

  it('writes a cold cover once only for an authenticated publication warm', async () => {
    const mediaId = '88888888-8888-4888-8888-888888888888';
    const records = new Map<string, { value: ArrayBuffer; metadata: Record<string, string> }>();
    const kv = {
      get: vi.fn(async () => null),
      getWithMetadata: vi.fn(async (key: string) => records.get(key) || null),
      put: vi.fn(async (key: string, value: ArrayBuffer, options: { metadata: Record<string, string> }) => {
        records.set(key, { value, metadata: options.metadata });
      })
    };
    mocks.mediaRecord = {
      id: mediaId, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
      access_class: 'PUBLIC', purpose: 'editorial', bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg', sha256: 'warm_hash', provider_key: 'warm_key', bytes: 4,
      width: 1440, height: 2048
    };
    mocks.download.mockResolvedValue(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));

    const res = await GET({
      locals: {}, params: { id: mediaId },
      request: new Request(`https://nox.invalid/media/${mediaId}?size=thumb`, {
        headers: { Authorization: 'Bearer internal-token' }
      }),
      platform: { env: { COVER_THUMBNAILS: kv, NOX_STORAGE_BRIDGE_TOKEN: 'internal-token' } },
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cover-Warm')).toBe('stored');
    expect(kv.getWithMetadata).toHaveBeenCalledTimes(1);
    expect(kv.put).toHaveBeenCalledTimes(1);
  });

  it('does not let an unauthenticated cold cover view create a KV write', async () => {
    const mediaId = '99999999-9999-4999-8999-999999999999';
    const kv = { get: vi.fn(async () => null), getWithMetadata: vi.fn(async () => null), put: vi.fn() };
    mocks.mediaRecord = {
      id: mediaId, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
      access_class: 'PUBLIC', purpose: 'editorial', bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg', sha256: 'public_hash', provider_key: 'public_key', bytes: 4,
      width: 1440, height: 2048
    };
    mocks.download.mockResolvedValue(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));

    const res = await GET({
      locals: {}, params: { id: mediaId },
      request: new Request(`https://nox.invalid/media/${mediaId}?size=thumb`),
      platform: { env: { COVER_THUMBNAILS: kv, NOX_STORAGE_BRIDGE_TOKEN: 'internal-token' } },
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(200);
    expect(kv.getWithMetadata).toHaveBeenCalledTimes(1);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('rejects anonymous access to staff_manual media (MUST NOT be public)', async () => {
    mocks.mediaRecord = {
      id: '22222222-2222-4222-8222-222222222222',
      provider: 'telegram',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: null,
      purpose: 'staff_manual',
      bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg',
      sha256: 'staff_hash',
      provider_key: 'staff_key'
    };

    mocks.extractFullAuthCookie.mockReturnValue(null);

    const res = await GET({
      locals: {},
      params: { id: mocks.mediaRecord.id },
      request: new Request('https://nox.invalid/media/' + mocks.mediaRecord.id),
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Acesso não autorizado');
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  it('serves public editorial media with X-Media-Cache: MISS on cold request', async () => {
    mocks.mediaRecord = {
      id: '33333333-3333-4333-8333-333333333333',
      provider: 'telegram',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'editorial',
      bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/webp',
      sha256: 'editorial_hash',
      provider_key: 'editorial_key',
      bytes: 120000
    };

    mocks.download.mockResolvedValue(new Uint8Array([82, 73, 70, 70]));

    const res = await GET({
      locals: {},
      params: { id: mocks.mediaRecord.id },
      request: new Request('https://nox.invalid/media/' + mocks.mediaRecord.id),
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Media-Cache')).toBe('MISS');
    expect(res.headers.get('Cache-Control')).toContain('public');
    expect(res.headers.get('Cache-Control')).toContain('immutable');
  });

  it('returns cached response immediately with X-Media-Cache: HIT and zero DB lookup', async () => {
    const cachedResponse = new Response('cached-image-data', {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'ETag': '"cached_etag"',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });

    const mockMatch = vi.fn().mockResolvedValue(cachedResponse);
    const originalCaches = (globalThis as any).caches;
    (globalThis as any).caches = {
      default: {
        match: mockMatch,
        put: vi.fn()
      }
    };

    try {
      const res = await GET({
        locals: {},
        params: { id: '44444444-4444-4444-8444-444444444444' },
        request: new Request('https://nox.invalid/media/44444444-4444-4444-8444-444444444444'),
        platform: { env: { COVER_THUMBNAILS: { get: vi.fn(async () => null) } } },
        cookies: { getAll: () => [] }
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('X-Media-Cache')).toBe('HIT');
      expect(await res.text()).toBe('cached-image-data');
      // DB was never touched
      expect(mocks.dbFrom).not.toHaveBeenCalled();
    } finally {
      (globalThis as any).caches = originalCaches;
    }
  });

  it('returns controlled 502 with no-store on storage failure, NEVER a false 200 transparent PNG', async () => {
    mocks.mediaRecord = {
      id: '55555555-5555-4555-8555-555555555555',
      provider: 'telegram',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'editorial',
      bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg',
      sha256: 'missing_key_hash',
      provider_key: 'failing_key'
    };

    mocks.download.mockRejectedValue(new Error('Storage unavailable'));

    const res = await GET({
      locals: {},
      params: { id: mocks.mediaRecord.id },
      request: new Request('https://nox.invalid/media/' + mocks.mediaRecord.id),
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(502);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const data = await res.json();
    expect(data.error).toBe('Página temporariamente indisponível');
  });

  it('falls back to a fresh original stream after thumbnail processing fails', async () => {
    const mediaId = '56565656-5656-4656-8656-565656565656';
    mocks.mediaRecord = {
      id: mediaId,
      provider: 'telegram',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'editorial',
      bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg',
      sha256: 'broken_thumbnail_source',
      provider_key: 'broken_thumbnail_source_key',
      bytes: 128,
      width: 1000,
      height: 1500
    };
    const brokenStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('source stream failed'));
      }
    });
    mocks.download.mockResolvedValueOnce(brokenStream).mockResolvedValueOnce(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));

    const res = await GET({
      locals: {},
      params: { id: mediaId },
      request: new Request(`https://nox.invalid/media/${mediaId}?size=thumb`),
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Thumbnail-Strategy')).toBe('fallback-original');
    expect(mocks.download).toHaveBeenCalledTimes(2);
  });

  it('falls back to healed altBotRef when thumbnail fails after bot mismatch (tg400)', async () => {
    const mediaId = '57575757-5757-4757-8757-575757575757';
    mocks.mediaRecord = {
      id: mediaId,
      provider: 'telegram',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'editorial',
      bot_reference: 'MANGA_STORAGE_2',
      mime: 'image/jpeg',
      sha256: 'alt_bot_thumbnail_fallback',
      provider_key: 'alt_bot_thumbnail_source_key',
      bytes: 128,
      width: 1000,
      height: 1500
    };

    const clientsUsed: (string | undefined)[] = [];
    mocks.resolveBotClient.mockImplementation((botRef?: string) => {
      clientsUsed.push(botRef);
      return {
        download: mocks.download
      };
    });

    const brokenStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('broken stream on alt bot'));
      }
    });

    // 1st call on MANGA_STORAGE_2 fails with tg400 (bot mismatch)
    // 2nd call on MANGA_STORAGE_01 delivers stream that fails thumbnail decoder
    // 3rd call is fallback to original: MUST use MANGA_STORAGE_01 (healed bot), not initial failing MANGA_STORAGE_2
    mocks.download
      .mockRejectedValueOnce(new TelegramStorageError('http', 400))
      .mockResolvedValueOnce(brokenStream)
      .mockResolvedValueOnce(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));

    const res = await GET({
      locals: {},
      params: { id: mediaId },
      request: new Request(`https://nox.invalid/media/${mediaId}?size=thumb`),
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Thumbnail-Strategy')).toBe('fallback-original');
    expect(mocks.download).toHaveBeenCalledTimes(3);
    // The 3rd resolution (fallback download) must have used MANGA_STORAGE_01
    expect(clientsUsed).toEqual(['MANGA_STORAGE_2', 'MANGA_STORAGE_01', 'MANGA_STORAGE_01']);
  });

  it('retries one transient Telegram download failure before returning an error', async () => {
    const mediaId = '88888888-8888-4888-8888-888888888888';
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    mocks.mediaRecord = {
      id: mediaId, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
      access_class: 'PUBLIC', purpose: 'editorial', bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg', sha256: 'retry_sha256', provider_key: 'retry_key', bytes: bytes.length
    };
    mocks.download
      .mockRejectedValueOnce(new TelegramStorageError('network'))
      .mockResolvedValueOnce(bytes);

    const res = await GET({
      locals: {},
      params: { id: mediaId },
      request: new Request(`https://nox.invalid/media/${mediaId}`),
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(200);
    expect(mocks.download).toHaveBeenCalledTimes(2);
  });

  it('cancels a stalled thumbnail body and falls back to the original stream', async () => {
    vi.useFakeTimers();
    try {
      const mediaId = '99999999-9999-4999-8999-999999999999';
      const stalledBody = new ReadableStream<Uint8Array>({
        pull: () => new Promise<void>(() => {}),
        cancel: () => undefined
      });
      const originalBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
      mocks.mediaRecord = {
        id: mediaId,
        provider: 'telegram',
        storage_ready: true,
        status: 'ACTIVE',
        access_class: 'PUBLIC',
        purpose: 'editorial',
        bot_reference: 'MANGA_STORAGE_01',
        mime: 'image/jpeg',
        sha256: 'stalled_sha256',
        provider_key: 'stalled_key',
        bytes: 3_000_000,
        width: 2000,
        height: 2000
      };
      mocks.download.mockResolvedValueOnce(stalledBody).mockResolvedValueOnce(originalBytes);

      const responsePromise = GET({
        locals: {},
        params: { id: mediaId },
        request: new Request(`https://nox.invalid/media/${mediaId}?size=thumb`),
        cookies: { getAll: () => [] }
      });
      await vi.advanceTimersByTimeAsync(12_000);
      const res = await responsePromise;

      expect(res.status).toBe(200);
      expect(res.headers.get('X-Thumbnail-Strategy')).toBe('fallback-original');
      expect(mocks.download).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('generates real thumbnail derivative for ?size=thumb from 1000x1500 fixture while leaving original byte-identical', async () => {
    const jpeg = (await import('jpeg-js')).default;
    const w = 1000, h = 1500;
    const rawRgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < rawRgba.length; i += 4) {
      rawRgba[i] = (i / 4) % 256;
      rawRgba[i + 1] = 120;
      rawRgba[i + 2] = 200;
      rawRgba[i + 3] = 255;
    }
    const fixtureJpeg = jpeg.encode({ data: rawRgba, width: w, height: h }, 85).data;
    expect(fixtureJpeg.length).toBeGreaterThan(100_000);

    const mediaId = '66666666-6666-4666-8666-666666666666';
    mocks.mediaRecord = {
      id: mediaId,
      provider: 'telegram',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'editorial',
      bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg',
      sha256: 'fixture_original_sha256',
      provider_key: 'fixture_key',
      bytes: fixtureJpeg.length
    };
    mocks.download.mockResolvedValue(fixtureJpeg);

    // 1. Request thumbnail derivative: ?size=thumb
    const thumbRes = await GET({
      locals: {},
      params: { id: mediaId },
      request: new Request(`https://nox.invalid/media/${mediaId}?size=thumb`),
      cookies: { getAll: () => [] }
    });

    expect(thumbRes.status).toBe(200);
    expect(thumbRes.headers.get('Content-Type')).toBe('image/jpeg');
    expect(thumbRes.headers.get('ETag')).toBe('"fixture_original_sha256-thumb-v3"');

    const thumbBytes = new Uint8Array(await thumbRes.arrayBuffer());
    // Must be significantly fewer bytes than the 1000x1500 JPEG fixture (>50% reduction)
    expect(thumbBytes.length).toBeLessThan(fixtureJpeg.length / 2);
    // Must be valid JPEG (starts with FF D8)
    expect(thumbBytes[0]).toBe(0xff);
    expect(thumbBytes[1]).toBe(0xd8);

    // 2. Request original full-size: /media/{id}
    const originalRes = await GET({
      locals: {},
      params: { id: mediaId },
      request: new Request(`https://nox.invalid/media/${mediaId}`),
      cookies: { getAll: () => [] }
    });

    expect(originalRes.status).toBe(200);
    expect(originalRes.headers.get('Content-Type')).toBe('image/jpeg');
    expect(originalRes.headers.get('ETag')).toBe('"fixture_original_sha256"');

    const originalBytes = new Uint8Array(await originalRes.arrayBuffer());
    // Must be byte-identical to the original fixture
    expect(originalBytes.length).toBe(fixtureJpeg.length);
    expect(Buffer.from(originalBytes).equals(Buffer.from(fixtureJpeg))).toBe(true);
  });

  it('streams a compact, high-pixel cover instead of holding the cold request for JS resizing', async () => {
    const mediaId = '67666666-6666-4666-8666-666666666666';
    const original = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    mocks.mediaRecord = {
      id: mediaId,
      provider: 'telegram',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'editorial',
      bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg',
      sha256: 'compact_high_pixel_cover',
      provider_key: 'compact_high_pixel_cover_key',
      bytes: original.length,
      width: 1440,
      height: 2048
    };
    mocks.download.mockResolvedValue(original);

    const res = await GET({
      locals: {},
      params: { id: mediaId },
      request: new Request(`https://nox.invalid/media/${mediaId}?size=thumb`),
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Thumbnail-Strategy')).toBe('stream-original');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(original);
  });

  it('preserves animated GIFs intact on ?size=thumb without converting to static image', async () => {
    // Valid GIF89a header + minimal screen descriptor
    const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x0a, 0x00, 0x0a, 0x00, 0x80, 0x00, 0x00]);
    const mediaId = '77777777-7777-4777-8777-777777777777';
    mocks.mediaRecord = {
      id: mediaId,
      provider: 'telegram',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'editorial',
      bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/gif',
      sha256: 'gif_sha256',
      provider_key: 'gif_key',
      bytes: gifBytes.length
    };
    mocks.download.mockResolvedValue(gifBytes);

    const res = await GET({
      locals: {},
      params: { id: mediaId },
      request: new Request(`https://nox.invalid/media/${mediaId}?size=thumb`),
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/gif');
    expect(res.headers.get('X-Thumbnail-Strategy')).toBe('stream-original');
    const returnedBytes = new Uint8Array(await res.arrayBuffer());
    expect(returnedBytes.length).toBe(gifBytes.length);
    expect(Buffer.from(returnedBytes).equals(Buffer.from(gifBytes))).toBe(true);
  });

  it('revalidates with 304 Not Modified when client sends a weak If-None-Match matching the media ETag', async () => {
    const mediaId = '81818181-8181-4181-8181-818181818181';
    mocks.mediaRecord = {
      id: mediaId, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
      access_class: 'PUBLIC', purpose: 'editorial', bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg', sha256: 'weak_etag_target', provider_key: 'target_key', bytes: 100
    };

    const res = await GET({
      locals: {},
      params: { id: mediaId },
      request: new Request(`https://nox.invalid/media/${mediaId}`, {
        headers: { 'If-None-Match': 'W/"weak_etag_target"' }
      }),
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(304);
    expect(res.headers.get('ETag')).toBe('"weak_etag_target"');
  });

  it('rejects conditional request with 412 Precondition Failed when If-Match does not match', async () => {
    const mediaId = '82828282-8282-4282-8282-828282828282';
    mocks.mediaRecord = {
      id: mediaId, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
      access_class: 'PUBLIC', purpose: 'editorial', bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg', sha256: 'actual_etag_val', provider_key: 'target_key', bytes: 100
    };

    const res = await GET({
      locals: {},
      params: { id: mediaId },
      request: new Request(`https://nox.invalid/media/${mediaId}`, {
        headers: { 'If-Match': '"mismatched_etag"' }
      }),
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(412);
  });

  it('serves 200 with full entity when If-Range validator does not match target ETag', async () => {
    const mediaId = '83838383-8383-4383-8383-838383838383';
    const originalBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    mocks.mediaRecord = {
      id: mediaId, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
      access_class: 'PUBLIC', purpose: 'editorial', bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg', sha256: 'real_range_etag', provider_key: 'target_key', bytes: 10
    };
    mocks.download.mockResolvedValue(originalBytes);

    const res = await GET({
      locals: {},
      params: { id: mediaId },
      request: new Request(`https://nox.invalid/media/${mediaId}`, {
        headers: {
          'Range': 'bytes=0-3',
          'If-Range': '"stale_or_mismatched_etag"'
        }
      }),
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Length')).toBe('10');
    expect(res.headers.get('Content-Range')).toBeNull();
  });
});
