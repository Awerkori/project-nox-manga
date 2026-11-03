import { describe, expect, it, vi } from 'vitest';

const work = { id: 'work', title: 'Story', slug: 'story', aliases: [], published: true };
const published = { id: 'public', work_id: 'work', number: 1, published_at: '2026-09-01' };
const draft = { id: 'draft', work_id: 'work', number: 2, published_at: null };

vi.mock('$lib/server/db', () => ({ WORK_FIELDS: '*' }));
vi.mock('$lib/server/yugabyte', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/server/yugabyte')>();
  return {
    ...actual,
    fetchFullWorkPageFromYugabyte: vi.fn(async (_slug: string, _vid: any, _uid: any, preview: boolean) => ({
      work,
      chapters: preview ? [published, draft] : [published],
      tags: [],
      rating: { rating: 5, total_votes: 10 }
    })),
    executeYugabyteSql: vi.fn(async () => ({ rows: [] }))
  };
});

import { load as workLoad } from '../src/routes/obra/[slug]/+page.server';

function makeEvent(role: string | null, preview = false) {
  return {
    locals: { user: null, role },
    params: { slug: 'story' },
    url: new URL('https://nox.invalid/obra/story' + (preview ? '?preview=1' : '')),
    cookies: { get: () => undefined }
  } as any;
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
