import { describe, it, expect } from 'vitest';
import { inspectImage } from '../src/lib/media-validation';
import { slugify } from '../src/lib/types';
describe('public upload boundary', () => {
  it('rejects SVG and script payloads even when named png', () => {
    expect(() =>
      inspectImage(
        new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
      )
    ).toThrow();
  });
  it('rejects oversized and truncated files', () => {
    expect(() => inspectImage(new Uint8Array(19_000_001))).toThrow();
    expect(() => inspectImage(new Uint8Array([137, 80, 78, 71]))).toThrow();
  });
  it('reads real PNG dimensions', () => {
    const bytes = Uint8Array.from(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64'
      )
    );
    expect(inspectImage(bytes)).toEqual({ mime: 'image/png', width: 1, height: 1 });
  });
  it('reads real GIF dimensions and mime', () => {
    const bytes = Uint8Array.from(
      Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
    );
    expect(inspectImage(bytes)).toEqual({ mime: 'image/gif', width: 1, height: 1 });
  });
  it('rejects appended PNG payloads', () => {
    const bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64'
    );
    expect(() => inspectImage(new Uint8Array(Buffer.concat([bytes, Buffer.from('<script>')])))).toThrow();
  });
  it('normalizes Portuguese URLs without executable characters', () => {
    expect(slugify('Ação: Céu Distante!')).toBe('acao-ceu-distante');
    expect(slugify('<script>alert(1)</script>')).toBe('script-alert-1-script');
  });
});
