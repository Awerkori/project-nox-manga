import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/server/reader-editorial', () => ({
  readerChapter: vi.fn().mockResolvedValue({
    data: {
      id: 'chap-100',
      number: 1,
      title: 'Capítulo 1',
      published_at: '2026-01-01T00:00:00.000Z',
      works: {
        id: 'work-1',
        title: 'Obra 1',
        slug: 'obra-1',
        published: true,
        content_rating: 'SAFE'
      }
    }
  }),
  readerContent: vi.fn().mockResolvedValue({
    data: {
      pages: [
        { position: 1, media_id: '11111111-1111-4111-8111-111111111111', width: 800, height: 1200 },
        { position: 2, media_id: '22222222-2222-4222-8222-222222222222', width: 800, height: 1200 }
      ]
    }
  })
}));

vi.mock('$lib/server/yugabyte', () => ({
  withYugabyteReadSession: (_env: any, fn: any) => fn(_env),
  executeYugabyteSql: vi.fn().mockResolvedValue({ rows: [] })
}));

import { GET } from '../src/routes/api/chapters/[id]/pages/+server';

describe('Chapter Manifest API - Caching & CDN URLs', () => {
  it('returns full manifest with CDN-prefixed image URLs and cache headers', async () => {
    const res = await GET({
      params: { id: 'chap-100' },
      locals: {},
      cookies: { get: () => undefined },
      platform: { env: { MEDIA_CDN_URL: 'https://cdn.projectnox.org' } },
      request: new Request('http://localhost/api/chapters/chap-100/pages')
    } as any);

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('public');
    const etag = res.headers.get('etag');
    expect(etag).toBeTruthy();

    const data = await res.json();
    expect(data.chapter_id).toBe('chap-100');
    expect(data.pages).toHaveLength(2);
    expect(data.pages[0].url).toBe('https://cdn.projectnox.org/media/11111111-1111-4111-8111-111111111111');
    expect(data.pages[1].url).toBe('https://cdn.projectnox.org/media/22222222-2222-4222-8222-222222222222');
  });

  it('returns 304 Not Modified when matching If-None-Match header is provided', async () => {
    // Expected ETag for chap-100 with 2 pages and published_at 2026-01-01T00:00:00.000Z (timestamp: 1767225600000)
    const expectedEtag = `"chap-100-2-${new Date('2026-01-01T00:00:00.000Z').getTime()}"`;

    const res = await GET({
      params: { id: 'chap-100' },
      locals: {},
      cookies: { get: () => undefined },
      platform: { env: {} },
      request: new Request('http://localhost/api/chapters/chap-100/pages', {
        headers: { 'if-none-match': expectedEtag }
      })
    } as any);

    expect(res.status).toBe(304);
    expect(res.headers.get('etag')).toBe(expectedEtag);
  });
});
