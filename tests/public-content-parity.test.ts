import { describe, expect, it, vi } from 'vitest';
vi.mock('$lib/server/db', () => ({ WORK_FIELDS: '*' }));
import { load as workLoad } from '../src/routes/obra/[slug]/+page.server';

function makeEvent(role: string | null, preview = false) {
  const work = { id: 'work', title: 'Story', slug: 'story', aliases: [], published: true };
  const published = { id: 'public', work_id: 'work', number: 1, published_at: '2026-09-01' };
  const draft = { id: 'draft', work_id: 'work', number: 2, published_at: null };
  const tables: Record<string, any[]> = { works: [work], chapters: [published, draft] };
  const db = {
    from(table: string) {
      let rows = [...(tables[table] || [])];
      const q: any = {
        select: () => q, order: () => q, limit: () => q,
        eq: (k: string, v: unknown) => { rows = rows.filter(r => r[k] === v); return q; },
        is: (k: string, v: unknown) => { rows = rows.filter(r => r[k] === v); return q; },
        not: (k: string, op: string, v: unknown) => { rows = rows.filter(r => r[k] !== v); return q; },
        maybeSingle: async () => ({ data: rows[0] || null, error: null }),
        then: (resolve: any) => Promise.resolve({ data: rows, error: null }).then(resolve)
      };
      return q;
    },
    rpc: async () => ({ data: [], error: null })
  };
  return { locals: { db, user: null, role }, params: { slug: 'story' }, url: new URL('https://nox.invalid/obra/story' + (preview ? '?preview=1' : '')), cookies: { get: () => undefined } } as any;
}

describe('public chapter visibility', () => {
  it('gives staff and anonymous readers the same published chapters', async () => {
    const anon = await workLoad(makeEvent(null));
    const staff = await workLoad(makeEvent('ADMIN'));
    expect(staff.chapters).toEqual(anon.chapters);
    expect(staff.chapters.map((c: any) => c.id)).toEqual(['public']);
  });
  it('requires both explicit preview and staff authority to include drafts', async () => {
    expect((await workLoad(makeEvent(null, true))).chapters).toHaveLength(1);
    expect((await workLoad(makeEvent('ADMIN', true))).chapters).toHaveLength(2);
  });
});
