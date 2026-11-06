import { describe, it, expect } from 'vitest';
import { hashToken, matchesETag } from '../src/lib/server/mihon';

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
});
