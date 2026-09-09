import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { telegramStorage, TelegramStorageError } from '$lib/server/telegram';
import { inspectImage } from '$lib/media-validation';
import { readRequestBytes } from '$lib/server/request-body';
import type { RequestHandler } from './$types';

// In-memory sliding-window rate limiter (120 requests / 60 seconds per IP)
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string, limit = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    rateLimitMap.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return true;
}

function safeTokenCompare(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(provided);
  const b = encoder.encode(expected);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function authenticate(request: Request, getClientAddress: () => string, url: URL): void {
  // 1. Enforce HTTPS in production
  if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    error(403, 'Apenas conexões seguras HTTPS são permitidas');
  }

  // 2. Rate limit defensive check
  const ip = request.headers.get('cf-connecting-ip') || getClientAddress() || '127.0.0.1';
  if (!checkRateLimit(ip)) {
    error(429, 'Limite de requisições excedido. Tente novamente em instantes.');
  }

  // 3. Constant-time token verification against dedicated NOX_STORAGE_BRIDGE_TOKEN
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    error(401, 'Acesso não autorizado');
  }

  const token = authHeader.slice(7).trim();
  const expectedToken = env.NOX_STORAGE_BRIDGE_TOKEN;

  if (!expectedToken || !safeTokenCompare(token, expectedToken)) {
    error(401, 'Acesso não autorizado');
  }
}

export const GET: RequestHandler = async ({ request, getClientAddress, url }) => {
  authenticate(request, getClientAddress, url);

  const configured = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
  return json({
    ok: configured,
    provider: 'telegram'
  });
};

export const POST: RequestHandler = async ({ request, getClientAddress, url }) => {
  authenticate(request, getClientAddress, url);

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    error(503, 'Armazenamento temporariamente indisponível');
  }

  const id = url.searchParams.get('id') || crypto.randomUUID();
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    error(400, 'Identificador de mídia inválido');
  }

  const bytes = await readRequestBytes(request, 19_000_000);
  if (bytes.byteLength < 24) {
    error(413, 'Cada página deve ter no máximo 19 MB e no mínimo 24 bytes');
  }

  let info;
  try {
    info = inspectImage(bytes);
  } catch (e) {
    error(400, (e as Error).message);
  }

  try {
    const fileId = await telegramStorage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID).upload(
      bytes,
      info.mime,
      id
    );

    return json({
      providerKey: fileId,
      mime: info.mime,
      width: info.width,
      height: info.height,
      bytes: bytes.byteLength
    });
  } catch (failure) {
    const isTg = failure instanceof TelegramStorageError;
    console.warn('internal_storage_upload_failed', {
      stage: isTg ? failure.stage : 'upload',
      status: isTg ? failure.status : undefined,
      retryAfter: isTg ? failure.retryAfter : undefined
    });

    if (isTg && failure.status === 429) {
      const retryAfter = failure.retryAfter && failure.retryAfter > 0 ? failure.retryAfter : 15;
      return new Response(
        JSON.stringify({ error: 'Telegram rate limit (FloodWait)', retryAfter }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter)
          }
        }
      );
    }

    error(502, 'Não foi possível armazenar a imagem. Tente novamente.');
  }
};
