import { env } from '$env/dynamic/private';
import { privileged } from '$lib/server/db';
import { telegramStorage, TelegramStorageError } from '$lib/server/telegram';
import { inspectImage } from '$lib/media-validation';
import { RateLimitError } from '$lib/server/media';

export type StoragePoolKey =
  | 'MANGA_STORAGE'
  | 'STAFF_STORAGE'
  | 'PARTNER_SCAN_STORAGE'
  | 'PROFILE_MEDIA'
  | 'SCAN_MEDIA'
  | 'OVERFLOW_STORAGE';

export interface StorageShardInfo {
  shardId: string;
  poolId: string;
  backend: string;
  botReference: string;
  channelId: string;
  displayName: string;
  writeStatus: string;
  isOverflow: boolean;
}

export interface MediaUploadOptions {
  bytes: Uint8Array;
  mime?: string;
  purpose?: string;
  userId: string;
  mediaId?: string;
  scanId?: string;
  chapterId?: string;
  workId?: string;
  accessClass?: 'PUBLIC' | 'AUTHENTICATED' | 'STAFF_ONLY' | 'SCAN_MEMBER' | 'ADMIN_ONLY' | 'STAGING';
}

export interface StoredMediaRecord {
  id: string;
  providerKey: string;
  shardId: string;
  poolKey: StoragePoolKey;
  botReference: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  isOverflow: boolean;
}

/**
 * Maps a media purpose string to one of the 6 canonical storage pools.
 */
export function resolveStoragePoolForPurpose(purpose: string): StoragePoolKey {
  switch (purpose) {
    case 'staff_manual':
      return 'STAFF_STORAGE';
    case 'scan_chapter':
      return 'PARTNER_SCAN_STORAGE';
    case 'avatar':
    case 'banner':
    case 'profile_banner':
    case 'comment_banner':
    case 'profile_media':
      return 'PROFILE_MEDIA';
    case 'scan_logo':
    case 'scan_banner':
    case 'scan_media':
      return 'SCAN_MEDIA';
    case 'overflow':
      return 'OVERFLOW_STORAGE';
    case 'editorial':
    default:
      return 'MANGA_STORAGE';
  }
}

/**
 * Fair Scheduler concurrency tracking per partner scan.
 * Prevents any single scan from monopolizing workers or storage bandwidth.
 */
const scanInFlightMap = new Map<string, number>();
const MAX_SCAN_CONCURRENT = 4;

export async function acquireScanSlot(scanId: string): Promise<() => void> {
  const current = scanInFlightMap.get(scanId) || 0;
  if (current >= MAX_SCAN_CONCURRENT) {
    let waited = 0;
    while ((scanInFlightMap.get(scanId) || 0) >= MAX_SCAN_CONCURRENT && waited < 10_000) {
      await new Promise((r) => setTimeout(r, 150));
      waited += 150;
    }
  }
  scanInFlightMap.set(scanId, (scanInFlightMap.get(scanId) || 0) + 1);

  return () => {
    const c = scanInFlightMap.get(scanId) || 1;
    if (c <= 1) {
      scanInFlightMap.delete(scanId);
    } else {
      scanInFlightMap.set(scanId, c - 1);
    }
  };
}

function getEnvToken(upper: string): string | undefined {
  const variations = [
    `TELEGRAM_BOT_${upper}`,
    `TELEGRAM_BOT_${upper.replace(/_STORAGE$/, '')}`,
    `TELEGRAM_BOT_${upper.replace(/_MEDIA$/, '')}`,
    `TELEGRAM_BOT_${upper.replace(/^STORAGE_/, '')}`,
    `TELEGRAM_BOT_${upper}_STORAGE`,
    `TELEGRAM_BOT_${upper}_MEDIA`
  ];
  for (const v of variations) {
    if ((env as any)[v]) return (env as any)[v];
  }
  return undefined;
}

function getEnvChat(upper: string): string | undefined {
  const variations = [
    `TELEGRAM_CHAT_${upper}`,
    `TELEGRAM_CHAT_${upper.replace(/_STORAGE$/, '')}`,
    `TELEGRAM_CHAT_${upper.replace(/_MEDIA$/, '')}`,
    `TELEGRAM_CHANNEL_${upper}`
  ];
  for (const v of variations) {
    if ((env as any)[v]) return (env as any)[v];
  }
  return undefined;
}

/**
 * Resolves the Telegram client with token and chat ID for the designated bot reference.
 * Supports dedicated bot tokens per shard pool or gracefully falls back to primary credentials.
 */
export function resolveBotClient(botRef: string, targetChannel?: string) {
  const upper = (botRef || 'PRIMARY').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const token = getEnvToken(upper) || env.TELEGRAM_BOT_TOKEN;
  const specificChat = getEnvChat(upper);
  const chat = targetChannel || specificChat || env.TELEGRAM_CHAT_ID;

  if (!token || !chat) {
    throw new Error(`Armazenamento Telegram não configurado para o shard [${botRef}].`);
  }

  return {
    client: telegramStorage(token, chat),
    token,
    chat,
    botRef: upper
  };
}

/**
 * Resolves download client with strict Bot Affinity.
 */
export function resolveBotDownloadClient(botRef: string) {
  const upper = (botRef || 'PRIMARY').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const token = getEnvToken(upper) || env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error(`Credenciais de leitura Telegram não encontradas para [${botRef}].`);
  }

  return telegramStorage(token, '');
}

