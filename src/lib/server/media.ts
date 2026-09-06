import { error } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import { inspectImage } from '$lib/media-validation';
import { telegramStorage } from '$lib/server/telegram';
export async function storeImage(request: Request, userId: string, purpose = 'editorial') {
  const reader = request.body?.getReader();
  if (!reader) error(400, 'Selecione uma imagem.');
  const parts: Uint8Array[] = [];
  let size = 0;
  const max = purpose === 'avatar' ? 300_000 : 19_000_000;
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
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  let info;
  try {
    info = inspectImage(bytes);
  } catch (e) {
    error(400, (e as Error).message);
  }
  if (request.headers.get('content-type') !== info.mime)
    error(400, 'O conteúdo não corresponde ao formato informado.');
  const db = privileged(),
    id = crypto.randomUUID();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
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
      key = await telegramStorage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID).upload(bytes, info.mime, id);
    } else {
      const { error: problem } = await db.storage
        .from('nox-media')
        .upload(id, bytes, { contentType: info.mime, upsert: false });
      if (problem) throw new Error('Não foi possível armazenar a imagem.');
    }
    const { error: problem } = await db
      .from('media')
      .update({ provider_key: key, storage_ready: true })
      .eq('id', id);
    if (problem) throw new Error('Não foi possível registrar a imagem.');
    return { id, ...info, bytes: size };
  } catch {
    // Keep the reservation if cleanup fails; this prevents orphaned bytes bypassing the free quota.
    if (provider === 'supabase') {
      const { error: cleanup } = await db.storage.from('nox-media').remove([id]);
      if (!cleanup) await db.from('media').delete().eq('id', id);
    } else if (key === id) await db.from('media').delete().eq('id', id);
    error(502, 'Não foi possível armazenar a imagem. Tente novamente.');
  }
}
