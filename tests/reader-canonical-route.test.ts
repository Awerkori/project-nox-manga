import { describe, expect, it, vi } from 'vitest';

const editorial = vi.hoisted(() => ({
  chapter: null as any,
  pages: [] as any[],
  siblings: [] as any[],
  work: null as any,
}));

vi.mock('$lib/server/reader-editorial', () => ({
  readerChapter: vi.fn(async () => ({ data: editorial.chapter })),
  readerContent: vi.fn(async () => ({ data: { pages: editorial.pages, siblings: editorial.siblings } })),
  readerPreviewTarget: vi.fn(async () => ({ data: null })),
  readerPreviewWork: vi.fn(async () => ({ data: editorial.work })),
}));

import { load } from '../src/routes/ler/[id]/+page.server';

type Result = { data: any; error?: any };

function query(result: Result) {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    not: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  };
  return builder;
}

function readerDb(chapter: any, siblings: any[]) {
  let chapterCalls = 0;
  return {
    from: vi.fn((table: string) => {
      if (table === 'chapters') {
        chapterCalls += 1;
        return chapterCalls === 1 ? query({ data: chapter }) : query({ data: siblings });
      }
      if (table === 'pages') return query({ data: [{ position: 1, media_id: 'media-1', width: 800, height: 1200 }] });
      if (table === 'comments') return query({ data: [] });
      if (table === 'chapter_scans' || table === 'work_scans') return query({ data: [] });
      return query({ data: null });
    })
  };
}

function setEditorialReader(chapter: any, siblings: any[]) {
  editorial.chapter = chapter;
  editorial.siblings = siblings;
  editorial.pages = [{ position: 1, media_id: 'media-1', width: 800, height: 1200 }];
  editorial.work = chapter.works;
}

describe('Reader UUID routes with canonical chapter labels', () => {
  it('keeps old UUID URLs and does not cross-cache 12.1 with 12.10', async () => {
    const work = { id: 'work-1', title: 'Teste', slug: 'teste', kind: 'MANGA', published: true, content_rating: 'GENERAL' };
    const one = {
      id: '00000000-0000-4000-8000-000000000121', work_id: work.id, number: 12.1, display_number: '12.1',
      canonical_chapter_key: 'pt-br|default|chapter|12.1|-', chapter_order_key: 'n|000000000012|100000000000|1||',
      chapter_kind: 'chapter', edition: 'default', language: 'pt-BR', title: 'Um', published_at: '2026-10-11T00:00:00Z', works: work
    };
    const ten = {
      id: '00000000-0000-4000-8000-000000000122', work_id: work.id, number: 12.1, display_number: '12.10',
      canonical_chapter_key: 'pt-br|default|chapter|12.10|-', chapter_order_key: 'n|000000000012|100000000000|10||',
      chapter_kind: 'chapter', edition: 'default', language: 'pt-BR', title: 'Dez', published_at: '2026-10-11T00:01:00Z', works: work
    };
    const shared = { url: new URL(`https://manga.example/ler/${one.id}`), cookies: { get: () => undefined }, setHeaders: vi.fn() };

    setEditorialReader(one, [one, ten]);
    const first = await load({ ...shared, locals: { db: readerDb(one, [one, ten]), user: null }, params: { id: one.id } } as any);
    setEditorialReader(ten, [one, ten]);
    const second = await load({ ...shared, locals: { db: readerDb(ten, [one, ten]), user: null }, params: { id: ten.id } } as any);

    expect(first.chapter.id).toBe(one.id);
    expect(first.chapter.display_number).toBe('12.1');
    expect(first.next?.id).toBe(ten.id);
    expect(second.chapter.id).toBe(ten.id);
    expect(second.chapter.display_number).toBe('12.10');
    expect(second.previous?.id).toBe(one.id);
  });

  it('presents a special and an edition as independent Reader chapters', async () => {
    const work = { id: 'work-2', title: 'Teste dois', slug: 'teste-dois', kind: 'MANGA', published: true, content_rating: 'GENERAL' };
    const special = {
      id: '00000000-0000-4000-8000-000000000123', work_id: work.id, number: null, display_number: 'Prólogo',
      canonical_chapter_key: 'pt-br|default|special|pr%C3%B3logo|pr%C3%B3logo', chapter_order_key: 'z|pr%C3%B3logo|pr%C3%B3logo',
      chapter_kind: 'special', edition: 'default', language: 'pt-BR', title: 'Prólogo', published_at: '2026-10-11T00:00:00Z', works: work
    };
    const official = {
      id: '00000000-0000-4000-8000-000000000124', work_id: work.id, number: 12.1, display_number: '12.1',
      canonical_chapter_key: 'en|official|chapter|12.1|-', chapter_order_key: 'n|000000000012|100000000000|1||',
      chapter_kind: 'chapter', edition: 'official', language: 'en', title: 'Official', published_at: '2026-10-11T00:01:00Z', works: work
    };
    setEditorialReader(special, [official, special]);
    const data = await load({
      locals: { db: readerDb(special, [official, special]), user: null }, params: { id: special.id },
      url: new URL(`https://manga.example/ler/${special.id}`), cookies: { get: () => undefined }, setHeaders: vi.fn()
    } as any);
    expect(data.chapter.display_number).toBe('Prólogo');
    expect(data.siblings.map((chapter: any) => chapter.canonical_chapter_key)).toEqual([
      official.canonical_chapter_key,
      special.canonical_chapter_key
    ]);
  });
});