/**
 * Core upload engine of Project Nox Storage Supremo.
 * Routes media to the optimal shard across the 6 canonical pools with circuit breakers,
 * fair scheduling, and zero artificial hourly upload limits.
 */
export async function uploadToStorageSupremo(options: MediaUploadOptions): Promise<StoredMediaRecord> {
  const {
    bytes,
    purpose = 'editorial',
    userId,
    mediaId = crypto.randomUUID(),
    scanId,
    chapterId,
    accessClass = 'PUBLIC'
  } = options;

  // 1. Inspect image and validate dimensions
  const info = inspectImage(bytes);

  // 2. Compute SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  const hash = Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0')).join('');

  // 3. Resolve canonical pool
  const poolKey = resolveStoragePoolForPurpose(purpose);

  // 4. If partner scan upload, enforce fair scheduler token
  let releaseScanSlot: (() => void) | null = null;
  if (scanId) {
    releaseScanSlot = await acquireScanSlot(scanId);
  }

  const db = privileged();

  try {
    // 5. Select optimal shard via control plane RPC
    const { data: shardRows, error: shardErr } = await db.rpc('select_optimal_storage_shard', {
      p_pool_key: poolKey,
      p_chapter_id: chapterId || null,
      p_scan_id: scanId || null
    });

    if (shardErr || !shardRows?.length) {
      throw new Error(`Falha ao selecionar shard de armazenamento para o pool [${poolKey}]: ${shardErr?.message || 'Nenhum shard disponível'}`);
    }

    const shard = shardRows[0];
    const shardId = shard.shard_id;
    const botRef = shard.bot_reference || 'primary';
    const channelId = shard.channel_id;
    const isOverflow = Boolean(shard.is_overflow);

    // 6. Reserve media record (zero artificial hourly limit, clean in-flight debounce)
    const { error: reserveErr } = await db.rpc('reserve_media', {
      p_id: mediaId,
      p_user: userId,
      p_provider: 'telegram',
      p_mime: info.mime,
      p_width: info.width,
      p_height: info.height,
      p_bytes: bytes.byteLength,
      p_sha256: hash,
      p_purpose: purpose
    });

    if (reserveErr) {
      throw new Error(reserveErr.message);
    }

    // Set router metadata on media record
    await db
      .from('media')
      .update({
        storage_pool_id: shard.pool_id,
        storage_shard_id: shardId,
        bot_reference: botRef,
        access_class: accessClass,
        scan_id: scanId || null,
        chapter_id: chapterId || null
      })
      .eq('id', mediaId);

    // 7. Track upload start in control plane
    await db.rpc('record_shard_upload_start', { p_shard_id: shardId });

    // 8. Resolve Telegram bot client for this shard
    const botClient = resolveBotClient(botRef, channelId);

    // Sync database shard channel_id only if shard had no channel configured
    if (!channelId && botClient.chat && !shard.owner_scan_id) {
      await db
        .from('storage_shards')
        .update({ channel_id: botClient.chat })
        .eq('id', shardId);
    }

    const startTime = Date.now();
    let providerKey: string;

    try {
      providerKey = await botClient.client.upload(
        bytes as unknown as Uint8Array<ArrayBuffer>,
        info.mime,
        mediaId
      );
    } catch (uploadErr) {
      const elapsedMs = Date.now() - startTime;
      const isTg = uploadErr instanceof TelegramStorageError;
      const statusCode = isTg ? uploadErr.status : undefined;
      const retryAfter = isTg ? uploadErr.retryAfter : undefined;

      // Report failure to circuit breaker (marks COOLDOWN if 429)
      await db.rpc('record_shard_upload_result', {
        p_shard_id: shardId,
        p_success: false,
        p_latency_ms: elapsedMs,
        p_bytes: 0,
        p_error_code: statusCode || null,
        p_retry_after: retryAfter || null
      });

      // Cleanup reservation
      await db.from('media').delete().eq('id', mediaId);

      if (isTg && statusCode === 429) {
        throw new RateLimitError(retryAfter && retryAfter > 0 ? retryAfter : 15);
      }

      throw uploadErr;
    }

    const elapsedMs = Date.now() - startTime;

    // 9. Record success in circuit breaker & metrics
    await db.rpc('record_shard_upload_result', {
      p_shard_id: shardId,
      p_success: true,
      p_latency_ms: elapsedMs,
      p_bytes: bytes.byteLength,
      p_error_code: null,
      p_retry_after: null
    });

    // 10. Commit media record & location entry
    const { error: commitErr } = await db.rpc('commit_media_record', {
      p_id: mediaId,
      p_shard_id: shardId,
      p_provider_key: providerKey,
      p_message_id: null,
      p_unique_file_id: null
    });

    if (commitErr) {
      console.warn('commit_media_record_warning:', commitErr.message);
    }

    return {
      id: mediaId,
      providerKey,
      shardId,
      poolKey,
      botReference: botRef,
      mime: info.mime,
      width: info.width,
      height: info.height,
      bytes: bytes.byteLength,
      sha256: hash,
      isOverflow
    };
  } finally {
    if (releaseScanSlot) {
      releaseScanSlot();
    }
  }
}
