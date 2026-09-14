import { expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { expandFiles, normalizePage } from '../src/lib/uploads';

const png = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64'
  )
);
const archive = (entries: Record<string, Uint8Array>) =>
  new File([zipSync(entries, { level: 0 })], 'chapter.zip');

it('extracts real image entries and applies natural page ordering', async () => {
  const pages = await expandFiles([archive({ '10.png': png, '2.png': png, '1.png': png })]);
  expect(pages.map((f) => f.name)).toEqual(['1.png', '2.png', '10.png']);
  expect(new Uint8Array(await pages[0].arrayBuffer())).toEqual(png);
});

it.each(['../raw.png', '/private.png', '..\\private.png', 'script.svg', 'program.exe'])(
  'rejects unsafe ZIP entry %s',
  async (name) => {
    await expect(expandFiles([archive({ [name]: png })])).rejects.toThrow();
  }
);

it('rejects empty archives, oversized selections and nonimage files', async () => {
  await expect(expandFiles([archive({})])).rejects.toThrow('Nenhuma página');
  await expect(
    expandFiles(Array.from({ length: 501 }, (_, n) => new File([png], `${n}.png`)))
  ).rejects.toThrow('500 páginas');
  await expect(expandFiles([new File(['<script>'], 'payload.html')])).rejects.toThrow('PNG');
});

it('rejects executable payloads and impossible dimensions before bitmap decoding', async () => {
  await expect(normalizePage(new File(['<svg><script/></svg>'], 'fake.png'))).rejects.toThrow();
  const enormous = png.slice();
  new DataView(enormous.buffer).setUint32(16, 100_000);
  await expect(normalizePage(new File([enormous], 'huge.png'))).rejects.toThrow('Dimensões');
});

it('accepts and extracts .cbz comic book archives with natural ordering', async () => {
  const cbzArchive = new File([zipSync({ '02.png': png, '01.png': png, '10.png': png }, { level: 0 })], 'comic.cbz', {
    type: 'application/vnd.comicbook+zip'
  });
  const pages = await expandFiles([cbzArchive]);
  expect(pages.map((p) => p.name)).toEqual(['01.png', '02.png', '10.png']);
  expect(pages.length).toBe(3);
});

it('silently ignores __MACOSX, .DS_Store, Thumbs.db and desktop.ini without aborting extraction', async () => {
  const archiveWithJunk = new File(
    [
      zipSync(
        {
          '__MACOSX/._page1.png': new Uint8Array([0, 1, 2]),
          '.DS_Store': new Uint8Array([0, 1, 2]),
          'Thumbs.db': new Uint8Array([0, 1, 2]),
          'desktop.ini': new Uint8Array([0, 1, 2]),
          'chapter/01.png': png,
          'chapter/02.png': png
        },
        { level: 0 }
      )
    ],
    'dirty_chapter.zip'
  );
  const pages = await expandFiles([archiveWithJunk]);
  expect(pages.map((p) => p.name)).toEqual(['01.png', '02.png']);
  expect(pages.length).toBe(2);
});

it('supports .avif files both directly and inside zip/cbz archives', async () => {
  const avifBytes = new Uint8Array([1, 2, 3]);
  const archiveWithAvif = new File(
    [
      zipSync(
        {
          '01.avif': avifBytes,
          '02.webp': png
        },
        { level: 0 }
      )
    ],
    'avif_chapter.cbz'
  );
  const pages = await expandFiles([archiveWithAvif]);
  expect(pages.map((p) => p.name)).toEqual(['01.avif', '02.webp']);
  expect(pages.length).toBe(2);
});

