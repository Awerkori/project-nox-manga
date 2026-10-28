import { describe, it, expect } from 'vitest';
import {
  estimateChapterStorageBytes,
  formatStorageBytes,
  groupOfflineChaptersByWork,
  type OfflineChapter
} from '../src/lib/offline-storage';

describe('Offline Storage Engine Helpers', () => {
  const mockChapters: OfflineChapter[] = [
    {
      chapterId: 'ch-solo-02',
      workId: 'work-solo',
      workTitle: 'Solo Leveling',
      workSlug: 'solo-leveling',
      coverId: 'cover-solo',
      coverBlobUrl: 'data:image/webp;base64,AAAA', // ~4 bytes
      number: 2,
      title: 'O Despertar',
      pages: [
        { position: 1, mediaId: 'p1', blobUrl: 'data:image/webp;base64,AAAAAAAAAAAA' }, // ~12 bytes * 0.75 = 9
        { position: 2, mediaId: 'p2', blobUrl: 'data:image/webp;base64,BBBBBBBBBBBB' }
      ],
      downloadedAt: '2026-10-28T02:00:00.000Z',
      totalPages: 2
    },
    {
      chapterId: 'ch-solo-01',
      workId: 'work-solo',
      workTitle: 'Solo Leveling',
      workSlug: 'solo-leveling',
      coverId: 'cover-solo',
      number: '1',
      title: 'Prólogo',
      pages: [
        { position: 1, mediaId: 'p1', blobUrl: 'data:image/webp;base64,CCCCCCCCCCCC' }
      ],
      downloadedAt: '2026-10-28T01:00:00.000Z',
      totalPages: 1
    },
    {
      chapterId: 'ch-solo-10-5',
      workId: 'work-solo',
      workTitle: 'Solo Leveling',
      workSlug: 'solo-leveling',
      coverId: 'cover-solo',
      number: '10.5',
      title: 'Especial Side-Story',
      pages: [
        { position: 1, mediaId: 'p1', blobUrl: 'data:image/webp;base64,DDDDDDDDDDDD' }
      ],
      downloadedAt: '2026-10-28T03:00:00.000Z',
      totalPages: 1
    },
    {
      chapterId: 'ch-distant-80',
      workId: 'work-distant',
      workTitle: 'Distant Sky',
      workSlug: 'distant-sky',
      coverId: 'cover-distant',
      number: 80,
      title: 'Sobrevivência',
      pages: [
        { position: 1, mediaId: 'dp1', blobUrl: 'data:image/webp;base64,EEEEEEEEEEEE' }
      ],
      downloadedAt: '2026-10-27T10:00:00.000Z',
      totalPages: 1
    }
  ];

  it('correctly calculates byte sizes and human-readable storage formats', () => {
    expect(formatStorageBytes(0)).toBe('0 B');
    expect(formatStorageBytes(512)).toBe('512 B');
    expect(formatStorageBytes(1536)).toBe('1.5 KB');
    expect(formatStorageBytes(5242880)).toBe('5.0 MB');
    expect(formatStorageBytes(2147483648)).toBe('2.00 GB');

    const bytes = estimateChapterStorageBytes(mockChapters[0]);
    expect(bytes).toBeGreaterThan(0);
  });

  it('groups chapters by work with correct counts and aggregated metrics', () => {
    const groups = groupOfflineChaptersByWork(mockChapters);

    expect(groups.length).toBe(2);

    const soloGroup = groups.find((g) => g.workId === 'work-solo');
    expect(soloGroup).toBeDefined();
    expect(soloGroup!.chaptersCount).toBe(3);
    expect(soloGroup!.workTitle).toBe('Solo Leveling');
    expect(soloGroup!.isFullyDownloaded).toBe(true);

    const distantGroup = groups.find((g) => g.workId === 'work-distant');
    expect(distantGroup).toBeDefined();
    expect(distantGroup!.chaptersCount).toBe(1);
    expect(distantGroup!.workTitle).toBe('Distant Sky');
  });

  it('sorts chapters inside work in correct numerical order (1 -> 2 -> 10.5)', () => {
    const groups = groupOfflineChaptersByWork(mockChapters);
    const solo = groups.find((g) => g.workId === 'work-solo')!;

    const numbers = solo.chapters.map((c) => String(c.number));
    expect(numbers).toEqual(['1', '2', '10.5']);
  });

  it('detects incomplete chapters when pages or blobUrls are missing', () => {
    const incompleteChapter: OfflineChapter = {
      chapterId: 'ch-broken',
      workId: 'work-broken',
      workTitle: 'Obra Incompleta',
      workSlug: 'obra-incompleta',
      number: 1,
      title: null,
      pages: [
        { position: 1, mediaId: 'p1' } // missing blobUrl!
      ],
      downloadedAt: '2026-10-28T04:00:00.000Z',
      totalPages: 1
    };

    const groups = groupOfflineChaptersByWork([incompleteChapter]);
    expect(groups[0].isFullyDownloaded).toBe(false);
    expect(groups[0].hasIncomplete).toBe(true);
  });
});
