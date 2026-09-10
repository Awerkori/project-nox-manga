import { Unzip, AsyncUnzipInflate, type UnzipFile } from 'fflate';
import { inspectImage } from '$lib/media-validation';
export async function normalizePage(file: File): Promise<Blob> {
  if (file.size > 19_000_000) throw new Error(`${file.name}: limite de 19 MB por página.`);
  // Check dimensions before allocating a decoded bitmap, not only after decoding.
  inspectImage(new Uint8Array(await file.arrayBuffer()));
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`${file.name}: imagem corrompida ou formato não suportado.`);
  });
  if (bitmap.width * bitmap.height > 80_000_000 || bitmap.height > 60000 || bitmap.width > 10000) {
    bitmap.close();
    throw new Error(`${file.name}: dimensões acima do limite.`);
  }
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Não foi possível processar a imagem.');
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  // Re-encode pixels to strip executable metadata and normalize the uploaded MIME.
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Falha ao processar imagem.'))),
      'image/webp',
      0.92
    )
  );
  canvas.width = 1;
  canvas.height = 1;
  return blob;
}

/**
 * Normalizes cover images. For GIF files, bypasses canvas re-encoding
 * so that animation frames and byte sequence are fully preserved.
 * For static images (PNG, JPEG, WebP), delegates to normalizePage.
 */
