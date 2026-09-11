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

export function normalizeBotReference(rawRef: string | null | undefined): string {
  if (!rawRef) return 'MANGA_STORAGE_01';
  const clean = rawRef.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
  if (['MANGA_STORAGE_02', 'MANGA_STORAGE_2', 'MANGA_02', 'MANGA_2', 'STORAGE_02', 'STORAGE_2', 'BOT_02', 'BOT_2'].includes(clean)) {
    return 'MANGA_STORAGE_2';
  }
  if (['MANGA_STORAGE_01', 'MANGA_STORAGE_1', 'MANGA_01', 'MANGA_1', 'STORAGE_01', 'STORAGE_1', 'BOT_01', 'BOT_1', 'PRIMARY', 'LEGACY'].includes(clean)) {
    return 'MANGA_STORAGE_01';
  }
  if (['STAFF_STORAGE', 'STAFF'].includes(clean)) return 'STAFF_STORAGE';
  if (['PARTNER_SCAN_STORAGE', 'PARTNER_STORAGE', 'PARTNER'].includes(clean)) return 'PARTNER_STORAGE';
  if (['PROFILE_MEDIA', 'PROFILE'].includes(clean)) return 'PROFILE_MEDIA';
  if (['SCAN_MEDIA', 'SCAN'].includes(clean)) return 'SCAN_MEDIA';
  if (['OVERFLOW_STORAGE', 'OVERFLOW'].includes(clean)) return 'OVERFLOW_STORAGE';
  return clean;
}

export const KNOWN_MANGA_SHARDS: Record<string, { name: string; botRef: string; shardId: string; channelId: string }> = {
  '0383b872': { name: 'Site Mangá (Storage 000)', botRef: 'MANGA_STORAGE_01', shardId: '935e146d-de3f-4a8e-b393-692944c716fa', channelId: '-1004353931378' },
  'd22770c9': { name: 'Nox Manga Storage 001',    botRef: 'MANGA_STORAGE_01', shardId: '3a4be1a3-f5d2-40c9-9eab-697c2357b183', channelId: '-1003525800137' },
  'dbc29f11': { name: 'Nox Manga Storage 002',    botRef: 'MANGA_STORAGE_01', shardId: 'a3b6a10e-f53a-4873-9f19-d4cc8576de3a', channelId: '-1003686965009' },
  '064ee013': { name: 'Nox Manga Storage 003',    botRef: 'MANGA_STORAGE_01', shardId: '424e8be1-dc8a-4d97-a904-119c7ef1c9b5', channelId: '-1004400799763' },
  '053996b5': { name: 'Nox Manga Storage 004',    botRef: 'MANGA_STORAGE_01', shardId: 'b8fd37d7-3923-4e04-be37-610a1079aa43', channelId: '-1004382627509' },
  'e7d202e3': { name: 'Nox Manga Storage 005',    botRef: 'MANGA_STORAGE_2',  shardId: '80ead41f-7b58-492d-a028-ae0b2669cd93', channelId: '-1003889300195' },
  '03acc769': { name: 'Nox Manga Storage 006',    botRef: 'MANGA_STORAGE_2',  shardId: '98701fd5-d376-4310-b664-6aa13bf0cbb1', channelId: '-1004356622185' },
  '070a0e6a': { name: 'Nox Manga Storage 007',    botRef: 'MANGA_STORAGE_2',  shardId: '3535da22-cb50-4b7b-b12f-96c25460d0b6', channelId: '-1004413066858' },
  '0289a08a': { name: 'Nox Manga Storage 008',    botRef: 'MANGA_STORAGE_2',  shardId: '23518242-ad31-44e9-9997-add190b0a930', channelId: '-1004337541258' }
};

export function deduceMangaShardFromFileId(fileId: string) {
  try {
    const buf = Buffer.from(fileId.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const hex = buf.toString('hex');
    for (const [chanHex, info] of Object.entries(KNOWN_MANGA_SHARDS)) {
      if (hex.includes(chanHex)) return info;
    }
  } catch {}
  return null;
}

function getEnvToken(rawUpper: string): string | undefined {
  const norm = normalizeBotReference(rawUpper);
  if (norm === 'MANGA_STORAGE_2') {
    const t = (env as any).TELEGRAM_BOT_MANGA_STORAGE_2 || (env as any).TELEGRAM_BOT_MANGA_02;
    if (t) return t;
  }
  if (norm === 'MANGA_STORAGE_01') {
    const t = (env as any).TELEGRAM_BOT_MANGA_STORAGE_01 || (env as any).TELEGRAM_BOT_MANGA_01;
    if (t) return t;
  }
  const variations = [
    `TELEGRAM_BOT_${norm}`,
    `TELEGRAM_BOT_${rawUpper}`,
    `TELEGRAM_BOT_${norm.replace(/_STORAGE$/, '')}`,
    `TELEGRAM_BOT_${norm.replace(/_MEDIA$/, '')}`,
    `TELEGRAM_BOT_${norm.replace(/^STORAGE_/, '')}`,
    `TELEGRAM_BOT_${norm}_STORAGE`,
    `TELEGRAM_BOT_${norm}_MEDIA`
  ];
  for (const v of variations) {
    if ((env as any)[v]) return (env as any)[v];
  }
  return undefined;
}

function getEnvChat(rawUpper: string): string | undefined {
  const norm = normalizeBotReference(rawUpper);
  if (norm === 'MANGA_STORAGE_2') {
    const c = (env as any).TELEGRAM_CHAT_MANGA_STORAGE_2 || (env as any).TELEGRAM_CHAT_MANGA_02;
    if (c) return c;
  }
  if (norm === 'MANGA_STORAGE_01') {
    const c = (env as any).TELEGRAM_CHAT_MANGA_STORAGE_01 || (env as any).TELEGRAM_CHAT_MANGA_01;
    if (c) return c;
  }
  const variations = [
    `TELEGRAM_CHAT_${norm}`,
    `TELEGRAM_CHAT_${rawUpper}`,
    `TELEGRAM_CHAT_${norm.replace(/_STORAGE$/, '')}`,
    `TELEGRAM_CHAT_${norm.replace(/_MEDIA$/, '')}`,
    `TELEGRAM_CHANNEL_${norm}`
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
  const norm = normalizeBotReference(botRef);
  const token = getEnvToken(norm) || env.TELEGRAM_BOT_TOKEN;
  const specificChat = getEnvChat(norm);
  const chat = targetChannel || specificChat || env.TELEGRAM_CHAT_ID;

  if (!token || !chat) {
    throw new Error(`Armazenamento Telegram não configurado para o shard [${botRef}].`);
  }

  return {
    client: telegramStorage(token, chat),
    token,
    chat,
    botRef: norm
  };
}

/**
 * Resolves download client with strict Bot Affinity.
 */
export function resolveBotDownloadClient(botRef: string) {
  const norm = normalizeBotReference(botRef);
  const token = getEnvToken(norm) || (norm === 'MANGA_STORAGE_2' ? undefined : env.TELEGRAM_BOT_TOKEN);

  if (!token) {
    throw new Error(`Credenciais de leitura Telegram não encontradas para [${botRef}].`);
  }

  const client = telegramStorage(token, '');
  return {
    ...client,
    botRef: norm
  };
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
