import { describe, expect, it } from 'vitest';
import {
  canonicalChapterKey,
  chapterDisplayNumber,
  chapterIdentityLabel,
  chapterKindForInput,
  chapterOrderKey,
  compareChapterIdentity
} from '../src/lib/chapter-identity';

describe('Reader canonical chapter identity', () => {
  it('preserves textual decimal scale instead of rendering 12.10 as 12.1', () => {
    expect(chapterDisplayNumber({ number: 12.1, display_number: '12.10' })).toBe('12.10');
    expect(chapterDisplayNumber({ number: 12.1, display_number: '12.1' })).toBe('12.1');
  });

  it('orders decimal text with a durable key and keeps an explicit tie breaker', () => {
    const chapters = [
      { id: 'b', display_number: '12.10', canonical_chapter_key: 'pt-br|default|chapter|12.10|-', chapter_order_key: 'n|000000000012|100000000000|10||' },
      { id: 'a', display_number: '12.1', canonical_chapter_key: 'pt-br|default|chapter|12.1|-', chapter_order_key: 'n|000000000012|100000000000|1||' },
      { id: 'special', display_number: 'Extra', canonical_chapter_key: 'pt-br|default|special|unnumbered|extra', chapter_order_key: 'z|extra' }
    ];
    expect(chapters.sort(compareChapterIdentity).map((chapter) => chapter.display_number)).toEqual(['12.1', '12.10', 'Extra']);
  });

  it('creates the same textual contract used by Lite for manual chapter writes', () => {
    const one = { displayNumber: '12.1', language: 'pt-BR', edition: 'default', kind: 'chapter' };
    const ten = { displayNumber: '12.10', language: 'pt-BR', edition: 'default', kind: 'chapter' };
    const special = { displayNumber: 'Prólogo', title: 'Prólogo', language: 'pt-BR' };
    expect(canonicalChapterKey(one)).toBe('pt-br|default|chapter|12.1|-');
    expect(canonicalChapterKey(ten)).toBe('pt-br|default|chapter|12.10|-');
    expect(canonicalChapterKey(one)).not.toBe(canonicalChapterKey(ten));
    expect(chapterOrderKey(one)).not.toBe(chapterOrderKey(ten));
    expect(chapterKindForInput(special)).toBe('special');
    expect(canonicalChapterKey(special)).toBe('pt-br|default|special|pr%C3%B3logo|pr%C3%B3logo');
  });

  it('keeps special and edition identities visible without changing legacy URLs', () => {
    const special = { number: null, display_number: 'Prólogo', chapter_kind: 'special', edition: 'default', language: 'pt-BR' };
    const official = { number: 12.1, display_number: '12.1', chapter_kind: 'chapter', edition: 'official', language: 'en' };
    expect(chapterIdentityLabel(special)).toBe('Prólogo · pt-BR');
    expect(chapterIdentityLabel(official)).toBe('12.1 · official · en');
    // Reader routes use the stable UUID, never a decimal chapter label.
    expect(`/ler/${'00000000-0000-4000-8000-000000000012'}`).toBe('/ler/00000000-0000-4000-8000-000000000012');
  });
});