export async function normalizeCover(file: File): Promise<Blob> {
  if (file.size > 19_000_000) throw new Error(`${file.name}: limite de 19 MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = inspectImage(bytes);
  if (info.mime === 'image/gif') {
    return new Blob([bytes], { type: 'image/gif' });
  }
  return normalizePage(file);
}

export async function expandFiles(input: File[]): Promise<File[]> {
  const result: File[] = [];
  let total = 0;
  for (const file of input) {
    if (!/\.zip$/i.test(file.name)) {
      if (!/\.(png|jpe?g|webp)$/i.test(file.name) || file.size > 19_000_000)
        throw new Error('Selecione páginas PNG, JPEG ou WebP de até 19 MB.');
      result.push(file);
      total += file.size;
      if (result.length > 500 || total > 400_000_000)
        throw new Error('Selecione até 500 páginas e 400 MB por capítulo.');
      continue;
    }
    if (file.size > 300_000_000) throw new Error('O ZIP deve ter no máximo 300 MB.');
    await new Promise<void>((resolve, reject) => {
      let pending = 0,
        streamDone = false,
        failed = false;
      const active = new Set<UnzipFile>();
      const abort = (message: string) => {
        if (failed) return;
        failed = true;
        for (const entry of active) entry.terminate();
        active.clear();
        reject(new Error(message));
      };
      const complete = () => {
        if (streamDone && pending === 0 && !failed) resolve();
      };
      const unzip = new Unzip((entry) => {
        if (failed) return;
        if (entry.name.endsWith('/') || entry.name.startsWith('__MACOSX/')) return;
        if (
          !/\.(png|jpe?g|webp)$/i.test(entry.name) ||
          entry.name.split('/').includes('..') ||
          entry.name.includes('\\') ||
          entry.name.startsWith('/')
        ) {
          abort('O ZIP deve conter somente imagens PNG, JPEG ou WebP.');
          return;
        }
        if (entry.originalSize !== undefined && entry.originalSize > 19_000_000) {
          abort('Uma página do ZIP excede 19 MB.');
          return;
        }
        pending++;
        active.add(entry);
        let size = 0;
        const chunks: Uint8Array[] = [];
        entry.ondata = (problem, chunk, final) => {
          if (failed) return;
          if (problem) {
            abort('ZIP corrompido.');
            return;
          }
          size += chunk.length;
          total += chunk.length;
          if (size > 19_000_000 || total > 400_000_000 || result.length + pending > 500) {
            abort('Limite de 500 páginas, 19 MB por página ou 400 MB descompactados excedido.');
            return;
          }
          chunks.push(chunk);
          if (final) {
            active.delete(entry);
            result.push(new File(chunks as BlobPart[], entry.name.split('/').at(-1)!));
            pending--;
            complete();
          }
        };
        entry.start();
      });
      unzip.register(AsyncUnzipInflate);
      (async () => {
        const reader = file.stream().getReader();
        try {
          while (!failed) {
            const { value, done } = await reader.read();
            if (done) {
              unzip.push(new Uint8Array(), true);
              streamDone = true;
              complete();
              break;
            }
            unzip.push(value);
          }
          if (failed) await reader.cancel();
        } catch {
          abort('Não foi possível abrir o ZIP.');
        }
      })();
    });
  }
  if (result.length > 500 || total > 400_000_000)
    throw new Error('Selecione até 500 páginas e 400 MB por capítulo.');
  if (!result.length) throw new Error('Nenhuma página encontrada. Selecione imagens ou um ZIP com páginas.');
  return result.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }));
}

export interface DetectedChapter {
  folder: string;
  number: number;
  title: string;
  files: File[];
}

export function parseChapterNumber(name: string, fallbackIndex = 1): number {
  const clean = name.trim();
  const match = clean.match(/(?:cap[ií]tulo|cap\.?|c|ch\.?|chapter)?\s*(\d+(?:\.\d+)?)/i);
  if (match && match[1]) {
    const num = parseFloat(match[1]);
    if (!isNaN(num)) return num;
  }
  return fallbackIndex;
}

export async function extractChaptersFromZip(file: File): Promise<DetectedChapter[]> {
  if (!/\.zip$/i.test(file.name)) {
    throw new Error('Selecione um arquivo .zip');
  }
  if (file.size > 800_000_000) {
    throw new Error('O arquivo ZIP excede o limite de 800 MB.');
  }

  const rawEntries: { path: string; chunks: Uint8Array[] }[] = [];

  await new Promise<void>((resolve, reject) => {
    let pending = 0;
    let streamDone = false;
    let failed = false;
    const active = new Set<UnzipFile>();

    const abort = (msg: string) => {
      if (failed) return;
      failed = true;
      for (const entry of active) entry.terminate();
      active.clear();
      reject(new Error(msg));
    };

    const complete = () => {
      if (streamDone && pending === 0 && !failed) resolve();
    };

    const unzip = new Unzip((entry) => {
      if (failed) return;
      if (entry.name.endsWith('/') || entry.name.startsWith('__MACOSX/')) return;
      if (
        !/\.(png|jpe?g|webp)$/i.test(entry.name) ||
        entry.name.split('/').includes('..') ||
        entry.name.includes('\\') ||
        entry.name.startsWith('/')
      ) {
        return;
      }
      pending++;
      active.add(entry);
      const chunks: Uint8Array[] = [];
      entry.ondata = (problem, chunk, final) => {
        if (failed) return;
        if (problem) {
          abort('Arquivo ZIP corrompido.');
          return;
        }
        chunks.push(chunk);
        if (final) {
          active.delete(entry);
          rawEntries.push({ path: entry.name, chunks });
          pending--;
          complete();
        }
      };
      entry.start();
    });

    unzip.register(AsyncUnzipInflate);

    (async () => {
      const reader = file.stream().getReader();
      try {
        while (!failed) {
          const { value, done } = await reader.read();
          if (done) {
            unzip.push(new Uint8Array(), true);
            streamDone = true;
            complete();
            break;
          }
          unzip.push(value);
        }
        if (failed) await reader.cancel();
      } catch {
        abort('Não foi possível ler o arquivo ZIP.');
      }
    })();
  });

  if (!rawEntries.length) {
    throw new Error('Nenhuma imagem válida (PNG, JPG, WebP) encontrada no arquivo ZIP.');
  }

  const pathParts = rawEntries.map((e) => e.path.split('/'));
  const hasSubfolders = pathParts.some((p) => p.length > 1);

  if (!hasSubfolders) {
    const files = rawEntries.map((e) => new File(e.chunks as BlobPart[], e.path));
    files.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }));
    return [
      {
        folder: 'Raiz',
        number: parseChapterNumber(file.name.replace(/\.zip$/i, ''), 1),
        title: '',
        files
      }
    ];
  }

  const firstSegment = pathParts[0][0];
  const allShareFirst = pathParts.every((p) => p.length > 1 && p[0] === firstSegment);
  const normalizedEntries = rawEntries.map((e) => {
    let parts = e.path.split('/');
    if (allShareFirst && parts.length > 2) {
      parts = parts.slice(1);
    }
    return {
      folder: parts.length > 1 ? parts[0] : 'Raiz',
      filename: parts.at(-1)!,
      chunks: e.chunks
    };
  });

  const groups = new Map<string, File[]>();
  for (const item of normalizedEntries) {
    let list = groups.get(item.folder);
    if (!list) {
      list = [];
      groups.set(item.folder, list);
    }
    list.push(new File(item.chunks as BlobPart[], item.filename));
  }

  const result: DetectedChapter[] = [];
  let index = 1;
  for (const [folder, files] of groups.entries()) {
    files.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }));
    const chapterNum = parseChapterNumber(folder, index++);
    result.push({
      folder,
      number: chapterNum,
      title: '',
      files
    });
  }

  result.sort((a, b) => a.number - b.number);
  return result;
}
