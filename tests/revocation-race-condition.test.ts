import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  fetchMediaMetadataFromYugabyte: vi.fn(),
  executeYugabyteSql: vi.fn(),
  extractFullAuthCookie: vi.fn(),
  decodeSessionJwt: vi.fn(),
  resolveSessionData: vi.fn(),
  mediaStore: new Map<string, any>()
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

vi.mock('$lib/server/yugabyte', () => ({
  fetchMediaMetadataFromYugabyte: vi.fn(async (id: string, _env?: any, _options?: { forceFresh?: boolean }) => {
    return mocks.mediaStore.get(id) || null;
  }),
  executeYugabyteSql: mocks.executeYugabyteSql,
  invalidateMediaMetadataCache: vi.fn((_id: string) => {
    // Invalidate local in-memory store if needed
  }),
  invalidateYugabyteLkgPrefix: vi.fn()
}));

import { GET as getPublicMediaRoute } from '../src/routes/media/[id]/+server';
import { POST as revokeMediaEndpoint } from '../src/routes/api/internal/media/revoke/+server';
import { GET as getPrivateMediaRoute } from '../src/routes/api/media/[id]/+server';
import { revokeMedia, isMediaRevoked, clearMemoryRevocationCache } from '../src/lib/server/media-revocation';

function createMockKv(initialData: Record<string, any> = {}, initialMetadata: Record<string, any> = {}) {
  const store = new Map<string, any>();
  const metaStore = new Map<string, any>();
  for (const [k, v] of Object.entries(initialData)) {
    store.set(k, v);
  }
  for (const [k, v] of Object.entries(initialMetadata)) {
    metaStore.set(k, v);
  }
  return {
    _store: store,
    _metaStore: metaStore,
    get: vi.fn(async (key: string, opts?: any) => {
      const val = store.get(key);
      if (!val) return null;
      if (opts?.type === 'json') {
        try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return null; }
      }
      return typeof val === 'string' ? val : JSON.stringify(val);
    }),
    getWithMetadata: vi.fn(async (key: string, _opts?: any) => {
      const val = store.get(key);
      if (!val) return { value: null, metadata: null };
      const meta = metaStore.get(key) || null;
      const buffer = val instanceof ArrayBuffer ? val : (val instanceof Uint8Array ? val.buffer : new TextEncoder().encode(String(val)).buffer);
      return { value: buffer, metadata: meta };
    }),
    put: vi.fn(async (key: string, val: any, opts?: any) => {
      store.set(key, val);
      if (opts?.metadata) {
        metaStore.set(key, opts.metadata);
      }
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
      metaStore.delete(key);
    })
  };
}

function createMockCache() {
  const map = new Map<string, Response>();
  return {
    _map: map,
    match: vi.fn(async (req: any) => {
      const key = typeof req === 'string' ? req : req.url;
      const res = map.get(key);
      return res ? res.clone() : null;
    }),
    put: vi.fn(async (req: any, res: Response) => {
      const key = typeof req === 'string' ? req : req.url;
      map.set(key, res.clone());
    }),
    delete: vi.fn(async (req: any) => {
      const key = typeof req === 'string' ? req : req.url;
      return map.delete(key);
    })
  };
}

