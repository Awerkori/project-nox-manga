import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { inspectImage } from '$lib/media-validation';
import { TelegramStorageError } from '$lib/server/telegram';
import { uploadToStorageSupremo } from '$lib/server/storage-router';

/** Thrown when Telegram returns 429 FloodWait. The caller must convert to a proper 429 Response. */
export class RateLimitError extends Error {
  constructor(readonly retryAfter: number) {
    super('Telegram rate limit');
  }
}

export async function storeImage(input: Request | FormData, userId: string, defaultPurpose = 'editorial') {
  let purpose = defaultPurpose;
  let scanId: string | undefined;
  let chapterId: string | undefined;
  let workId: string | undefined;
  let accessClass: 'PUBLIC' | 'AUTHENTICATED' | 'STAFF_ONLY' | 'SCAN_MEMBER' | 'ADMIN_ONLY' | 'STAGING' = 'PUBLIC';

  const max = 52_428_800;
  let bytes: Uint8Array;
  let size = 0;

  if (input instanceof FormData) {
    const formData = input;
    const purposeField = formData.get('purpose');
    if (typeof purposeField === 'string' && purposeField.trim()) {
      purpose = purposeField.trim();
    }
    const scanIdField = formData.get('scan_id');
    if (typeof scanIdField === 'string' && scanIdField.trim()) {
      scanId = scanIdField.trim();
    }
    const chapterIdField = formData.get('chapter_id');
    if (typeof chapterIdField === 'string' && chapterIdField.trim()) {
      chapterId = chapterIdField.trim();
    }
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) error(400, 'Selecione uma imagem.');
    if (file.size > max) error(413, 'Imagem acima do limite permitido.');
    size = file.size;
    const arrayBuffer = await file.arrayBuffer();
    bytes = new Uint8Array(arrayBuffer as ArrayBuffer);
  } else {
    const request = input;
    purpose = request.headers.get('x-media-purpose') || defaultPurpose;
    scanId = request.headers.get('x-scan-id') || undefined;
    chapterId = request.headers.get('x-chapter-id') || undefined;
    workId = request.headers.get('x-work-id') || undefined;
    accessClass = (request.headers.get('x-access-class') as any) || 'PUBLIC';

    const rawContentType = request.headers.get('content-type')?.toLowerCase() || '';
    const isMultipart = rawContentType.includes('multipart/form-data');

    if (isMultipart) {
      const formData = await request.formData();
      const purposeField = formData.get('purpose');
      if (typeof purposeField === 'string' && purposeField.trim()) {
        purpose = purposeField.trim();
      }
      const scanIdField = formData.get('scan_id');
      if (typeof scanIdField === 'string' && scanIdField.trim()) {
        scanId = scanIdField.trim();
      }
      const chapterIdField = formData.get('chapter_id');
      if (typeof chapterIdField === 'string' && chapterIdField.trim()) {
        chapterId = chapterIdField.trim();
      }
      const file = formData.get('file');
      if (!file || !(file instanceof Blob)) error(400, 'Selecione uma imagem.');
      if (file.size > max) error(413, 'Imagem acima do limite permitido.');
      size = file.size;
      const arrayBuffer = await file.arrayBuffer();
      bytes = new Uint8Array(arrayBuffer as ArrayBuffer);
    } else {
      const reader = request.body?.getReader();
      if (!reader) error(400, 'Selecione uma imagem.');
      const parts: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > max) {
          await reader.cancel();
          error(413, 'Imagem acima do limite permitido.');
        }
        parts.push(value);
      }
      bytes = new Uint8Array(size);
      let offset = 0;
      for (const part of parts) {
        bytes.set(part, offset);
        offset += part.length;
      }
    }
  }

  if (defaultPurpose === 'staff_manual' && (!purpose || purpose === 'editorial')) {
    purpose = 'staff_manual';
  }

  let info;
  try {
    info = inspectImage(bytes);
  } catch (e) {
    error(400, (e as Error).message);
  }

  try {
    const stored = await uploadToStorageSupremo({
      bytes,
      mime: info.mime,
      purpose,
      userId,
      scanId,
      chapterId,
      workId,
      accessClass
    });
    return { id: stored.id, ...info, bytes: size };
  } catch (failure) {
    if (failure instanceof RateLimitError) throw failure;
    if (failure instanceof TelegramStorageError && failure.status === 429) {
      throw new RateLimitError(failure.retryAfter && failure.retryAfter > 0 ? failure.retryAfter : 15);
    }
    error(502, (failure as Error).message || 'Não foi possível armazenar a imagem. Tente novamente.');
  }
}
