import { describe, expect, it, vi } from 'vitest';
vi.mock('$lib/server/db', () => ({ WORK_FIELDS: '*', check: () => {} }));
import { load as workLoad } from '../src/routes/obra/[slug]/+page.server';
import { load as readerLoad } from '../src/routes/ler/[id]/+page.server';

function event() {
  const work = { id: 'work', slug: 'story', title: 'Story', synopsis: '', aliases: [], published: true };
  const chapter = { id: 'chapter', work_id: 'work', number: 64, works: work, published_at: '2026-09-07' };
  const tables: Record<string, any[]> = {
    works: [work],
    chapters: [chapter],
    comments: [
      { id: 'visible', work_id: 'work', chapter_id: null, removed: false },
      { id: 'removed', work_id: 'work', chapter_id: null, removed: true },
      { id: 'chapter-visible', work_id: 'work', chapter_id: 'chapter', removed: false },
      { id: 'chapter-removed', work_id: 'work', chapter_id: 'chapter', removed: true }
    ]
  };
  // An administrator can read moderated rows for the moderation panel.
  // Public page loaders must explicitly exclude those rows for every role.
  const db = {
    from(table: string) {
      let rows = [...(tables[table] || [])];
      const q: any = {
        select: (fields: string) => {
          if (table === 'comments') expect(fields).toContain('members!comments_user_id_fkey(');
          return q;
        },
        order: () => q,
        limit: () => q,
        not: () => q,
        eq: (key: string, value: unknown) => {
          rows = rows.filter((r) => r[key] === value);
          return q;
        },
        is: (key: string, value: unknown) => {
          rows = rows.filter((r) => r[key] === value);
          return q;
        },
        maybeSingle: async () => ({ data: rows[0] || null, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(resolve)
      };
      return q;
    },
    rpc: async () => ({ data: [], error: null })
  };
  return {
    locals: { db, user: null, role: 'ADMIN' },
    params: { slug: 'story', id: 'chapter' },
    url: new URL('https://nox.invalid')
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
