import { describe, expect, it } from 'vitest';
import { resolveCoverUrl, resolveOriginalCoverUrl } from '../src/lib/covers';

describe('cover URL resolution', () => {
  it('uses a versioned derivative namespace for thumbnails', () => {
    expect(resolveCoverUrl('abc', null, null, { size: 'thumb' })).toBe('/media/abc?size=thumb&v=3');
    expect(resolveCoverUrl('abc', null, null, { size: 'hero' })).toBe('/media/abc?size=hero&v=3');
  });

  it('removes only derivative parameters when falling back to the original', () => {
    expect(resolveOriginalCoverUrl('/media/abc?size=thumb&v=3')).toBe('/media/abc');
    expect(resolveOriginalCoverUrl('/media/abc?size=hero&v=3&download=1')).toBe('/media/abc?download=1');
  });
});
