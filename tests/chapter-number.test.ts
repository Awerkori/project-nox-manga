import { describe, expect, it } from 'vitest';
import { formatChapterNumber } from '../src/lib/chapter-number';

describe('formatChapterNumber', () => {
  it.each([
    [1, '1'], ['1.00', '1'], ['1.0', '1'], [12, '12'], ['12.00', '12'],
    ['12.1', '12.1'], ['12.10', '12.1'], ['12.5', '12.5'], ['12.50', '12.5'],
    ['12.05', '12.05'], ['112.00', '112'], ['0.5', '0.5'], ['Prólogo', 'Prólogo']
  ])('formats %s as %s', (input, expected) => {
    expect(formatChapterNumber(input)).toBe(expected);
  });
});
