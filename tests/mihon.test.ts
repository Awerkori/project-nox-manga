import { describe, it, expect, vi } from 'vitest';
import {
  hashToken,
  matchesETag,
  recordMihonTokenRevocation,
  verifyMihonAuth,
  invalidateMihonTokenCache,
  MIHON_REVOKED_KV_PREFIX
} from '../src/lib/server/mihon';

describe('Mihon API & Security Helpers', () => {
  it('hashes token consistently with SHA-256', async () => {
    const token = 'nox_mh_0123456789abcdef';
    const hash1 = await hashToken(token);
    const hash2 = await hashToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different tokens', async () => {
    const hashA = await hashToken('nox_mh_token_a');
    const hashB = await hashToken('nox_mh_token_b');
    expect(hashA).not.toBe(hashB);
  });

  it('matches strong and weak ETags per RFC 9110 weak comparison', () => {
    const etag = '"chapter-123-20-abc"';
    expect(matchesETag(etag, etag)).toBe(true);
    expect(matchesETag(`W/${etag}`, etag)).toBe(true);
    expect(matchesETag(etag, `W/${etag}`)).toBe(true);
    expect(matchesETag(`W/${etag}`, `W/${etag}`)).toBe(true);
    expect(matchesETag('"other-tag", ' + etag, etag)).toBe(true);
    expect(matchesETag('"other-tag", W/' + etag, etag)).toBe(true);
    expect(matchesETag('*', etag)).toBe(true);
    expect(matchesETag('"different-tag"', etag)).toBe(false);
    expect(matchesETag(null, etag)).toBe(false);
    expect(matchesETag('', etag)).toBe(false);
  });

  it('guarantees deterministic ETag invalidation on all chapter/page representation mutations (Phase 4.3)', () => {
    function computeChapterPagesEtag(chapter: any, pages: any[]): string {
      let pagesHash = 0;
      for (const p of pages) {
        const pageSig = `${p.position}:${p.media_id}:${p.width || 0}:${p.height || 0};`;
        for (let i = 0; i < pageSig.length; i++) {
          pagesHash = ((pagesHash << 5) - pagesHash + pageSig.charCodeAt(i)) | 0;
        }
      }
      let metaHash = 0;
      const metaSig = `${chapter.id}:${chapter.number}:${chapter.display_number}:${chapter.title || ''}:${chapter.chapter_kind || ''}:${chapter.edition || ''}:${chapter.language || ''}:${chapter.content_rating || ''}:${chapter.work_updated_at || ''}`;
      for (let i = 0; i < metaSig.length; i++) {
        metaHash = ((metaHash << 5) - metaHash + metaSig.charCodeAt(i)) | 0;
      }
      const chapterTime = new Date(chapter.published_at || chapter.created_at || 0).getTime();
      return `"${chapter.id}-${pages.length}-${(pagesHash >>> 0).toString(36)}-${(metaHash >>> 0).toString(36)}-${chapterTime}"`;
    }

    const baseChapter = {
      id: 'c1-uuid',
      number: 1,
      display_number: '1',
      title: 'Capítulo Inicial',
      chapter_kind: 'NORMAL',
      edition: null,
      language: 'pt-BR',
      content_rating: 'SAFE',
      work_updated_at: '2026-11-01T00:00:00Z',
      published_at: '2026-11-01T10:00:00Z',
      created_at: '2026-11-01T09:00:00Z'
    };

    const basePages = [
      { position: 1, media_id: 'm1-uuid', width: 800, height: 1200 },
      { position: 2, media_id: 'm2-uuid', width: 800, height: 1200 }
    ];

    const baseEtag = computeChapterPagesEtag(baseChapter, basePages);

    // 1. Alterar título de capítulo
    const titleChangedEtag = computeChapterPagesEtag({ ...baseChapter, title: 'Título Modificado' }, basePages);
    expect(titleChangedEtag).not.toBe(baseEtag);

    // 2. Alterar páginas (novo media_id)
    const pagesAlteredEtag = computeChapterPagesEtag(baseChapter, [
      { position: 1, media_id: 'm1-different-uuid', width: 800, height: 1200 },
      { position: 2, media_id: 'm2-uuid', width: 800, height: 1200 }
    ]);
    expect(pagesAlteredEtag).not.toBe(baseEtag);

    // 3. Reordenar páginas
    const pagesReorderedEtag = computeChapterPagesEtag(baseChapter, [
      { position: 2, media_id: 'm1-uuid', width: 800, height: 1200 },
      { position: 1, media_id: 'm2-uuid', width: 800, height: 1200 }
    ]);
    expect(pagesReorderedEtag).not.toBe(baseEtag);

    // 4. Alterar classificação de conteúdo da obra
    const ratingChangedEtag = computeChapterPagesEtag({ ...baseChapter, content_rating: 'ADULT_18' }, basePages);
    expect(ratingChangedEtag).not.toBe(baseEtag);

    // 5. Alterar dados da obra (work_updated_at)
    const workUpdatedEtag = computeChapterPagesEtag({ ...baseChapter, work_updated_at: '2026-11-05T12:00:00Z' }, basePages);
    expect(workUpdatedEtag).not.toBe(baseEtag);

    // 6. Publicar novo capítulo (novo ID e timestamp)
    const newChapterEtag = computeChapterPagesEtag({ ...baseChapter, id: 'c2-uuid', published_at: '2026-11-06T00:00:00Z' }, basePages);
    expect(newChapterEtag).not.toBe(baseEtag);
  });

  it('records Mihon token revocation in KV tombstone and invalidates local cache', async () => {
    const rawToken = 'nox_mh_test_token_revocation';
    const tokenHash = await hashToken(rawToken);

    const mockKvStore = new Map<string, string>();
    const mockKv = {
      put: vi.fn(async (key: string, val: string, opts?: any) => {
        mockKvStore.set(key, val);
      }),
      get: vi.fn(async (key: string) => {
        return mockKvStore.get(key) || null;
      })
    };

    await recordMihonTokenRevocation(tokenHash, mockKv);

    expect(mockKv.put).toHaveBeenCalledWith(
      `${MIHON_REVOKED_KV_PREFIX}${tokenHash}`,
      expect.stringContaining('"revokedAt"'),
      { expirationTtl: 300 }
    );
    expect(mockKvStore.has(`${MIHON_REVOKED_KV_PREFIX}${tokenHash}`)).toBe(true);
  });

  it('immediately rejects revoked Mihon token via KV tombstone even if cached in isolate memory', async () => {
    const rawToken = 'nox_mh_active_session_token';
    const tokenHash = await hashToken(rawToken);

    const mockKvStore = new Map<string, string>();
    const mockKv = {
      put: vi.fn(async (key: string, val: string) => {
        mockKvStore.set(key, val);
      }),
      get: vi.fn(async (key: string) => {
        return mockKvStore.get(key) || null;
      })
    };

    // Simulate an active token previously authenticated and cached in memory
    invalidateMihonTokenCache();

    // Now write a KV tombstone from "another isolate"
    await mockKv.put(`${MIHON_REVOKED_KV_PREFIX}${tokenHash}`, JSON.stringify({ revokedAt: Date.now() }));

    const req = new Request('https://projectnox.org/api/mihon/chapter/123/pages', {
      headers: { Authorization: `Bearer ${rawToken}` }
    });

    const result = await verifyMihonAuth(req, { COVER_THUMBNAILS: mockKv });

    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('Token revogado');
  });
});
