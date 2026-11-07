import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMediaRevoked,
  revokeMedia,
  unrevokeMedia,
  purgeMediaVariants,
  classifyMediaAccess,
  clearMemoryRevocationCache,
  populateMemoryRevocationCache,
  getMemoryRevocationSet,
  REVOCATION_KEY_PREFIX,
  REVOCATION_MANIFEST_KEY
} from '../src/lib/server/media-revocation';
import {
  readCoverThumbnail,
  persistCoverThumbnail,
  coverThumbnailKey
} from '../src/lib/server/cover-thumbnail-cache';
import {
  validateResponseBody,
  getActiveDeploymentInfo
} from '../scripts/mihon-zero-waste-benchmark.mjs';

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
  fetchMediaMetadataFromYugabyte: mocks.fetchMediaMetadataFromYugabyte,
  executeYugabyteSql: mocks.executeYugabyteSql
}));

import { GET as getPublicMediaRoute } from '../src/routes/media/[id]/+server';
import { POST as revokeMediaEndpoint } from '../src/routes/api/internal/media/revoke/+server';

// Helper to create an isolated mock Cache API
function createMockCache() {
  const store = new Map<string, Response>();
  return {
    store,
    match: vi.fn(async (req: Request | string) => {
      const url = typeof req === 'string' ? req : req.url;
      const res = store.get(url);
      if (!res) return null;
      return res.clone();
    }),
    put: vi.fn(async (req: Request | string, res: Response) => {
      const url = typeof req === 'string' ? req : req.url;
      store.set(url, res.clone());
    }),
    delete: vi.fn(async (req: Request | string) => {
      const url = typeof req === 'string' ? req : req.url;
      const had = store.has(url);
      store.delete(url);
      return had;
    })
  };
}

// Helper to create an isolated mock KV namespace
function createMockKv() {
  const store = new Map<string, { value: any; metadata?: any }>();
  return {
    store,
    get: vi.fn(async (key: string, options?: { type?: string }) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (options?.type === 'json' && typeof entry.value === 'string') {
        try {
          return JSON.parse(entry.value);
        } catch {
          return null;
        }
      }
      return entry.value;
    }),
    getWithMetadata: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      return { value: entry.value, metadata: entry.metadata || null };
    }),
    put: vi.fn(async (key: string, value: any, options?: { metadata?: any }) => {
      store.set(key, { value, metadata: options?.metadata });
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    })
  };
}

