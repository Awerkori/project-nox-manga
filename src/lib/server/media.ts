import { error } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import { inspectImage } from '$lib/media-validation';
import { telegramStorage, TelegramStorageError } from '$lib/server/telegram';

/** Thrown when Telegram returns 429 FloodWait. The caller must convert to a proper 429 Response. */
export class RateLimitError extends Error {
  constructor(readonly retryAfter: number) {
    super('Telegram rate limit');
  }
}

export async function storeImage(request: Request, userId: string, purpose = 'editorial') {
  const rawContentType = request.headers.get('content-type')?.toLowerCase() || '';
  const isMultipart = rawContentType.includes('multipart/form-data');
  const max = purpose === 'avatar' ? 10_000_000 : purpose === 'banner' ? 15_000_000 : 19_000_000;
  let bytes: Uint8Array;
  let size = 0;

  if (isMultipart) {
    const formData = await request.formData();
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

  let info;
  try {
    info = inspectImage(bytes);
  } catch (e) {
    error(400, (e as Error).message);
  }
  const cleanContentType = rawContentType.split(';')[0].trim();
  if (!isMultipart && cleanContentType && cleanContentType !== info.mime)
    error(400, 'O conteúdo não corresponde ao formato informado.');
  const db = privileged(),
    id = crypto.randomUUID();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
  const provider =
    env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID && purpose === 'editorial' ? 'telegram' : 'supabase';
  const { error: reservation } = await db.rpc('reserve_media', {
    p_id: id,
    p_user: userId,
    p_provider: provider,
    p_mime: info.mime,
    p_width: info.width,
    p_height: info.height,
    p_bytes: size,
    p_sha256: hash,
    p_purpose: purpose
  });
  if (reservation) error(400, reservation.message);
  let key: string = id;
  try {
    if (provider === 'telegram') {
      if (!env.TELEGRAM_CHAT_ID || !env.TELEGRAM_BOT_TOKEN)
        throw new Error('Armazenamento Telegram não configurado.');
      key = await telegramStorage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID).upload(bytes as unknown as Uint8Array<ArrayBuffer>, info.mime, id);
    } else {
      const { error: problem } = await db.storage
        .from('nox-media')
        .upload(id, bytes as unknown as ArrayBuffer, { contentType: info.mime, upsert: false });
      if (problem) throw new Error('Não foi possível armazenar a imagem.');
    }
    const { error: problem } = await db
      .from('media')
      .update({ provider_key: key, storage_ready: true })
      .eq('id', id);
    if (problem) throw new Error('Não foi possível registrar a imagem.');
    return { id, ...info, bytes: size };
  } catch (failure) {
    // Log only our own fixed diagnostic labels; upstream errors can contain credentials.
    const isTg = failure instanceof TelegramStorageError;
    console.warn('media_upload_failed', {
      provider,
      stage: isTg ? failure.stage : 'storage_record',
      status: isTg ? failure.status : undefined,
      retryAfter: isTg ? failure.retryAfter : undefined
    });
    // Clean up the reservation on permanent failures.
    if (provider === 'supabase') {
      const { error: cleanup } = await db.storage.from('nox-media').remove([id]);
      if (!cleanup) await db.from('media').delete().eq('id', id);
    } else if (key === id) await db.from('media').delete().eq('id', id);
    // Propagate 429 FloodWait so the caller can return a proper Retry-After response.
    if (isTg && failure.status === 429) {
      throw new RateLimitError(failure.retryAfter && failure.retryAfter > 0 ? failure.retryAfter : 15);
    }
    error(502, 'Não foi possível armazenar a imagem. Tente novamente.');
  }
}
