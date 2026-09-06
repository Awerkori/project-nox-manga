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
