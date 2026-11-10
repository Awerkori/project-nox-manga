import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * ============================================================================
 * PROJECT NOX — TESTES ADVERSARIAIS OBRIGATÓRIOS
 * Hyperdrive, consistência de mídia, revogação e encerramento do Cloudflare Zero Waste
 *
 * Simulação adversarial com DOIS estados separados em memória:
 * 1. authoritativeDb: Estado atual e verdadeiro do YugabyteDB.
 * 2. hyperdriveQueryCache: Cache SQL do Hyperdrive retendo versões antigas de SELECTs.
 * ============================================================================
 */

interface MockMediaRow {
  id: string;
  provider: string;
  provider_key: string;
  bot_reference: string;
  storage_shard_id: string | null;
  mime: string;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  access_class: string;
  purpose: string;
  storage_ready: boolean;
  status: string;
  created_by: string | null;
  is_adult_associated: boolean;
  all_works_published: boolean;
  all_chapters_published: boolean;
  has_published_association: boolean;
  has_published_chapter: boolean;
}

// Dual-state storage
const authoritativeDb = new Map<string, MockMediaRow>();
const hyperdriveQueryCache = new Map<string, MockMediaRow>();

// Telemetry tracker for Hyperdrive queries
const hyperdriveTelemetry: Array<{
  query: string;
  cacheStatus: 'hit' | 'miss' | 'volatile';
  returnedStatus: string;
  returnedAccessClass: string;
}> = [];

// Volatile bypass detection: queries containing volatile PostgreSQL functions
function isVolatileQuery(sql: string): boolean {
  return /clock_timestamp\(\)|NOW\(\)|CURRENT_TIMESTAMP|RANDOM\(\)/i.test(sql);
}

// Simulated Hyperdrive executor with exact query-caching semantics
async function mockHyperdriveExecute(sql: string, params: any[]): Promise<{ rows: MockMediaRow[]; rowCount: number }> {
  const upper = sql.trim().toUpperCase();

  // Handle UPDATE queries (e.g. administrative revocation or unrevocation)
  if (upper.startsWith('UPDATE')) {
    const isPrivatize = params.length === 3;
    const targetId = isPrivatize ? params[2] : (params.length === 2 ? params[1] : params[0]);
    const targetStatus = params[0];
    const targetAccess = isPrivatize ? params[1] : undefined;
    const existing = authoritativeDb.get(targetId);
    if (existing) {
      existing.status = targetStatus;
      if (targetAccess) existing.access_class = targetAccess;
      authoritativeDb.set(targetId, existing);
    }
    return { rows: [], rowCount: 1 };
  }

  const mediaId = params[0];
  const isVolatile = isVolatileQuery(sql);

  if (isVolatile) {
    // Hyperdrive bypasses cache completely when STABLE/VOLATILE function is detected.
    // Cache status in Cloudflare analytics: 'volatile'
    const dbRow = authoritativeDb.get(mediaId);
    hyperdriveTelemetry.push({
      query: sql,
      cacheStatus: 'volatile',
      returnedStatus: dbRow?.status || 'NOT_FOUND',
      returnedAccessClass: dbRow?.access_class || 'NOT_FOUND'
    });
    return {
      rows: dbRow ? [{ ...dbRow }] : [],
      rowCount: dbRow ? 1 : 0
    };
  }

  // Conventional query: Hyperdrive checks query cache first
  const cacheKey = `select_media_${mediaId}`;
  if (hyperdriveQueryCache.has(cacheKey)) {
    const cachedRow = hyperdriveQueryCache.get(cacheKey)!;
    hyperdriveTelemetry.push({
      query: sql,
      cacheStatus: 'hit',
      returnedStatus: cachedRow.status,
      returnedAccessClass: cachedRow.access_class
    });
    return {
      rows: [{ ...cachedRow }],
      rowCount: 1
    };
  }

  // Query cache MISS: fetch from DB and store in Hyperdrive cache
  const dbRow = authoritativeDb.get(mediaId);
  if (dbRow) {
    hyperdriveQueryCache.set(cacheKey, { ...dbRow });
  }
  hyperdriveTelemetry.push({
    query: sql,
    cacheStatus: 'miss',
    returnedStatus: dbRow?.status || 'NOT_FOUND',
    returnedAccessClass: dbRow?.access_class || 'NOT_FOUND'
  });
  return {
    rows: dbRow ? [{ ...dbRow }] : [],
    rowCount: dbRow ? 1 : 0
  };
}

