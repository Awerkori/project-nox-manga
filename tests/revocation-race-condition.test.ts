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
  fetchMediaMetadataFromYugabyte: vi.fn(async (id: string, _env?: any, options?: { forceFresh?: boolean }) => {
    return mocks.mediaStore.get(id) || null;
  }),
  executeYugabyteSql: mocks.executeYugabyteSql,
  invalidateMediaMetadataCache: vi.fn((id: string) => {
    // Invalidate local in-memory store if needed
  }),
  invalidateYugabyteLkgPrefix: vi.fn()
}));

import { GET as getPublicMediaRoute } from '../src/routes/media/[id]/+server';
import { POST as revokeMediaEndpoint } from '../src/routes/api/internal/media/revoke/+server';
import { GET as getPrivateMediaRoute } from '../src/routes/api/media/[id]/+server';
import { revokeMedia, unrevokeMedia, isMediaRevoked, clearMemoryRevocationCache } from '../src/lib/server/media-revocation';

function createMockKv(initialData: Record<string, any> = {}) {
  const store = new Map<string, string>();
  for (const [k, v] of Object.entries(initialData)) {
    store.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  return {
    _store: store,
    get: vi.fn(async (key: string, opts?: any) => {
      const val = store.get(key);
      if (!val) return null;
      if (opts?.type === 'json') {
        try { return JSON.parse(val); } catch { return null; }
      }
      return val;
    }),
    getWithMetadata: vi.fn(async (key: string, opts?: any) => {
      const val = store.get(key);
      if (!val) return { value: null, metadata: null };
      return { value: val, metadata: null };
    }),
    put: vi.fn(async (key: string, val: string) => {
      store.set(key, val);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
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

    mocks.executeYugabyteSql.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('SELECT status FROM public.media') || sql.includes('SELECT status FROM media')) {
        const id = params?.[0];
        const item = mocks.mediaStore.get(id);
        return { rows: item ? [{ status: item.status }] : [], rowCount: item ? 1 : 0 };
      }
      if (sql.includes('UPDATE public.media') || sql.includes('UPDATE media')) {
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
});
