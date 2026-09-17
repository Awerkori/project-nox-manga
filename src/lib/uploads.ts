import { Unzip, AsyncUnzipInflate, type UnzipFile } from 'fflate';
import { inspectImage } from '$lib/media-validation';
export async function normalizePage(file: File): Promise<Blob> {
  if (file.size > 19_000_000) throw new Error(`${file.name}: limite de 19 MB por pgina.`);
  // Check dimensions before allocating a decoded bitmap, not only after decoding.
  inspectImage(new Uint8Array(await file.arrayBuffer()));
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`${file.name}: imagem corrompida ou formato no suportado.`);
  });
  if (bitmap.width * bitmap.height > 80_000_000 || bitmap.height > 60000 || bitmap.width > 10000) {
    bitmap.close();
    throw new Error(`${file.name}: dimenses acima do limite.`);
  }
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('No foi possvel processar a imagem.');
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

export const SUPPORTED_IMAGE_REGEX = /\.(png|jpe?g|webp|avif)$/i;
export const DANGEROUS_EXT_REGEX = /\.(exe|svg|sh|bat|cmd|com|vbs|js|html|htm|php|py|bin|dll|so|app)$/i;

export async function isZipOrCbzFile(file: File): Promise<boolean> {
  if (/\.(zip|cbz)$/i.test(file.name)) return true;
  if (
    [
      'application/zip',
      'application/x-zip-compressed',
      'application/vnd.comicbook+zip',
      'application/x-cbz'
    ].includes(file.type)
  ) {
    return true;
  }
  try {
    const slice = await file.slice(0, 4).arrayBuffer();
    const bytes = new Uint8Array(slice);
    return (
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
        (bytes[2] === 0x05 && bytes[3] === 0x06) ||
        (bytes[2] === 0x07 && bytes[3] === 0x08))
    );
  } catch {
    return false;
  }
}

export async function expandFiles(input: File[]): Promise<File[]> {
  const result: File[] = [];
  let total = 0;
  for (const file of input) {
    const isArchive = await isZipOrCbzFile(file);
    if (!isArchive) {
      if (!SUPPORTED_IMAGE_REGEX.test(file.name) || file.size > 19_000_000)
        throw new Error('Selecione pginas PNG, JPEG, WebP ou AVIF de at 19 MB.');
      result.push(file);
      total += file.size;
      if (result.length > 500 || total > 400_000_000)
        throw new Error('Selecione at 500 pginas e 400 MB por captulo.');
      continue;
    }

    if (file.size > 400_000_000) throw new Error('O arquivo compactado deve ter no mximo 400 MB.');
    const extractedBefore = result.length;

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

        // Skip directories and common OS junk files
        if (entry.name.endsWith('/')) return;
        if (
          entry.name.includes('__MACOSX') ||
          entry.name.split('/').some((p) => p.startsWith('.') || p === 'Thumbs.db' || p === 'desktop.ini')
        ) {
          return;
        }

        // Guard against directory traversal attacks and dangerous payloads
        if (
          entry.name.split('/').includes('..') ||
          entry.name.includes('\\') ||
          entry.name.startsWith('/') ||
          DANGEROUS_EXT_REGEX.test(entry.name)
        ) {
          abort('O arquivo compactado contm entradas invlidas ou no permitidas.');
          return;
        }

        // If harmless non-image file (e.g. metadata or text), skip silently
        if (!SUPPORTED_IMAGE_REGEX.test(entry.name)) {
          return;
        }

        if (entry.originalSize !== undefined && entry.originalSize > 19_000_000) {
          abort('Uma pgina do arquivo compactado excede 19 MB.');
          return;
        }

        pending++;
        active.add(entry);
        let size = 0;
        const chunks: Uint8Array[] = [];
        entry.ondata = (problem, chunk, final) => {
          if (failed) return;
          if (problem) {
            abort('Arquivo compactado corrompido.');
            return;
          }
          size += chunk.length;
          total += chunk.length;
          if (size > 19_000_000 || total > 400_000_000 || result.length + pending > 500) {
            abort('Limite de 500 pginas, 19 MB por pgina ou 400 MB descompactados excedido.');
            return;
          }
          chunks.push(chunk);
          if (final) {
            active.delete(entry);
            const cleanName = entry.name.split('/').filter(Boolean).pop() || entry.name;
            result.push(new File(chunks as BlobPart[], cleanName));
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
          abort('No foi possvel abrir o arquivo compactado.');
        }
      })();
    });

    if (result.length === extractedBefore) {
      throw new Error(`Nenhuma pgina ou imagem vlida (.png, .jpg, .webp, .avif) encontrada no arquivo ${file.name}.`);
    }
  }
  if (result.length > 500 || total > 400_000_000)
    throw new Error('Selecione at 500 pginas e 400 MB por captulo.');
  if (!result.length)
    throw new Error('Nenhuma pgina encontrada. Selecione imagens ou um arquivo ZIP/CBZ com pginas.');
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
  const match = clean.match(/(?:cap[i]tulo|cap\.?|c|ch\.?|chapter)?\s*(\d+(?:\.\d+)?)/i);
  if (match && match[1]) {
    const num = parseFloat(match[1]);
    if (!isNaN(num)) return num;
  }
  return fallbackIndex;
}

export async function extractChaptersFromZip(file: File): Promise<DetectedChapter[]> {
  const isArchive = await isZipOrCbzFile(file);
  if (!isArchive) {
    throw new Error('Selecione um arquivo .zip ou .cbz');
  }
  if (file.size > 800_000_000) {
    throw new Error('O arquivo compactado excede o limite de 800 MB.');
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
      if (entry.name.endsWith('/')) return;
      if (
        entry.name.includes('__MACOSX') ||
        entry.name.split('/').some((p) => p.startsWith('.') || p === 'Thumbs.db' || p === 'desktop.ini')
      ) {
        return;
      }
      if (
        entry.name.split('/').includes('..') ||
        entry.name.includes('\\') ||
        entry.name.startsWith('/') ||
        DANGEROUS_EXT_REGEX.test(entry.name)
      ) {
        return;
      }
      if (!SUPPORTED_IMAGE_REGEX.test(entry.name)) {
        return;
      }
      pending++;
      active.add(entry);
      const chunks: Uint8Array[] = [];
      entry.ondata = (problem, chunk, final) => {
        if (failed) return;
        if (problem) {
          abort('Arquivo compactado corrompido.');
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
        abort('No foi possvel ler o arquivo compactado.');
      }
    })();
  });

  if (!rawEntries.length) {
    throw new Error('Nenhuma imagem vlida (PNG, JPG, WebP, AVIF) encontrada no arquivo compactado.');
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
