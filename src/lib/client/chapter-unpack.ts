import * as fflate from 'fflate';

export interface UnpackedPage {
  index: number; // 1-based index
  filename: string;
  bytes: Uint8Array;
  mimeType: string;
  size: number;
  previewUrl?: string;
  status: 'IDLE' | 'UPLOADING' | 'STORED' | 'FAILED';
  progress: number; // 0..100
  mediaId?: string;
  telegramFileId?: string;
  error?: string;
  speedMBs?: number;
}

export interface BatchChapterItem {
  id: string; // unique client id
  file?: File;
  name: string;
  detectedNumber: number | null;
  chapterNumber: number;
  chapterTitle: string;
  volume: string;
  pages: UnpackedPage[];
  status: 'READY' | 'UPLOADING' | 'COMMITTING' | 'PUBLISHED' | 'FAILED' | 'CONFLICT' | 'SKIPPED';
  progress: number; // 0..100
  totalPages: number;
  completedPages: number;
  failedPages: number;
  speedMBs: number;
  etaSeconds: number;
  errorMessage?: string;
  conflictMessage?: string;
  sessionId?: string | null;
  uploadPool?: any; // UploadPool reference
  publishedChapter?: { id: string; number: number; slug?: string } | null;
  replaceExisting: boolean;
}

const VALID_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'application/octet-stream';
}

export function isImageFile(filename: string): boolean {
  if (filename.startsWith('__MACOSX') || filename.includes('/.') || filename.startsWith('.')) {
    return false;
  }
  const clean = filename.toLowerCase();
  if (clean.endsWith('thumbs.db') || clean.endsWith('.ds_store')) return false;
  const ext = clean.split('.').pop() || '';
  return VALID_IMAGE_EXTS.has(ext);
}

/**
 * Natural alphabetical / numerical sort (e.g. 1, 2, ..., 10, 11)
 */
export function naturalSortFilenames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Detects chapter number from filename (e.g. "Capítulo 1189.cbz", "cap-1189.zip", "c1189.cbz", "1190.zip").
 */
export function detectChapterNumber(filename: string): number | null {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '').trim();

  // Pattern 1: explicit prefix followed by number
  // e.g. "Capítulo 1189", "cap-1189", "c1189", "ch. 42", "Chapter 12.5"
  const prefixMatch = nameWithoutExt.match(/(?:cap(?:[íi]tulo)?|ch(?:apter)?|\bc)[-_\s]*([0-9]+(?:\.[0-9]+)?)/i);
  if (prefixMatch && prefixMatch[1]) {
    const val = parseFloat(prefixMatch[1]);
    if (!isNaN(val)) return val;
  }

  // Pattern 2: isolated number surrounded by word boundaries, spaces, dashes, or underscores
  // e.g. "1190.zip", "1190.cbz", "One Piece - 1190"
  const isolatedMatch = nameWithoutExt.match(/(?:^|[-_\s])([0-9]+(?:\.[0-9]+)?)(?:$|[-_\s])/);
  if (isolatedMatch && isolatedMatch[1]) {
    const val = parseFloat(isolatedMatch[1]);
    if (!isNaN(val)) return val;
  }

  // Pattern 3: any number in the string
  const anyNumMatch = nameWithoutExt.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (anyNumMatch && anyNumMatch[1]) {
    const val = parseFloat(anyNumMatch[1]);
    if (!isNaN(val)) return val;
  }

  return null;
}

/**
 * Classifies dropped files into archives and/or loose images.
 */
export function classifyDroppedFiles(files: File[]): {
  isBatch: boolean;
  isLooseImages: boolean;
  archives: File[];
  looseImages: File[];
} {
  const archives: File[] = [];
  const looseImages: File[] = [];

  for (const f of files) {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'zip' || ext === 'cbz') {
      archives.push(f);
    } else if (VALID_IMAGE_EXTS.has(ext)) {
      looseImages.push(f);
    }
  }

  // Natural sort archives
  archives.sort((a, b) => naturalSortFilenames(a.name, b.name));
  looseImages.sort((a, b) => naturalSortFilenames(a.name, b.name));

  const isBatch = archives.length > 1;
  const isLooseImages = archives.length === 0 && looseImages.length > 0;

  return { isBatch, isLooseImages, archives, looseImages };
}