const downloadBarrier = {
  active: false,
  gate: Promise.resolve(),
  release: () => {}
};

function createDownloadBarrier() {
  let releaseFunc = () => {};
  const gatePromise = new Promise<void>((resolve) => {
    releaseFunc = resolve;
  });
  downloadBarrier.active = true;
  downloadBarrier.gate = gatePromise;
  downloadBarrier.release = releaseFunc;
}

// Hoisted mocks for dependencies
const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  pgQuery: vi.fn(),
  extractFullAuthCookie: vi.fn(),
  decodeSessionJwt: vi.fn(),
  resolveSessionData: vi.fn()
}));

vi.mock('pg', () => {
  return {
    Client: class {
      connect = vi.fn().mockResolvedValue(undefined);
      query = vi.fn().mockImplementation((sql: string, params: any[]) => mocks.pgQuery(sql, params));
      end = vi.fn().mockResolvedValue(undefined);
    },
    Pool: class {
      query = vi.fn().mockImplementation((sql: string, params: any[]) => mocks.pgQuery(sql, params));
      on = vi.fn();
      end = vi.fn().mockResolvedValue(undefined);
    }
  };
});

vi.mock('$lib/server/storage-router', () => ({
  resolveBotDownloadClient: () => ({
    download: async (...args: any[]) => {
      if (downloadBarrier.active) {
        await downloadBarrier.gate;
      }
      return mocks.download(...args);
    }
  }),
  normalizeBotReference: (x: string) => x,
  deduceMangaShardFromFileId: () => null
}));

vi.mock('$lib/server/session-cache', () => ({
  extractFullAuthCookie: mocks.extractFullAuthCookie,
  decodeSessionJwt: mocks.decodeSessionJwt,
  resolveSessionData: mocks.resolveSessionData
}));

import {
  fetchMediaMetadataFromYugabyte,
  invalidateMediaMetadataCache,
  setLkg,
  getLkg
} from '../src/lib/server/yugabyte';
import { GET as getPublicMediaRoute, HEAD as headPublicMediaRoute } from '../src/routes/media/[id]/+server';
import { GET as getPrivateMediaRoute } from '../src/routes/api/media/[id]/+server';
import { POST as revokeMediaEndpoint } from '../src/routes/api/internal/media/revoke/+server';
import { classifyMediaAccess } from '../src/lib/server/media-revocation';

function createMockKv(initialData: Record<string, any> = {}) {
  const store = new Map<string, any>();
  for (const [k, v] of Object.entries(initialData)) {
    store.set(k, v);
  }
  return {
    _store: store,
    get: vi.fn(async (key: string, opts?: any) => {
      const val = store.get(key);
      if (val === undefined || val === null) return null;
      if (opts?.type === 'json') {
        try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return null; }
      }
      return typeof val === 'string' ? val : JSON.stringify(val);
    }),
    getWithMetadata: vi.fn(async (key: string) => {
      const val = store.get(key);
      if (!val) return { value: null, metadata: null };
      const buffer = new TextEncoder().encode(typeof val === 'string' ? val : JSON.stringify(val)).buffer;
      return {
        value: buffer,
        metadata: {
          mime: 'image/jpeg',
          width: 300,
          height: 450,
          etag: '"thumb-etag-123"',
          variant: 'thumb',
          updatedAt: Date.now()
        }
      };
    }),
    put: vi.fn(async (key: string, val: any) => {
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
    }),
    purge: vi.fn(async (_opts: any) => {})
  };
}

function makeSampleMedia(id: string, overrides: Partial<MockMediaRow> = {}): MockMediaRow {
  return {
    id,
    provider: 'telegram',
    provider_key: `tg_${id}`,
    bot_reference: 'storage_01',
    storage_shard_id: null,
    mime: 'image/jpeg',
    sha256: `hash_${id}`,
    bytes: 10240,
    width: 800,
    height: 1200,
    access_class: 'PUBLIC',
    purpose: 'chapter_page',
    storage_ready: true,
    status: 'ACTIVE',
    created_by: null,
    is_adult_associated: false,
    all_works_published: true,
    all_chapters_published: true,
    has_published_association: true,
    has_published_chapter: true,
    ...overrides
  };
}

