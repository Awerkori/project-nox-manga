import { describe, expect, it } from 'vitest';
import {
  buildChapterProvenance,
  buildWorkProvenance,
  type ChapterMappingRecord,
  type SourceRecord,
  type WorkMappingRecord
} from '../src/lib/server/admin-work-provenance.js';
import { load as adminLayoutLoad } from '../src/routes/admin/+layout.server.js';

const sources: SourceRecord[] = [
  { id: 'kuro', name: 'Kuro', base_url: 'https://kuro.example', enabled: true, status: 'ACTIVE' },
  { id: 'mangaflix', name: 'MangaFlix', base_url: 'https://mangaflix.example', enabled: true, status: 'ACTIVE' },
  { id: 'retired', name: 'Fonte desativada', base_url: 'https://retired.example', enabled: false, status: 'DISABLED' }
];

const workMappings: WorkMappingRecord[] = [
  {
    id: 'mapping-kuro',
    source: 'kuro',
    source_work_id: 'kuro-7',
    source_slug: 'obra-de-teste',
    source_title: 'Obra de teste',
    sync_status: 'SYNCED',
    last_synced_at: '2026-10-01T12:00:00.000Z',
    is_primary: true,
    metadata: { sourceUrl: 'https://kuro.example/works/obra-de-teste' },
    updated_at: '2026-10-01T12:00:00.000Z'
  },
  {
    id: 'mapping-flix',
    source: 'mangaflix',
    source_work_id: 'flix-9',
    source_slug: 'test-work',
    source_title: 'Test work',
    sync_status: 'SYNCED',
    last_synced_at: '2026-09-30T12:00:00.000Z',
    is_primary: false,
    metadata: {},
    updated_at: '2026-09-30T12:00:00.000Z'
  }
];

describe('admin work provenance', () => {
  it('keeps provenance behind the existing editorial admin boundary', async () => {
    await expect(
      adminLayoutLoad({ locals: { user: { id: 'reader' }, role: 'USER', db: {} } } as any)
    ).rejects.toThrow();
    await expect(
      adminLayoutLoad({ locals: { user: null, role: null, db: {} } } as any)
    ).rejects.toThrow();
  });

  it('uses persisted field provenance independently from the primary work mapping', () => {
    const provenance = buildWorkProvenance(
      {
        title: { source: 'mangaflix', updated_at: '2026-10-01T09:00:00.000Z' },
        synopsis: { source: 'kuro', updated_at: '2026-10-01T10:00:00.000Z' },
        cover: { source: 'mangaflix', updated_at: '2026-10-01T11:00:00.000Z' }
      },
      workMappings,
      sources
    );

    expect(provenance.primaryMapping?.name).toBe('Kuro');
    expect(provenance.primaryMapping?.sourceUrl).toBe('https://kuro.example/works/obra-de-teste');
    expect(provenance.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'title', source: expect.objectContaining({ id: 'mangaflix' }) }),
        expect.objectContaining({ field: 'synopsis', source: expect.objectContaining({ id: 'kuro' }) }),
        expect.objectContaining({ field: 'cover', source: expect.objectContaining({ id: 'mangaflix' }) })
      ])
    );
  });

  it('shows the real page provider for a chapter and retains alternate source mappings', () => {
    const mappings: ChapterMappingRecord[] = [
      {
        id: 'alt', chapter_id: 'chapter-1', work_id: 'work-1', work_mapping_id: 'mapping-flix',
        source: 'mangaflix', source_chapter_id: 'external-chapter-22', status: 'COMPLETED',
        is_page_provider: false, created_at: '2026-10-01T08:00:00.000Z', updated_at: '2026-10-01T08:00:00.000Z'
      },
      {
        id: 'provider', chapter_id: 'chapter-1', work_id: 'work-1', work_mapping_id: 'mapping-kuro',
        source: 'kuro', source_chapter_id: 'https://kuro.example/chapters/22', status: 'COMPLETED',
        is_page_provider: true, created_at: '2026-10-01T09:00:00.000Z', updated_at: '2026-10-01T09:00:00.000Z'
      }
    ];

    const provenance = buildChapterProvenance(['chapter-1'], mappings, sources)['chapter-1'];
    expect(provenance.name).toBe('Kuro');
    expect(provenance.sourceChapterId).toBe('https://kuro.example/chapters/22');
    expect(provenance.sourceUrl).toBe('https://kuro.example/chapters/22');
    expect(provenance.alternatives).toEqual([
      expect.objectContaining({ name: 'MangaFlix', sourceChapterId: 'external-chapter-22', sourceUrl: null })
    ]);
  });

  it('does not invent chapter URLs or provenance for unmapped chapters', () => {
    const provenance = buildChapterProvenance(
      ['chapter-1', 'chapter-without-mapping'],
      [{
        id: 'retired-map', chapter_id: 'chapter-1', work_id: 'work-1', work_mapping_id: 'mapping-retired',
        source: 'retired', source_chapter_id: 'opaque-id-88', status: 'COMPLETED',
        is_page_provider: true, created_at: '2026-10-01T09:00:00.000Z', updated_at: '2026-10-01T09:00:00.000Z'
      }],
      sources
    );

    expect(provenance['chapter-1']).toEqual(expect.objectContaining({
      name: 'Fonte desativada',
      enabled: false,
      sourceUrl: null
    }));
    expect(provenance['chapter-without-mapping']).toBeUndefined();
  });
});