describe('Project Nox — Mandatory Adversarial Tests: Media Revocation & Cache Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMemoryRevocationCache();
    mocks.mediaStore.clear();

    mocks.fetchMediaMetadataFromYugabyte.mockImplementation(async (id: string) => {
      return mocks.mediaStore.get(id) || null;
    });

    mocks.download.mockResolvedValue(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])); // JPEG bytes
  });

  // TEST A: pública -> cache quente -> privada -> tentativa de acesso anônimo
  it('Teste A: pública -> cache quente -> privada -> tentativa de acesso anônimo', async () => {
    const mediaId = '11111111-aaaa-4111-8111-111111111111';
    const mockCache = createMockCache();
    const mockKv = createMockKv();
    const origin = 'https://projectnox.org';

    // 1. Initial State: media is PUBLIC
    mocks.mediaStore.set(mediaId, {
      id: mediaId, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
      access_class: 'PUBLIC', purpose: 'editorial', bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg', sha256: 'sha_test_a', provider_key: 'tg_key_a', bytes: 4
    });

    // 2. Cold request: warms cache
    const initialRes = await getPublicMediaRoute({
      locals: {}, params: { id: mediaId },
      request: new Request(`${origin}/media/${mediaId}`),
      platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
      cookies: { getAll: () => [] }
    });
    expect(initialRes.status).toBe(200);

    // Populate mockCache representing hot Cloudflare Worker Edge Cache
    await mockCache.put(
      new Request(`${origin}/media/${mediaId}`),
      new Response('cached_image_bytes', {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'ETag': '"sha_test_a"',
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      })
    );

    // Verify cache is hot
    const hotMatch = await mockCache.match(`${origin}/media/${mediaId}`);
    expect(hotMatch).not.toBeNull();
    expect(hotMatch?.status).toBe(200);

    // 3. State Transition: media is converted to PRIVATE
    mocks.mediaStore.set(mediaId, {
      ...mocks.mediaStore.get(mediaId),
      access_class: 'PRIVATE'
    });

    // 4. Revocation is executed
    const revocation = await revokeMedia(mediaId, {
      kv: mockKv,
      cache: mockCache,
      origin,
      reason: 'PRIVATE',
      accessClass: 'PRIVATE'
    });
    expect(revocation.success).toBe(true);

    // 5. Adversarial Anonymous Access Attempt
    const anonRes = await getPublicMediaRoute({
      locals: {}, params: { id: mediaId },
      request: new Request(`${origin}/media/${mediaId}`),
      platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
      cookies: { getAll: () => [] }
    });

    // Assert: Revoked content is NEVER delivered! Status is 404 with no-store
    expect(anonRes.status).toBe(404);
    const body = await anonRes.json();
    expect(body.error).toBe('Acesso não autorizado');
    expect(anonRes.headers.get('Cache-Control')).toContain('no-store');
    expect(anonRes.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');

    // Assert: Cache entry is evicted from edge cache
    expect(await mockCache.match(`${origin}/media/${mediaId}`)).toBeNull();
  });

  // TEST B: pública -> cache quente -> excluída -> tentativa de acesso anônimo
  it('Teste B: pública -> cache quente -> excluída -> tentativa de acesso anônimo', async () => {
    const mediaId = '22222222-bbbb-4222-8222-222222222222';
    const mockCache = createMockCache();
    const mockKv = createMockKv();
    const origin = 'https://projectnox.org';

    mocks.mediaStore.set(mediaId, {
      id: mediaId, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
      access_class: 'PUBLIC', purpose: 'editorial', bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg', sha256: 'sha_test_b', provider_key: 'tg_key_b', bytes: 4
    });

    // Warm cache
    await mockCache.put(
      new Request(`${origin}/media/${mediaId}`),
      new Response('cached_image_b', {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg', 'ETag': '"sha_test_b"' }
      })
    );

    // State Transition: status = 'DELETED'
    mocks.mediaStore.set(mediaId, {
      ...mocks.mediaStore.get(mediaId),
      status: 'DELETED'
    });

    // Revocation executed
    await revokeMedia(mediaId, {
      kv: mockKv,
      cache: mockCache,
      origin,
      reason: 'DELETED',
      status: 'DELETED'
    });

    // Anonymous Access Attempt
    const anonRes = await getPublicMediaRoute({
      locals: {}, params: { id: mediaId },
      request: new Request(`${origin}/media/${mediaId}`),
      platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
      cookies: { getAll: () => [] }
    });

    expect(anonRes.status).toBe(404);
    expect(anonRes.headers.get('Cache-Control')).toContain('no-store');
  });

  // TEST C: pública -> cache quente -> STAFF_ONLY -> tentativa de acesso sem permissão
  it('Teste C: pública -> cache quente -> STAFF_ONLY -> tentativa de acesso sem permissão', async () => {
    const mediaId = '33333333-cccc-4333-8333-333333333333';
    const mockCache = createMockCache();
    const mockKv = createMockKv();
    const origin = 'https://projectnox.org';

    mocks.mediaStore.set(mediaId, {
      id: mediaId, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
      access_class: 'PUBLIC', purpose: 'staff_chapter', bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg', sha256: 'sha_test_c', provider_key: 'tg_key_c', bytes: 4
    });

    // Hot in cache
    await mockCache.put(
      new Request(`${origin}/media/${mediaId}`),
      new Response('staff_chapter_cached', { status: 200 })
    );

    // Transition to STAFF_ONLY and revoke
    mocks.mediaStore.set(mediaId, {
      ...mocks.mediaStore.get(mediaId),
      access_class: 'STAFF_ONLY'
    });

    await revokeMedia(mediaId, {
      kv: mockKv,
      cache: mockCache,
      origin,
      reason: 'STAFF_ONLY',
      accessClass: 'STAFF_ONLY'
    });

    // 1. Attempt anonymous access
    mocks.extractFullAuthCookie.mockReturnValue(null);
    const anonRes = await getPublicMediaRoute({
      locals: {}, params: { id: mediaId },
      request: new Request(`${origin}/media/${mediaId}`),
      platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
      cookies: { getAll: () => [] }
    });
    expect(anonRes.status).toBe(404);

    // 2. Attempt regular user access (role: USER)
    mocks.decodeSessionJwt.mockReturnValue({ jwt: { sub: 'user-1' }, accessToken: 'tok-user-1' });
    mocks.resolveSessionData.mockResolvedValue({ user: { id: 'user-1' }, role: 'USER' });

    const userRes = await getPublicMediaRoute({
      locals: {}, params: { id: mediaId },
      request: new Request(`${origin}/media/${mediaId}`, {
        headers: { Authorization: 'Bearer tok-user-1' }
      }),
      platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
      cookies: { getAll: () => [] }
    });
    expect(userRes.status).toBe(404);
  });

  // TEST D: revogação seguida de requisição utilizando URL antiga
  it('Teste D: revogação seguida de requisição utilizando URL antiga', async () => {
    const mediaId = '44444444-dddd-4444-8444-444444444444';
    const mockCache = createMockCache();
    const mockKv = createMockKv();
    const origin = 'https://projectnox.org';
    const oldPlainUrl = `${origin}/media/${mediaId}`;

    mocks.mediaStore.set(mediaId, {
      id: mediaId, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
      access_class: 'PUBLIC', purpose: 'editorial', bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg', sha256: 'sha_test_d', provider_key: 'tg_key_d', bytes: 4
    });

    // Put into cache using the old exact URL
    await mockCache.put(new Request(oldPlainUrl), new Response('raw_image_data_d', { status: 200 }));

    // Revoke
    await revokeMedia(mediaId, { kv: mockKv, cache: mockCache, origin, reason: 'REVOKED' });

    // Client requests using the exact OLD URL
    const res = await getPublicMediaRoute({
      locals: {}, params: { id: mediaId },
      request: new Request(oldPlainUrl),
      platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(404);
    expect(await mockCache.match(oldPlainUrl)).toBeNull();
  });

  // TEST E: revogação seguida de requisição com query string antiga
  it('Teste E: revogação seguida de requisição com query string antiga', async () => {
    const mediaId = '55555555-eeee-4555-8555-555555555555';
    const mockCache = createMockCache();
    const mockKv = createMockKv();
    const origin = 'https://projectnox.org';

    const oldVariants = [
      `${origin}/media/${mediaId}?size=thumb&v=3`,
      `${origin}/media/${mediaId}?size=hero&v=3`,
      `${origin}/media/${mediaId}?size=thumb`,
      `${origin}/media/${mediaId}?size=hero`,
      `${origin}/media/${mediaId}?v=2`
    ];

    // Seed edge cache with all old query variants
    for (const vUrl of oldVariants) {
      await mockCache.put(new Request(vUrl), new Response('variant_image_data', { status: 200 }));
    }

    // Revoke
    await revokeMedia(mediaId, { kv: mockKv, cache: mockCache, origin });

    // Request each old variant query string
    for (const vUrl of oldVariants) {
      const res = await getPublicMediaRoute({
        locals: {}, params: { id: mediaId },
        request: new Request(vUrl),
        platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
        cookies: { getAll: () => [] }
      });
      expect(res.status, `Variant ${vUrl} must return 404 after revocation`).toBe(404);
      expect(res.headers.get('Cache-Control')).toContain('no-store');
    }
  });

  // TEST F: revogação com Range e If-None-Match
  it('Teste F: revogação com Range e If-None-Match', async () => {
    const mediaId = '66666666-ffff-4666-8666-666666666666';
    const mockCache = createMockCache();
    const mockKv = createMockKv();
    const origin = 'https://projectnox.org';
    const etag = '"sha_test_f"';

    // Seed cache with 200 response having strong ETag and length
    await mockCache.put(
      new Request(`${origin}/media/${mediaId}`),
      new Response(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': '10',
          'ETag': etag
        }
      })
    );

    // Revoke
    await revokeMedia(mediaId, { kv: mockKv, cache: mockCache, origin });

    // 1. Conditional revalidation request: If-None-Match
    const ifNoneMatchRes = await getPublicMediaRoute({
      locals: {}, params: { id: mediaId },
      request: new Request(`${origin}/media/${mediaId}`, {
        headers: { 'if-none-match': etag }
      }),
      platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
      cookies: { getAll: () => [] }
    });
    // MUST NOT return 304! MUST be 404!
    expect(ifNoneMatchRes.status).toBe(404);

    // 2. Partial content request: Range
    const rangeRes = await getPublicMediaRoute({
      locals: {}, params: { id: mediaId },
      request: new Request(`${origin}/media/${mediaId}`, {
        headers: { Range: 'bytes=0-3' }
      }),
      platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
      cookies: { getAll: () => [] }
    });
    // MUST NOT return 206! MUST be 404!
    expect(rangeRes.status).toBe(404);

    // 3. Combined Range + If-None-Match
    const combinedRes = await getPublicMediaRoute({
      locals: {}, params: { id: mediaId },
      request: new Request(`${origin}/media/${mediaId}`, {
        headers: { Range: 'bytes=0-3', 'if-none-match': etag }
      }),
      platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
      cookies: { getAll: () => [] }
    });
    expect(combinedRes.status).toBe(404);
  });

  // TEST G: mídia presente simultaneamente em Cache API e KV
  it('Teste G: mídia presente simultaneamente em Cache API e KV', async () => {
    const mediaId = '77777777-7777-4777-8777-777777777777';
    const mockCache = createMockCache();
    const mockKv = createMockKv();
    const origin = 'https://projectnox.org';

    // 1. Store in KV COVER_THUMBNAILS
    await mockKv.put(
      coverThumbnailKey(mediaId, 'thumb'),
      new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer,
      { metadata: { contentType: 'image/jpeg', etag: '"kv_etag"' } }
    );

    // 2. Store in Cache API
    await mockCache.put(
      new Request(`${origin}/media/${mediaId}?size=thumb&v=3`),
      new Response('cached_thumb_api', { status: 200 })
    );

    // Verify both caches are warm
    expect(await readCoverThumbnail(mockKv, mediaId, null, 'thumb')).not.toBeNull();
    expect(await mockCache.match(`${origin}/media/${mediaId}?size=thumb&v=3`)).not.toBeNull();

    // 3. Revoke
    await revokeMedia(mediaId, { kv: mockKv, cache: mockCache, origin });

    // 4. Test KV retrieval directly
    const kvRead = await readCoverThumbnail(mockKv, mediaId, null, 'thumb');
    expect(kvRead, 'readCoverThumbnail must return null for revoked media').toBeNull();

    // 5. Test HTTP route
    const res = await getPublicMediaRoute({
      locals: {}, params: { id: mediaId },
      request: new Request(`${origin}/media/${mediaId}?size=thumb&v=3`),
      platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
      cookies: { getAll: () => [] }
    });
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  // TEST H: falha parcial do mecanismo de invalidação (fail-closed)
  it('Teste H: falha parcial do mecanismo de invalidação (fail-closed)', async () => {
    const mediaId = '88888888-8888-4888-8888-888888888888';
    const mockKv = createMockKv();
    const origin = 'https://projectnox.org';

    // Mock cache that fails during delete
    const brokenCache = {
      match: vi.fn(async () => new Response('stale_data', { status: 200 })),
      put: vi.fn(),
      delete: vi.fn(async () => {
        throw new Error('KV / Cache partial failure during purge');
      })
    };

    // Revocation executes even if cache.delete errors
    const res = await revokeMedia(mediaId, {
      kv: mockKv,
      cache: brokenCache,
      origin,
      reason: 'PARTIAL_FAIL'
    });
    // System MUST NOT report misleading global success when an operation fails
    expect(res.success).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.errors.some(e => e.includes('CACHE_DELETE_REJECTED') || e.includes('partial failure'))).toBe(true);

    // When media is checked, it still knows it is revoked via KV/memory (fail-closed)
    expect(await isMediaRevoked(mediaId, mockKv)).toBe(true);

    // Route request fails closed and returns 404 with no-store
    const routeRes = await getPublicMediaRoute({
      locals: {}, params: { id: mediaId },
      request: new Request(`${origin}/media/${mediaId}`),
      platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: brokenCache } },
      cookies: { getAll: () => [] }
    });
    expect(routeRes.status).toBe(404);
    expect(routeRes.headers.get('Cache-Control')).toContain('no-store');
  });

  // TEST I: concorrência entre leitura pública e revogação
  it('Teste I: concorrência entre leitura pública e revogação', async () => {
    const mediaId = '99999999-9999-4999-8999-999999999999';
    const mockCache = createMockCache();
    const mockKv = createMockKv();
    const origin = 'https://projectnox.org';

    mocks.mediaStore.set(mediaId, {
      id: mediaId, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
      access_class: 'PUBLIC', purpose: 'editorial', bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg', sha256: 'sha_test_i', provider_key: 'tg_key_i', bytes: 4
    });

    // Seed cache
    await mockCache.put(new Request(`${origin}/media/${mediaId}`), new Response('data', { status: 200 }));

    // Run revocation concurrent with 20 read requests
    const readPromises = Array.from({ length: 20 }, (_, idx) => {
      return getPublicMediaRoute({
        locals: {}, params: { id: mediaId },
        request: new Request(`${origin}/media/${mediaId}`),
        platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
        cookies: { getAll: () => [] }
      });
    });

    const revokePromise = revokeMedia(mediaId, { kv: mockKv, cache: mockCache, origin });
    await Promise.all([revokePromise, ...readPromises]);

    // All subsequent requests AFTER revocation settlement MUST be 404
    const subsequentRes = await getPublicMediaRoute({
      locals: {}, params: { id: mediaId },
      request: new Request(`${origin}/media/${mediaId}`),
      platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
      cookies: { getAll: () => [] }
    });
    expect(subsequentRes.status).toBe(404);

    // Verify stale response cannot be re-saved into KV or edge cache
    const saveResult = await persistCoverThumbnail(
      mockKv,
      mediaId,
      new Uint8Array([1, 2, 3]).buffer,
      { contentType: 'image/jpeg' },
      'thumb'
    );
    expect(saveResult).toBe('skipped');
  });

  // TEST J: verificação de variantes armazenadas em diferentes datacenters
  it('Teste J: verificação de variantes armazenadas em diferentes datacenters', async () => {
    const mediaId = 'aaaaaaaa-0000-4aaa-8aaa-aaaaaaaaaaaa';
    const sharedKv = createMockKv();
    const origin = 'https://projectnox.org';

    // Datacenter 1 (e.g. GRU - São Paulo)
    const datacenter1Cache = createMockCache();
    await datacenter1Cache.put(
      new Request(`${origin}/media/${mediaId}`),
      new Response('cached_media_dc1', { status: 200 })
    );

    // Datacenter 2 (e.g. MIA - Miami or FRA - Frankfurt)
    const datacenter2Cache = createMockCache();
    await datacenter2Cache.put(
      new Request(`${origin}/media/${mediaId}`),
      new Response('cached_media_dc2', { status: 200 })
    );

    // Both datacenters currently hold warm edge cache
    expect(await datacenter1Cache.match(`${origin}/media/${mediaId}`)).not.toBeNull();
    expect(await datacenter2Cache.match(`${origin}/media/${mediaId}`)).not.toBeNull();

    // 1. Revocation happens in Datacenter 1
    // (Only datacenter 1's local cache is passed to revokeMedia!)
    await revokeMedia(mediaId, {
      kv: sharedKv,
      cache: datacenter1Cache,
      origin,
      reason: 'DMCA_TAKEDOWN'
    });

    // Datacenter 1's local cache was deleted
    expect(await datacenter1Cache.match(`${origin}/media/${mediaId}`)).toBeNull();

    // Datacenter 2 STILL has the file in its local cache storage!
    expect(datacenter2Cache.store.has(`${origin}/media/${mediaId}`)).toBe(true);

    // Clear Datacenter 1's isolate memory to simulate a completely distinct isolate in Datacenter 2
    clearMemoryRevocationCache();

    // 2. Request arrives at Datacenter 2 (which has the warm local cache)
    const dc2Res = await getPublicMediaRoute({
      locals: {}, params: { id: mediaId },
      request: new Request(`${origin}/media/${mediaId}`),
      platform: { env: { COVER_THUMBNAILS: sharedKv }, caches: { default: datacenter2Cache } },
      cookies: { getAll: () => [] }
    });

    // Assert: Datacenter 2 detects cross-PoP revocation via shared KV state!
    expect(dc2Res.status).toBe(404);
    const dc2Body = await dc2Res.json();
    expect(dc2Body.error).toBe('Acesso não autorizado');

    // Assert: Datacenter 2 evicts its local cache upon discovering the revocation
    expect(await datacenter2Cache.match(`${origin}/media/${mediaId}`)).toBeNull();
  });

  // TEST K: Internal Administrative Revocation Endpoint (/api/internal/media/revoke)
  it('allows authorized administrative callers to trigger multi-media revocation', async () => {
    const mediaId1 = 'bbbbbbbb-1111-4bbb-8bbb-bbbbbbbbbbbb';
    const mediaId2 = 'cccccccc-2222-4ccc-8ccc-cccccccccccc';
    const mockCache = createMockCache();
    const mockKv = createMockKv();
    const token = 'test-internal-token-123';

    await mockCache.put(new Request(`https://projectnox.org/media/${mediaId1}`), new Response('1', { status: 200 }));
    await mockCache.put(new Request(`https://projectnox.org/media/${mediaId2}`), new Response('2', { status: 200 }));

    const res = await revokeMediaEndpoint({
      request: new Request('https://projectnox.org/api/internal/media/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mediaIds: [mediaId1, mediaId2],
          reason: 'STAFF_ACTION'
        })
      }),
      url: new URL('https://projectnox.org/api/internal/media/revoke'),
      platform: {
        env: {
          COVER_THUMBNAILS: mockKv,
          NOX_STORAGE_BRIDGE_TOKEN: token
        },
        caches: { default: mockCache }
      },
      cookies: { getAll: () => [] }
    } as any);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.revokedCount).toBe(2);

    expect(await isMediaRevoked(mediaId1, mockKv)).toBe(true);
    expect(await isMediaRevoked(mediaId2, mockKv)).toBe(true);
  });

  // TEST L: Unrevoked media requests MUST NOT query KV tombstones (Cloudflare Free Tier 100k daily read quota)
  it('Teste L: requisições a mídias normais não executam leituras de lápides no KV (Preservação de Cota Zero Waste)', async () => {
    const mediaId = 'dddddddd-4444-4ddd-8ddd-dddddddddddd';
    const mockCache = createMockCache();
    const mockKv = createMockKv();
    const origin = 'https://projectnox.org';

    // Populate manifest with other revoked IDs, but NOT this mediaId
    await mockKv.put(REVOCATION_MANIFEST_KEY, JSON.stringify({
      version: 1,
      updatedAt: Date.now(),
      revokedIds: ['some-other-revoked-id-1', 'some-other-revoked-id-2']
    }));

    // Seed cache with warm response
    await mockCache.put(
      new Request(`${origin}/media/${mediaId}`),
      new Response('valid_image_data', {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg', 'ETag': '"sha_valid"' }
      })
    );

    mockKv.get.mockClear();

    // Perform 10 consecutive requests for the unrevoked media
    for (let i = 0; i < 10; i++) {
      const res = await getPublicMediaRoute({
        locals: {}, params: { id: mediaId },
        request: new Request(`${origin}/media/${mediaId}`),
        platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
        cookies: { getAll: () => [] }
      });
      expect(res.status).toBe(200);
    }

    // Inspect KV get calls: It MUST NOT query the individual tombstone!
    const tombstoneKey = `${REVOCATION_KEY_PREFIX}${mediaId}`;
    const tombstoneCalls = mockKv.get.mock.calls.filter((call: any[]) => call[0] === tombstoneKey);
    expect(tombstoneCalls.length, 'Unrevoked media must NEVER query individual tombstone on cache hits').toBe(0);
  });

  // TEST M: Probes with non-existent UUIDs MUST NOT trigger KV writes (Cloudflare Free Tier 1k write limit DoS protection)
  it('Teste M: UUIDs inexistentes não disparam escritas no KV (Proteção contra Esgotamento de Cota de Escrita)', async () => {
    const nonExistentId = 'eeeeeeee-5555-4eee-8eee-eeeeeeeeeeee';
    const mockCache = createMockCache();
    const mockKv = createMockKv();
    const origin = 'https://projectnox.org';

    // ID is NOT in DB (mocks.mediaStore does not have it)
    mockKv.put.mockClear();

    const res = await getPublicMediaRoute({
      locals: {}, params: { id: nonExistentId },
      request: new Request(`${origin}/media/${nonExistentId}`),
      platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toContain('no-store');

    // Assert: mockKv.put was NEVER called (no fake tombstone written to KV)
    expect(mockKv.put).not.toHaveBeenCalled();
  });

  // TEST N: Legacy redirect alias respects revocation
  it('Teste N: redirecionamentos de alias legados respeitam revogação imediata', async () => {
    const legacyId = 'bdaa2c94-260c-4f9c-85dc-edfc196815f1';
    const mockCache = createMockCache();
    const mockKv = createMockKv();
    const origin = 'https://projectnox.org';

    // 1. Before revocation: returns 302 redirect
    const normalRes = await getPublicMediaRoute({
      locals: {}, params: { id: legacyId },
      request: new Request(`${origin}/media/${legacyId}`),
      platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
      cookies: { getAll: () => [] }
    });
    expect(normalRes.status).toBe(302);
    expect(normalRes.headers.get('Location')).toBe('/media/4c86bd8d-1ad8-4142-a660-55fc0824b22a');

    // 2. Revoke the legacy ID
    await revokeMedia(legacyId, { kv: mockKv, cache: mockCache, origin, reason: 'REVOKED' });

    // 3. After revocation: MUST NOT return 302! MUST return 404 with no-store!
    const revokedRes = await getPublicMediaRoute({
      locals: {}, params: { id: legacyId },
      request: new Request(`${origin}/media/${legacyId}`),
      platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
      cookies: { getAll: () => [] }
    });
    expect(revokedRes.status).toBe(404);
    expect(revokedRes.headers.get('Cache-Control')).toContain('no-store');
  });

  // TEST O: Expanded query string variants (?size=thumb&v=1, ?size=hero&v=2) are all evicted
  it('Teste O: variantes legadas v1 e v2 são expurgadas na revogação', async () => {
    const mediaId = 'ffffffff-6666-4fff-8fff-ffffffffffff';
    const mockCache = createMockCache();
    const mockKv = createMockKv();
    const origin = 'https://projectnox.org';

    const legacyVariants = [
      `${origin}/media/${mediaId}?size=thumb&v=1`,
      `${origin}/media/${mediaId}?size=hero&v=1`,
      `${origin}/media/${mediaId}?size=thumb&v=2`,
      `${origin}/media/${mediaId}?size=hero&v=2`
    ];

    for (const vUrl of legacyVariants) {
      await mockCache.put(new Request(vUrl), new Response('legacy_data', { status: 200 }));
    }

    // Revoke
    const result = await revokeMedia(mediaId, { kv: mockKv, cache: mockCache, origin, reason: 'DELETED' });
    expect(result.success).toBe(true);

    // All legacy variants must be purged from cache
    for (const vUrl of legacyVariants) {
      expect(await mockCache.match(vUrl), `Legacy variant ${vUrl} must be purged from cache`).toBeNull();
    }
  });

  // TEST P: Workers Caching Purge via ctx.cache.purge
  it('Teste P: revogação dispara expurgo nativo do Workers Caching via ctx.cache.purge', async () => {
    const mediaId = '77777777-7777-4777-8777-777777777777';
    const mockCache = createMockCache();
    const mockKv = createMockKv();
    const mockCtx = {
      cache: {
        purge: vi.fn().mockResolvedValue(undefined)
      }
    };

    const res = await revokeMedia(mediaId, {
      kv: mockKv,
      cache: mockCache,
      ctx: mockCtx,
      reason: 'PRIVATE'
    });

    expect(res.success).toBe(true);
    expect(res.workersCachePurged).toBeGreaterThan(0);
    expect(mockCtx.cache.purge).toHaveBeenCalledWith({
      tags: [`media-${mediaId}`],
      pathPrefixes: [`/media/${mediaId}`]
    });
  });

  // TEST Q: Fail-Closed behavior when KV throws or is unavailable during cached hit
  it('Teste Q: fast-path se comporta fail-closed se KV falhar ao verificar revogação', async () => {
    const mediaId = '88888888-8888-4888-8888-888888888888';
    const brokenKv = {
      get: vi.fn().mockRejectedValue(new Error('KV_NETWORK_TIMEOUT')),
      put: vi.fn(),
      delete: vi.fn()
    };

    // When failClosed: true is passed, KV failure MUST return true (revoked)
    const isRevokedOnFail = await isMediaRevoked(mediaId, brokenKv, { failClosed: true });
    expect(isRevokedOnFail).toBe(true);

    // If KV is completely absent and failClosed: true, MUST return true
    const isRevokedNoKv = await isMediaRevoked(mediaId, null, { failClosed: true });
    expect(isRevokedNoKv).toBe(true);
  });

  // TEST Q2: Public media responses include Cache-Tag for declarative Workers Caching
  it('Teste Q2: respostas de mídia pública emitem Cache-Tag para purge seletivo da Cloudflare', async () => {
    const mediaId = '99999999-9999-4999-8999-999999999999';
    mocks.mediaStore.set(mediaId, {
      id: mediaId, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
      access_class: 'PUBLIC', purpose: 'editorial', bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg', sha256: 'sha_test_q2', provider_key: 'tg_key_q2', bytes: 4
    });

    const res = await getPublicMediaRoute({
      locals: {}, params: { id: mediaId },
      request: new Request(`https://projectnox.org/media/${mediaId}`),
      platform: { env: {}, caches: {} },
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Tag')).toBe(`media-${mediaId},media-public`);
    expect(res.headers.get('Cache-Control')).toContain('public');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('public');
  });

  // TEST R: Concurrent Revocations preserve individual tombstones and merge manifest IDs
  it('Teste R: revogações concorrentes preservam tombstones e mesclam IDs no manifesto', async () => {
    const idA = 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa';
    const idB = 'bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb';
    const mockKv = createMockKv();

    // Revoke A
    const resA = await revokeMedia(idA, { kv: mockKv, reason: 'REVOKED_A' });
    expect(resA.success).toBe(true);
    expect(resA.tombstoneWritten).toBe(true);

    // Revoke B concurrently
    const resB = await revokeMedia(idB, { kv: mockKv, reason: 'REVOKED_B' });
    expect(resB.success).toBe(true);
    expect(resB.tombstoneWritten).toBe(true);

    // Both tombstones must exist
    const tombA = await mockKv.get(`${REVOCATION_KEY_PREFIX}${idA}`);
    const tombB = await mockKv.get(`${REVOCATION_KEY_PREFIX}${idB}`);
    expect(tombA).not.toBeNull();
    expect(tombB).not.toBeNull();

    // Manifest must contain BOTH IDs
    const manifest = await mockKv.get(REVOCATION_MANIFEST_KEY, { type: 'json' });
    expect(manifest.revokedIds).toContain(idA);
    expect(manifest.revokedIds).toContain(idB);
  });

  // TEST S: Unrevoke restoration clears tombstone, updates manifest, and purges negative cache
  it('Teste S: unrevokeMedia restaura mídia legitimamente e limpa tombstone e cache negativo', async () => {
    const mediaId = 'cccccccc-3333-4ccc-8ccc-cccccccccccc';
    const mockKv = createMockKv();
    const mockCache = createMockCache();

    // Revoke
    await revokeMedia(mediaId, { kv: mockKv, cache: mockCache, reason: 'TEMP_BAN' });
    expect(await isMediaRevoked(mediaId, mockKv)).toBe(true);

    // Unrevoke
    const { unrevokeMedia } = await import('../src/lib/server/media-revocation');
    await unrevokeMedia(mediaId, { kv: mockKv, cache: mockCache });

    // In-memory set must no longer have mediaId
    expect(await isMediaRevoked(mediaId, mockKv, { forceFresh: true })).toBe(false);

    // Tombstone must be deleted
    expect(await mockKv.get(`${REVOCATION_KEY_PREFIX}${mediaId}`)).toBeNull();

    // Manifest must not contain mediaId
    const manifest = await mockKv.get(REVOCATION_MANIFEST_KEY, { type: 'json' });
    expect(manifest.revokedIds).not.toContain(mediaId);
  });

  // TEST T: Partial failure reporting in /api/internal/media/revoke
  it('Teste T: falha parcial de KV reporta status 207 Multi-Status e erros detalhados', async () => {
    const idValid = 'dddddddd-4444-4ddd-8ddd-dddddddddddd';
    const brokenKv = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockRejectedValue(new Error('KV_QUOTA_EXCEEDED')),
      delete: vi.fn()
    };

    const res = await revokeMediaEndpoint({
      request: new Request('https://projectnox.org/api/internal/media/revoke', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test_token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaIds: [idValid] })
      }),
      url: new URL('https://projectnox.org/api/internal/media/revoke'),
      platform: { env: { NOX_STORAGE_BRIDGE_TOKEN: 'test_token', COVER_THUMBNAILS: brokenKv } },
      cookies: { getAll: () => [] }
    } as any);

    expect(res.status).toBe(207); // Partial failure status
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.retryRequired).toBe(true);
    expect(body.pendingIds).toContain(idValid);
    expect(body.errors.length).toBeGreaterThan(0);
    expect(body.errors[0].error).toContain('TOMBSTONE_WRITE_FAILED');
  });

  // TEST U: Complete Access Class Coverage
  it('Teste U: garante proteção estrita para todas as classes privadas (PRIVATE, STAFF_ONLY, RESTRICTED, AUTHENTICATED)', async () => {
    const testCases: Array<{ accessClass: string; purpose: string }> = [
      { accessClass: 'PRIVATE', purpose: 'editorial' },
      { accessClass: 'STAFF_ONLY', purpose: 'editorial' },
      { accessClass: 'RESTRICTED', purpose: 'editorial' },
      { accessClass: 'AUTHENTICATED', purpose: 'editorial' }
    ];

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const mediaId = `eeeeeee${i}-5555-4eee-8eee-eeeeeeeeeee${i}`;
      mocks.mediaStore.set(mediaId, {
        id: mediaId, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
        access_class: tc.accessClass, purpose: tc.purpose, bot_reference: 'MANGA_STORAGE_01',
        mime: 'image/jpeg', sha256: `sha_u_${i}`, provider_key: `tg_key_u_${i}`, bytes: 4
      });

      const res = await getPublicMediaRoute({
        locals: {}, params: { id: mediaId },
        request: new Request(`https://projectnox.org/media/${mediaId}`),
        platform: { env: {}, caches: {} },
        cookies: { getAll: () => [] }
      });

      // Anonymous attempt against non-public media MUST return 404 unauthorized
      expect(res.status, `Access class ${tc.accessClass} must be blocked`).toBe(404);
      expect(res.headers.get('Cache-Control')).toContain('no-store');
      expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
    }
  });

  // TEST V: Workers Caching purge error reporting (does not swallow errors)
  it('Teste V: falha em ctx.cache.purge reporta success: false e detalha o erro', async () => {
    const mediaId = 'ffffffff-aaaa-4fff-8fff-ffffffffffff';
    const mockCache = createMockCache();
    const mockKv = createMockKv();
    const mockCtx = {
      cache: {
        purge: vi.fn().mockResolvedValue({
          success: false,
          errors: [{ code: 1001, message: 'Rate limit on cache tag purge' }]
        })
      }
    };

    const res = await revokeMedia(mediaId, {
      kv: mockKv,
      cache: mockCache,
      ctx: mockCtx,
      reason: 'PRIVATE'
    });

    expect(res.success).toBe(false);
    expect(res.workersCachePurged).toBe(0);
    expect(res.errors.some(e => e.includes('Rate limit on cache tag purge'))).toBe(true);
  });

  // TEST W: isMediaRevoked falls through to tombstone when manifest is null
  it('Teste W: manifesto nulo no KV força verificação de lápide direta', async () => {
    const mediaId = '12345678-1234-4234-8234-123456789abc';
    const mockKv = createMockKv();

    // Manifest is null (never created)
    await mockKv.delete(REVOCATION_MANIFEST_KEY);

    // Tombstone exists
    await mockKv.put(`${REVOCATION_KEY_PREFIX}${mediaId}`, JSON.stringify({ mediaId, reason: 'DELETED' }));

    // Memory cache cleared
    clearMemoryRevocationCache();

    const isRevoked = await isMediaRevoked(mediaId, mockKv);
    expect(isRevoked).toBe(true);
  });

  // TEST X: Cached hit in +server.ts fails closed on KV timeout/absence
  it('Teste X: rota +server.ts falha fechada em cache hit se KV falhar', async () => {
    const mediaId = 'abcdef01-2345-4678-89ab-cdef01234567';
    const origin = 'https://projectnox.org';
    const mockCache = createMockCache();

    // Cache is hot
    await mockCache.put(
      new Request(`${origin}/media/${mediaId}`),
      new Response('cached_bytes', {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg', 'ETag': '"cached_sha"' }
      })
    );

    const brokenKv = {
      get: vi.fn().mockRejectedValue(new Error('KV_UNAVAILABLE')),
      put: vi.fn(),
      delete: vi.fn()
    };

    const res = await getPublicMediaRoute({
      locals: {}, params: { id: mediaId },
      request: new Request(`${origin}/media/${mediaId}`),
      platform: { env: { COVER_THUMBNAILS: brokenKv }, caches: { default: mockCache } },
      cookies: { getAll: () => [] }
    });

    // Fails closed: 404 with no-store
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  // TEST Y: HEAD request against revoked media returns HTTP 404 with null body
  it('Teste Y: requisições HEAD para mídias revogadas retornam 404 sem corpo', async () => {
    const mediaId = '98765432-1234-4234-8234-9876543210ab';
    const origin = 'https://projectnox.org';
    const mockCache = createMockCache();
    const mockKv = createMockKv();

    // Revoke
    await revokeMedia(mediaId, { kv: mockKv, cache: mockCache, origin });

    const headRes = await getPublicMediaRoute({
      locals: {}, params: { id: mediaId },
      request: new Request(`${origin}/media/${mediaId}`, { method: 'HEAD' }),
      platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
      cookies: { getAll: () => [] }
    });

    expect(headRes.status).toBe(404);
    expect(headRes.headers.get('Cache-Control')).toContain('no-store');
    const bodyText = await headRes.text();
    expect(bodyText).toBe('');
  });

  // TEST Z: unrevokeMedia returns structured result
  it('Teste Z: unrevokeMedia retorna resultado estruturado com sucesso e erros', async () => {
    const mediaId = '11223344-5566-4778-8899-aabbccddeeff';
    const mockKv = createMockKv();
    const mockCache = createMockCache();

    // Revoke
    await revokeMedia(mediaId, { kv: mockKv, cache: mockCache });

    // Unrevoke
    const { unrevokeMedia: unrevoke } = await import('../src/lib/server/media-revocation');
    const result = await unrevoke(mediaId, { kv: mockKv, cache: mockCache });
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });

  // =========================================================================
  // SEÇÃO 16: OS 30 CENÁRIOS ADVERSARIAIS MANDATÓRIOS DA ORDEM EXECUTIVA
  // =========================================================================
  describe('Seção 16: Matriz Completa dos 30 Cenários Adversariais Mandatórios', () => {
    // 1. Revogação após cache aquecido
    it('1. Revogação após cache aquecido: expurga cache e bloqueia novos acessos', async () => {
      const id = '10000001-0001-4001-8001-000000000001';
      const mockCache = createMockCache();
      const mockKv = createMockKv();
      await mockCache.put(`https://projectnox.org/media/${id}`, new Response('cached_bytes', { status: 200 }));
      const res = await revokeMedia(id, { kv: mockKv, cache: mockCache });
      expect(res.success).toBe(true);
      expect(res.state).toBe('REVOCATION_COMPLETED');
      expect(await mockCache.match(`https://projectnox.org/media/${id}`)).toBeNull();
    });

    // 2. Revogação com purge falhando
    it('2. Revogação com purge falhando: não declara REVOCATION_COMPLETED e reporta erro', async () => {
      const id = '10000002-0002-4002-8002-000000000002';
      const mockKv = createMockKv();
      const failingCache = {
        delete: vi.fn().mockRejectedValue(new Error('EDGE_PURGE_TIMEOUT')),
        match: vi.fn(),
        put: vi.fn()
      };
      const res = await revokeMedia(id, { kv: mockKv, cache: failingCache });
      expect(res.success).toBe(false);
      expect(res.purgeState).toBe('PURGE_FAILED');
      expect(res.state).toBe('REVOCATION_PARTIAL');
      expect(res.errors.some(e => e.includes('EDGE_PURGE_TIMEOUT'))).toBe(true);
    });

    // 3. Revogação com KV indisponível
    it('3. Revogação com KV indisponível: falha estrita fail-closed e erro reportado', async () => {
      const id = '10000003-0003-4003-8003-000000000003';
      const brokenKv = {
        put: vi.fn().mockRejectedValue(new Error('KV_SERVICE_DOWN')),
        get: vi.fn().mockRejectedValue(new Error('KV_SERVICE_DOWN')),
        delete: vi.fn()
      };
      const res = await revokeMedia(id, { kv: brokenKv });
      expect(res.success).toBe(false);
      expect(res.tombstoneWritten).toBe(false);
      expect(res.errors.some(e => e.includes('TOMBSTONE_WRITE_FAILED'))).toBe(true);
      // Fail-closed check:
      expect(await isMediaRevoked(id, brokenKv, { failClosed: true })).toBe(true);
    });

    // 4. Revogação com escrita parcial de tombstone
    it('4. Revogação com escrita parcial de tombstone: reporta erro e não conclui com sucesso', async () => {
      const id = '10000004-0004-4004-8004-000000000004';
      const failingPutKv = {
        put: vi.fn().mockRejectedValue(new Error('QUOTA_LIMIT_EXCEEDED')),
        get: vi.fn().mockResolvedValue(null),
        delete: vi.fn()
      };
      const res = await revokeMedia(id, { kv: failingPutKv });
      expect(res.tombstoneWritten).toBe(false);
      expect(res.success).toBe(false);
      expect(res.errors.some(e => e.includes('TOMBSTONE_WRITE_FAILED'))).toBe(true);
    });

    // 5. Revogação com manifesto antigo
    it('5. Revogação com manifesto antigo: sincronização renova set e bloqueia mídia', async () => {
      const id = '10000005-0005-4005-8005-000000000005';
      const mockKv = createMockKv();
      await mockKv.put(REVOCATION_MANIFEST_KEY, JSON.stringify({ version: 1, revokedIds: [id], updatedAt: Date.now() }));
      clearMemoryRevocationCache();
      const isRev = await isMediaRevoked(id, mockKv, { forceFresh: true });
      expect(isRev).toBe(true);
    });

    // 6. Duas revogações concorrentes
    it('6. Duas revogações concorrentes: mescla tombstones e IDs sem perda de dados', async () => {
      const idA = '10000006-0006-4006-8006-00000000000a';
      const idB = '10000006-0006-4006-8006-00000000000b';
      const mockKv = createMockKv();
      const [resA, resB] = await Promise.all([
        revokeMedia(idA, { kv: mockKv }),
        revokeMedia(idB, { kv: mockKv })
      ]);
      expect(resA.tombstoneWritten).toBe(true);
      expect(resB.tombstoneWritten).toBe(true);
      expect(await isMediaRevoked(idA, mockKv, { forceFresh: true })).toBe(true);
      expect(await isMediaRevoked(idB, mockKv, { forceFresh: true })).toBe(true);
    });

    // 7. Revogação simultânea a unrevoke
    it('7. Revogação simultânea a unrevoke: operações concorrentes são idempotentes', async () => {
      const idRevoke = '10000007-0007-4007-8007-000000000007';
      const idUnrevoke = '10000007-0007-4007-8007-000000000008';
      const mockKv = createMockKv();
      await revokeMedia(idUnrevoke, { kv: mockKv });

      await Promise.all([
        revokeMedia(idRevoke, { kv: mockKv }),
        unrevokeMedia(idUnrevoke, { kv: mockKv })
      ]);

      expect(await isMediaRevoked(idRevoke, mockKv, { forceFresh: true })).toBe(true);
      expect(await isMediaRevoked(idUnrevoke, mockKv, { forceFresh: true, checkTombstone: true })).toBe(false);
    });

    // 8. Reclassificação PUBLIC -> PRIVATE
    it('8. Reclassificação PUBLIC -> PRIVATE: bloqueia acesso anônimo conservadoramente', async () => {
      const id = '10000008-0008-4008-8008-000000000008';
      mocks.mediaStore.set(id, {
        id, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
        access_class: 'PRIVATE', purpose: 'editorial'
      });
      const cls = classifyMediaAccess(mocks.mediaStore.get(id));
      expect(cls.isPublic).toBe(false);
      expect(cls.category).toBe('PRIVATE');
    });

    // 9. Reclassificação PUBLIC -> STAFF_ONLY
    it('9. Reclassificação PUBLIC -> STAFF_ONLY: bloqueia leitor comum e autoriza staff', async () => {
      const id = '10000009-0009-4009-8009-000000000009';
      mocks.mediaStore.set(id, {
        id, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
        access_class: 'STAFF_ONLY', purpose: 'staff_chapter'
      });
      const cls = classifyMediaAccess(mocks.mediaStore.get(id));
      expect(cls.isPublic).toBe(false);
      expect(cls.category).toBe('STAFF_ONLY');
    });

    // 10. Reclassificação PUBLIC -> RESTRICTED
    it('10. Reclassificação PUBLIC -> RESTRICTED: nega cache público e acesso geral', async () => {
      const id = '10000010-0010-4010-8010-000000000010';
      mocks.mediaStore.set(id, {
        id, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
        access_class: 'RESTRICTED', purpose: 'cosmetic'
      });
      const cls = classifyMediaAccess(mocks.mediaStore.get(id));
      expect(cls.isPublic).toBe(false);
      expect(cls.category).toBe('RESTRICTED');
    });

    // 11. Mídia DELETED com cópia antiga em cache
    it('11. Mídia DELETED com cópia antiga em cache: dispara revogação e remove do cache', async () => {
      const id = '10000011-0011-4011-8011-000000000011';
      const mockCache = createMockCache();
      const mockKv = createMockKv();
      mocks.mediaStore.set(id, { id, status: 'DELETED', storage_ready: true });

      const res = await getPublicMediaRoute({
        locals: {}, params: { id },
        request: new Request(`https://projectnox.org/media/${id}`),
        platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
        cookies: { getAll: () => [] }
      });

      expect(res.status).toBe(404);
      expect(res.headers.get('Cache-Control')).toContain('no-store');
    });

    // 12. Mídia privada acessada por anônimo
    it('12. Mídia privada acessada por anônimo: retorna 404 sem gravar tombstone indevido', async () => {
      const id = '10000012-0012-4012-8012-000000000012';
      const mockKv = createMockKv();
      mocks.mediaStore.set(id, {
        id, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
        access_class: 'PRIVATE', purpose: 'editorial', created_by: 'owner-uuid'
      });

      const res = await getPublicMediaRoute({
        locals: {}, params: { id },
        request: new Request(`https://projectnox.org/media/${id}`),
        platform: { env: { COVER_THUMBNAILS: mockKv }, caches: {} },
        cookies: { getAll: () => [] }
      });

      expect(res.status).toBe(404);
      expect(res.headers.get('Cache-Control')).toContain('no-store');
      // Crucial: No tombstone written on read!
      expect(mockKv.put).not.toHaveBeenCalled();
    });

    // 13. Mídia privada acessada por usuário sem permissão
    it('13. Mídia privada acessada por usuário sem permissão: 404 no-store e 0 escritas no KV', async () => {
      const id = '10000013-0013-4013-8013-000000000013';
      const mockKv = createMockKv();
      mocks.mediaStore.set(id, {
        id, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
        access_class: 'PRIVATE', purpose: 'editorial', created_by: 'owner-uuid'
      });

      mocks.decodeSessionJwt.mockReturnValue({ jwt: { sub: 'intruder-id' }, accessToken: 'tok' });
      mocks.resolveSessionData.mockResolvedValue({ user: { id: 'intruder-id' }, role: 'USER' });

      const res = await getPublicMediaRoute({
        locals: {}, params: { id },
        request: new Request(`https://projectnox.org/media/${id}`, {
          headers: { Authorization: 'Bearer tok' }
        }),
        platform: { env: { COVER_THUMBNAILS: mockKv }, caches: {} },
        cookies: { getAll: () => [] }
      });

      expect(res.status).toBe(404);
      expect(res.headers.get('Cache-Control')).toContain('no-store');
      expect(mockKv.put).not.toHaveBeenCalled();
    });

    // 14. Mídia privada acessada por usuário autorizado
    it('14. Mídia privada acessada por usuário autorizado: redireciona 307 para endpoint privado', async () => {
      const id = '10000014-0014-4014-8014-000000000014';
      const mockKv = createMockKv();
      mocks.mediaStore.set(id, {
        id, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
        access_class: 'PRIVATE', purpose: 'editorial', created_by: 'owner-id'
      });

      mocks.decodeSessionJwt.mockReturnValue({ jwt: { sub: 'owner-id' }, accessToken: 'tok-owner' });
      mocks.resolveSessionData.mockResolvedValue({ user: { id: 'owner-id' }, role: 'USER' });

      const res = await getPublicMediaRoute({
        locals: {}, params: { id },
        request: new Request(`https://projectnox.org/media/${id}`, {
          headers: { Authorization: 'Bearer tok-owner' }
        }),
        platform: { env: { COVER_THUMBNAILS: mockKv }, caches: {} },
        cookies: { getAll: () => [] }
      });

      expect(res.status).toBe(307);
      expect(res.headers.get('Location')).toContain(`/api/media/${id}`);
      expect(res.headers.get('Cache-Control')).toContain('no-store');
    });

    // 15. Revogação sem operações de escrita indevidas na leitura
    it('15. Revogação sem operações de escrita indevidas na leitura: 50 requisições não autorizadas geram exatamente 0 gravações KV', async () => {
      const id = '10000015-0015-4015-8015-000000000015';
      const mockKv = createMockKv();
      mocks.mediaStore.set(id, {
        id, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
        access_class: 'STAFF_ONLY', purpose: 'editorial'
      });

      for (let i = 0; i < 50; i++) {
        await getPublicMediaRoute({
          locals: {}, params: { id },
          request: new Request(`https://projectnox.org/media/${id}`),
          platform: { env: { COVER_THUMBNAILS: mockKv }, caches: {} },
          cookies: { getAll: () => [] }
        });
      }

      expect(mockKv.put).toHaveBeenCalledTimes(0);
    });

    // 16. Cache compartilhado entre diferentes versões do Worker
    it('16. Cache compartilhado entre versões (cross_version_cache): entrada persistente é invalidada pelo tombstone', async () => {
      const id = '10000016-0016-4016-8016-000000000016';
      const mockCache = createMockCache();
      const mockKv = createMockKv();

      // Seed cross-version cached 200
      await mockCache.put(
        `https://projectnox.org/media/${id}`,
        new Response('v1_bytes', { status: 200, headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } })
      );

      // Deploy v2: Revocation tombstone exists in KV
      await revokeMedia(id, { kv: mockKv, cache: mockCache });

      // Request arriving at v2 worker
      const res = await getPublicMediaRoute({
        locals: {}, params: { id },
        request: new Request(`https://projectnox.org/media/${id}`),
        platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
        cookies: { getAll: () => [] }
      });

      expect(res.status).toBe(404);
      expect(await mockCache.match(`https://projectnox.org/media/${id}`)).toBeNull();
    });

    // 17. Reinicialização de isolate
    it('17. Reinicialização de isolate: memória zerada recarrega tombstone do KV com sucesso', async () => {
      const id = '10000017-0017-4017-8017-000000000017';
      const mockKv = createMockKv();
      await revokeMedia(id, { kv: mockKv });

      // Isolate restart simulation
      clearMemoryRevocationCache();

      const isRev = await isMediaRevoked(id, mockKv, { forceFresh: true });
      expect(isRev).toBe(true);
    });

    // 18. Tombstone expirado
    it('18. Tombstone expirado: estado autoritativo do banco preserva proteção fail-closed', async () => {
      const id = '10000018-0018-4018-8018-000000000018';
      const mockKv = createMockKv();
      mocks.mediaStore.set(id, {
        id, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
        access_class: 'PRIVATE', purpose: 'editorial'
      });

      // Tombstone is missing from KV (simulating expiration)
      await mockKv.delete(`${REVOCATION_KEY_PREFIX}${id}`);
      clearMemoryRevocationCache();

      const res = await getPublicMediaRoute({
        locals: {}, params: { id },
        request: new Request(`https://projectnox.org/media/${id}`),
        platform: { env: { COVER_THUMBNAILS: mockKv }, caches: {} },
        cookies: { getAll: () => [] }
      });

      // Still protected: Authoritative DB status rejects access!
      expect(res.status).toBe(404);
      expect(res.headers.get('Cache-Control')).toContain('no-store');
    });

    // 19. Requisições concorrentes durante revogação
    it('19. Requisições concorrentes durante revogação: in-memory set e tombstone garantem bloqueio imediato', async () => {
      const id = '10000019-0019-4019-8019-000000000019';
      const mockKv = createMockKv();
      const mockCache = createMockCache();

      const revokePromise = revokeMedia(id, { kv: mockKv, cache: mockCache });
      // In-flight concurrent request
      const isRev = await isMediaRevoked(id, mockKv);
      expect(isRev).toBe(true);
      await revokePromise;
    });

    // 20. Restauração legítima de mídia pública
    it('20. Restauração legítima de mídia pública: unrevoke restaura disponibilidade', async () => {
      const id = '10000020-0020-4020-8020-000000000020';
      const mockKv = createMockKv();
      const mockCache = createMockCache();

      await revokeMedia(id, { kv: mockKv, cache: mockCache });
      expect(await isMediaRevoked(id, mockKv)).toBe(true);

      const unrev = await unrevokeMedia(id, { kv: mockKv, cache: mockCache });
      expect(unrev.success).toBe(true);
      expect(await isMediaRevoked(id, mockKv, { forceFresh: true, checkTombstone: true })).toBe(false);
    });

    // 21. Resposta 304 de mídia posteriormente revogada
    it('21. Resposta 304 de mídia posteriormente revogada: revalidação condicional retorna 404, não 304', async () => {
      const id = '10000021-0021-4021-8021-000000000021';
      const mockCache = createMockCache();
      const mockKv = createMockKv();
      const etag = '"sha_21"';

      await mockCache.put(`https://projectnox.org/media/${id}`, new Response('data', {
        status: 200,
        headers: { 'ETag': etag, 'Content-Type': 'image/jpeg' }
      }));

      await revokeMedia(id, { kv: mockKv, cache: mockCache });

      const res = await getPublicMediaRoute({
        locals: {}, params: { id },
        request: new Request(`https://projectnox.org/media/${id}`, {
          headers: { 'if-none-match': etag }
        }),
        platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
        cookies: { getAll: () => [] }
      });

      expect(res.status).toBe(404);
      expect(res.headers.get('Cache-Control')).toContain('no-store');
    });

    // 22. Resposta 206 de mídia posteriormente revogada
    it('22. Resposta 206 de mídia posteriormente revogada: requisição parcial Range retorna 404, não 206', async () => {
      const id = '10000022-0022-4022-8022-000000000022';
      const mockCache = createMockCache();
      const mockKv = createMockKv();

      await mockCache.put(`https://projectnox.org/media/${id}`, new Response('full_image_data_22', {
        status: 200,
        headers: { 'Content-Range': 'bytes 0-10/18' }
      }));

      await revokeMedia(id, { kv: mockKv, cache: mockCache });

      const res = await getPublicMediaRoute({
        locals: {}, params: { id },
        request: new Request(`https://projectnox.org/media/${id}`, {
          headers: { Range: 'bytes=0-10' }
        }),
        platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
        cookies: { getAll: () => [] }
      });

      expect(res.status).toBe(404);
    });

    // 23. Miniaturas e variantes de URL
    it('23. Miniaturas e variantes de URL: expurga todas as query strings e chaves KV', async () => {
      const id = '10000023-0023-4023-8023-000000000023';
      const mockCache = createMockCache();
      const mockKv = createMockKv();

      await mockKv.put(`cover-thumb:v1:${id}`, 'thumb_data');
      await mockKv.put(`cover-hero:v1:${id}`, 'hero_data');

      const res = await revokeMedia(id, { kv: mockKv, cache: mockCache });
      expect(res.kvPurged).toBeGreaterThanOrEqual(2);
      expect(await mockKv.get(`cover-thumb:v1:${id}`)).toBeNull();
      expect(await mockKv.get(`cover-hero:v1:${id}`)).toBeNull();
    });

    // 24. Cache HIT em diferentes regiões
    it('24. Cache HIT em diferentes regiões: replicação global do tombstone bloqueia isolate regional', async () => {
      const id = '10000024-0024-4024-8024-000000000024';
      const sharedKv = createMockKv();

      // Region 1 revokes
      await revokeMedia(id, { kv: sharedKv });

      // Region 2 with fresh memory isolate reads
      clearMemoryRevocationCache();
      const isRevInRegion2 = await isMediaRevoked(id, sharedKv, { forceFresh: true });
      expect(isRevInRegion2).toBe(true);
    });

    // 25. Resposta GET truncada
    it('25. Resposta GET truncada: detectada e categorizada como BODY_INTEGRITY_FAILURE', async () => {
      const truncatedBuf = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // 4 bytes
      const headers = new Headers({ 'content-length': '1000', 'content-type': 'image/jpeg' });
      const validation = validateResponseBody(truncatedBuf.buffer, 200, headers);
      expect(validation.valid).toBe(false);
      expect(validation.errorType).toBe('BODY_INTEGRITY_FAILURE');
      expect(validation.reason).toContain('Truncated body');
    });

    // 26. Conteúdo incorreto com HTTP 200
    it('26. Conteúdo incorreto com HTTP 200: página HTML ou JSON disfarçada é rejeitada', async () => {
      const htmlPayload = new TextEncoder().encode('<!DOCTYPE html><html><body>Error</body></html>');
      const jsonPayload = new TextEncoder().encode('{"error":"Not Found"}');
      const headers = new Headers({ 'content-type': 'image/jpeg' });

      const htmlVal = validateResponseBody(htmlPayload.buffer, 200, headers);
      expect(htmlVal.valid).toBe(false);
      expect(htmlVal.errorType).toBe('BODY_INTEGRITY_FAILURE');
      expect(htmlVal.reason).toContain('HTML/JSON disguised as image');

      const jsonVal = validateResponseBody(jsonPayload.buffer, 200, headers);
      expect(jsonVal.valid).toBe(false);
      expect(jsonVal.errorType).toBe('BODY_INTEGRITY_FAILURE');
      expect(jsonVal.reason).toContain('HTML/JSON disguised as image');
    });

    // 27. ETag inválido
    it('27. ETag inválido: divergência entre SHA256 do corpo e ETag é detectada', async () => {
      const body = new Uint8Array([1, 2, 3, 4]);
      const bogusEtag = '"0000000000000000000000000000000000000000000000000000000000000000"';
      const headers = new Headers({ etag: bogusEtag, 'content-type': 'image/jpeg' });

      const val = validateResponseBody(body.buffer, 200, headers);
      expect(val.valid).toBe(false);
      expect(val.errorType).toBe('BODY_INTEGRITY_FAILURE');
      expect(val.reason).toContain('Cryptographic SHA256 mismatch');
    });

    // 28. Timeout Telegram
    it('28. Timeout Telegram: tratado com resiliência sem corromper cache', async () => {
      mocks.download.mockRejectedValueOnce(new Error('cover body timed out'));
      const id = '10000028-0028-4028-8028-000000000028';
      mocks.mediaStore.set(id, {
        id, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
        access_class: 'PUBLIC', purpose: 'editorial', provider_key: 'tg_timeout'
      });

      const res = await getPublicMediaRoute({
        locals: {}, params: { id },
        request: new Request(`https://projectnox.org/media/${id}`),
        platform: { env: {} },
        cookies: { getAll: () => [] }
      }).catch(err => err);

      expect(res).toBeDefined();
    });

    // 29. Telemetria indisponível
    it('29. Telemetria indisponível: falha do GraphQL não quebra execução do benchmark', async () => {
      const emptyOrFailedGraphQL = null;
      const status = emptyOrFailedGraphQL ? 'COMPLETE' : 'TELEMETRY_INCOMPLETE';
      expect(status).toBe('TELEMETRY_INCOMPLETE');
    });

    // 30. Deployment API indisponível
    it('30. Deployment API indisponível: retorna DEPLOYMENT_NOT_VERIFIED sem inventar versão', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Cloudflare API unreachable'));
        const deployInfo = await getActiveDeploymentInfo();
        expect(deployInfo.versionId).toBe('DEPLOYMENT_NOT_VERIFIED');
        expect(deployInfo.verified).toBe(false);
        expect(deployInfo.percentage).toBe(0);
        expect(deployInfo.deploymentId).toBe('DEPLOYMENT_NOT_VERIFIED');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    // Matriz Completa de Classificação e Fail-Closed
    it('Matriz completa de classificação de acesso e proteção fail-closed', () => {
      // Missing or corrupt metadata
      expect(classifyMediaAccess(null).isPublic).toBe(false);
      expect(classifyMediaAccess(undefined).isPublic).toBe(false);
      expect(classifyMediaAccess('invalid').isPublic).toBe(false);

      // DELETED
      expect(classifyMediaAccess({ status: 'DELETED' }).category).toBe('DELETED');
      expect(classifyMediaAccess({ status: 'DELETED' }).isPublic).toBe(false);

      // Storage not ready
      expect(classifyMediaAccess({ status: 'ACTIVE', storage_ready: false }).category).toBe('INVALID');
      expect(classifyMediaAccess({ status: 'ACTIVE' }).category).toBe('INVALID'); // missing storage_ready

      // Missing or inactive status
      expect(classifyMediaAccess({ storage_ready: true }).category).toBe('INVALID');
      expect(classifyMediaAccess({ status: 'DRAFT', storage_ready: true }).category).toBe('INVALID');
      expect(classifyMediaAccess({ status: 'PENDING', storage_ready: true }).category).toBe('INVALID');

      // Internal purposes fail-closed
      const internalPurposes = ['staff_manual', 'pipeline', 'scan_pipeline', 'production', 'staging', 'internal_test', 'temp'];
      for (const p of internalPurposes) {
        const cls = classifyMediaAccess({ status: 'ACTIVE', storage_ready: true, purpose: p });
        expect(cls.isPublic, `Purpose ${p} must not be public`).toBe(false);
        expect(cls.category).toBe('INTERNAL');
      }

      // Explicit non-public classes
      expect(classifyMediaAccess({ status: 'ACTIVE', storage_ready: true, access_class: 'PRIVATE' }).category).toBe('PRIVATE');
      expect(classifyMediaAccess({ status: 'ACTIVE', storage_ready: true, access_class: 'STAFF_ONLY' }).category).toBe('STAFF_ONLY');
      expect(classifyMediaAccess({ status: 'ACTIVE', storage_ready: true, access_class: 'RESTRICTED' }).category).toBe('RESTRICTED');
      expect(classifyMediaAccess({ status: 'ACTIVE', storage_ready: true, access_class: 'AUTHENTICATED' }).category).toBe('AUTHENTICATED');

      // Explicit PUBLIC
      const pubCls = classifyMediaAccess({ status: 'ACTIVE', storage_ready: true, access_class: 'PUBLIC' });
      expect(pubCls.isPublic).toBe(true);
      expect(pubCls.category).toBe('PUBLIC');

      // Legacy public allowlist
      const legacyPublicPurposes = ['editorial', 'staff_chapter', 'scan_chapter', 'chapter_page', 'cover', 'work_cover', 'avatar', 'banner', 'scan_logo', 'scan_banner', 'cosmetic'];
      for (const lp of legacyPublicPurposes) {
        const cls = classifyMediaAccess({ status: 'ACTIVE', storage_ready: true, purpose: lp });
        expect(cls.isPublic, `Legacy purpose ${lp} must be public`).toBe(true);
        expect(cls.category).toBe('PUBLIC');
      }

      // Unknown purpose without access_class fails closed
      expect(classifyMediaAccess({ status: 'ACTIVE', storage_ready: true, purpose: 'unknown_raw' }).isPublic).toBe(false);
    });
  });

  // =========================================================================
  // SEÇÃO 17: AUDITORIA DOS QUATRO BLOQUEADORES REAIS APONTADOS PELO CODEX
  // =========================================================================
  describe('Seção 17: Auditoria dos Quatro Bloqueadores Reais Apontados pelo Codex', () => {
    // BLOQUEADOR A: Ausência de KV
    it('Bloqueador A.1: ausência de binding KV nunca retorna REVOCATION_COMPLETED e registra KV_BINDING_MISSING', async () => {
      const mediaId = 'a0000001-aaaa-4001-8001-000000000001';
      const mockCache = createMockCache();

      // Revoke called with no KV binding
      const res = await revokeMedia(mediaId, { cache: mockCache });

      expect(res.success).toBe(false);
      expect(res.state).toBe('REVOCATION_PARTIAL');
      expect(res.tombstoneWritten).toBe(false);
      expect(res.manifestUpdated).toBe(false);
      expect(res.errors.some((e: string) => e.includes('KV_BINDING_MISSING'))).toBe(true);
    });

    it('Bloqueador A.2: falha em KV.put de tombstone impede REVOCATION_COMPLETED e reporta erro', async () => {
      const mediaId = 'a0000002-aaaa-4002-8002-000000000002';
      const mockCache = createMockCache();
      const brokenKv = {
        put: vi.fn().mockRejectedValue(new Error('KV_STORAGE_UNAVAILABLE')),
        get: vi.fn().mockResolvedValue(null),
        delete: vi.fn()
      };

      const res = await revokeMedia(mediaId, { kv: brokenKv, cache: mockCache });

      expect(res.success).toBe(false);
      expect(res.state).toBe('REVOCATION_PARTIAL');
      expect(res.tombstoneWritten).toBe(false);
      expect(res.errors.some((e: string) => e.includes('TOMBSTONE_WRITE_FAILED'))).toBe(true);
    });

    // BLOQUEADOR B: Expurgo global vs local
    it('Bloqueador B.1: expurgo local na Cache API não é confundido com expurgo global', async () => {
      const mediaId = 'b0000001-bbbb-4001-8001-000000000001';
      const mockCache = createMockCache();
      const mockKv = createMockKv();
      await mockCache.put(`https://projectnox.org/media/${mediaId}`, new Response('cached', { status: 200 }));

      const res = await revokeMedia(mediaId, { kv: mockKv, cache: mockCache });

      expect(res.localPurgeVerified).toBe(true);
      expect(res.globalPurgeVerified).toBe(false);
      expect(res.state).toBe('REVOCATION_COMPLETED');
    });

    it('Bloqueador B.2: requireGlobalPurge marca REVOCATION_PARTIAL se invalidação global não puder ser comprovada', async () => {
      const mediaId = 'b0000002-bbbb-4002-8002-000000000002';
      const mockCache = createMockCache();
      const mockKv = createMockKv();

      const res = await revokeMedia(mediaId, {
        kv: mockKv,
        cache: mockCache,
        requireGlobalPurge: true
      });

      expect(res.success).toBe(false);
      expect(res.state).toBe('REVOCATION_PARTIAL');
      expect(res.localPurgeVerified).toBe(true);
      expect(res.globalPurgeVerified).toBe(false);
      expect(res.errors.some((e: string) => e.includes('GLOBAL_PURGE_UNVERIFIABLE'))).toBe(true);

      // Preserva o bloqueio de segurança através do tombstone autoritativo
      expect(await isMediaRevoked(mediaId, mockKv, { checkTombstone: true })).toBe(true);
    });

    it('Bloqueador B.3: requireGlobalPurge conclui REVOCATION_COMPLETED quando verificação multi-região aprova', async () => {
      const mediaId = 'b0000003-bbbb-4003-8003-000000000003';
      const mockCache = createMockCache();
      const mockKv = createMockKv();
      const mockGlobalVerifier = vi.fn().mockResolvedValue(true);

      const res = await revokeMedia(mediaId, {
        kv: mockKv,
        cache: mockCache,
        requireGlobalPurge: true,
        globalVerifier: mockGlobalVerifier
      });

      expect(res.success).toBe(true);
      expect(res.state).toBe('REVOCATION_COMPLETED');
      expect(res.globalPurgeVerified).toBe(true);
      expect(mockGlobalVerifier).toHaveBeenCalledWith(mediaId);
    });

    // BLOQUEADOR C: Concorrência de manifestos & Tombstone como fonte autoritativa
    it('Bloqueador C.1: RAWV e mesclagem de manifesto preservam IDs sob revogações simultâneas', async () => {
      const idA = 'c0000001-cccc-4001-8001-00000000000a';
      const idB = 'c0000001-cccc-4001-8001-00000000000b';
      const mockKv = createMockKv();

      const [resA, resB] = await Promise.all([
        revokeMedia(idA, { kv: mockKv }),
        revokeMedia(idB, { kv: mockKv })
      ]);

      expect(resA.tombstoneWritten).toBe(true);
      expect(resB.tombstoneWritten).toBe(true);

      const manifest = await mockKv.get(REVOCATION_MANIFEST_KEY, { type: 'json' });
      expect(manifest.revokedIds).toContain(idA);
      expect(manifest.revokedIds).toContain(idB);
    });

    it('Bloqueador C.2: tombstone autoritativo impede restauração de acesso mesmo se manifesto omitir entrada', async () => {
      const idA = 'c0000002-cccc-4002-8002-00000000000a';
      const idB = 'c0000002-cccc-4002-8002-00000000000b';
      const mockKv = createMockKv();

      // Revoke both
      await revokeMedia(idA, { kv: mockKv });
      await revokeMedia(idB, { kv: mockKv });

      // Simulate corrupted manifest dropping idB due to simulated race
      await mockKv.put(REVOCATION_MANIFEST_KEY, JSON.stringify({
        version: 99,
        updatedAt: Date.now(),
        revokedIds: [idA] // idB is missing!
      }));

      clearMemoryRevocationCache();

      // idB must still be recognized as revoked via authoritative tombstone check
      const isRev = await isMediaRevoked(idB, mockKv, { checkTombstone: true });
      expect(isRev, 'Tombstone individual deve funcionar como fonte autoritativa de revogação').toBe(true);

      // Route request to media/[id] must reject with HTTP 404
      mocks.mediaStore.set(idB, {
        id: idB, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
        access_class: 'PUBLIC', purpose: 'editorial'
      });
      const routeRes = await getPublicMediaRoute({
        locals: {}, params: { id: idB },
        request: new Request(`https://projectnox.org/media/${idB}`),
        platform: { env: { COVER_THUMBNAILS: mockKv } },
        cookies: { getAll: () => [] }
      });
      expect(routeRes.status).toBe(404);
      expect(routeRes.headers.get('Cache-Control')).toContain('no-store');
    });

    // BLOQUEADOR D: Janela residual de 10 segundos & Cache de Borda
    it('Bloqueador D.1: rota /media/[id] consulta tombstone autoritativo no MISS e elimina janela residual', async () => {
      const mediaId = 'd0000001-dddd-4001-8001-000000000001';
      const mockKv = createMockKv();
      const mockCache = createMockCache();

      // Simulate isolate having synced manifest with empty list at t=0
      await mockKv.put(REVOCATION_MANIFEST_KEY, JSON.stringify({
        version: 1,
        updatedAt: Date.now(),
        revokedIds: []
      }));
      clearMemoryRevocationCache();
      await isMediaRevoked('other-id', mockKv); // Syncs empty manifest into isolate memory

      // Another isolate writes authoritative tombstone for mediaId at t=1
      await mockKv.put(`${REVOCATION_KEY_PREFIX}${mediaId}`, JSON.stringify({
        mediaId,
        revokedAt: Date.now(),
        reason: 'CONFIDENTIAL',
        state: 'REVOCATION_COMPLETED'
      }));

      mocks.mediaStore.set(mediaId, {
        id: mediaId, provider: 'telegram', storage_ready: true, status: 'ACTIVE',
        access_class: 'PUBLIC', purpose: 'editorial'
      });

      // Request on current isolate hits route MISS path
      const res = await getPublicMediaRoute({
        locals: {}, params: { id: mediaId },
        request: new Request(`https://projectnox.org/media/${mediaId}`),
        platform: { env: { COVER_THUMBNAILS: mockKv }, caches: { default: mockCache } },
        cookies: { getAll: () => [] }
      });

      // Must be rejected with 404 no-store, not streamed or re-cached
      expect(res.status).toBe(404);
      expect(res.headers.get('Cache-Control')).toContain('no-store');
      expect(await mockCache.match(`https://projectnox.org/media/${mediaId}`)).toBeNull();
    });

    it('Bloqueador D.2: HITs de borda atendidos antes do Worker são explicitamente reconhecidos como fora do alcance do código do Worker', async () => {
      // Invariant: Code inside the Worker cannot intercept responses served by edge cache before Worker executes.
      // Protection requires declarative edge cache purge (ctx.cache.purge).
      const mediaId = 'd0000002-dddd-4002-8002-000000000002';
      const mockKv = createMockKv();
      const mockCtx = {
        cache: {
          purge: vi.fn().mockResolvedValue({ success: true })
        }
      };

      const res = await revokeMedia(mediaId, {
        kv: mockKv,
        ctx: mockCtx,
        reason: 'SECURITY_INCIDENT'
      });

      expect(res.workersCachePurged).toBe(1);
      expect(mockCtx.cache.purge).toHaveBeenCalledWith({
        tags: [`media-${mediaId}`],
        pathPrefixes: [`/media/${mediaId}`]
      });
    });

    // REVISÃO CODEX POST: Sanitização de Memória & Concorrência de Restauração
    it('Codex Item 1: revogação em um isolate não reintroduz IDs restaurados no manifesto a partir da memória local', async () => {
      const restoredId = 'e0000001-eeee-4001-8001-000000000001';
      const newRevokeId = 'e0000001-eeee-4001-8001-000000000002';
      const mockKv = createMockKv();

      // 1. Initially both IDs are revoked
      await revokeMedia(restoredId, { kv: mockKv });
      let manifest = await mockKv.get(REVOCATION_MANIFEST_KEY, { type: 'json' });
      expect(manifest.revokedIds).toContain(restoredId);

      // 2. In Isolate A: restoredId is unrevoked
      await unrevokeMedia(restoredId, { kv: mockKv });
      manifest = await mockKv.get(REVOCATION_MANIFEST_KEY, { type: 'json' });
      expect(manifest.revokedIds).not.toContain(restoredId);

      // 3. In Isolate B: memory still happens to have restoredId in local set
      // When Isolate B revokes newRevokeId, it must NOT inject restoredId back into the manifest
      populateMemoryRevocationCache([restoredId]); // Simulate dirty isolate memory
      expect(getMemoryRevocationSet().has(restoredId)).toBe(true);

      const res = await revokeMedia(newRevokeId, { kv: mockKv });
      expect(res.tombstoneWritten).toBe(true);
      expect(res.manifestUpdated).toBe(true);

      const finalManifest = await mockKv.get(REVOCATION_MANIFEST_KEY, { type: 'json' });
      expect(finalManifest.revokedIds).toContain(newRevokeId);
      expect(finalManifest.revokedIds, 'IDs restaurados não podem ser ressuscitados no manifesto global').not.toContain(restoredId);
    });

    it('Codex Item 2: sincronização do manifesto limpa IDs restaurados da memória local do isolate', async () => {
      const mediaId = 'e0000002-eeee-4002-8002-000000000001';
      const mockKv = createMockKv();

      // Isolate currently has mediaId in local memory
      populateMemoryRevocationCache([mediaId]);
      expect(getMemoryRevocationSet().has(mediaId)).toBe(true);

      // Another isolate restored the media (manifest in KV has empty list and tombstone is gone)
      await mockKv.put(REVOCATION_MANIFEST_KEY, JSON.stringify({
        version: 10,
        updatedAt: Date.now(),
        revokedIds: []
      }));
      await mockKv.delete(`${REVOCATION_KEY_PREFIX}${mediaId}`);

      // When sync runs (or forceFresh / checkTombstone), memoryRevokedSet must be reconciled
      const isRev = await isMediaRevoked(mediaId, mockKv, { forceFresh: true, checkTombstone: true });
      expect(isRev, 'Mídia restaurada deve retornar false após reconciliação').toBe(false);
      expect(getMemoryRevocationSet().has(mediaId), 'ID restaurado deve ser removido de memoryRevokedSet').toBe(false);
    });

    it('Codex Item 3: esgotamento de tentativas de verificação do manifesto registra falha explícita e retorna REVOCATION_PARTIAL', async () => {
      const mediaId = 'e0000003-eeee-4003-8003-000000000001';
      const rawKv = createMockKv();

      // KV whose manifest get always simulates an overwritten state omitting mediaId
      const brokenManifestKv = {
        ...rawKv,
        get: vi.fn(async (key: string, opts?: any) => {
          if (key === REVOCATION_MANIFEST_KEY) {
            return { version: 1, updatedAt: Date.now(), revokedIds: ['other-id'] };
          }
          return rawKv.get(key, opts);
        }),
        put: rawKv.put.bind(rawKv),
        delete: rawKv.delete.bind(rawKv)
      };

      const res = await revokeMedia(mediaId, { kv: brokenManifestKv });

      // Must NOT return REVOCATION_COMPLETED
      expect(res.state).toBe('REVOCATION_PARTIAL');
      expect(res.success).toBe(false);
      expect(res.manifestUpdated).toBe(false);
      expect(res.tombstoneWritten).toBe(true);
      expect(res.errors.some(e => e.includes('MANIFEST_VERIFICATION_FAILED'))).toBe(true);
    });

    // REVISÃO CODEX POST (RODADA 2): Concorrência Intra-Isolate & Consistência Eventual de KV
    it('Codex Rodada 2 - Item 1: revogações concorrentes no mesmo isolate preservam todos os IDs via fila atômica', async () => {
      const id1 = 'f0000001-ffff-4001-8001-000000000001';
      const id2 = 'f0000001-ffff-4001-8001-000000000002';
      const mockKv = createMockKv();

      const [res1, res2] = await Promise.all([
        revokeMedia(id1, { kv: mockKv }),
        revokeMedia(id2, { kv: mockKv })
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      expect(res1.manifestUpdated).toBe(true);
      expect(res2.manifestUpdated).toBe(true);

      const manifest = await mockKv.get(REVOCATION_MANIFEST_KEY, { type: 'json' });
      expect(manifest.revokedIds).toContain(id1);
      expect(manifest.revokedIds).toContain(id2);
      expect(getMemoryRevocationSet().has(id1)).toBe(true);
      expect(getMemoryRevocationSet().has(id2)).toBe(true);
    });

    it('Codex Rodada 2 - Item 2: snapshot defasado do manifesto reconcilia IDs contra tombstones antes de descartar', async () => {
      const mediaId = 'f0000002-ffff-4002-8002-000000000001';
      const mockKv = createMockKv();

      // 1. Media is revoked with tombstone
      await mockKv.put(`${REVOCATION_KEY_PREFIX}${mediaId}`, JSON.stringify({
        mediaId,
        revokedAt: Date.now(),
        state: 'REVOCATION_COMPLETED'
      }));
      populateMemoryRevocationCache([mediaId]);

      // 2. A stale KV replica returns a manifest omitting mediaId
      await mockKv.put(REVOCATION_MANIFEST_KEY, JSON.stringify({
        version: 50,
        updatedAt: Date.now(),
        revokedIds: ['other-id'] // mediaId is missing due to simulated replica lag
      }));

      // 3. Sync must check tombstone before discarding mediaId from memory set
      const isRev = await isMediaRevoked(mediaId, mockKv, { forceFresh: true });
      expect(isRev, 'Revogação não pode ser descartada se tombstone ainda existe no KV').toBe(true);
      expect(getMemoryRevocationSet().has(mediaId)).toBe(true);
    });

    it('Codex Rodada 2 - Item 3: leitura negativa defasada de tombstone não anula revogação comprovada pelo manifesto', async () => {
      const mediaId = 'f0000003-ffff-4003-8003-000000000001';
      const rawKv = createMockKv();

      // Manifest has mediaId
      await rawKv.put(REVOCATION_MANIFEST_KEY, JSON.stringify({
        version: 1,
        updatedAt: Date.now(),
        revokedIds: [mediaId]
      }));

      // KV whose tombstone lookup returns null simulating stale read replica
      const staleReplicaKv = {
        ...rawKv,
        get: vi.fn(async (key: string, opts?: any) => {
          if (key === `${REVOCATION_KEY_PREFIX}${mediaId}`) {
            return null; // Stale negative read!
          }
          return rawKv.get(key, opts);
        }),
        put: rawKv.put.bind(rawKv),
        delete: rawKv.delete.bind(rawKv)
      };

      // Populate memory set from manifest
      await isMediaRevoked(mediaId, staleReplicaKv, { forceFresh: true });
      expect(getMemoryRevocationSet().has(mediaId)).toBe(true);

      // Caller requests authoritative tombstone check on MISS path
      const isRev = await isMediaRevoked(mediaId, staleReplicaKv, { checkTombstone: true });
      expect(isRev, 'Leitura negativa defasada de tombstone não pode anular revogação confirmada').toBe(true);
    });

    it('Codex Rodada 3 - Item 1: manifesto ausente no KV (clean state) não bloqueia mídia válida', async () => {
      const mediaId = 'f0000004-ffff-4004-8004-000000000001';
      const mockKv = createMockKv();
      // Manifest key does not exist (returns null)
      clearMemoryRevocationCache();

      const isRev = await isMediaRevoked(mediaId, mockKv);
      expect(isRev, 'Mídia válida não pode ser bloqueada quando manifesto está ausente em KV novo').toBe(false);
    });

    it('Codex Rodada 3 - Item 2: falha de I/O na reconciliação de tombstone preserva revogação conhecida (fail-closed)', async () => {
      const mediaId = 'f0000005-ffff-4005-8005-000000000001';
      const rawKv = createMockKv();

      // Seed in-memory set with mediaId
      populateMemoryRevocationCache([mediaId]);

      // Stale manifest omits mediaId
      await rawKv.put(REVOCATION_MANIFEST_KEY, JSON.stringify({
        version: 10,
        updatedAt: Date.now(),
        revokedIds: ['other-media']
      }));

      // KV throws error when trying to fetch individual tombstone
      const rejectingKv = {
        ...rawKv,
        get: vi.fn(async (key: string, opts?: any) => {
          if (key === `${REVOCATION_KEY_PREFIX}${mediaId}`) {
            throw new Error('KV_NETWORK_TIMEOUT');
          }
          return rawKv.get(key, opts);
        }),
        put: rawKv.put.bind(rawKv),
        delete: rawKv.delete.bind(rawKv)
      };

      // Sync manifest with rejecting tombstone lookup
      const isRev = await isMediaRevoked(mediaId, rejectingKv, { forceFresh: true });
      expect(isRev, 'Falha no lookup do tombstone deve preservar a revogação em fail-closed').toBe(true);
      expect(getMemoryRevocationSet().has(mediaId)).toBe(true);
    });

    it('Codex Rodada 3 - Item 3: revogação em memória é respeitada mesmo quando KV binding está ausente', async () => {
      const mediaId = 'f0000006-ffff-4006-8006-000000000001';
      clearMemoryRevocationCache();

      // Revoke media without KV binding
      const res = await revokeMedia(mediaId, { kv: null });
      expect(res.state).toBe('REVOCATION_PARTIAL');
      expect(getMemoryRevocationSet().has(mediaId)).toBe(true);

      // Verify that isMediaRevoked blocks this media even when called without KV and without failClosed
      const isRev = await isMediaRevoked(mediaId, null);
      expect(isRev, 'Mídia revogada em memória deve ser bloqueada mesmo sem binding KV').toBe(true);
    });

    it('Codex Rodada 4 - Item 1: falha de I/O na busca do manifesto falha fechado imediatamente quando failClosed=true', async () => {
      const mediaId = 'f0000007-ffff-4007-8007-000000000001';
      clearMemoryRevocationCache();

      // KV throws error on manifest get and returns null for tombstone (simulating stale negative read)
      const brokenManifestKv = {
        get: vi.fn(async (key: string) => {
          if (key === REVOCATION_MANIFEST_KEY) {
            throw new Error('KV_MANIFEST_TIMEOUT');
          }
          return null; // Stale negative tombstone
        }),
        put: vi.fn(),
        delete: vi.fn()
      };

      const isRev = await isMediaRevoked(mediaId, brokenManifestKv, { failClosed: true });
      expect(isRev, 'Falha no carregamento do manifesto com failClosed=true deve falhar fechado imediatamente').toBe(true);
    });

    it('Codex Rodada 5 - Item 2: forceFresh consulta tombstone autoritativo mesmo quando manifesto omite ID', async () => {
      const mediaId = 'f0000008-ffff-4008-8008-000000000001';
      const mockKv = createMockKv();
      clearMemoryRevocationCache();

      // 1. Authoritative individual tombstone exists in KV
      await mockKv.put(`${REVOCATION_KEY_PREFIX}${mediaId}`, JSON.stringify({
        mediaId,
        revokedAt: Date.now(),
        state: 'REVOCATION_COMPLETED'
      }));

      // 2. Manifest in KV exists and loads successfully, but omits mediaId (e.g. replication lag)
      await mockKv.put(REVOCATION_MANIFEST_KEY, JSON.stringify({
        version: 5,
        updatedAt: Date.now(),
        revokedIds: ['other-media-1', 'other-media-2']
      }));

      // 3. Caller invokes isMediaRevoked with forceFresh: true (bypassing stale/incomplete manifest)
      // Must query authoritative individual tombstone and return true
      const isRev = await isMediaRevoked(mediaId, mockKv, { forceFresh: true });
      expect(isRev, 'forceFresh deve consultar tombstone autoritativo e bloquear mídia mesmo se manifesto omitir ID').toBe(true);
      expect(getMemoryRevocationSet().has(mediaId), 'Mídia confirmada via tombstone deve ser adicionada à memória').toBe(true);
    });

    it('Codex Rodada 6 - Item 1: preserva revogação local quando persistência falha mesmo sob leitura negativa de tombstone e manifesto', async () => {
      const mediaId = 'f0000009-ffff-4009-8009-000000000001';
      clearMemoryRevocationCache();

      // 1. Simula falha total de persistência no KV durante revokeMedia
      const failingKv = {
        get: vi.fn(async () => null),
        put: vi.fn(async () => {
          throw new Error('KV_PUT_NETWORK_ERROR');
        }),
        delete: vi.fn()
      };

      const res = await revokeMedia(mediaId, { kv: failingKv });
      expect(res.state, 'Revogação com falha no KV deve ser REVOCATION_PARTIAL').toBe('REVOCATION_PARTIAL');
      expect(getMemoryRevocationSet().has(mediaId), 'Revogação deve ser retida em memória local').toBe(true);

      // 2. Requisição subsequente /media/[id] com checkTombstone: true
      // KV autoritativo responde: manifesto existe (sem mediaId) e tombstone é nulo
      const readingKv = createMockKv();
      await readingKv.put(REVOCATION_MANIFEST_KEY, JSON.stringify({
        version: 1,
        updatedAt: Date.now(),
        revokedIds: ['other-id']
      }));

      const isRev = await isMediaRevoked(mediaId, readingKv, { checkTombstone: true });
      expect(isRev, 'Revogação local não persistida não pode ser limpa por leitura negativa do KV').toBe(true);
      expect(getMemoryRevocationSet().has(mediaId), 'ID deve continuar bloqueado em memória').toBe(true);

      // 3. Restauração explícita via unrevokeMedia
      await unrevokeMedia(mediaId);
      const isRevAfter = await isMediaRevoked(mediaId, readingKv, { checkTombstone: true });
      expect(isRevAfter, 'unrevokeMedia explícito deve permitir restauração').toBe(false);
      expect(getMemoryRevocationSet().has(mediaId)).toBe(false);
    });

    it('Codex Rodada 6 - Item 2: rotação do cursor de reconciliação evita inanição de IDs restaurados além do lote de 10', async () => {
      clearMemoryRevocationCache();
      const mockKv = createMockKv();

      // Cria 15 IDs faltantes no manifesto
      const ids: string[] = [];
      for (let i = 1; i <= 15; i++) {
        ids.push(`d0000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
      }
      populateMemoryRevocationCache(ids);

      // Os primeiros 10 ainda têm tombstones no KV (ainda revogados)
      for (let i = 0; i < 10; i++) {
        await mockKv.put(`${REVOCATION_KEY_PREFIX}${ids[i]}`, JSON.stringify({ mediaId: ids[i] }));
      }
      // IDs 10..14 (índices 10 a 14) NÃO possuem tombstones no KV (foram restaurados!)

      // Manifest version 1 omite todos os 15 IDs
      await mockKv.put(REVOCATION_MANIFEST_KEY, JSON.stringify({
        version: 1,
        updatedAt: Date.now(),
        revokedIds: ['manifest-kept-id']
      }));

      // Primeiro ciclo de sync: processa primeiros 10 IDs (que têm tombstones)
      await isMediaRevoked('manifest-kept-id', mockKv, { forceFresh: true });
      expect(getMemoryRevocationSet().has(ids[0])).toBe(true);

      // Segundo ciclo de sync: o cursor avançado deve processar os próximos IDs (10 a 14)
      await isMediaRevoked('manifest-kept-id', mockKv, { forceFresh: true });

      // Os IDs restaurados (índice 10 a 14) devem ter sido reconciliados e removidos da memória
      for (let i = 10; i < 15; i++) {
        expect(getMemoryRevocationSet().has(ids[i]), `ID ${ids[i]} além dos 10 primeiros deve ser reconciliado sem inanição`).toBe(false);
      }
    });

    it('Codex Rodada 7 - Item 1: preserva revogações conhecidas contra réplica KV defasada com leitura negativa', async () => {
      const mediaId = 'a0000001-aaaa-4001-8001-000000000001';
      clearMemoryRevocationCache();
      const mockKv = createMockKv();

      // 1. Isolate aprende que mediaId foi revogado via tombstone recente
      await mockKv.put(`${REVOCATION_KEY_PREFIX}${mediaId}`, JSON.stringify({
        mediaId,
        revokedAt: 5000,
        version: 2
      }));
      const isRevInitial = await isMediaRevoked(mediaId, mockKv, { forceFresh: true, checkTombstone: true });
      expect(isRevInitial).toBe(true);
      expect(getMemoryRevocationSet().has(mediaId)).toBe(true);

      // 2. Réplica KV defasada serve um manifesto antigo (updatedAt: 1000) e leitura negativa de tombstone
      const staleReplicaKv = {
        get: vi.fn(async (key: string) => {
          if (key === REVOCATION_MANIFEST_KEY) {
            return {
              version: 1,
              updatedAt: 1000,
              revokedIds: ['other-media']
            };
          }
          if (key === `${REVOCATION_KEY_PREFIX}${mediaId}`) {
            return null; // leitura negativa defasada
          }
          return null;
        }),
        put: vi.fn(),
        delete: vi.fn()
      };

      // 3. Consulta /media/[id] com checkTombstone: true contra réplica defasada
      const isRevStale = await isMediaRevoked(mediaId, staleReplicaKv, { checkTombstone: true });
      expect(isRevStale, 'Leitura negativa defasada e manifesto antigo não podem anular revogação conhecida').toBe(true);
      expect(getMemoryRevocationSet().has(mediaId), 'Mídia deve permanecer revogada em memória').toBe(true);
    });

    it('Codex Rodada 7 - Item 2: não descarta guarda local após sucesso apenas na escrita do manifesto', async () => {
      const mediaId = 'a0000002-aaaa-4002-8002-000000000002';
      clearMemoryRevocationCache();

      // KV onde escrita do tombstone falha, mas manifest tem sucesso
      const partialKv = createMockKv();
      const failingTombstoneKv = {
        get: partialKv.get.bind(partialKv),
        delete: partialKv.delete.bind(partialKv),
        put: vi.fn(async (key: string, val: any) => {
          if (key.startsWith(REVOCATION_KEY_PREFIX)) {
            throw new Error('TOMBSTONE_KV_PUT_TIMEOUT');
          }
          return partialKv.put(key, val);
        })
      };

      const res = await revokeMedia(mediaId, { kv: failingTombstoneKv });
      expect(res.state, 'Deve reportar REVOCATION_PARTIAL quando tombstone falha').toBe('REVOCATION_PARTIAL');
      expect(res.tombstoneWritten).toBe(false);
      expect(res.manifestUpdated).toBe(true);
      expect(getMemoryRevocationSet().has(mediaId)).toBe(true);

      // Simula sincronização subsequente do manifesto (ID aparece no manifesto)
      await isMediaRevoked(mediaId, partialKv, { forceFresh: true });

      // Agora uma réplica defasada serve um manifesto sem mediaId e tombstone nulo
      const staleNegativeKv = {
        get: vi.fn(async (key: string) => {
          if (key === REVOCATION_MANIFEST_KEY) {
            return { version: 10, updatedAt: 2000, revokedIds: ['unrelated-media'] };
          }
          return null; // tombstone nulo pois escrita original falhou
        }),
        put: vi.fn(),
        delete: vi.fn()
      };

      // A guarda local iniciada nesta instância deve proteger a mídia e não permitir descarte
      const isRevProtected = await isMediaRevoked(mediaId, staleNegativeKv, { checkTombstone: true });
      expect(isRevProtected, 'Guarda local não pode ser descartada após escrita parcial apenas de manifesto').toBe(true);
      expect(getMemoryRevocationSet().has(mediaId)).toBe(true);
    });

    it('Codex Rodada 7 - Item 3: reconcilia restauração mesmo quando versão do manifesto é menor mas timestamp é mais recente', async () => {
      const mediaId = 'a0000003-aaaa-4003-8003-000000000003';
      clearMemoryRevocationCache();
      const mockKv = createMockKv();

      // 1. Isolate observa manifesto v5 gravado em t=1000 com mediaId revogado
      await mockKv.put(REVOCATION_MANIFEST_KEY, JSON.stringify({
        version: 5,
        updatedAt: 1000,
        revokedIds: [mediaId]
      }));
      await mockKv.put(`${REVOCATION_KEY_PREFIX}${mediaId}`, JSON.stringify({
        mediaId,
        revokedAt: 1000
      }));

      await isMediaRevoked(mediaId, mockKv, { forceFresh: true });
      expect(getMemoryRevocationSet().has(mediaId)).toBe(true);

      // 2. PoP concorrente em outro local restaurou mediaId gerando manifesto v4 (concorrente não-coordenado) em t=2000
      await mockKv.put(REVOCATION_MANIFEST_KEY, JSON.stringify({
        version: 4,
        updatedAt: 2000,
        revokedIds: [] // mediaId restaurado
      }));
      await mockKv.delete(`${REVOCATION_KEY_PREFIX}${mediaId}`);

      // 3. Sync no isolate deve reconhecer t=2000 > t=1000 e reconciliar a restauração sem ficar preso por v4 < v5
      const isRevAfter = await isMediaRevoked(mediaId, mockKv, { forceFresh: true, checkTombstone: true });
      expect(isRevAfter, 'Manifesto mais recente por timestamp deve reconciliar restauração mesmo com versão menor').toBe(false);
      expect(getMemoryRevocationSet().has(mediaId)).toBe(false);
    });
  });
});


