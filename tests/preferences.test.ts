import { afterEach, expect, it, vi } from 'vitest';
import { readPreference, savePreference } from '../src/lib/preferences';
afterEach(() => vi.unstubAllGlobals());
it('does not break the reader when browser storage is denied', () => {
  vi.stubGlobal('localStorage', {
    getItem() {
      throw new Error('Denied');
    },
    setItem() {
      throw new Error('Quota');
    }
  });
  expect(readPreference('page')).toBeNull();
  expect(savePreference('page', '12')).toBe(false);
});
it('keeps preferences when storage is available', () => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value)
  });
  expect(savePreference('page', '12')).toBe(true);
  expect(readPreference('page')).toBe('12');
});
