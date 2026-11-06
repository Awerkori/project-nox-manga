import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMediaRevoked,
  revokeMedia,
  purgeMediaVariants,
  clearMemoryRevocationCache,
  REVOCATION_KEY_PREFIX,
  REVOCATION_MANIFEST_KEY
} from '../src/lib/server/media-revocation';
import {
  readCoverThumbnail,
  persistCoverThumbnail,
  coverThumbnailKey
} from '../src/lib/server/cover-thumbnail-cache';

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
    expect(res.success).toBe(true);

    // When media is checked, it still knows it is revoked via KV/memory
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
});