describe('PROJECT NOX — Hyperdrive Media Authoritative Consistency & Zero Waste Homologation', () => {
  const mockPlatformEnv = {
    HYPERDRIVE: { connectionString: 'postgresql://mock-hyperdrive:5433/project_nox_prod' },
    COVER_THUMBNAILS: createMockKv(),
    NOX_STORAGE_BRIDGE_TOKEN: 'valid-internal-bridge-token'
  };

  beforeEach(async () => {
    vi.restoreAllMocks();
    authoritativeDb.clear();
    hyperdriveQueryCache.clear();
    hyperdriveTelemetry.length = 0;
    downloadBarrier.active = false;
    mocks.download.mockResolvedValue(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03, 0x04]));
    mocks.pgQuery.mockImplementation(mockHyperdriveExecute);
  });

  // ==========================================================================
  // GRUPO A — CONSISTÊNCIA DO SQL
  // ==========================================================================
  describe('Grupo A — Consistência do SQL', () => {
    it('A1: PUBLIC/ACTIVE retorna autorização pública quando realmente válido', async () => {
      const mediaId = 'aaaaaaaa-1111-4000-8000-000000000001';
      const row = makeSampleMedia(mediaId, { access_class: 'PUBLIC', status: 'ACTIVE' });
      authoritativeDb.set(mediaId, row);

      const result = await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv, { authoritative: true });
      expect(result).not.toBeNull();
      expect(result.status).toBe('ACTIVE');
      expect(result.access_class).toBe('PUBLIC');

      const classification = classifyMediaAccess(result);
      expect(classification.isPublic).toBe(true);
      expect(classification.category).toBe('PUBLIC');

      // Telemetry must record volatile bypass
      const entry = hyperdriveTelemetry.find(t => t.cacheStatus === 'volatile');
      expect(entry).toBeDefined();
      expect(entry?.returnedStatus).toBe('ACTIVE');
    });

    it('A2: PUBLIC → PRIVATE: a leitura autoritativa reconhece PRIVATE mesmo com Hyperdrive stale', async () => {
      const mediaId = 'aaaaaaaa-1111-4000-8000-000000000002';
      // 1. Prime stale Hyperdrive SQL cache with PUBLIC
      hyperdriveQueryCache.set(`select_media_${mediaId}`, makeSampleMedia(mediaId, { access_class: 'PUBLIC' }));
      // 2. Authoritative database has transitioned to PRIVATE
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { access_class: 'PRIVATE' }));

      // Conventional read receives stale PUBLIC from Hyperdrive cache
      const staleRead = await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv);
      expect(staleRead.access_class).toBe('PUBLIC');

      // Authoritative read bypasses Hyperdrive cache via clock_timestamp() and sees PRIVATE
      const authRead = await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv, { authoritative: true });
      expect(authRead.access_class).toBe('PRIVATE');
      const classification = classifyMediaAccess(authRead);
      expect(classification.isPublic).toBe(false);
      expect(classification.category).toBe('PRIVATE');
    });

    it('A3: ACTIVE → DELETED: a leitura autoritativa reconhece DELETED mesmo com Hyperdrive stale', async () => {
      const mediaId = 'aaaaaaaa-1111-4000-8000-000000000003';
      hyperdriveQueryCache.set(`select_media_${mediaId}`, makeSampleMedia(mediaId, { status: 'ACTIVE' }));
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { status: 'DELETED' }));

      const authRead = await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv, { authoritative: true });
      expect(authRead.status).toBe('DELETED');
      const classification = classifyMediaAccess(authRead);
      expect(classification.isPublic).toBe(false);
      expect(classification.category).toBe('DELETED');
    });

    it('A4: Mudança para conteúdo +18 (is_adult_associated) é reconhecida de forma autoritativa', async () => {
      const mediaId = 'aaaaaaaa-1111-4000-8000-000000000004';
      hyperdriveQueryCache.set(`select_media_${mediaId}`, makeSampleMedia(mediaId, { is_adult_associated: false }));
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { is_adult_associated: true }));

      const authRead = await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv, { authoritative: true });
      expect(authRead.is_adult_associated).toBe(true);
      const classification = classifyMediaAccess(authRead);
      expect(classification.isPublic).toBe(false);
      expect(classification.category).toBe('RESTRICTED');
    });

    it('A5: Obra despublicada (all_works_published = false) é reconhecida de forma autoritativa', async () => {
      const mediaId = 'aaaaaaaa-1111-4000-8000-000000000005';
      hyperdriveQueryCache.set(`select_media_${mediaId}`, makeSampleMedia(mediaId, { all_works_published: true }));
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { all_works_published: false }));

      const authRead = await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv, { authoritative: true });
      expect(authRead.all_works_published).toBe(false);
      const classification = classifyMediaAccess(authRead);
      expect(classification.isPublic).toBe(false);
      expect(classification.reason).toBe('UNPUBLISHED_WORK');
    });

    it('A6: Capítulo despublicado (has_published_chapter = false) é reconhecido de forma autoritativa', async () => {
      const mediaId = 'aaaaaaaa-1111-4000-8000-000000000006';
      hyperdriveQueryCache.set(`select_media_${mediaId}`, makeSampleMedia(mediaId, { has_published_chapter: true }));
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { has_published_chapter: false }));

      const authRead = await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv, { authoritative: true });
      expect(authRead.has_published_chapter).toBe(false);
      const classification = classifyMediaAccess(authRead);
      expect(classification.isPublic).toBe(false);
      expect(classification.reason).toBe('UNPUBLISHED_CHAPTER');
    });

    it('A7: SELECT convencional pode receber dado cached, mas SELECT autoritativo sempre devolve o estado confirmado atual', async () => {
      const mediaId = 'aaaaaaaa-1111-4000-8000-000000000007';
      const initial = makeSampleMedia(mediaId, { status: 'ACTIVE', access_class: 'PUBLIC' });
      authoritativeDb.set(mediaId, initial);

      // 1. Initial conventional read warms the Hyperdrive query cache
      const first = await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv);
      expect(first.status).toBe('ACTIVE');
      expect(hyperdriveQueryCache.has(`select_media_${mediaId}`)).toBe(true);

      // 2. Direct mutation in database to DELETED without invalidating Hyperdrive cache
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { status: 'DELETED' }));

      // 3. Conventional read still gets stale ACTIVE hit from Hyperdrive cache
      invalidateMediaMetadataCache(mediaId); // clear Worker memory only
      const conventionalRead = await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv);
      expect(conventionalRead.status).toBe('ACTIVE');

      // 4. Authoritative read uses clock_timestamp(), bypassing Hyperdrive cache to fetch true DELETED status
      const authRead = await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv, { authoritative: true });
      expect(authRead.status).toBe('DELETED');
    });

    it('A8: Falha SQL não pode produzir autorização pública (fail-closed seguro)', async () => {
      const mediaId = 'aaaaaaaa-1111-4000-8000-000000000008';
      mocks.pgQuery.mockRejectedValueOnce(
        new Error('Hyperdrive origin connection refused: 5433')
      );

      const result = await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv, { authoritative: true });
      expect(result).toBeNull();
    });

    it('A9: Resultado LKG antigo não pode substituir leitura autoritativa em falha de conexão', async () => {
      const mediaId = 'aaaaaaaa-1111-4000-8000-000000000009';
      const staleActiveRow = makeSampleMedia(mediaId, { status: 'ACTIVE', access_class: 'PUBLIC' });
      // Prime LKG store with stale active record
      setLkg(`media_${mediaId}`, staleActiveRow);
      expect(getLkg(`media_${mediaId}`)).not.toBeNull();

      // Database connection fails
      mocks.pgQuery.mockRejectedValueOnce(
        new Error('Database timeout')
      );

      // Authoritative read MUST strictly return null, ignoring the cached LKG entry
      const result = await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv, { authoritative: true });
      expect(result).toBeNull();
    });

    it('A10: Conexão reutilizada não compromete a distinção entre as duas modalidades', async () => {
      const mediaId = 'aaaaaaaa-1111-4000-8000-000000000010';
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { status: 'DELETED' }));
      hyperdriveQueryCache.set(`select_media_${mediaId}`, makeSampleMedia(mediaId, { status: 'ACTIVE' }));

      // Alternating interleaved reads
      const r1 = await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv, { authoritative: true });
      expect(r1.status).toBe('DELETED');

      invalidateMediaMetadataCache(mediaId);
      const r2 = await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv);
      expect(r2.status).toBe('ACTIVE');

      const r3 = await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv, { authoritative: true });
      expect(r3.status).toBe('DELETED');
    });
  });

  // ==========================================================================
  // GRUPO B — CORRIDAS DURANTE O DOWNLOAD
  // ==========================================================================
  describe('Grupo B — Corridas durante o download', () => {
    it('B1: PUBLIC → PRIVATE durante download in-flight bloqueia entrega e cache', async () => {
      const mediaId = 'bbbbbbbb-1111-4000-8000-000000000001';
      // 1. Initial DB state is PUBLIC
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { access_class: 'PUBLIC', status: 'ACTIVE' }));
      // Hyperdrive cache has PUBLIC
      hyperdriveQueryCache.set(`select_media_${mediaId}`, makeSampleMedia(mediaId, { access_class: 'PUBLIC' }));

      const mockCache = createMockCache();
      createDownloadBarrier();

      // Start download
      const request = new Request(`https://projectnox.org/media/${mediaId}`);
      const responsePromise = getPublicMediaRoute({
        params: { id: mediaId },
        request,
        url: new URL(request.url),
        platform: { env: mockPlatformEnv, caches: { default: mockCache } },
        cookies: { get: () => undefined, getAll: () => [] }
      } as any);

      // In the middle of download: DB mutates to PRIVATE
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { access_class: 'PRIVATE', status: 'ACTIVE' }));
      // Stale Hyperdrive cache is intentionally NOT invalidated, modeling real Hyperdrive behavior!

      // Release download
      downloadBarrier.release();

      const response = await responsePromise;

      // Must be 307 redirect to /api/media or 404/403 private rejection — NEVER public 200 with media bytes!
      expect(response.status).not.toBe(200);
      expect(response.headers.get('Cache-Control')).toContain('no-store');
      expect(response.headers.get('Cache-Control')).toContain('private');
      // No public edge cache written
      expect(mockCache._map.has(`https://projectnox.org/media/${mediaId}`)).toBe(false);
    });

    it('B2: ACTIVE → DELETED durante download in-flight bloqueia entrega e cache', async () => {
      const mediaId = 'bbbbbbbb-1111-4000-8000-000000000002';
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { status: 'ACTIVE' }));
      hyperdriveQueryCache.set(`select_media_${mediaId}`, makeSampleMedia(mediaId, { status: 'ACTIVE' }));

      const mockCache = createMockCache();
      createDownloadBarrier();

      const request = new Request(`https://projectnox.org/media/${mediaId}`);
      const responsePromise = getPublicMediaRoute({
        params: { id: mediaId },
        request,
        url: new URL(request.url),
        platform: { env: mockPlatformEnv, caches: { default: mockCache } },
        cookies: { get: () => undefined, getAll: () => [] }
      } as any);

      // DB changes to DELETED during download
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { status: 'DELETED' }));

      downloadBarrier.release();
      const response = await responsePromise;

      expect(response.status).toBe(404);
      expect(response.headers.get('Cache-Control')).toContain('no-store');
      expect(mockCache._map.has(`https://projectnox.org/media/${mediaId}`)).toBe(false);
    });

    it('B3: Transição para +18 (RESTRICTED) durante download bloqueia entrega anônima', async () => {
      const mediaId = 'bbbbbbbb-1111-4000-8000-000000000003';
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { is_adult_associated: false }));
      hyperdriveQueryCache.set(`select_media_${mediaId}`, makeSampleMedia(mediaId, { is_adult_associated: false }));

      const mockCache = createMockCache();
      createDownloadBarrier();

      const request = new Request(`https://projectnox.org/media/${mediaId}`);
      const responsePromise = getPublicMediaRoute({
        params: { id: mediaId },
        request,
        url: new URL(request.url),
        platform: { env: mockPlatformEnv, caches: { default: mockCache } },
        cookies: { get: () => undefined, getAll: () => [] }
      } as any);

      // In-flight adult association
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { is_adult_associated: true }));

      downloadBarrier.release();
      const response = await responsePromise;

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.age_restricted).toBe(true);
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    });

    it('B4: Despublicação de obra durante download bloqueia entrega e cache', async () => {
      const mediaId = 'bbbbbbbb-1111-4000-8000-000000000004';
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { all_works_published: true }));
      hyperdriveQueryCache.set(`select_media_${mediaId}`, makeSampleMedia(mediaId, { all_works_published: true }));

      const mockCache = createMockCache();
      createDownloadBarrier();

      const request = new Request(`https://projectnox.org/media/${mediaId}`);
      const responsePromise = getPublicMediaRoute({
        params: { id: mediaId },
        request,
        url: new URL(request.url),
        platform: { env: mockPlatformEnv, caches: { default: mockCache } },
        cookies: { get: () => undefined, getAll: () => [] }
      } as any);

      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { all_works_published: false }));

      downloadBarrier.release();
      const response = await responsePromise;

      expect(response.status).toBe(404);
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    });
  });

  // ==========================================================================
  // GRUPO C — RETORNOS ANTECIPADOS
  // ==========================================================================
  describe('Grupo C — Retornos antecipados', () => {
    it('C1: GET 200 normal só entrega quando metadados autoritativos confirmam ACTIVE/PUBLIC', async () => {
      const mediaId = 'cccccccc-1111-4000-8000-000000000001';
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { status: 'ACTIVE', access_class: 'PUBLIC' }));

      const request = new Request(`https://projectnox.org/media/${mediaId}`);
      const response = await getPublicMediaRoute({
        params: { id: mediaId },
        request,
        url: new URL(request.url),
        platform: { env: mockPlatformEnv },
        cookies: { get: () => undefined, getAll: () => [] }
      } as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toContain('public');
    });

    it('C2: GET 206 (Range) é rejeitado com 404 quando mídia foi revogada no banco', async () => {
      const mediaId = 'cccccccc-1111-4000-8000-000000000002';
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { status: 'DELETED' }));
      hyperdriveQueryCache.set(`select_media_${mediaId}`, makeSampleMedia(mediaId, { status: 'ACTIVE' }));

      const request = new Request(`https://projectnox.org/media/${mediaId}`, {
        headers: { Range: 'bytes=0-1024' }
      });
      const response = await getPublicMediaRoute({
        params: { id: mediaId },
        request,
        url: new URL(request.url),
        platform: { env: mockPlatformEnv },
        cookies: { get: () => undefined, getAll: () => [] }
      } as any);

      expect(response.status).toBe(404);
      expect(response.headers.get('Content-Range')).toBeNull();
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    });

    it('C3: GET com If-None-Match (304) é rejeitado com 404 se a mídia foi despublicada no banco', async () => {
      const mediaId = 'cccccccc-1111-4000-8000-000000000003';
      const etag = `"hash_${mediaId}"`;
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { all_works_published: false }));
      hyperdriveQueryCache.set(`select_media_${mediaId}`, makeSampleMedia(mediaId, { all_works_published: true }));

      const request = new Request(`https://projectnox.org/media/${mediaId}`, {
        headers: { 'If-None-Match': etag }
      });
      const response = await getPublicMediaRoute({
        params: { id: mediaId },
        request,
        url: new URL(request.url),
        platform: { env: mockPlatformEnv },
        cookies: { get: () => undefined, getAll: () => [] }
      } as any);

      expect(response.status).toBe(404);
      expect(response.status).not.toBe(304);
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    });

    it('C4: HEAD request é rejeitado com 404 para mídia privatizada, sem retornar 200 antecipado', async () => {
      const mediaId = 'cccccccc-1111-4000-8000-000000000004';
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { access_class: 'PRIVATE' }));
      hyperdriveQueryCache.set(`select_media_${mediaId}`, makeSampleMedia(mediaId, { access_class: 'PUBLIC' }));

      const request = new Request(`https://projectnox.org/media/${mediaId}`, {
        method: 'HEAD'
      });
      const response = await headPublicMediaRoute({
        params: { id: mediaId },
        request,
        url: new URL(request.url),
        platform: { env: mockPlatformEnv },
        cookies: { get: () => undefined, getAll: () => [] }
      } as any);

      expect(response.status).not.toBe(200);
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    });

    it('C5: If-Range não ignora decisão autoritativa de revogação', async () => {
      const mediaId = 'cccccccc-1111-4000-8000-000000000005';
      const etag = `"hash_${mediaId}"`;
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { status: 'DELETED' }));
      hyperdriveQueryCache.set(`select_media_${mediaId}`, makeSampleMedia(mediaId, { status: 'ACTIVE' }));

      const request = new Request(`https://projectnox.org/media/${mediaId}`, {
        headers: { Range: 'bytes=0-500', 'If-Range': etag }
      });
      const response = await getPublicMediaRoute({
        params: { id: mediaId },
        request,
        url: new URL(request.url),
        platform: { env: mockPlatformEnv },
        cookies: { get: () => undefined, getAll: () => [] }
      } as any);

      expect(response.status).toBe(404);
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    });

    it('C6: Thumbnail KV não contorna revogação no banco mesmo se KV ainda tiver o blob', async () => {
      const mediaId = 'cccccccc-1111-4000-8000-000000000006';
      // Blob pre-exists in KV
      const mockKv = createMockKv({
        [`cover_thumb_${mediaId}`]: new Uint8Array([0x01, 0x02, 0x03]).buffer
      });
      const envWithKv = { ...mockPlatformEnv, COVER_THUMBNAILS: mockKv };

      // DB has been deleted, Hyperdrive is stale
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { status: 'DELETED' }));
      hyperdriveQueryCache.set(`select_media_${mediaId}`, makeSampleMedia(mediaId, { status: 'ACTIVE' }));

      const request = new Request(`https://projectnox.org/media/${mediaId}?size=thumb`);
      const response = await getPublicMediaRoute({
        params: { id: mediaId },
        request,
        url: new URL(request.url),
        platform: { env: envWithKv },
        cookies: { get: () => undefined, getAll: () => [] }
      } as any);

      expect(response.status).toBe(404);
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    });

    it('C7: Thumbnail com Range em mídia revogada não devolve 206', async () => {
      const mediaId = 'cccccccc-1111-4000-8000-000000000007';
      const mockKv = createMockKv({
        [`cover_thumb_${mediaId}`]: new Uint8Array([0x01, 0x02, 0x03]).buffer
      });
      const envWithKv = { ...mockPlatformEnv, COVER_THUMBNAILS: mockKv };

      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { access_class: 'PRIVATE' }));
      hyperdriveQueryCache.set(`select_media_${mediaId}`, makeSampleMedia(mediaId, { access_class: 'PUBLIC' }));

      const request = new Request(`https://projectnox.org/media/${mediaId}?size=thumb`, {
        headers: { Range: 'bytes=0-10' }
      });
      const response = await getPublicMediaRoute({
        params: { id: mediaId },
        request,
        url: new URL(request.url),
        platform: { env: envWithKv },
        cookies: { get: () => undefined, getAll: () => [] }
      } as any);

      expect(response.status).not.toBe(206);
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    });

    it('C8: Falha temporária de SQL em leitura autoritativa produz 404 seguro com no-store', async () => {
      const mediaId = 'cccccccc-1111-4000-8000-000000000008';
      mocks.pgQuery.mockRejectedValueOnce(
        new Error('YSQL deadlock timeout')
      );

      const request = new Request(`https://projectnox.org/media/${mediaId}`);
      const response = await getPublicMediaRoute({
        params: { id: mediaId },
        request,
        url: new URL(request.url),
        platform: { env: mockPlatformEnv },
        cookies: { get: () => undefined, getAll: () => [] }
      } as any);

      expect(response.status).toBe(404);
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    });
  });

  // ==========================================================================
  // GRUPO D — CACHE DISTRIBUÍDO E ENDPOINT PRIVADO
  // ==========================================================================
  describe('Grupo D — Cache distribuído e endpoint privado', () => {
    it('D1: Protocolo de revogação administrativa atualiza YSQL antes de KV e invalida caches', async () => {
      const mediaId = 'dddddddd-1111-4000-8000-000000000001';
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { status: 'ACTIVE' }));

      const mockKv = createMockKv();
      const mockCache = createMockCache();
      (globalThis as any).caches = { default: mockCache };
      const envWithKv = { ...mockPlatformEnv, COVER_THUMBNAILS: mockKv };
      const mockCtx = {
        cache: {
          purge: vi.fn().mockResolvedValue({ success: true, errors: [] })
        },
        waitUntil: vi.fn()
      };

      const revokeReq = new Request('https://projectnox.org/api/internal/media/revoke', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-internal-bridge-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mediaId, action: 'revoke' })
      });

      const res = await revokeMediaEndpoint({
        request: revokeReq,
        url: new URL(revokeReq.url),
        platform: { env: envWithKv, caches: { default: mockCache }, context: mockCtx },
        cookies: { getAll: () => [] }
      } as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.revokedIds).toContain(mediaId);

      // KV tombstone written
      expect(mockKv.put).toHaveBeenCalledWith(
        expect.stringContaining(`revoked:v1:${mediaId}`),
        expect.any(String)
      );
    });

    it('D2: API administrativa rejeita ação desconhecida com HTTP 400 sem mutações no banco', async () => {
      const mediaId = 'dddddddd-1111-4000-8000-000000000002';
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { status: 'ACTIVE' }));

      const revokeReq = new Request('https://projectnox.org/api/internal/media/revoke', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-internal-bridge-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mediaId, action: 'malicious_delete' })
      });

      await expect(
        revokeMediaEndpoint({
          request: revokeReq,
          url: new URL(revokeReq.url),
          platform: { env: mockPlatformEnv },
          cookies: { getAll: () => [] }
        } as any)
      ).rejects.toThrow();

      // Database status remains untouched
      expect(authoritativeDb.get(mediaId)?.status).toBe('ACTIVE');
    });

    it('D3: Endpoint privado /api/media/[id] usa leitura autoritativa e bloqueia usuário anônimo', async () => {
      const mediaId = 'dddddddd-1111-4000-8000-000000000003';
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { access_class: 'PRIVATE' }));

      const request = new Request(`https://projectnox.org/api/media/${mediaId}`);
      const response = await getPrivateMediaRoute({
        params: { id: mediaId },
        request,
        url: new URL(request.url),
        platform: { env: mockPlatformEnv },
        cookies: { get: () => undefined, getAll: () => [] }
      } as any);

      expect(response.status).toBe(404);
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    });

    it('D4: Endpoint privado /api/media/[id] detecta revogação durante download e cancela entrega', async () => {
      const mediaId = 'dddddddd-1111-4000-8000-000000000004';
      // User is staff, media is initially STAFF_ONLY
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { access_class: 'STAFF_ONLY', status: 'ACTIVE' }));
      mocks.resolveSessionData.mockResolvedValue({ id: 'staff-user', role: 'STAFF_SITE' });
      mocks.extractFullAuthCookie.mockReturnValue('valid-staff-jwt');
      mocks.decodeSessionJwt.mockReturnValue({ jwt: { role: 'STAFF_SITE' }, accessToken: 'tok' });

      createDownloadBarrier();

      const request = new Request(`https://projectnox.org/api/media/${mediaId}`);
      const responsePromise = getPrivateMediaRoute({
        params: { id: mediaId },
        request,
        url: new URL(request.url),
        platform: { env: mockPlatformEnv },
        cookies: { get: () => 'valid-staff-jwt', getAll: () => [{ name: 'nox-auth-token', value: 'valid-staff-jwt' }] }
      } as any);

      // Media is deleted during download
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { status: 'DELETED' }));

      downloadBarrier.release();
      const response = await responsePromise;

      expect(response.status).toBe(404);
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    });
  });

  // ==========================================================================
  // GRUPO E — COMPROVAÇÃO DE BYPASS HYPERDRIVE (TELEMETRIA E CONTRATO)
  // ==========================================================================
  describe('Grupo E — Comprovação de bypass do Hyperdrive', () => {
    it('E1: Comprova que toda chamada autoritativa executa SQL com clock_timestamp() e recebe cacheStatus = volatile', async () => {
      const mediaId = 'eeeeeeee-1111-4000-8000-000000000001';
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { status: 'ACTIVE' }));

      await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv, { authoritative: true });

      const lastTelemetry = hyperdriveTelemetry[hyperdriveTelemetry.length - 1];
      expect(lastTelemetry).toBeDefined();
      expect(lastTelemetry.query).toContain('clock_timestamp() IS NOT NULL');
      expect(lastTelemetry.cacheStatus).toBe('volatile');
    });

    it('E2: Comprova que chamadas convencionais preservam caching do Hyperdrive para desempenho Zero Waste', async () => {
      const mediaId = 'eeeeeeee-1111-4000-8000-000000000002';
      authoritativeDb.set(mediaId, makeSampleMedia(mediaId, { status: 'ACTIVE' }));

      // First conventional read: miss (populates cache)
      await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv);
      const t1 = hyperdriveTelemetry[hyperdriveTelemetry.length - 1];
      expect(t1.cacheStatus).toBe('miss');
      expect(t1.query).not.toContain('clock_timestamp()');

      // Second conventional read (simulating another worker or isolate after LRU eviction): hit
      invalidateMediaMetadataCache(mediaId);
      await fetchMediaMetadataFromYugabyte(mediaId, mockPlatformEnv);
      const t2 = hyperdriveTelemetry[hyperdriveTelemetry.length - 1];
      expect(t2.cacheStatus).toBe('hit');
      expect(t2.query).not.toContain('clock_timestamp()');
    });
  });
});
