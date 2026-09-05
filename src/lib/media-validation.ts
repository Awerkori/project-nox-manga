export type ImageInfo = { mime: 'image/png' | 'image/jpeg' | 'image/webp'; width: number; height: number };
const text = (a: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...a.slice(start, start + length));
export function inspectImage(a: Uint8Array): ImageInfo {
  if (a.length < 24 || a.length > 19_000_000) throw new Error('Cada página deve ter no máximo 19 MB.');
  const d = new DataView(a.buffer, a.byteOffset, a.byteLength);
  let width = 0,
    height = 0;
  let mime: ImageInfo['mime'];
  if (a[0] === 137 && text(a, 1, 3) === 'PNG' && d.getUint32(4) === 0x0d0a1a0a) {
    mime = 'image/png';
    if (text(a, 12, 4) !== 'IHDR' || d.getUint32(8) !== 13) throw new Error('PNG inválido.');
    width = d.getUint32(16);
    height = d.getUint32(20);
    let offset = 8,
      idat = false,
      end = false;
    while (offset + 12 <= a.length) {
      const len = d.getUint32(offset),
        type = text(a, offset + 4, 4);
      if (offset + len + 12 > a.length) throw new Error('PNG incompleto.');
      if (type === 'IDAT') idat = true;
      if (type === 'IEND') {
        end = len === 0 && offset + 12 === a.length;
        break;
      }
      offset += len + 12;
    }
    if (!idat || !end) throw new Error('PNG incompleto.');
  } else if (a[0] === 255 && a[1] === 216 && a[a.length - 2] === 255 && a[a.length - 1] === 217) {
    mime = 'image/jpeg';
    let offset = 2;
    while (offset + 4 < a.length) {
      if (a[offset] !== 255) throw new Error('JPEG inválido.');
      const marker = a[offset + 1];
      if (marker === 0xda) break;
      const len = d.getUint16(offset + 2);
      if (len < 2 || offset + 2 + len > a.length) throw new Error('JPEG inválido.');
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        height = d.getUint16(offset + 5);
        width = d.getUint16(offset + 7);
        break;
      }
      offset += 2 + len;
    }
  } else if (text(a, 0, 4) === 'RIFF' && text(a, 8, 4) === 'WEBP' && d.getUint32(4, true) + 8 === a.length) {
    mime = 'image/webp';
    const format = text(a, 12, 4);
    if (format === 'VP8X' && a.length >= 30) {
      if (a[20] & 2) throw new Error('Imagens animadas não são aceitas.');
      width = 1 + a[24] + (a[25] << 8) + (a[26] << 16);
      height = 1 + a[27] + (a[28] << 8) + (a[29] << 16);
    } else if (format === 'VP8 ' && a.length >= 30 && a[23] === 0x9d && a[24] === 1 && a[25] === 0x2a) {
      width = d.getUint16(26, true) & 0x3fff;
      height = d.getUint16(28, true) & 0x3fff;
    } else if (format === 'VP8L' && a.length >= 25 && a[20] === 0x2f) {
      const bits = d.getUint32(21, true);
      width = (bits & 0x3fff) + 1;
      height = ((bits >> 14) & 0x3fff) + 1;
    }
  } else throw new Error('Formato não permitido. Use PNG, JPEG ou WebP.');
  if (!width || !height || width > 10000 || height > 40000 || width * height > 40_000_000)
    throw new Error('Dimensões inválidas ou imagem muito grande.');
  return { mime, width, height };
}
