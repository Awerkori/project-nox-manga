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
});
