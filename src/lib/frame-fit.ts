/**
 * Automatic framing for uploaded avatar frames (PNG/GIF/WebP with transparency).
 *
 * The photo is always a circle of size S. The frame layer is an S×S box where the
 * image is rendered with object-fit: contain, then `translate(offset%) scale(k)`.
 * We find the transparent opening of the frame (connected transparent region
 * around the centre that does not touch the image borders) and compute k/offset
 * so that opening sits exactly over the photo circle. Ornaments outside the
 * opening (horns, hats, bats, wings...) are left free to overflow.
 */

export type FrameFit = {
  frame_scale: number;
  frame_offset_x: number;
  frame_offset_y: number;
  frame_fit: 'contain';
};

export type FrameFitResult = { ok: true; fit: FrameFit } | { ok: false; reason: 'no-opening' | 'open-frame' | 'tiny-opening' };

const round = (v: number, decimals: number) => Number(v.toFixed(decimals));

/**
 * @param alpha  RGBA pixel buffer of the (optionally downsampled) image, w×h.
 * @param w,h    dimensions of the buffer.
 * @param W,H    natural dimensions of the source image.
 * @param overlap Opening is scaled slightly beyond the photo so seams stay hidden.
 */
export function computeFrameFit(
  alpha: ArrayLike<number>,
  w: number,
  h: number,
  W: number,
  H: number,
  overlap = 1.02
): FrameFitResult {
  const clear = (i: number) => alpha[i * 4 + 3] < 24;
  const total = w * h;

  // Seed: transparent pixel closest to the centre.
  const cx0 = Math.floor(w / 2);
  const cy0 = Math.floor(h / 2);
  let seed = -1;
  const maxR = Math.ceil(Math.max(w, h) / 2);
  for (let r = 0; r <= maxR && seed < 0; r++) {
    for (let dy = -r; dy <= r && seed < 0; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx0 + dx;
        const y = cy0 + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (clear(y * w + x)) {
          seed = y * w + x;
          break;
        }
      }
    }
  }
  if (seed < 0) return { ok: false, reason: 'no-opening' };

  const seen = new Uint8Array(total);
  const stack = [seed];
  seen[seed] = 1;
  let minX = w, maxX = 0, minY = h, maxY = 0, count = 0;
  let touchesBorder = false;
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p - x) / w;
    count++;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true;
    if (x > 0 && !seen[p - 1] && clear(p - 1)) { seen[p - 1] = 1; stack.push(p - 1); }
    if (x < w - 1 && !seen[p + 1] && clear(p + 1)) { seen[p + 1] = 1; stack.push(p + 1); }
    if (y > 0 && !seen[p - w] && clear(p - w)) { seen[p - w] = 1; stack.push(p - w); }
    if (y < h - 1 && !seen[p + w] && clear(p + w)) { seen[p + w] = 1; stack.push(p + w); }
  }

  if (touchesBorder) return { ok: false, reason: 'open-frame' };
  if (count < total * 0.03) return { ok: false, reason: 'tiny-opening' };

  const sx = W / w;
  const sy = H / h;
  const holeD = Math.min((maxX - minX + 1) * sx, (maxY - minY + 1) * sy);
  const holeCx = ((minX + maxX + 1) / 2) * sx;
  const holeCy = ((minY + maxY + 1) / 2) * sy;
  const maxSide = Math.max(W, H);

  const k = Math.min(4, Math.max(0.5, (maxSide / holeD) * overlap));
  return {
    ok: true,
    fit: {
      frame_scale: round(k, 2),
      frame_offset_x: round((-(holeCx - W / 2) * k * 100) / maxSide, 1),
      frame_offset_y: round((-(holeCy - H / 2) * k * 100) / maxSide, 1),
      frame_fit: 'contain'
    }
  };
}

/** Browser helper: loads an image URL, samples its alpha channel and runs computeFrameFit. */
export async function computeFrameFitFromUrl(src: string): Promise<FrameFitResult & { width: number; height: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = src;
  });
  const W = img.naturalWidth || img.width || 1;
  const H = img.naturalHeight || img.height || 1;
  const ds = Math.min(1, 240 / Math.max(W, H));
  const w = Math.max(1, Math.round(W * ds));
  const h = Math.max(1, Math.round(H * ds));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { ok: false, reason: 'no-opening', width: W, height: H };
  ctx.drawImage(img, 0, 0, w, h);
  const result = computeFrameFit(ctx.getImageData(0, 0, w, h).data, w, h, W, H);
  return { ...result, width: W, height: H };
}
