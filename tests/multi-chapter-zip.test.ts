import { describe, it, expect } from 'vitest';
import { parseChapterNumber } from '../src/lib/uploads';

describe('Multi-Chapter ZIP parsing', () => {
  it('parses standard chapter folder formats correctly', () => {
    expect(parseChapterNumber('Capítulo 01')).toBe(1);
    expect(parseChapterNumber('Capítulo 10')).toBe(10);
    expect(parseChapterNumber('Cap 5')).toBe(5);
    expect(parseChapterNumber('Cap. 12.5')).toBe(12.5);
    expect(parseChapterNumber('c01')).toBe(1);
    expect(parseChapterNumber('Ch. 99')).toBe(99);
    expect(parseChapterNumber('Chapter 100')).toBe(100);
    expect(parseChapterNumber('001')).toBe(1);
    expect(parseChapterNumber('045')).toBe(45);
  });

  it('falls back to provided index when no number found', () => {
    expect(parseChapterNumber('Special Extra', 7)).toBe(7);
    expect(parseChapterNumber('Bonus', 12)).toBe(12);
  });
});
