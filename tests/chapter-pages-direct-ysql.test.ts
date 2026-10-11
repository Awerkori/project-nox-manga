import { describe, expect, it, vi } from 'vitest';

const editorial = vi.hoisted(() => ({
  chapter: null as any,
  pages: [] as any[]
}));

vi.mock('$lib/server/reader-editorial', () => ({
  readerChapter: vi.fn(async () => ({ data: editorial.chapter })),
  readerContent: vi.fn(async () => ({ data: { pages: editorial.pages, siblings: [] } }))
}));

import { GET } from '../src/routes/api/chapters/[id]/pages/+server';

function event(id: string) {
  return {
    params: { id },
    locals: { role: null, user: null, db: { from: vi.fn() } },
    cookies: { get: () => undefined },
    platform: { env: {} }
  } as any;
}

describe('public chapter-pages API', () => {
  it('uses canonical direct-YSQL identity without collapsing 12.1 and 12.10', async () => {
    editorial.chapter = {
      id: '00000000-0000-4000-8000-000000000121',
      work_id: '00000000-0000-4000-8000-000000000001',
      number: 12.1,
      display_number: '12.10',
      canonical_chapter_key: 'pt-br|default|chapter|12.10|-',
      chapter_order_key: 'n|000000000012|100000000000|10||',
      chapter_kind: 'chapter',
      edition: 'default',
      language: 'pt-BR',
      title: 'Capítulo 12.10',
      published_at: '2026-10-11T00:00:00Z',
      works: { id: '00000000-0000-4000-8000-000000000001', title: 'Obra', slug: 'obra', published: true, content_rating: 'GENERAL' }
    };
    editorial.pages = [{ position: 1, media_id: 'media-1', width: 800, height: 1200 }];

    const response = await GET(event(editorial.chapter.id));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      chapter_display_number: '12.10',
      canonical_chapter_key: 'pt-br|default|chapter|12.10|-',
      pages: [{ position: 1, media_id: 'media-1' }]
    });
  });

  it('does not expose an unpublished chapter to a public caller', async () => {
    editorial.chapter = null;
    editorial.pages = [];
    const response = await GET(event('00000000-0000-4000-8000-000000000122'));
    expect(response.status).toBe(404);
  });
});
