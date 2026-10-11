import { json } from '@sveltejs/kit';
import { deleteTelegramObject, uploadPipelineFileToStorage } from '$lib/server/storage-router';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import { RateLimitError } from '$lib/server/media';
import { getScanArtifactStorage, removeScanArtifact } from '$lib/server/scan-artifact-storage';
import crypto from 'node:crypto';

const BLOCKED_EXTENSIONS = ['.exe', '.apk', '.bat', '.cmd', '.sh', '.bin', '.dll', '.msi', '.vbs', '.ps1', '.scr', '.com', '.pif', '.hta', '.cpl', '.jar'];
const MAX_PIPELINE_SIZE = 524_288_000;
const LARGE_FILE_THRESHOLD = 20_971_520;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID.test(value));
}

function sanitizeFilename(rawFilename: string): string {
  return rawFilename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
}

function logYsqlFailure(operation: string, error: any) {
  console.error('scan_pipeline_ysql_failed', {
    operation,
    code: typeof error?.code === 'string' ? error.code : null,
    message: String(error?.message || 'unknown').slice(0, 240)
  });
}

async function ysql<T>(platform: any, query: string, params: any[] = []) {
  return executeYugabyteSql<T>(query, params, platform?.env);
}

async function checkScanAccess(platform: any, scanId: string, userId: string, isGlobalAdmin: boolean) {
  if (isGlobalAdmin) return { allowed: true, role: 'ADMIN' };
  const result = await ysql<{ role: string }>(platform,
    'SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1', [scanId, userId]);
  return { allowed: Boolean(result.rows[0]), role: result.rows[0]?.role || null };
}

