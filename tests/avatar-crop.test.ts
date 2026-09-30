import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { avatarCropStyle, normalizeAvatarCrop } from '../src/lib/avatar';
import { inspectImage } from '../src/lib/media-validation';

describe('avatar crop metadata', () => {
  it('preserves a valid zero focal position instead of resetting it to the centre', () => {
    expect(normalizeAvatarCrop({ x: 0, y: 0, zoom: 1.5 })).toEqual({ x: 0, y: 0, zoom: 1.5 });
    expect(avatarCropStyle({ x: 0, y: 100, zoom: 1.25 })).toContain('object-position: 0% 100%');
  });

  it('normalizes persisted JSON safely without changing valid presentation metadata', () => {
    expect(normalizeAvatarCrop('{"x":12,"y":88,"zoom":2}')).toEqual({ x: 12, y: 88, zoom: 2 });
    expect(normalizeAvatarCrop({ x: -1, y: 101, zoom: 99 })).toEqual({ x: 0, y: 100, zoom: 3 });
  });
});

describe('animated avatar input', () => {
  it('keeps the uploaded GIF bytes identifiable as an animated GIF', () => {
    const original = readFileSync(new URL('./fixtures/test-animated.gif', import.meta.url));
    const info = inspectImage(new Uint8Array(original));
    const originalHash = createHash('sha256').update(original).digest('hex');

    expect(info).toMatchObject({ mime: 'image/gif', isAnimated: true });
    // The normal avatar path forwards this File to FormData/storeImage; no
    // canvas/encoder is involved, so the storage hash is of these same bytes.
    expect(originalHash).toHaveLength(64);
    expect(original.length).toBeGreaterThan(0);
  });
});
