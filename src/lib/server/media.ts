import { error } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
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

  let info;
  try {
    info = inspectImage(bytes);
  } catch (e) {
    error(400, (e as Error).message);
  }

  // Route through Storage Supremo if Telegram storage is configured
  if (env.TELEGRAM_BOT_TOKEN || (env as any).TELEGRAM_BOT_MANGA_STORAGE_01) {
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

  // Fallback to Supabase Storage if Telegram is completely absent
  const db = privileged();
  const id = crypto.randomUUID();
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)),
    (b) => b.toString(16).padStart(2, '0')
  ).join('');

  const { error: reservation } = await db.rpc('reserve_media', {
    p_id: id,
    p_user: userId,
    p_provider: 'supabase',
    p_mime: info.mime,
    p_width: info.width,
    p_height: info.height,
    p_bytes: size,
    p_sha256: hash,
    p_purpose: purpose
  });
  if (reservation) error(400, reservation.message);

  try {
    const { error: problem } = await db.storage
      .from('nox-media')
      .upload(id, bytes as unknown as ArrayBuffer, { contentType: info.mime, upsert: false });
    if (problem) throw new Error('Não foi possível armazenar a imagem.');

    const { error: updateErr } = await db
      .from('media')
      .update({ provider_key: id, storage_ready: true })
      .eq('id', id);
    if (updateErr) throw new Error('Não foi possível registrar a imagem.');

    return { id, ...info, bytes: size };
  } catch (failure) {
    await db.storage.from('nox-media').remove([id]);
    await db.from('media').delete().eq('id', id);
    error(502, 'Não foi possível armazenar a imagem. Tente novamente.');
  }
}