describe('P0 — 1. Forensic Media Revocation Concurrency & Race Condition Proofs', () => {
  const testMediaId = '77777777-8888-4999-a000-bbbbbbbb0001';
  const bridgeToken = 'auth-token-test-123';

  beforeEach(() => {
    vi.clearAllMocks();
    clearMemoryRevocationCache();
    mocks.mediaStore.clear();
    mocks.extractFullAuthCookie.mockReturnValue(null);

    mocks.executeYugabyteSql.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('SELECT status FROM public.media') || sql.includes('SELECT status FROM media')) {
        const id = params?.[0];
        const item = mocks.mediaStore.get(id);
        return { rows: item ? [{ status: item.status }] : [], rowCount: item ? 1 : 0 };
      }
      if (sql.includes('UPDATE public.media') || sql.includes('UPDATE media')) {
        if (sql.includes('access_class = $2') && params?.[0] && params?.[1] && params?.[2]) {
          const item = mocks.mediaStore.get(params[2]);
          if (item) {
            item.status = params[0];
            item.access_class = params[1];
            mocks.mediaStore.set(params[2], item);
          }
        } else {
          const statusMatch = sql.match(/SET status = \$1/);
          if (statusMatch && params?.[0] && params?.[1]) {
            const item = mocks.mediaStore.get(params[1]);
            if (item) {
              item.status = params[0];
              mocks.mediaStore.set(params[1], item);
            }
          } else if (sql.includes("SET status = 'ACTIVE'")) {
            const id = params?.[0];
            const item = mocks.mediaStore.get(id);
            if (item) {
              item.status = 'ACTIVE';
              mocks.mediaStore.set(id, item);
            }
          }
        }
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    mocks.download.mockResolvedValue(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]));
          controller.close();
        }
      })
    );
  });

  it('1. Administrative revocation authoritatively updates public.media.status = DELETED before KV and purge', async () => {
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_active_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      mime: 'image/webp',
      bytes: 12
    });

    const mockKv = createMockKv();
    const mockCache = createMockCache();
    const mockCtx = {
      cache: {
        purge: vi.fn().mockResolvedValue({ success: true, errors: [] })
      }
    };

    const res = await revokeMediaEndpoint({
      request: new Request('https://projectnox.org/api/internal/media/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bridgeToken}`
        },
        body: JSON.stringify({
          mediaId: testMediaId,
          reason: 'DMCA_TAKEDOWN'
        })
      }),
      url: new URL('https://projectnox.org/api/internal/media/revoke'),
      platform: {
        env: {
          COVER_THUMBNAILS: mockKv,
          NOX_STORAGE_BRIDGE_TOKEN: bridgeToken
        },
        caches: { default: mockCache },
        context: mockCtx
      },
      cookies: { getAll: () => [] }
    } as any);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.revokedCount).toBe(1);

    // Verify DB update happened authoritatively
    expect(mocks.executeYugabyteSql).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE public.media SET status = $1 WHERE id = $2;'),
      ['DELETED', testMediaId],
      expect.anything()
    );
    expect(mocks.mediaStore.get(testMediaId).status).toBe('DELETED');

    // Verify KV tombstone exists
    expect(await mockKv.get(`revoked:v1:${testMediaId}`)).toBeTruthy();
  });

  it('2. SQL failure during revocation strictly HALTS revocation without reporting success or dispatching purge', async () => {
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_active_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'chapter_page'
    });

    // Simulate SQL failure (database connection error, deadlock, etc.)
    mocks.executeYugabyteSql.mockRejectedValueOnce(new Error('YSQL_CONNECTION_TIMEOUT'));

    const mockKv = createMockKv();
    const mockCache = createMockCache();
    const mockCtx = {
      cache: {
        purge: vi.fn().mockResolvedValue({ success: true, errors: [] })
      }
    };

    const res = await revokeMediaEndpoint({
      request: new Request('https://projectnox.org/api/internal/media/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bridgeToken}`
        },
        body: JSON.stringify({
          mediaId: testMediaId,
          reason: 'DMCA_TAKEDOWN'
        })
      }),
      url: new URL('https://projectnox.org/api/internal/media/revoke'),
      platform: {
        env: {
          COVER_THUMBNAILS: mockKv,
          NOX_STORAGE_BRIDGE_TOKEN: bridgeToken
        },
        caches: { default: mockCache },
        context: mockCtx
      },
      cookies: { getAll: () => [] }
    } as any);

    // Must return 207 Multi-Status error, NOT 200
    expect(res.status).toBe(207);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.revokedCount).toBe(0);
    expect(data.retryRequired).toBe(true);
    expect(data.pendingIds).toContain(testMediaId);
    expect(data.errors[0].error).toContain('DB_UPDATE_FAILED');

    // Purge was NOT dispatched because DB update failed
    expect(mockCtx.cache.purge).not.toHaveBeenCalled();
  });

  it('3. Cache MISS in a remote region during KV replication delay: status = DELETED prevents reintroducing media to cache', async () => {
    // Scenario: Admin in Region A already updated DB (status = 'DELETED').
    // Region B has an EMPTY or purged cache, and Region B's KV has NOT replicated yet (simulating eventual consistency delay).
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_123',
      storage_ready: true,
      status: 'DELETED', // Authoritatively DELETED in DB
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      mime: 'image/webp',
      bytes: 12
    });

    // Remote KV does NOT have the tombstone yet (simulating 10-60s KV delay)
    const remoteKv = createMockKv(); // empty KV!
    const remoteCache = createMockCache(); // empty cache!

    const res = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, { method: 'GET' }),
      platform: {
        env: {
          COVER_THUMBNAILS: remoteKv
        },
        caches: { default: remoteCache },
        context: {
          waitUntil: (p: Promise<any>) => p
        }
      },
      cookies: { getAll: () => [] }
    } as any);

    // Must return 404 Not Found
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toContain('no-store');

    // CRUCIAL PROOF: The media was NOT downloaded from Telegram and was NOT re-cached in remoteCache!
    expect(mocks.download).not.toHaveBeenCalled();
    expect(remoteCache._map.size).toBe(0);
  });

  it('4. Concurrent in-flight request started before revocation completes after revocation: stops before cache.put and returns 404', async () => {
    // Scenario: Request starts when media was ACTIVE.
    // Download takes time. During download, admin revokes media (updating DB status = 'DELETED' and writing KV tombstone).
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      mime: 'image/webp',
      bytes: 12
    });

    const mockKv = createMockKv();
    const mockCache = createMockCache();

    // Hook download to trigger revocation in DB and KV while download is in-flight
    mocks.download.mockImplementationOnce(async () => {
      // Simulate admin revocation completing while download was in-flight
      mocks.mediaStore.get(testMediaId).status = 'DELETED';
      await mockKv.put(`revoked:v1:${testMediaId}`, JSON.stringify({ mediaId: testMediaId, reason: 'REVOKED', revokedAt: Date.now() }));

      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]));
          controller.close();
        }
      });
    });

    const res = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, { method: 'GET' }),
      platform: {
        env: {
          COVER_THUMBNAILS: mockKv,
          NOX_STORAGE_BRIDGE_TOKEN: bridgeToken
        },
        caches: { default: mockCache },
        context: {
          waitUntil: (p: Promise<any>) => p
        }
      },
      cookies: { getAll: () => [] }
    } as any);

    // In-flight request must detect revocation, NOT return 200, and must return 404!
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toContain('no-store');

    // In-flight request must NOT have repopulated the cache!
    expect(mockCache._map.size).toBe(0);
  });

  it('5. Unrevoking / restoring media updates public.media.status = ACTIVE and clears KV tombstone', async () => {
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      status: 'DELETED'
    });

    const mockKv = createMockKv({
      [`revoked:v1:${testMediaId}`]: { mediaId: testMediaId, revokedAt: Date.now() - 5000 }
    });
    const mockCache = createMockCache();

    const res = await revokeMediaEndpoint({
      request: new Request('https://projectnox.org/api/internal/media/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bridgeToken}`
        },
        body: JSON.stringify({
          action: 'unrevoke',
          mediaId: testMediaId,
          reason: 'RESTORATION'
        })
      }),
      url: new URL('https://projectnox.org/api/internal/media/revoke'),
      platform: {
        env: {
          COVER_THUMBNAILS: mockKv,
          NOX_STORAGE_BRIDGE_TOKEN: bridgeToken
        },
        caches: { default: mockCache },
        context: {
          cache: { purge: vi.fn().mockResolvedValue({ success: true, errors: [] }) }
        }
      },
      cookies: { getAll: () => [] }
    } as any);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.restoredCount).toBe(1);

    // Verify DB update happened authoritatively to ACTIVE
    expect(mocks.executeYugabyteSql).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE public.media SET status = 'ACTIVE' WHERE id = $1;"),
      [testMediaId],
      expect.anything()
    );
    expect(mocks.mediaStore.get(testMediaId).status).toBe('ACTIVE');

    // Verify tombstone was deleted from KV
    expect(await mockKv.get(`revoked:v1:${testMediaId}`)).toBeNull();
  });

  it('6. In-flight cover warm request: admin revokes during download -> suppresses KV thumbnail write and returns 404', async () => {
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_cov',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'cover',
      mime: 'image/webp',
      bytes: 12
    });

    const mockKv = createMockKv();
    const mockCache = createMockCache();

    // Hook download to trigger revocation in DB and KV while download is in-flight
    mocks.download.mockImplementationOnce(async () => {
      mocks.mediaStore.get(testMediaId).status = 'DELETED';
      await mockKv.put(`revoked:v1:${testMediaId}`, JSON.stringify({ mediaId: testMediaId, reason: 'REVOKED', revokedAt: Date.now() }));
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]));
          controller.close();
        }
      });
    });

    const res = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}?size=thumb`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${bridgeToken}`
        }
      }),
      platform: {
        env: {
          COVER_THUMBNAILS: mockKv,
          NOX_STORAGE_BRIDGE_TOKEN: bridgeToken
        },
        caches: { default: mockCache },
        context: {
          waitUntil: (p: Promise<any>) => p
        }
      },
      cookies: { getAll: () => [] }
    } as any);

    expect(res.status).toBe(404);
    // CRITICAL: Thumbnail must NOT have been written to KV!
    expect(mockKv.put).not.toHaveBeenCalledWith(expect.stringContaining(`cover:v3:thumb:${testMediaId}`), expect.anything());
    // CRITICAL: Cache must NOT have been populated!
    expect(mockCache._map.size).toBe(0);
  });

  it('7. Dedicated private endpoint /api/media/[id]: in-flight revocation during download returns 404 no-store', async () => {
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_priv',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'STAFF_ONLY',
      purpose: 'staff_manual',
      mime: 'image/webp',
      bytes: 12
    });

    mocks.extractFullAuthCookie.mockReturnValue('valid-staff-token');
    mocks.decodeSessionJwt.mockReturnValue({ jwt: { role: 'ADMIN' }, accessToken: 'tok' });
    mocks.resolveSessionData.mockResolvedValue({ role: 'ADMIN', user: { id: 'admin-1' } });

    const mockKv = createMockKv();
    mocks.download.mockImplementationOnce(async () => {
      mocks.mediaStore.get(testMediaId).status = 'DELETED';
      await mockKv.put(`revoked:v1:${testMediaId}`, JSON.stringify({ mediaId: testMediaId, reason: 'REVOKED', revokedAt: Date.now() }));
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]));
          controller.close();
        }
      });
    });

    const res = await getPrivateMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/api/media/${testMediaId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer valid-staff-token`
        }
      }),
      platform: {
        env: {
          COVER_THUMBNAILS: mockKv,
          NOX_STORAGE_BRIDGE_TOKEN: bridgeToken
        },
        context: {
          waitUntil: (p: Promise<any>) => p
        }
      },
      cookies: { getAll: () => [] }
    } as any);

    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  it('8. Media with non-active status (e.g. DISABLED) returns 404 on Cache MISS without download', async () => {
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_dis',
      storage_ready: true,
      status: 'DISABLED',
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      mime: 'image/webp',
      bytes: 12
    });

    const mockKv = createMockKv();
    const mockCache = createMockCache();

    const res = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, { method: 'GET' }),
      platform: {
        env: {
          COVER_THUMBNAILS: mockKv
        },
        caches: { default: mockCache },
        context: {
          waitUntil: (p: Promise<any>) => p
        }
      },
      cookies: { getAll: () => [] }
    } as any);

    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mockCache._map.size).toBe(0);
  });

  it('9. Mandatory Scenario: In-flight download starts ACTIVE, admin updates YSQL to DELETED, remote KV remains outdated -> post-download guard prevents cache.put() and returns 404', async () => {
    // 1. Initial state: media is ACTIVE in DB
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_in_flight_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      mime: 'image/webp',
      bytes: 12
    });

    // Remote PoP has EMPTY / lagging KV (tombstone has NOT replicated here)
    const remoteLaggingKv = createMockKv(); // NO TOMBSTONE IN KV!
    const remoteCache = createMockCache();

    // Hook download to simulate in-flight Telegram download delay
    // While download is in progress, admin alters YSQL status to 'DELETED'
    mocks.download.mockImplementationOnce(async () => {
      // Admin alters media in YSQL to DELETED
      mocks.mediaStore.get(testMediaId).status = 'DELETED';
      // KV remains outdated at this remote PoP (remoteLaggingKv is NOT updated!)

      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]));
          controller.close();
        }
      });
    });

    const res = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, { method: 'GET' }),
      platform: {
        env: {
          COVER_THUMBNAILS: remoteLaggingKv // Remote lagging KV without tombstone!
        },
        caches: { default: remoteCache },
        context: {
          waitUntil: (p: Promise<any>) => p
        }
      },
      cookies: { getAll: () => [] }
    } as any);

    // Must return 404 Not Found with no-store headers
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toContain('no-store');

    // CRITICAL FORENSIC PROOF:
    // Despite remote KV lagging, post-download guard checked authoritative YSQL,
    // recognized status = DELETED, and PREVENTED cache.put() from executing!
    expect(remoteCache.put).not.toHaveBeenCalled();
    expect(remoteCache._map.size).toBe(0);
  });

  it('10. Cache HITs do NOT execute SQL queries (0 SQL calls on warm hit)', async () => {
    const mockKv = createMockKv({
      'media-revocation-manifest:v1': { version: 1, updatedAt: Date.now(), revokedIds: [] }
    });
    const mockCache = createMockCache();

    // Seed cache with a valid 200 response
    const cachedResponse = new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000',
        'ETag': '"active-sha256"'
      }
    });
    mockCache._map.set(`https://projectnox.org/media/${testMediaId}`, cachedResponse);

    mocks.executeYugabyteSql.mockClear();

    const res = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, { method: 'GET' }),
      platform: {
        env: {
          COVER_THUMBNAILS: mockKv
        },
        caches: { default: mockCache },
        context: {
          waitUntil: (p: Promise<any>) => p
        }
      },
      cookies: { getAll: () => [] }
    } as any);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Media-Cache')).toBe('HIT');

    // ZERO SQL queries executed on Cache HIT!
    expect(mocks.executeYugabyteSql).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it('11. In-flight Range request: admin deletes media during download -> post-download guard blocks Range 206 and returns 404 no-store', async () => {
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_range_race_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      mime: 'image/webp',
      bytes: 12
    });

    const remoteLaggingKv = createMockKv();
    const remoteCache = createMockCache();

    mocks.download.mockImplementationOnce(async () => {
      // Admin deletes media in YSQL while Telegram download is in progress
      mocks.mediaStore.get(testMediaId).status = 'DELETED';

      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]));
          controller.close();
        }
      });
    });

    const res = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, {
        method: 'GET',
        headers: { range: 'bytes=0-3' }
      }),
      platform: {
        env: { COVER_THUMBNAILS: remoteLaggingKv },
        caches: { default: remoteCache },
        context: { waitUntil: (p: Promise<any>) => p }
      },
      cookies: { getAll: () => [] }
    } as any);

    // CRITICAL SECURITY PROOF:
    // Range request must NOT return 206 with sliced bytes of deleted media!
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(remoteCache.put).not.toHaveBeenCalled();
    expect(remoteCache._map.size).toBe(0);
  });

  it('12. In-flight Protected Content privatization: admin changes access_class to PRIVATE during download -> post-download guard blocks public cache.put and returns 404', async () => {
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_privatize_race_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      mime: 'image/webp',
      bytes: 12
    });

    const remoteLaggingKv = createMockKv();
    const remoteCache = createMockCache();

    mocks.download.mockImplementationOnce(async () => {
      // Admin alters media to PRIVATE in YSQL while Telegram download is in progress
      mocks.mediaStore.get(testMediaId).access_class = 'PRIVATE';

      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]));
          controller.close();
        }
      });
    });

    const res = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, { method: 'GET' }),
      platform: {
        env: { COVER_THUMBNAILS: remoteLaggingKv },
        caches: { default: remoteCache },
        context: { waitUntil: (p: Promise<any>) => p }
      },
      cookies: { getAll: () => [] }
    } as any);

    // Anonymous public user must NOT receive newly-privatized media
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toContain('no-store');

    // CRITICAL PROOF: Newly privatized media must NEVER be cached in public edge cache!
    expect(remoteCache.put).not.toHaveBeenCalled();
    expect(remoteCache._map.size).toBe(0);
  });

  it('13. Adversarial KV Thumbnail: media revoked in YSQL while remote KV is lagging -> cache MISS validates DB fresh, prevents early KV return, and returns 404 no-store', async () => {
    // Stale cover thumbnail exists in remote KV
    const staleBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    const remoteLaggingKv = createMockKv(
      { [`cover-thumb:v1:${testMediaId}`]: staleBytes },
      { [`cover-thumb:v1:${testMediaId}`]: { contentType: 'image/jpeg', etag: '"stale_thumb_etag"', contentLength: '10' } }
    );
    const remoteCache = createMockCache();

    // Media was revoked in YSQL (status = DELETED), but KV tombstone is lagging / absent
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_revoked_cover_123',
      storage_ready: true,
      status: 'DELETED',
      access_class: 'PUBLIC',
      purpose: 'cover',
      mime: 'image/jpeg',
      bytes: 10
    });

    const res = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}?size=thumb`, { method: 'GET' }),
      platform: {
        env: { COVER_THUMBNAILS: remoteLaggingKv },
        caches: { default: remoteCache },
        context: { waitUntil: (p: Promise<any>) => p }
      },
      cookies: { getAll: () => [] }
    } as any);

    // CRITICAL: Must validate against authoritative DB and return 404, NEVER returning stale KV bytes
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(res.headers.get('X-Media-Cache')).toBeNull();
    expect(remoteCache.put).not.toHaveBeenCalled();
  });

  it('14. Adversarial KV Thumbnail: media privatized in YSQL while remote KV is lagging -> cache MISS validates DB fresh and blocks stale KV thumbnail return', async () => {
    const staleBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    const remoteLaggingKv = createMockKv(
      { [`cover-thumb:v1:${testMediaId}`]: staleBytes },
      { [`cover-thumb:v1:${testMediaId}`]: { contentType: 'image/jpeg', etag: '"stale_thumb_etag"', contentLength: '10' } }
    );
    const remoteCache = createMockCache();

    // Media changed to PRIVATE in YSQL, but remote KV has no tombstone
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_privatized_cover_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PRIVATE',
      purpose: 'cover',
      mime: 'image/jpeg',
      bytes: 10
    });

    const res = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}?size=thumb`, { method: 'GET' }),
      platform: {
        env: { COVER_THUMBNAILS: remoteLaggingKv },
        caches: { default: remoteCache },
        context: { waitUntil: (p: Promise<any>) => p }
      },
      cookies: { getAll: () => [] }
    } as any);

    // Anonymous request must be denied with 404 no-store, not served from lagging KV
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(remoteCache.put).not.toHaveBeenCalled();
  });

  it('15. Controlled Race Condition: post-download check confirms ACTIVE -> revocation finishes before cache.put -> pre/post-put guard prevents stale cache resurrection', async () => {
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_race_control_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      mime: 'image/webp',
      bytes: 12
    });

    const kv = createMockKv();
    const cache = createMockCache();

    // Deferred execution control for cache.put:
    let resolvePut: () => void = () => {};
    const putTrigger = new Promise<void>((resolve) => {
      resolvePut = resolve;
    });

    const originalPut = cache.put;
    cache.put = vi.fn(async (req: any, res: Response) => {
      // Suspend cache.put until explicit release signal
      await putTrigger;
      return originalPut(req, res);
    });

    let backgroundTask: Promise<any> | null = null;
    const waitUntilMock = vi.fn((promise: Promise<any>) => {
      backgroundTask = promise;
    });

    // 1. Initial GET request: download and post-download DB re-verification succeed (ACTIVE)
    const initialRes = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, { method: 'GET' }),
      platform: {
        env: { COVER_THUMBNAILS: kv },
        caches: { default: cache },
        context: { waitUntil: waitUntilMock }
      },
      cookies: { getAll: () => [] }
    } as any);

    expect(initialRes.status).toBe(200);

    // 2. While cache.put is suspended in background, administrative revocation executes:
    // updates YSQL to DELETED, writes KV tombstone, and executes cache.delete
    const revokeResult = await revokeMedia(testMediaId, {
      kv,
      cache,
      origin: 'https://projectnox.org',
      reason: 'ADMIN_TAKEDOWN'
    });
    expect(revokeResult.success).toBe(true);
    expect(mocks.mediaStore.get(testMediaId).status).toBe('DELETED');
    expect(await isMediaRevoked(testMediaId, kv)).toBe(true);

    // 3. Now release cache.put to finish after revocation and purge have completed
    resolvePut();
    if (backgroundTask) {
      await backgroundTask;
    }

    // 4. Verify post-put guard: cache must NOT contain resurrected stale entry
    const cachedEntry = await cache.match(new Request(`https://projectnox.org/media/${testMediaId}`));
    expect(cachedEntry).toBeNull();

    // 5. Subsequent request must return 404 no-store
    const subsequentRes = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, { method: 'GET' }),
      platform: {
        env: { COVER_THUMBNAILS: kv },
        caches: { default: cache },
        context: { waitUntil: (p: Promise<any>) => p }
      },
      cookies: { getAll: () => [] }
    } as any);

    expect(subsequentRes.status).toBe(404);
    expect(subsequentRes.headers.get('Cache-Control')).toContain('no-store');
  });

  it('16. Restricted & +18 Content Headers: delivers strictly no-store Cache-Control (no max-age=86400) and permits self-declared age cookie without JWT', async () => {
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_adult_page_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      mime: 'image/webp',
      bytes: 12,
      work_content_rating: 'ADULT_18'
    });

    const kv = createMockKv();
    const cache = createMockCache();

    // Request with self-declared age cookie nox-age-status=ADULT (no JWT session)
    const res = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, { method: 'GET' }),
      platform: {
        env: { COVER_THUMBNAILS: kv },
        caches: { default: cache },
        context: { waitUntil: (p: Promise<any>) => p }
      },
      cookies: {
        getAll: () => [{ name: 'nox-age-status', value: 'ADULT' }],
        get: (name: string) => (name === 'nox-age-status' ? 'ADULT' : undefined)
      }
    } as any);

    expect(res.status).toBe(200);

    // CRITICAL SECURITY PROOFS for Restricted Delivery:
    const cacheControl = res.headers.get('Cache-Control') || '';
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).not.toContain('max-age=86400');
    expect(res.headers.get('CDN-Cache-Control')).toBe('no-store');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
    expect(res.headers.get('Pragma')).toBe('no-cache');
    expect(res.headers.get('Cache-Tag')).toBeNull();

    // Edge cache must NEVER store restricted delivery
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('17. Active Public Cover: prewarming benefits strictly preserved with 0 Telegram calls when verified ACTIVE and PUBLIC in DB', async () => {
    const thumbBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    const kv = createMockKv(
      { [`cover-thumb:v1:${testMediaId}`]: thumbBytes },
      { [`cover-thumb:v1:${testMediaId}`]: { contentType: 'image/webp', etag: '"valid_thumb_etag"', contentLength: '12' } }
    );
    const cache = createMockCache();

    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_active_cover_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'cover',
      mime: 'image/webp',
      bytes: 12
    });

    let backgroundTask: Promise<any> | null = null;
    const waitUntilMock = vi.fn((promise: Promise<any>) => {
      backgroundTask = promise;
    });

    const res = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}?size=thumb`, { method: 'GET' }),
      platform: {
        env: { COVER_THUMBNAILS: kv },
        caches: { default: cache },
        context: { waitUntil: waitUntilMock }
      },
      cookies: { getAll: () => [] }
    } as any);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Media-Cache')).toBe('COVER_THUMBNAIL_KV');
    // Telegram download was skipped completely (0 calls)
    expect(mocks.download).not.toHaveBeenCalled();

    if (backgroundTask) {
      await backgroundTask;
    }
    // Prewarmed response was populated into edge cache
    expect(cache.put).toHaveBeenCalled();
  });

  it('18. Controlled Race Condition on Prewarmed KV Thumbnail: revocation finishes before deferred thumbnail cache.put -> post-put guard purges entry', async () => {
    const thumbBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    const kv = createMockKv(
      { [`cover-thumb:v1:${testMediaId}`]: thumbBytes },
      { [`cover-thumb:v1:${testMediaId}`]: { contentType: 'image/webp', etag: '"race_thumb_etag"', contentLength: '12' } }
    );
    const cache = createMockCache();

    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_race_thumb_cover_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'cover',
      mime: 'image/webp',
      bytes: 12
    });

    let resolvePut: () => void = () => {};
    const putTrigger = new Promise<void>((resolve) => {
      resolvePut = resolve;
    });

    const originalPut = cache.put;
    cache.put = vi.fn(async (req: any, res: Response) => {
      await putTrigger;
      return originalPut(req, res);
    });

    let backgroundTask: Promise<any> | null = null;
    const waitUntilMock = vi.fn((promise: Promise<any>) => {
      backgroundTask = promise;
    });

    // 1. Initial GET thumbnail request: verified ACTIVE & PUBLIC, KV read succeeds
    const initialRes = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}?size=thumb`, { method: 'GET' }),
      platform: {
        env: { COVER_THUMBNAILS: kv },
        caches: { default: cache },
        context: { waitUntil: waitUntilMock }
      },
      cookies: { getAll: () => [] }
    } as any);

    expect(initialRes.status).toBe(200);
    expect(initialRes.headers.get('X-Media-Cache')).toBe('COVER_THUMBNAIL_KV');

    // 2. While cache.put is suspended in background, administrative revocation executes
    const revokeResult = await revokeMedia(testMediaId, {
      kv,
      cache,
      origin: 'https://projectnox.org',
      reason: 'ADMIN_TAKEDOWN'
    });
    expect(revokeResult.success).toBe(true);
    expect(mocks.mediaStore.get(testMediaId).status).toBe('DELETED');

    // 3. Release cache.put to finish after revocation and purge have completed
    resolvePut();
    if (backgroundTask) {
      await backgroundTask;
    }

    // 4. Verify post-put guard: edge cache must NOT contain resurrected stale entry
    const canonicalThumbUrl = `https://projectnox.org/media/${testMediaId}?size=thumb&v=3`;
    const cachedEntry = await cache.match(new Request(canonicalThumbUrl));
    expect(cachedEntry).toBeNull();

    // 5. Subsequent request must return 404 no-store
    const subsequentRes = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}?size=thumb`, { method: 'GET' }),
      platform: {
        env: { COVER_THUMBNAILS: kv },
        caches: { default: cache },
        context: { waitUntil: (p: Promise<any>) => p }
      },
      cookies: { getAll: () => [] }
    } as any);

    expect(subsequentRes.status).toBe(404);
    expect(subsequentRes.headers.get('Cache-Control')).toContain('no-store');
  });

  it('19a. Adversarial Deterministic Privatization: in-flight transition from PUBLIC to PRIVATE with status = ACTIVE -> anonymous visitor blocked with 404 no-store, 0 cache commits', async () => {
    // 1. Media starts as ACTIVE and PUBLIC
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_privatize_anon_race_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      mime: 'image/webp',
      bytes: 12
    });

    // Simulated remote PoP KV has NO tombstone (outdated replication)
    const remoteLaggingKv = createMockKv();
    const remoteCache = createMockCache();

    // Controlled async barrier to interrupt execution during in-flight download
    let resumeDownload: (() => void) | null = null;
    const downloadBarrier = new Promise<void>((resolve) => {
      resumeDownload = resolve;
    });

    mocks.download.mockImplementationOnce(async () => {
      await downloadBarrier;
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]));
          controller.close();
        }
      });
    });

    // 2. Begin real HTTP request to the public media handler
    const requestPromise = getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, { method: 'GET' }),
      platform: {
        env: { COVER_THUMBNAILS: remoteLaggingKv },
        caches: { default: remoteCache },
        context: { waitUntil: (p: Promise<any>) => p }
      },
      cookies: { getAll: () => [], get: () => undefined }
    } as any);

    // Give microtask time to reach download barrier
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 3. Modifie efetivamente o registro para status = ACTIVE e access_class = PRIVATE (NOT DELETED!)
    const currentItem = mocks.mediaStore.get(testMediaId);
    currentItem.status = 'ACTIVE';
    currentItem.access_class = 'PRIVATE';
    expect(mocks.mediaStore.get(testMediaId).status).toBe('ACTIVE');
    expect(mocks.mediaStore.get(testMediaId).access_class).toBe('PRIVATE');

    // 4. Resume download execution
    resumeDownload!();
    const res = await requestPromise;

    // 5. Assert: Anonymous public visitor does NOT receive private bytes (HTTP 404)
    expect(res.status).toBe(404);
    const bodyText = await res.text();
    expect(bodyText).toContain('Acesso não autorizado');
    expect(bodyText).not.toContain('RIFF');

    // 6. Assert: Cache headers are strictly private/no-store
    const cacheControl = res.headers.get('Cache-Control') || '';
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).not.toContain('public');
    expect(cacheControl).not.toContain('immutable');
    expect(res.headers.get('Cache-Tag')).toBeNull();

    // 7. Assert: Response is NEVER stored in edge cache
    expect(remoteCache.put).not.toHaveBeenCalled();
    expect(remoteCache._map.size).toBe(0);
  });

  it('19b. Adversarial Deterministic Privatization: in-flight transition from PUBLIC to PRIVATE with status = ACTIVE -> authorized staff receives 200 with strictly private headers (NO public/immutable headers)', async () => {
    // 1. Media starts as ACTIVE and PUBLIC
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_privatize_auth_race_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      mime: 'image/webp',
      bytes: 12
    });

    // Outdated remote KV without tombstone
    const remoteLaggingKv = createMockKv();
    const remoteCache = createMockCache();

    // Setup authorized staff credentials
    mocks.extractFullAuthCookie.mockReturnValue('valid-staff-token');
    mocks.decodeSessionJwt.mockReturnValue({ jwt: { role: 'ADMIN' }, accessToken: 'valid-staff-token' });
    mocks.resolveSessionData.mockResolvedValue({ role: 'ADMIN', user: { id: 'admin-user-001' } });

    // Controlled barrier
    let resumeDownload: (() => void) | null = null;
    const downloadBarrier = new Promise<void>((resolve) => {
      resumeDownload = resolve;
    });

    mocks.download.mockImplementationOnce(async () => {
      await downloadBarrier;
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]));
          controller.close();
        }
      });
    });

    // 2. Begin HTTP request with staff authorization
    const requestPromise = getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-staff-token' }
      }),
      platform: {
        env: { COVER_THUMBNAILS: remoteLaggingKv },
        caches: { default: remoteCache },
        context: { waitUntil: (p: Promise<any>) => p }
      },
      cookies: {
        getAll: () => [{ name: 'auth-token', value: 'valid-staff-token' }],
        get: (name: string) => (name === 'auth-token' ? 'valid-staff-token' : undefined)
      }
    } as any);

    await new Promise((resolve) => setTimeout(resolve, 10));

    // 3. Admin alters media to PRIVATE in YSQL while maintaining status = ACTIVE
    const currentItem = mocks.mediaStore.get(testMediaId);
    currentItem.status = 'ACTIVE';
    currentItem.access_class = 'PRIVATE';
    expect(mocks.mediaStore.get(testMediaId).status).toBe('ACTIVE');
    expect(mocks.mediaStore.get(testMediaId).access_class).toBe('PRIVATE');

    // 4. Resume request
    resumeDownload!();
    const res = await requestPromise;

    // 5. Authorized staff receives the media bytes (HTTP 200)
    expect(res.status).toBe(200);

    // 6. CRITICAL REQUIREMENT 8: Validate that authorized users NEVER receive public cache headers
    const cacheControl = res.headers.get('Cache-Control') || '';
    expect(cacheControl).toContain('private');
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).toContain('must-revalidate');
    expect(cacheControl).toContain('max-age=0');
    expect(cacheControl).not.toContain('public');
    expect(cacheControl).not.toContain('immutable');
    expect(cacheControl).not.toContain('31536000');

    expect(res.headers.get('CDN-Cache-Control')).toBe('no-store');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
    expect(res.headers.get('Pragma')).toBe('no-cache');
    expect(res.headers.get('Expires')).toBe('0');
    expect(res.headers.get('Vary')).toContain('Cookie');
    expect(res.headers.get('Vary')).toContain('Authorization');

    // Cache-Tag MUST NOT be present on private responses
    expect(res.headers.get('Cache-Tag')).toBeNull();
    expect(res.headers.get('X-Cache-Tag')).toBeNull();

    // 7. CRITICAL REQUIREMENT 9: Confirm that NO private response is written to shared edge cache
    expect(remoteCache.put).not.toHaveBeenCalled();
    expect(remoteCache._map.size).toBe(0);
  });

  it('19c. Adversarial Deterministic +18 Adult Restriction: in-flight transition with status = ACTIVE -> unverified visitor returns 403, adult-declared visitor receives 200 strictly private, 0 cache commits', async () => {
    // 1. Media starts as ACTIVE and PUBLIC
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_adult_race_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      mime: 'image/webp',
      bytes: 12
    });

    const remoteLaggingKv = createMockKv();
    const remoteCache = createMockCache();

    // Scenario A: Unverified public visitor during in-flight restriction change
    let resumeDownloadA: (() => void) | null = null;
    const downloadBarrierA = new Promise<void>((resolve) => {
      resumeDownloadA = resolve;
    });

    mocks.download.mockImplementationOnce(async () => {
      await downloadBarrierA;
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]));
          controller.close();
        }
      });
    });

    const unverifiedRequest = getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, { method: 'GET' }),
      platform: {
        env: { COVER_THUMBNAILS: remoteLaggingKv },
        caches: { default: remoteCache },
        context: { waitUntil: (p: Promise<any>) => p }
      },
      cookies: { getAll: () => [], get: () => undefined }
    } as any);

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Admin updates work content rating to ADULT_18 while status remains ACTIVE
    mocks.mediaStore.get(testMediaId).work_content_rating = 'ADULT_18';
    expect(mocks.mediaStore.get(testMediaId).status).toBe('ACTIVE');

    resumeDownloadA!();
    const unverifiedRes = await unverifiedRequest;

    // Unverified visitor must receive HTTP 403 Forbidden with adult restriction metadata
    expect(unverifiedRes.status).toBe(403);
    const unverifiedBody = await unverifiedRes.json();
    expect(unverifiedBody.error).toBe('Conteúdo restrito a maiores de 18 anos');
    expect(unverifiedBody.age_restricted).toBe(true);
    expect(unverifiedRes.headers.get('Cache-Control')).toContain('no-store');
    expect(remoteCache.put).not.toHaveBeenCalled();

    // Scenario B: Adult-declared visitor (nox-age-status = ADULT) under the same active +18 content
    let resumeDownloadB: (() => void) | null = null;
    const downloadBarrierB = new Promise<void>((resolve) => {
      resumeDownloadB = resolve;
    });

    mocks.download.mockImplementationOnce(async () => {
      await downloadBarrierB;
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]));
          controller.close();
        }
      });
    });

    const adultRequest = getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, { method: 'GET' }),
      platform: {
        env: { COVER_THUMBNAILS: remoteLaggingKv },
        caches: { default: remoteCache },
        context: { waitUntil: (p: Promise<any>) => p }
      },
      cookies: {
        getAll: () => [{ name: 'nox-age-status', value: 'ADULT' }],
        get: (name: string) => (name === 'nox-age-status' ? 'ADULT' : undefined)
      }
    } as any);

    await new Promise((resolve) => setTimeout(resolve, 10));
    resumeDownloadB!();
    const adultRes = await adultRequest;

    // Adult-declared visitor receives media bytes (HTTP 200)
    expect(adultRes.status).toBe(200);

    // CRITICAL: Headers MUST be strictly private (no public, no max-age=31536000, no Cache-Tag)
    const adultCacheControl = adultRes.headers.get('Cache-Control') || '';
    expect(adultCacheControl).toContain('private');
    expect(adultCacheControl).toContain('no-store');
    expect(adultCacheControl).toContain('must-revalidate');
    expect(adultCacheControl).not.toContain('public');
    expect(adultCacheControl).not.toContain('31536000');
    expect(adultRes.headers.get('CDN-Cache-Control')).toBe('no-store');
    expect(adultRes.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
    expect(adultRes.headers.get('Cache-Tag')).toBeNull();

    // Edge cache must NOT be populated with adult content
    expect(remoteCache.put).not.toHaveBeenCalled();
    expect(remoteCache._map.size).toBe(0);
  });

  it('19d. Controlled Race Condition with deferred cache.put: admin privatizes media (status = ACTIVE, accessClass = PRIVATE) while cache.put is suspended -> post-put guard purges resurrected cache entry', async () => {
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_privatize_race_ctrl_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      mime: 'image/webp',
      bytes: 12
    });

    const kv = createMockKv();
    const cache = createMockCache();

    let resolvePut: () => void = () => {};
    const putTrigger = new Promise<void>((resolve) => {
      resolvePut = resolve;
    });

    const originalPut = cache.put;
    cache.put = vi.fn(async (req: any, res: Response) => {
      await putTrigger;
      return originalPut(req, res);
    });

    let backgroundTask: Promise<any> | null = null;
    const waitUntilMock = vi.fn((promise: Promise<any>) => {
      backgroundTask = promise;
    });

    const initialRes = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, { method: 'GET' }),
      platform: {
        env: { COVER_THUMBNAILS: kv },
        caches: { default: cache },
        context: { waitUntil: waitUntilMock }
      },
      cookies: { getAll: () => [] }
    } as any);

    expect(initialRes.status).toBe(200);

    // Administrative action marks content as PRIVATE while maintaining status = ACTIVE
    const revokeResult = await revokeMedia(testMediaId, {
      kv,
      cache,
      origin: 'https://projectnox.org',
      reason: 'CONTENT_PRIVATIZATION',
      accessClass: 'PRIVATE',
      status: 'ACTIVE'
    });
    expect(revokeResult.success).toBe(true);

    // PROOF: Status remained ACTIVE (not DELETED!), access_class became PRIVATE
    expect(mocks.mediaStore.get(testMediaId).status).toBe('ACTIVE');
    expect(mocks.mediaStore.get(testMediaId).access_class).toBe('PRIVATE');

    // Release deferred cache.put to complete in background
    resolvePut();
    if (backgroundTask) {
      await backgroundTask;
    }

    // Cache must not contain the privatized media (post-put guard purged it)
    const cachedEntry = await cache.match(new Request(`https://projectnox.org/media/${testMediaId}`));
    expect(cachedEntry).toBeNull();

    // Subsequent request returns 404 no-store for anonymous public visitor
    const subsequentRes = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, { method: 'GET' }),
      platform: {
        env: { COVER_THUMBNAILS: kv },
        caches: { default: cache },
        context: { waitUntil: (p: Promise<any>) => p }
      },
      cookies: { getAll: () => [] }
    } as any);

    expect(subsequentRes.status).toBe(404);
    expect(subsequentRes.headers.get('Cache-Control')).toContain('no-store');
  });

  it('19e. In-flight Range request by authorized staff on privatized media (status = ACTIVE, access_class = PRIVATE): delivers HTTP 206 with sliced bytes and strictly private headers', async () => {
    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_privatize_range_auth_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      mime: 'image/webp',
      bytes: 12,
      sha256: 'active-etag-123'
    });

    const remoteLaggingKv = createMockKv();
    const remoteCache = createMockCache();

    mocks.extractFullAuthCookie.mockReturnValue('valid-staff-token');
    mocks.decodeSessionJwt.mockReturnValue({ jwt: { role: 'ADMIN' }, accessToken: 'valid-staff-token' });
    mocks.resolveSessionData.mockResolvedValue({ role: 'ADMIN', user: { id: 'admin-user-001' } });

    let resumeDownload: (() => void) | null = null;
    const downloadBarrier = new Promise<void>((resolve) => {
      resumeDownload = resolve;
    });

    mocks.download.mockImplementationOnce(async () => {
      await downloadBarrier;
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]));
          controller.close();
        }
      });
    });

    const requestPromise = getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-staff-token',
          Range: 'bytes=0-3'
        }
      }),
      platform: {
        env: { COVER_THUMBNAILS: remoteLaggingKv },
        caches: { default: remoteCache },
        context: { waitUntil: (p: Promise<any>) => p }
      },
      cookies: {
        getAll: () => [{ name: 'auth-token', value: 'valid-staff-token' }],
        get: (name: string) => (name === 'auth-token' ? 'valid-staff-token' : undefined)
      }
    } as any);

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Admin updates access_class to PRIVATE in YSQL (status remains ACTIVE)
    mocks.mediaStore.get(testMediaId).status = 'ACTIVE';
    mocks.mediaStore.get(testMediaId).access_class = 'PRIVATE';

    resumeDownload!();
    const res = await requestPromise;

    // Authorized staff receives HTTP 206 Partial Content
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 0-3/12');
    expect(res.headers.get('Content-Length')).toBe('4');

    // CRITICAL: Range headers MUST be strictly private
    const cacheControl = res.headers.get('Cache-Control') || '';
    expect(cacheControl).toContain('private');
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).not.toContain('public');
    expect(cacheControl).not.toContain('31536000');
    expect(res.headers.get('CDN-Cache-Control')).toBe('no-store');
    expect(res.headers.get('Cache-Tag')).toBeNull();

    // Partial response MUST NOT be cached
    expect(remoteCache.put).not.toHaveBeenCalled();
  });

  it('20. Prewarmed KV Thumbnail Edge Cache Headers & Conditional ETag Parity: full parity with public CDN caching and RFC 9110 revalidation', async () => {
    const thumbBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    const kv = createMockKv(
      { [`cover-thumb:v1:${testMediaId}`]: thumbBytes },
      { [`cover-thumb:v1:${testMediaId}`]: { contentType: 'image/webp', etag: '"thumb_etag_xyz"', contentLength: '12' } }
    );
    const cache = createMockCache();

    mocks.mediaStore.set(testMediaId, {
      id: testMediaId,
      provider: 'telegram',
      provider_key: 'file_headers_parity_123',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'cover',
      mime: 'image/webp',
      bytes: 12
    });

    // 1. Initial 200 GET
    const res = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}?size=thumb`, { method: 'GET' }),
      platform: {
        env: { COVER_THUMBNAILS: kv },
        caches: { default: cache },
        context: { waitUntil: (p: Promise<any>) => p }
      },
      cookies: { getAll: () => [] }
    } as any);

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Tag')).toBe(`media-${testMediaId},media-public`);
    expect(res.headers.get('X-Cache-Tag')).toBe(`media-${testMediaId},media-public`);
    expect(res.headers.get('CDN-Cache-Control')).toBe('public, max-age=31536000');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('public, max-age=31536000');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'; sandbox");

    // 2. Conditional Revalidation via weak ETag: If-None-Match: W/"thumb_etag_xyz" returns 304
    const revalRes = await getPublicMediaRoute({
      params: { id: testMediaId },
      request: new Request(`https://projectnox.org/media/${testMediaId}?size=thumb`, {
        method: 'GET',
        headers: { 'If-None-Match': 'W/"thumb_etag_xyz"' }
      }),
      platform: {
        env: { COVER_THUMBNAILS: kv },
        caches: { default: cache },
        context: { waitUntil: (p: Promise<any>) => p }
      },
      cookies: { getAll: () => [] }
    } as any);

    expect(revalRes.status).toBe(304);
  });
});
