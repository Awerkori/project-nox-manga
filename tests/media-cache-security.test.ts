import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  resolveSessionData: vi.fn(),
  extractFullAuthCookie: vi.fn(),
  decodeSessionJwt: vi.fn(),
  dbFrom: vi.fn(),
  mediaRecord: null as any
}));

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
  resolveBotDownloadClient: () => ({
    download: mocks.download
  }),
  normalizeBotReference: (x: string) => x,
  deduceMangaShardFromFileId: () => null
}));

vi.mock('$lib/server/session-cache', () => ({
  extractFullAuthCookie: mocks.extractFullAuthCookie,
  decodeSessionJwt: mocks.decodeSessionJwt,
  resolveSessionData: mocks.resolveSessionData
}));

import { GET } from '../src/routes/media/[id]/+server';

describe('Media Security and Cache Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock DB behavior
    mocks.dbFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mocks.mediaRecord })
        })
      })
    });
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

  it('generates real WebP thumbnail derivative for ?size=thumb from 1000x1500 fixture while leaving original byte-identical', async () => {
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
    expect(thumbRes.headers.get('Content-Type')).toBe('image/webp');
    expect(thumbRes.headers.get('ETag')).toBe('"fixture_original_sha256-thumb"');

    const thumbBytes = new Uint8Array(await thumbRes.arrayBuffer());
    // Must be significantly fewer bytes than the 1000x1500 JPEG fixture
    expect(thumbBytes.length).toBeLessThan(fixtureJpeg.length / 2);
    // Must be valid WebP (starts with RIFF....WEBP)
    const headerStr = Buffer.from(thumbBytes.slice(0, 12)).toString('ascii');
    expect(headerStr.startsWith('RIFF') && headerStr.includes('WEBP')).toBe(true);

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
    const returnedBytes = new Uint8Array(await res.arrayBuffer());
    expect(returnedBytes.length).toBe(gifBytes.length);
    expect(Buffer.from(returnedBytes).equals(Buffer.from(gifBytes))).toBe(true);
  });
});
