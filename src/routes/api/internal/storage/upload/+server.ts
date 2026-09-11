import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { privileged } from '$lib/server/db';
import { TelegramStorageError } from '$lib/server/telegram';
import { resolveBotClient, resolveStoragePoolForPurpose } from '$lib/server/storage-router';
import { inspectImage } from '$lib/media-validation';
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

  const targetShard = url.searchParams.get('bot') || url.searchParams.get('shard') || 'MANGA_STORAGE_01';
  let configured = false;
  try {
    const client = resolveBotClient(targetShard);
    configured = Boolean(client.token && client.chat);
  } catch {
    configured = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
  }

  return json({
    ok: configured,
    provider: 'telegram'
  });
};

export const POST: RequestHandler = async ({ request, getClientAddress, url }) => {
  authenticate(request, getClientAddress, url);

  const id = url.searchParams.get('id') || crypto.randomUUID();
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    error(400, 'Identificador de mídia inválido');
  }

  const explicitShard = url.searchParams.get('bot') || url.searchParams.get('shard');
  const chapterId = url.searchParams.get('chapter_id') || request.headers.get('x-chapter-id') || undefined;
  const scanId = url.searchParams.get('scan_id') || request.headers.get('x-scan-id') || undefined;
  const purpose = url.searchParams.get('purpose') || request.headers.get('x-media-purpose') || 'editorial';

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await request.arrayBuffer();
  } catch {
    error(400, 'Falha ao ler dados da imagem');
  }

  if (arrayBuffer.byteLength < 24 || arrayBuffer.byteLength > 19_000_000) {
    error(413, 'Cada página deve ter no máximo 19 MB e no mínimo 24 bytes');
  }

  const bytes = new Uint8Array(arrayBuffer);

  let info;
  try {
    info = inspectImage(bytes);
  } catch (e) {
    error(400, (e as Error).message);
  }

  let db: ReturnType<typeof privileged> | null = null;
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      db = privileged();
    } catch {}
  }

  let shardId: string | null = null;
  let botClient;
  let selectedShardDisplayName: string | undefined;

  if (explicitShard || !db) {
    // Explicit shard requested or db unconfigured (e.g. diagnostic / unit tests)
    const target = explicitShard || 'MANGA_STORAGE_01';
    try {
      botClient = resolveBotClient(target);
    } catch (err1) {
      try {
        botClient = resolveBotClient('primary');
      } catch (err2) {
        console.warn('storage_resolve_failed', {
          target,
          err1: (err1 as Error).message,
          err2: (err2 as Error).message
        });
        error(503, 'Armazenamento temporariamente indisponível');
      }
    }
  } else {
    // Dynamic routing through Storage Supremo control plane
    const poolKey = resolveStoragePoolForPurpose(purpose);
    const { data: shardRows, error: shardErr } = await db.rpc('select_optimal_storage_shard', {
      p_pool_key: poolKey,
      p_chapter_id: chapterId || null,
      p_scan_id: scanId || null
    });

    if (shardErr || !shardRows?.length) {
      console.warn('storage_router_selection_failed', {
        poolKey,
        chapterId,
        error: shardErr?.message
      });
      // Fallback to primary client if router query fails
      try {
        botClient = resolveBotClient('MANGA_STORAGE_01');
      } catch {
        botClient = resolveBotClient('primary');
      }
    } else {
      const selectedShard = shardRows[0];
      shardId = selectedShard.shard_id;
      selectedShardDisplayName = selectedShard.display_name;
      const targetBotRef = selectedShard.bot_reference || 'primary';
      const targetChannel = selectedShard.channel_id;

      botClient = resolveBotClient(targetBotRef, targetChannel);
    }
  }

  if (shardId && db) {
    await db.rpc('record_shard_upload_start', { p_shard_id: shardId });
  }

  const startTime = Date.now();

  try {
    const fileId = await botClient.client.upload(
      bytes,
      info.mime,
      id
    );

    const elapsedMs = Date.now() - startTime;

    if (shardId && db) {
      await db.rpc('record_shard_upload_result', {
        p_shard_id: shardId,
        p_success: true,
        p_latency_ms: elapsedMs,
        p_bytes: bytes.byteLength
      });
    }

    const resultPayload: Record<string, any> = {
      providerKey: fileId,
      botReference: botClient.botRef,
      mime: info.mime,
      width: info.width,
      height: info.height,
      bytes: bytes.byteLength
    };

    if (shardId) {
      resultPayload.shardId = shardId;
      resultPayload.channelId = botClient.chat;
      resultPayload.displayName = selectedShardDisplayName;
    }

    return json(resultPayload);
  } catch (failure) {
    const elapsedMs = Date.now() - startTime;
    const isTg = failure instanceof TelegramStorageError;
    const statusCode = isTg ? failure.status : undefined;
    const retryAfter = isTg ? failure.retryAfter : undefined;

    console.warn('internal_storage_upload_failed', {
      shardId,
      stage: isTg ? failure.stage : 'upload',
      status: statusCode,
      retryAfter
    });

    if (shardId && db) {
      await db.rpc('record_shard_upload_result', {
        p_shard_id: shardId,
        p_success: false,
        p_latency_ms: elapsedMs,
        p_bytes: 0,
        p_error_code: statusCode || null,
        p_retry_after: retryAfter || null
      });
    }

    if (isTg && statusCode === 429) {
      const effectiveRetryAfter = retryAfter && retryAfter > 0 ? retryAfter : 15;
      return new Response(
        JSON.stringify({ error: 'Telegram rate limit (FloodWait)', retryAfter: effectiveRetryAfter }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(effectiveRetryAfter)
          }
        }
      );
    }

    error(502, 'Não foi possível armazenar a imagem. Tente novamente.');
  }
};
