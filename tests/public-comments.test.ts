import { describe, expect, it, vi } from 'vitest';
vi.mock('$lib/server/db', () => ({ WORK_FIELDS: '*', check: () => {} }));
vi.mock('$lib/server/reader-editorial', () => ({
  readerChapter: async () => ({ data: { id:'chapter',work_id:'work',number:64,published_at:'2026-09-07',works:{id:'work',published:true} } }),
  readerContent: async () => ({ data: { pages:[{position:1,media_id:'m1'}],siblings:[{id:'chapter',number:64}] } }),
  readerPreviewTarget: vi.fn(),
  readerPreviewWork: vi.fn()
}));
vi.mock('$lib/server/yugabyte', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/server/yugabyte')>();
  return {
    ...actual,
    fetchFullWorkPageFromYugabyte: vi.fn(async () => ({
      work: { id: 'work', slug: 'story', title: 'Story', synopsis: '', aliases: [], published: true },
      chapters: [{ id: 'chapter', work_id: 'work', number: 64, published_at: '2026-09-07' }],
      tags: [],
      rating: { rating: 5, total_votes: 1 }
    })),
    executeYugabyteSql: vi.fn(async (sql: string) => {
      if (sql.includes('FROM comments') && sql.includes('chapter_id IS NULL')) {
        return {
          rows: [
            { comments: [
              { id: 'visible', work_id: 'work', chapter_id: null, removed: false, created_at: '2026-01-01' },
              { id: 'removed', work_id: 'work', chapter_id: null, removed: true, created_at: '2026-01-02' }
            ], metrics: null, work_scans: [] }
          ]
        };
      }
      if (sql.includes('FROM comments') && sql.includes('c.chapter_id = $1')) {
        return {
          rows: [
            { id: 'chapter-visible', work_id: 'work', chapter_id: 'chapter', removed: false, created_at: '2026-01-01' },
            { id: 'chapter-removed', work_id: 'work', chapter_id: 'chapter', removed: true, created_at: '2026-01-02' }
          ]
        };
      }
      if (sql.includes('FROM public.works')) {
        return { rows: [{ id: 'work', slug: 'story', title: 'Story', synopsis: '', aliases: [], published: true }] };
      }
      return { rows: [] };
    })
  };
});
import { load as workLoad } from '../src/routes/obra/[slug]/+page.server';
import { load as readerLoad } from '../src/routes/ler/[id]/+page.server';

function event() {
  return {
    locals: { user: null, role: 'ADMIN' },
    params: { slug: 'story', id: 'chapter' },
    url: new URL('https://nox.invalid'),
    setHeaders: () => {}
  } as any;
}

describe('moderated comments on public pages', () => {
  it('hides removed work comments even from the owner outside moderation', async () => {
    const data = await workLoad(event());
    expect(data.comments.map((c: any) => c.id)).toEqual(['visible']);
  });
  it('hides removed chapter comments even from the owner outside moderation', async () => {
    const data = await readerLoad(event());
    expect(data.comments.map((c: any) => c.id)).toEqual(['chapter-visible']);
  });
});
