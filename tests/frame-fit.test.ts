import { describe, expect, it } from 'vitest';
import { computeFrameFit } from '../src/lib/frame-fit';

function ring(w: number, h: number, cx: number, cy: number, rIn: number, rOut: number, gapTop = false) {
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const inGap = gapTop && y < cy && Math.abs(x - cx) < 6;
      if (d >= rIn && d <= rOut && !inGap) buf[(y * w + x) * 4 + 3] = 255;
    }
  }
  return buf;
}

describe('computeFrameFit', () => {
  it('centres a square frame whose opening is centred', () => {
    const r = computeFrameFit(ring(200, 200, 100, 100, 50, 70), 200, 200, 200, 200, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fit.frame_scale).toBeCloseTo(2, 1);
    expect(Math.abs(r.fit.frame_offset_x)).toBeLessThan(1);
    expect(Math.abs(r.fit.frame_offset_y)).toBeLessThan(1);
    expect(r.fit.frame_fit).toBe('contain');
  });

  it('compensates an off-centre opening on a non-square frame', () => {
    // 300x200 image, opening centred at (110, 100): 40px left of centre.
    const r = computeFrameFit(ring(300, 200, 110, 100, 40, 55), 300, 200, 300, 200, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // k = 300/80 = 3.75; offset = 40 * 3.75 / 300 = +50%
    expect(r.fit.frame_scale).toBeCloseTo(3.75, 1);
    expect(r.fit.frame_offset_x).toBeGreaterThan(45);
    expect(Math.abs(r.fit.frame_offset_y)).toBeLessThan(2);
  });

  it('scales results back to the natural size when the alpha buffer is downsampled', () => {
    const full = computeFrameFit(ring(200, 200, 100, 100, 50, 70), 200, 200, 800, 800, 1);
    expect(full.ok && full.fit.frame_scale).toBeCloseTo(2, 1);
  });

  it('refuses open frames and fully transparent images instead of guessing', () => {
    expect(computeFrameFit(ring(200, 200, 100, 100, 50, 70, true), 200, 200, 200, 200).ok).toBe(false);
    expect(computeFrameFit(new Uint8ClampedArray(100 * 100 * 4), 100, 100, 100, 100).ok).toBe(false);
  });
});