/**
 * Extracts and unpacks a single ZIP or CBZ archive into ordered UnpackedPage list.
 */
export async function unpackArchive(file: File): Promise<UnpackedPage[]> {
  const buffer = await file.arrayBuffer();
  const unzipped = fflate.unzipSync(new Uint8Array(buffer), {
    filter(fileInfo) {
      return isImageFile(fileInfo.name);
    }
  });

  const extractedNames = Object.keys(unzipped).filter(isImageFile).sort(naturalSortFilenames);
  if (extractedNames.length === 0) {
    throw new Error(`Nenhuma imagem válida encontrada no arquivo ${file.name}`);
  }

  return extractedNames.map((name, idx) => {
    const bytes = unzipped[name];
    const mimeType = getMimeType(name);
    let previewUrl: string | undefined;
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      try {
        const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
        previewUrl = URL.createObjectURL(blob);
      } catch {}
    }
    return {
      index: idx + 1,
      filename: name.split('/').pop() || name,
      bytes,
      mimeType,
      size: bytes.byteLength,
      previewUrl,
      status: 'IDLE',
      progress: 0
    };
  });
}

/**
 * Converts an array of loose image files into ordered UnpackedPage list.
 */
export async function unpackImages(files: File[]): Promise<UnpackedPage[]> {
  const imageFiles = files.filter(f => isImageFile(f.name)).sort((a, b) => naturalSortFilenames(a.name, b.name));
  if (imageFiles.length === 0) {
    throw new Error('Nenhuma imagem válida encontrada.');
  }

  const pages: UnpackedPage[] = [];
  for (let idx = 0; idx < imageFiles.length; idx++) {
    const file = imageFiles[idx];
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const mimeType = file.type || getMimeType(file.name);
    let previewUrl: string | undefined;
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      try {
        const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
        previewUrl = URL.createObjectURL(blob);
      } catch {}
    }
    pages.push({
      index: idx + 1,
      filename: file.name,
      bytes,
      mimeType,
      size: bytes.byteLength,
      previewUrl,
      status: 'IDLE',
      progress: 0
    });
  }
  return pages;
}

/**
 * Extracts and unpacks ZIP / CBZ / Image files into ordered UnpackedPage list (backward compatibility).
 */
export async function unpackChapterFiles(files: File[]): Promise<UnpackedPage[]> {
  const rawPages: { filename: string; bytes: Uint8Array; mimeType: string }[] = [];

  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (ext === 'zip' || ext === 'cbz') {
      const buffer = await file.arrayBuffer();
      const unzipped = fflate.unzipSync(new Uint8Array(buffer), {
        filter(fileInfo) {
          return isImageFile(fileInfo.name);
        }
      });

      const extractedNames = Object.keys(unzipped).filter(isImageFile).sort(naturalSortFilenames);

      for (const name of extractedNames) {
        const bytes = unzipped[name];
        rawPages.push({
          filename: name.split('/').pop() || name,
          bytes,
          mimeType: getMimeType(name)
        });
      }
    } else if (VALID_IMAGE_EXTS.has(ext)) {
      const buffer = await file.arrayBuffer();
      rawPages.push({
        filename: file.name,
        bytes: new Uint8Array(buffer),
        mimeType: file.type || getMimeType(file.name)
      });
    }
  }

  // Sort all detected images naturally
  rawPages.sort((a, b) => naturalSortFilenames(a.filename, b.filename));

  // Map to UnpackedPage with 1-based index and preview URL
  return rawPages.map((page, idx) => {
    let previewUrl: string | undefined;
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      try {
        const blob = new Blob([page.bytes as unknown as BlobPart], { type: page.mimeType });
        previewUrl = URL.createObjectURL(blob);
      } catch {}
    }

    return {
      index: idx + 1,
      filename: page.filename,
      bytes: page.bytes,
      mimeType: page.mimeType,
      size: page.bytes.byteLength,
      previewUrl,
      status: 'IDLE',
      progress: 0
    };
  });
}