export const POST = async ({ locals, request, platform }) => {
  if (!locals.user) return json({ error: 'Não autenticado' }, { status: 401 });

  const formData = await request.formData();
  const scanId = formData.get('scan_id')?.toString();
  const productionChapterId = formData.get('production_chapter_id')?.toString();
  const stageId = formData.get('stage_id')?.toString();
  const note = formData.get('note')?.toString() || '';
  const replacementId = formData.get('replace_file_id')?.toString() || null;
  const requestedUploadId = formData.get('upload_id')?.toString() || null;
  const file = formData.get('file');
  const isGlobalAdmin = locals.role === 'ADMIN';

  if (!isUuid(scanId) || !isUuid(productionChapterId) || !isUuid(stageId)) {
    return json({ error: 'scan_id, production_chapter_id e stage_id válidos são obrigatórios' }, { status: 400 });
  }
  if (!file || !(file instanceof Blob)) return json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
  if (replacementId && !isUuid(replacementId)) return json({ error: 'Arquivo a substituir inválido' }, { status: 400 });

  const rawFilename = (file as File).name || 'arquivo';
  const ext = rawFilename.includes('.') ? rawFilename.slice(rawFilename.lastIndexOf('.')).toLowerCase() : '';
  if (BLOCKED_EXTENSIONS.includes(ext)) return json({ error: 'Formato de arquivo executável bloqueado por políticas de segurança da plataforma.' }, { status: 400 });
  if (file.size > MAX_PIPELINE_SIZE) return json({ error: `Arquivo excede o limite máximo permitido de 500 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB enviado).` }, { status: 413 });

  let memberRole: string | null;
  let chapter: { id: string; work_id: string } | undefined;
  let stage: { id: string; slug: string; name: string } | undefined;
  try {
    const [access, chapterResult, stageResult] = await Promise.all([
      checkScanAccess(platform, scanId, locals.user.id, isGlobalAdmin),
      ysql<{ id: string; work_id: string }>(platform,
        'SELECT id, work_id FROM public.scan_production_chapters WHERE id = $1 AND scan_id = $2 LIMIT 1', [productionChapterId, scanId]),
      ysql<{ id: string; slug: string; name: string }>(platform,
        'SELECT id, slug, name FROM public.scan_workflow_stages WHERE id = $1 AND scan_id = $2 LIMIT 1', [stageId, scanId])
    ]);
    if (!access.allowed) return json({ error: 'Acesso não autorizado a esta Scan' }, { status: 403 });
    memberRole = access.role;
    chapter = chapterResult.rows[0];
    stage = stageResult.rows[0];
  } catch (error) {
    logYsqlFailure('upload_destination_lookup', error);
    return json({ error: 'Não foi possível validar o destino do upload agora.' }, { status: 503 });
  }
  if (!chapter) return json({ error: 'Capítulo não encontrado nesta Scan' }, { status: 404 });
  if (!stage) return json({ error: 'Etapa não encontrada nesta Scan' }, { status: 404 });

  // The finalizer repeats this authorization under a row lock. This preflight
  // only gives immediate feedback when the browser is visibly stale.
  if (!isGlobalAdmin && !['OWNER', 'ADMIN'].includes(memberRole || '')) {
    try {
      const chapterStage = await ysql<{ assigned_to: string | null; status: string }>(platform, `
        SELECT assigned_to, status
        FROM public.scan_chapter_stages
        WHERE scan_id = $1 AND stage_id = $2
          AND (production_chapter_id = $3 OR chapter_id = $3)
        ORDER BY CASE WHEN production_chapter_id = $3 THEN 0 ELSE 1 END
        LIMIT 1
      `, [scanId, stageId, productionChapterId]);
      const current = chapterStage.rows[0];
      if (!current || current.assigned_to !== locals.user.id || !['IN_PROGRESS', 'REWORK'].includes(current.status)) {
        return json({ error: 'Assuma esta etapa antes de enviar ou alterar arquivos.' }, { status: 403 });
      }
    } catch (error) {
      logYsqlFailure('upload_assignment_lookup', error);
      return json({ error: 'Não foi possível validar sua atribuição nesta etapa.' }, { status: 503 });
    }
  }

  const uploadId = isUuid(requestedUploadId) ? requestedUploadId : crypto.randomUUID();
  try {
    const existing = await ysql<{
      id: string; scan_id: string; production_chapter_id: string; stage_id: string; user_id: string; status: string; file_id: string | null;
    }>(platform, `
      SELECT id, scan_id, production_chapter_id, stage_id, user_id, status, file_id
      FROM public.scan_pipeline_upload_attempts WHERE id = $1 LIMIT 1
    `, [uploadId]);
    const previous = existing.rows[0];
    if (previous) {
      const sameDestination = previous.scan_id === scanId && previous.production_chapter_id === productionChapterId && previous.stage_id === stageId;
      if (!sameDestination || (previous.user_id !== locals.user.id && !isGlobalAdmin)) {
        return json({ error: 'Tentativa de upload não autorizada' }, { status: 403 });
      }
      if (previous.status === 'SUCCEEDED' && previous.file_id) {
        const finished = await ysql<any>(platform, 'SELECT * FROM public.scan_production_files WHERE id = $1 LIMIT 1', [previous.file_id]);
        if (finished.rows[0]) return json({ success: true, file: finished.rows[0], version: finished.rows[0].version, uploadId, idempotent: true });
      }
    } else {
      await ysql(platform, `
        INSERT INTO public.scan_pipeline_upload_attempts
          (id, scan_id, production_chapter_id, stage_id, user_id, file_name, byte_size, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'UPLOADING')
      `, [uploadId, scanId, productionChapterId, stageId, locals.user.id, rawFilename, file.size]);
    }
  } catch (error) {
    logYsqlFailure('upload_attempt_prepare', error);
    return json({ error: 'Não foi possível preparar o upload. Tente novamente.' }, { status: 503 });
  }

  const failAttempt = async (message: string, status = 502, errorCode?: string) => {
    try {
      await ysql(platform, `
        UPDATE public.scan_pipeline_upload_attempts
        SET status = 'FAILED', error_code = $2, updated_at = now()
        WHERE id = $1 AND status <> 'SUCCEEDED'
      `, [uploadId, errorCode || null]);
    } catch (error) {
      logYsqlFailure('upload_attempt_fail_record', error);
    }
    return json({ error: message, uploadId }, { status });
  };

  let deliveryKey: string = crypto.randomUUID();
  let replacedTelegram: {
    botReference: string | null;
    messageId: string | null;
    chatId: string | null;
  } | undefined;
  if (replacementId) {
    try {
      const replacement = await ysql<{
        delivery_key: string | null; provider: string | null; bot_reference: string | null;
        telegram_message_id: string | null; telegram_chat_id: string | null;
      }>(platform, `
        SELECT file.delivery_key,
               COALESCE(attempt.provider, file.provider) AS provider,
               COALESCE(attempt.bot_reference, file.bot_reference) AS bot_reference,
               attempt.telegram_message_id, attempt.telegram_chat_id
        FROM public.scan_production_files file
        LEFT JOIN public.scan_pipeline_upload_attempts attempt ON attempt.file_id = file.id
        WHERE file.id = $1 AND file.scan_id = $2 AND file.production_chapter_id = $3
          AND file.stage_id = $4 AND file.is_current = true
        LIMIT 1
      `, [replacementId, scanId, productionChapterId, stageId]);
      if (!replacement.rows[0]?.delivery_key) return failAttempt('O arquivo a substituir não está mais disponível.', 409, 'REPLACEMENT_NOT_CURRENT');
      deliveryKey = replacement.rows[0].delivery_key;
      if (replacement.rows[0].provider === 'TELEGRAM') {
        replacedTelegram = {
          botReference: replacement.rows[0].bot_reference,
          messageId: replacement.rows[0].telegram_message_id,
          chatId: replacement.rows[0].telegram_chat_id
        };
      }
    } catch (error) {
      logYsqlFailure('upload_replacement_lookup', error);
      return failAttempt('Não foi possível validar o arquivo a substituir.', 503, 'REPLACEMENT_LOOKUP_FAILED');
    }
  }

  let buffer: Buffer;
  let checksum: string;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
    checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  } catch (error) {
    logYsqlFailure('upload_file_read', error);
    return failAttempt('Não foi possível ler o arquivo selecionado.', 400, 'READ_FAILED');
  }

  const safeFilename = sanitizeFilename(rawFilename);
  const artifactKey = `production/${scanId}/${productionChapterId}/${stage.slug}/${deliveryKey}/${uploadId}-${safeFilename}`;
  let storedArtifactKey: string | null = null;
  let storedArtifactProvider: string | null = null;
  const storeInArtifacts = async () => {
    // Private artifact storage is separate from the authoritative YSQL data
    // plane. Metadata, memberships and state transitions never use Supabase.
    const staffStorage = getScanArtifactStorage(platform?.env);
    const { error } = await staffStorage.storage.from('scan-artifacts').upload(artifactKey, buffer, {
      contentType: file.type || 'application/octet-stream', upsert: false
    });
    if (error) throw error;
    storedArtifactKey = artifactKey;
    storedArtifactProvider = 'STORAGE';
    return {
      provider: 'STORAGE', fileKey: artifactKey, shardId: null, poolId: null,
      botReference: 'PRODUCTION_STORAGE', telegramFileId: null,
      telegramMessageId: null, telegramChatId: null, telegramUniqueFileId: null,
      sha256: checksum, byteSize: file.size
    };
  };

  let storedRecord: {
    provider: string; fileKey: string; shardId: string | null; poolId: string | null;
    botReference: string; telegramFileId: string | null; telegramMessageId: string | null;
    telegramChatId: string | null; telegramUniqueFileId: string | null; sha256: string; byteSize: number;
  } | undefined;
  try {
    if (file.size > LARGE_FILE_THRESHOLD) {
      storedRecord = await storeInArtifacts();
    } else {
      try {
        const telegramRecord = await uploadPipelineFileToStorage({
          bytes: new Uint8Array(buffer), fileName: safeFilename, mime: file.type || 'application/octet-stream',
          userId: locals.user.id, scanId, productionChapterId, stageId
        }, platform?.env);
        storedRecord = {
          provider: 'TELEGRAM', fileKey: `prod_${checksum.slice(0, 16)}_${Date.now()}`,
          shardId: telegramRecord.shardId, poolId: telegramRecord.poolId,
          botReference: telegramRecord.botReference, telegramFileId: telegramRecord.telegramFileId,
          telegramMessageId: telegramRecord.telegramMessageId, telegramChatId: telegramRecord.telegramChatId,
          telegramUniqueFileId: telegramRecord.telegramUniqueFileId,
          sha256: telegramRecord.sha256 || checksum, byteSize: telegramRecord.byteSize
        };
      } catch (error: any) {
        if (error instanceof RateLimitError) {
          const response = await failAttempt('Rate limit temporário do armazenamento. Tente novamente em instantes.', 429, 'RATE_LIMIT');
          response.headers.set('Retry-After', String(error.retryAfter));
          return response;
        }
        if (!error?.message?.includes('FAIL_CLOSED') && !error?.message?.includes('TELEGRAM_BOT_PRODUCTION_STORAGE')) throw error;
        storedRecord = await storeInArtifacts();
      }
    }
  } catch (error) {
    logYsqlFailure('upload_storage', error);
    return failAttempt('Falha ao enviar o arquivo ao armazenamento. Você pode tentar novamente sem perder os demais arquivos.', 502, 'STORAGE_FAILED');
  }

  if (!storedRecord) return failAttempt('Falha ao preparar o registro do arquivo.', 503, 'STORAGE_RECORD_MISSING');

  try {
    // Keep the provider deletion coordinates on the retry/cancellation row.
    // This is the durable hand-off between the provider upload and the YSQL
    // finalizer; it also lets a user cancel an in-flight upload safely.
    await ysql(platform, `
      UPDATE public.scan_pipeline_upload_attempts
      SET provider = $2, bot_reference = $3, telegram_file_id = $4,
          telegram_message_id = $5, telegram_chat_id = $6,
          telegram_unique_file_id = $7, updated_at = now()
      WHERE id = $1 AND status <> 'SUCCEEDED'
    `, [uploadId, storedRecord.provider, storedRecord.botReference, storedRecord.telegramFileId,
      storedRecord.telegramMessageId, storedRecord.telegramChatId, storedRecord.telegramUniqueFileId]);
    const nameResult = await ysql<{ display_name: string | null; username: string | null }>(platform,
      'SELECT display_name, username FROM public.members WHERE id = $1 LIMIT 1', [locals.user.id]);
    const actorName = nameResult.rows[0]?.display_name || nameResult.rows[0]?.username || 'Membro';
    const result = await ysql<{ file: any }>(platform, `
      SELECT to_jsonb(finalized) AS file
      FROM public.finalize_scan_pipeline_file_ysql($1, $2, $3, $4, $5, $6::jsonb) AS finalized
    `, [uploadId, replacementId, locals.user.id, isGlobalAdmin, actorName, JSON.stringify({
      scan_id: scanId, production_chapter_id: productionChapterId, stage_id: stageId,
      delivery_key: deliveryKey, file_name: rawFilename, byte_size: storedRecord.byteSize,
      mime_type: file.type || 'application/octet-stream', file_key: storedRecord.fileKey,
      storage_pool_id: storedRecord.poolId, storage_shard_id: storedRecord.shardId,
      bot_reference: storedRecord.botReference, telegram_file_id: storedRecord.telegramFileId,
      sha256: storedRecord.sha256, provider: storedRecord.provider, note
    })]);
    const currentFile = result.rows[0]?.file;
    if (!currentFile) throw new Error('YSQL finalizer returned no file');
    if (replacedTelegram?.botReference && replacedTelegram.messageId && replacedTelegram.chatId) {
      await deleteTelegramObject(replacedTelegram.botReference, replacedTelegram.chatId, replacedTelegram.messageId)
        .catch((cleanupError) => logYsqlFailure('replacement_telegram_cleanup', cleanupError));
    }
    return json({ success: true, file: currentFile, version: currentFile.version, uploadId, deliveryKey: currentFile.delivery_key });
  } catch (error: any) {
    const conflict = /REPLACEMENT_NOT_CURRENT|STAGE_NO_LONGER_ACCEPTS_UPLOAD|STAGE_ASSIGNMENT_CHANGED|UPLOAD_ATTEMPT_NOT_FINALIZABLE/.test(String(error?.message || ''));
    if (storedArtifactProvider === 'STORAGE' && storedArtifactKey) {
      await removeScanArtifact(platform?.env, storedArtifactKey).catch((cleanupError) => {
        logYsqlFailure('upload_storage_compensation', cleanupError);
      });
    }
    if (storedRecord?.provider === 'TELEGRAM' && storedRecord.telegramMessageId && storedRecord.telegramChatId) {
      await deleteTelegramObject(storedRecord.botReference, storedRecord.telegramChatId, storedRecord.telegramMessageId)
        .catch((cleanupError) => logYsqlFailure('upload_telegram_compensation', cleanupError));
    }
    logYsqlFailure('upload_finalize', error);
    return failAttempt(
      conflict ? 'A etapa ou o arquivo foi atualizado por outra pessoa. Atualize a lista antes de tentar novamente.' : 'O arquivo foi enviado, mas não pôde ser registrado com segurança. Tente reenviá-lo.',
      conflict ? 409 : 503,
      conflict ? 'CONCURRENT_UPDATE' : 'FINALIZE_FAILED'
    );
  }
};

