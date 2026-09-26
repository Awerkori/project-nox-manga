import jpeg from 'jpeg-js';
import { decode as decodePng, encode as encodePng } from 'fast-png';

export function isGif(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  // GIF87a or GIF89a
  return (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  );
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

export function resizeRgba(
  src: Uint8Array | Uint8ClampedArray,
  w1: number,
  h1: number,
  w2: number,
  h2: number
): Uint8Array {
  const dst = new Uint8Array(w2 * h2 * 4);
  const xRatio = (w1 - 1) / Math.max(1, w2 - 1);
  const yRatio = (h1 - 1) / Math.max(1, h2 - 1);

  for (let y = 0; y < h2; y++) {
    const srcY = y * yRatio;
    const yFloor = Math.floor(srcY);
    const yCeil = Math.min(h1 - 1, yFloor + 1);
    const yWeight = srcY - yFloor;

    for (let x = 0; x < w2; x++) {
      const srcX = x * xRatio;
      const xFloor = Math.floor(srcX);
      const xCeil = Math.min(w1 - 1, xFloor + 1);
      const xWeight = srcX - xFloor;

      const idx00 = (yFloor * w1 + xFloor) * 4;
      const idx10 = (yFloor * w1 + xCeil) * 4;
      const idx01 = (yCeil * w1 + xFloor) * 4;
      const idx11 = (yCeil * w1 + xCeil) * 4;

      const dstIdx = (y * w2 + x) * 4;

      for (let c = 0; c < 4; c++) {
        const top = src[idx00 + c] * (1 - xWeight) + src[idx10 + c] * xWeight;
        const bottom = src[idx01 + c] * (1 - xWeight) + src[idx11 + c] * xWeight;
        dst[dstIdx + c] = Math.round(top * (1 - yWeight) + bottom * yWeight);
      }
    }
  }
  return dst;
}

export interface ThumbnailResult {
  data: Uint8Array;
  mime: string;
  width?: number;
  height?: number;
  resized: boolean;
}

export async function generateThumbnail(
  sourceBytes: Uint8Array,
  sourceMime?: string | null
): Promise<ThumbnailResult> {
  const mime = (sourceMime || '').toLowerCase();

  // 1. Guard Animated GIFs: preserve animation, never convert to single-frame static image
  if (mime === 'image/gif' || isGif(sourceBytes)) {
    return {
      data: sourceBytes,
      mime: 'image/gif',
      resized: false
    };
  }

  try {
    let rawRgba: Uint8Array | Uint8ClampedArray | null = null;
    let width = 0;
    let height = 0;

    if (mime === 'image/jpeg' || isJpeg(sourceBytes)) {
      const decoded = jpeg.decode(sourceBytes, { useTArray: true });
      if (decoded && decoded.width > 0 && decoded.height > 0) {
        rawRgba = decoded.data;
        width = decoded.width;
        height = decoded.height;
      }
    } else if (mime === 'image/png' || isPng(sourceBytes)) {
      const decoded = decodePng(sourceBytes);
      if (decoded && decoded.width > 0 && decoded.height > 0) {
        rawRgba = decoded.data;
        width = decoded.width;
        height = decoded.height;
      }
    }

    if (!rawRgba || width === 0 || height === 0) {
      // Format not decodable via fast pure-JS decoders, fallback to original
      return {
        data: sourceBytes,
        mime: sourceMime || 'image/jpeg',
        resized: false
      };
    }

    const MAX_WIDTH = 360;
    const MAX_HEIGHT = 480;

    // Rule: if image is already smaller or equal to target, serve original
    if (width <= MAX_WIDTH && height <= MAX_HEIGHT) {
      return {
        data: sourceBytes,
        mime: sourceMime || (isJpeg(sourceBytes) ? 'image/jpeg' : isPng(sourceBytes) ? 'image/png' : 'image/jpeg'),
        resized: false
      };
    }

    const widthRatio = MAX_WIDTH / width;
    const heightRatio = MAX_HEIGHT / height;
    const scale = Math.min(widthRatio, heightRatio);

    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const finalRgba = resizeRgba(rawRgba, width, height, targetWidth, targetHeight);

    // If source is PNG with alpha transparency, preserve PNG
    if (mime === 'image/png' || isPng(sourceBytes)) {
      let hasAlpha = false;
      for (let i = 3; i < finalRgba.length; i += 4) {
        if (finalRgba[i] < 250) {
          hasAlpha = true;
          break;
        }
      }
      if (hasAlpha) {
        const pngEncoded = encodePng({
          width: targetWidth,
          height: targetHeight,
          data: finalRgba
        });
        return {
          data: pngEncoded,
          mime: 'image/png',
          width: targetWidth,
          height: targetHeight,
          resized: true
        };
      }
    }

    // JPEG encoding at 78% quality: universal compatibility, fast, 80-90% byte reduction
    const jpegEncoded = jpeg.encode(
      {
        data: finalRgba,
        width: targetWidth,
        height: targetHeight
      },
      78
    );

    return {
      data: jpegEncoded.data,
      mime: 'image/jpeg',
      width: targetWidth,
      height: targetHeight,
      resized: true
    };
  } catch (err) {
    console.warn('Thumbnail generation failed, serving original:', err);
    return {
      data: sourceBytes,
      mime: sourceMime || 'image/jpeg',
      resized: false
    };
  }
}
