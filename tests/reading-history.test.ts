import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeYugabyteSql } = vi.hoisted(() => ({ executeYugabyteSql: vi.fn() }));

vi.mock('$lib/server/yugabyte', () => ({ executeYugabyteSql }));
vi.mock('$lib/server/resilience', () => ({ withTimeout: (promise: Promise<unknown>) => promise }));

import { enrichReadingRowsWithCatalog } from '../src/lib/server/reading-history';

describe('enrichReadingRowsWithCatalog', () => {
  beforeEach(() => executeYugabyteSql.mockReset());

  it('uses chapter and work columns already returned by the reading join without another query', async () => {
    const rows = await enrichReadingRowsWithCatalog(
      [{
        chapter_id: 'chapter-1',
        work_id: 'work-1',
        page: 8,
        chapter_catalog_id: 'chapter-1',
        chapter_number: '12.5',
        chapter_display_number: '12.5',
        chapter_title: 'A volta',
        chapter_work_id: 'work-1',
        chapter_published_at: '2026-01-02T03:04:05.000Z',
        work_catalog_id: 'work-1',
        work_slug: 'obra',
        work_title: 'Obra',
        work_cover_id: 'cover-1',
        work_kind: 'MANGA',
        work_status: 'ONGOING',
        work_published: true,
        work_content_rating: 'GENERAL'
      }],
      null
    );

    expect(executeYugabyteSql).not.toHaveBeenCalled();
    expect(rows).toHaveLength(1);
    expect(rows[0].chapters).toMatchObject({
      id: 'chapter-1',
      number: '12.5',
      work_id: 'work-1',
      works: { id: 'work-1', slug: 'obra', title: 'Obra' }
    });
  });

  it('keeps the indexed chapter lookup for legacy rows without joined catalog data', async () => {
    const chapterId = '10000000-0000-4000-8000-000000000001';
    executeYugabyteSql.mockResolvedValue({
      rows: [{
        id: chapterId,
        number: 3,
        title: 'Capítulo 3',
        work_id: '20000000-0000-4000-8000-000000000001',
        published_at: null,
        work_slug: 'obra-legado',
        work_title: 'Obra legado'
      }]
    });

    const rows = await enrichReadingRowsWithCatalog([{ chapter_id: chapterId, page: 2 }], null);

    expect(executeYugabyteSql).toHaveBeenCalledTimes(1);
    expect(rows[0].chapters.works.slug).toBe('obra-legado');
  });
});