export const DELETE = async ({ locals, url, platform }) => {
  if (!locals.user) return json({ error: 'Não autenticado' }, { status: 401 });
  const uploadId = url.searchParams.get('upload_id');
  if (!isUuid(uploadId)) return json({ error: 'Upload inválido' }, { status: 400 });
  try {
    const attemptResult = await ysql<{
      id: string; scan_id: string; user_id: string; status: string;
      provider: string | null; bot_reference: string | null; telegram_message_id: string | null;
      telegram_chat_id: string | null;
    }>(platform, `
      SELECT id, scan_id, user_id, status, provider, bot_reference,
             telegram_message_id, telegram_chat_id
      FROM public.scan_pipeline_upload_attempts WHERE id = $1 LIMIT 1
    `, [uploadId]);
    const attempt = attemptResult.rows[0];
    if (!attempt) return json({ error: 'Upload não encontrado' }, { status: 404 });
    const access = await checkScanAccess(platform, attempt.scan_id, locals.user.id, locals.role === 'ADMIN');
    if (!access.allowed || (attempt.user_id !== locals.user.id && locals.role !== 'ADMIN')) return json({ error: 'Acesso não autorizado' }, { status: 403 });
    if (attempt.status === 'SUCCEEDED') return json({ error: 'Uploads concluídos não podem ser descartados por esta ação.' }, { status: 409 });
    await ysql(platform, `
      UPDATE public.scan_pipeline_upload_attempts SET status = 'CANCELLED', updated_at = now()
      WHERE id = $1 AND status <> 'SUCCEEDED'
    `, [uploadId]);
    if (attempt.provider === 'TELEGRAM' && attempt.bot_reference && attempt.telegram_message_id && attempt.telegram_chat_id) {
      await deleteTelegramObject(attempt.bot_reference, attempt.telegram_chat_id, attempt.telegram_message_id)
        .catch((cleanupError) => logYsqlFailure('upload_cancel_telegram_compensation', cleanupError));
    }
    return json({ success: true });
  } catch (error) {
    logYsqlFailure('upload_discard', error);
    return json({ error: 'Não foi possível descartar o upload.' }, { status: 503 });
  }
};
