import { json } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { uploadPipelineFileToStorage } from '$lib/server/storage-router';
import { RateLimitError } from '$lib/server/media';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
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

async function checkScanAccess(db: ReturnType<typeof privileged>, scanId: string, userId: string, role: string | null | undefined) {
  if (role === 'ADMIN') return { allowed: true, error: null };
  const { data: member, error } = await db.from('scan_members').select('role').eq('scan_id', scanId).eq('user_id', userId).maybeSingle();
  return { allowed: Boolean(member), error };
}

export const POST = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'Não autenticado' }, { status: 401 });

  const formData = await request.formData();
  const scanId = formData.get('scan_id')?.toString();
  const productionChapterId = formData.get('production_chapter_id')?.toString();
  const stageId = formData.get('stage_id')?.toString();
  const note = formData.get('note')?.toString() || '';
  const replacementId = formData.get('replace_file_id')?.toString() || null;
  const requestedUploadId = formData.get('upload_id')?.toString() || null;
  const file = formData.get('file');

  if (!scanId || !productionChapterId || !stageId) return json({ error: 'scan_id, production_chapter_id e stage_id são obrigatórios' }, { status: 400 });
  if (!file || !(file instanceof Blob)) return json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
  if (replacementId && !isUuid(replacementId)) return json({ error: 'Arquivo a substituir inválido' }, { status: 400 });

  const rawFilename = (file as File).name || 'arquivo';
  const ext = rawFilename.includes('.') ? rawFilename.slice(rawFilename.lastIndexOf('.')).toLowerCase() : '';
  if (BLOCKED_EXTENSIONS.includes(ext)) return json({ error: 'Formato de arquivo executável bloqueado por políticas de segurança da plataforma.' }, { status: 400 });
  if (file.size > MAX_PIPELINE_SIZE) return json({ error: `Arquivo excede o limite máximo permitido de 500 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB enviado).` }, { status: 413 });

  const db = privileged();
  const access = await checkScanAccess(db, scanId, locals.user.id, locals.role);
  if (access.error) {
    console.error('scan_pipeline_upload_access_lookup_failed', { code: access.error.code, message: access.error.message });
    return json({ error: 'Não foi possível validar sua permissão agora.' }, { status: 503 });
  }
  if (!access.allowed) return json({ error: 'Acesso não autorizado a esta Scan' }, { status: 403 });

  // Never trust a chapter/stage supplied by the browser to belong to the scan.
  const [{ data: chapter, error: chapterError }, { data: stage, error: stageError }] = await Promise.all([
    db.from('scan_production_chapters').select('id, work_id, chapter_number').eq('id', productionChapterId).eq('scan_id', scanId).maybeSingle(),
    db.from('scan_workflow_stages').select('id, slug, name').eq('id', stageId).eq('scan_id', scanId).maybeSingle()
  ]);
  if (chapterError || stageError) {
    console.error('scan_pipeline_upload_lookup_failed', { operation: chapterError ? 'chapter_lookup' : 'stage_lookup', code: chapterError?.code || stageError?.code || null, message: chapterError?.message || stageError?.message || 'unknown' });
    return json({ error: 'Não foi possível validar o destino do upload. Tente novamente.' }, { status: 503 });
  }
  if (!chapter) return json({ error: 'Capítulo não encontrado nesta Scan' }, { status: 404 });
  if (!stage) return json({ error: 'Etapa não encontrada nesta Scan' }, { status: 404 });

  // A member must work only on their claimed stage. Leadership and global
  // administrators retain their established intervention powers.
  let membershipRole: string | null = null;
  if (locals.role !== 'ADMIN') {
    const [{ data: membership, error: membershipError }, { data: chapterStage, error: chapterStageError }] = await Promise.all([
      db.from('scan_members').select('role').eq('scan_id', scanId).eq('user_id', locals.user.id).maybeSingle(),
      db.from('scan_chapter_stages').select('assigned_to, status').eq('production_chapter_id', productionChapterId).eq('stage_id', stageId).maybeSingle()
    ]);
    if (membershipError || chapterStageError) {
      console.error('scan_pipeline_upload_assignment_lookup_failed', { code: membershipError?.code || chapterStageError?.code || null, message: membershipError?.message || chapterStageError?.message || 'unknown' });
      return json({ error: 'Não foi possível validar sua atribuição nesta etapa.' }, { status: 503 });
    }
    membershipRole = membership?.role || null;
    const isLeadership = ['OWNER', 'ADMIN'].includes(membershipRole || '');
    const isAssignee = chapterStage?.assigned_to === locals.user.id && ['IN_PROGRESS', 'REWORK'].includes(chapterStage.status);
    if (!isLeadership && !isAssignee) return json({ error: 'Assuma esta etapa antes de enviar ou alterar arquivos.' }, { status: 403 });
  }

  const uploadId = isUuid(requestedUploadId) ? requestedUploadId : crypto.randomUUID();
  const { data: previousAttempt, error: previousAttemptError } = await db.from('scan_pipeline_upload_attempts')
    .select('id, scan_id, production_chapter_id, stage_id, user_id, status, file_id').eq('id', uploadId).maybeSingle();
  if (previousAttemptError) {
    console.error('scan_pipeline_upload_attempt_lookup_failed', { code: previousAttemptError.code, message: previousAttemptError.message });
    return json({ error: 'Não foi possível preparar o upload. Tente novamente.' }, { status: 503 });
  }
  if (previousAttempt) {
    const sameDestination = previousAttempt.scan_id === scanId && previousAttempt.production_chapter_id === productionChapterId && previousAttempt.stage_id === stageId;
    if (!sameDestination || (previousAttempt.user_id !== locals.user.id && locals.role !== 'ADMIN')) return json({ error: 'Tentativa de upload não autorizada' }, { status: 403 });
    if (previousAttempt.status === 'SUCCEEDED' && previousAttempt.file_id) {
      const { data: existingFile } = await db.from('scan_production_files').select('*').eq('id', previousAttempt.file_id).maybeSingle();
      if (existingFile) return json({ success: true, file: existingFile, version: existingFile.version, uploadId, idempotent: true });
    }
  } else {
    const { error: attemptInsertError } = await db.from('scan_pipeline_upload_attempts').insert({
      id: uploadId, scan_id: scanId, production_chapter_id: productionChapterId, stage_id: stageId,
      user_id: locals.user.id, file_name: rawFilename, byte_size: file.size, status: 'UPLOADING'
    });
    if (attemptInsertError) {
      console.error('scan_pipeline_upload_attempt_create_failed', { code: attemptInsertError.code, message: attemptInsertError.message });
      return json({ error: 'Não foi possível iniciar o upload. Tente novamente.' }, { status: 503 });
    }
  }

  const failAttempt = async (message: string, status = 502, errorCode?: string) => {
    const { error } = await db.from('scan_pipeline_upload_attempts').update({ status: 'FAILED', error_code: errorCode || null, updated_at: new Date().toISOString() }).eq('id', uploadId);
    if (error) console.error('scan_pipeline_upload_attempt_failure_record_failed', { code: error.code, message: error.message });
    return json({ error: message, uploadId }, { status });
  };

  let deliveryKey = crypto.randomUUID();
  if (replacementId) {
    const { data: replacement, error: replacementError } = await db.from('scan_production_files')
      .select('id, delivery_key').eq('id', replacementId).eq('scan_id', scanId).eq('production_chapter_id', productionChapterId).eq('stage_id', stageId).eq('is_current', true).maybeSingle();
    if (replacementError) {
      console.error('scan_pipeline_upload_replacement_lookup_failed', { code: replacementError.code, message: replacementError.message });
      return failAttempt('Não foi possível validar o arquivo a substituir.', 503, replacementError.code);
    }
    if (!replacement) return failAttempt('O arquivo a substituir não está mais disponível.', 409, 'REPLACEMENT_NOT_CURRENT');
    deliveryKey = replacement.delivery_key;
  }

  const safeFilename = sanitizeFilename(rawFilename);

  let buffer: Buffer;
  let checksum: string;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
    checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  } catch (error) {
    console.error('scan_pipeline_upload_read_failed', { message: error instanceof Error ? error.message : 'unknown' });
    return failAttempt('Não foi possível ler o arquivo selecionado.', 400, 'READ_FAILED');
  }

  let storedRecord: { provider: string; fileKey: string; shardId: string | null; poolId: string | null; botReference: string; telegramFileId: string | null; sha256: string; byteSize: number };
  // Version allocation happens atomically after storage succeeds. Keeping the
  // storage key independent of that version prevents two concurrent uploads
  // from racing for the same path before the database serializes them.
  const artifactKey = `production/${scanId}/${productionChapterId}/${stage.slug}/${deliveryKey}/${uploadId}-${safeFilename}`;
  const storeInArtifacts = async () => {
    const staffDb = createClient(env.STAFF_SUPABASE_URL || 'https://pgumtergvtbeepzpgvkv.supabase.co', env.STAFF_SUPABASE_SERVICE_ROLE_KEY || '');
    const { error } = await staffDb.storage.from('scan-artifacts').upload(artifactKey, buffer, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) throw error;
    return { provider: 'STORAGE', fileKey: artifactKey, shardId: null, poolId: null, botReference: 'PRODUCTION_STORAGE', telegramFileId: null, sha256: checksum, byteSize: file.size };
  };

  try {
    if (file.size > LARGE_FILE_THRESHOLD) {
      storedRecord = await storeInArtifacts();
    } else {
      try {
        const tgRecord = await uploadPipelineFileToStorage({ bytes: new Uint8Array(buffer), fileName: safeFilename, mime: file.type || 'application/octet-stream', userId: locals.user.id, scanId, productionChapterId, stageId });
        storedRecord = { provider: 'TELEGRAM', fileKey: `prod_${checksum.slice(0, 16)}_${Date.now()}`, shardId: tgRecord.shardId, poolId: tgRecord.poolId, botReference: tgRecord.botReference, telegramFileId: tgRecord.telegramFileId, sha256: tgRecord.sha256 || checksum, byteSize: tgRecord.byteSize };
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
  } catch (error: any) {
    console.error('scan_pipeline_upload_storage_failed', { uploadId, code: error?.code || null, message: error?.message || 'unknown' });
    return failAttempt('Falha ao enviar o arquivo ao armazenamento. Você pode tentar novamente sem perder os demais arquivos.', 502, error?.code || 'STORAGE_FAILED');
  }

  // The database owns the state transition from stored artifact -> current
  // delivery. It locks the stage and the delivery lineage, versions only that
  // file, and updates the upload intent in one transaction.
  const { data: finalized, error: finalizeError } = await db.rpc('finalize_scan_pipeline_file', {
    p_upload_id: uploadId,
    p_replace_file_id: replacementId,
    p_payload: {
      scan_id: scanId,
      work_id: chapter.work_id,
      production_chapter_id: productionChapterId,
      stage_id: stageId,
      stage_slug: stage.slug,
      delivery_key: deliveryKey,
      file_name: rawFilename,
      byte_size: storedRecord.byteSize,
      mime_type: file.type || 'application/octet-stream',
      file_key: storedRecord.fileKey,
      storage_pool_id: storedRecord.poolId,
      storage_shard_id: storedRecord.shardId,
      bot_reference: storedRecord.botReference,
      telegram_file_id: storedRecord.telegramFileId,
      sha256: storedRecord.sha256,
      provider: storedRecord.provider,
      uploaded_by: locals.user.id,
      is_leadership: locals.role === 'ADMIN' || ['OWNER', 'ADMIN'].includes(membershipRole || ''),
      note
    }
  });
  const currentFile = Array.isArray(finalized) ? finalized[0] : finalized;
  if (finalizeError || !currentFile) {
    const conflict = /REPLACEMENT_NOT_CURRENT|STAGE_NO_LONGER_ACCEPTS_UPLOAD|STAGE_ASSIGNMENT_CHANGED/.test(finalizeError?.message || '');
    console.error('scan_pipeline_upload_finalize_failed', { code: finalizeError?.code || null, message: finalizeError?.message || 'unknown', conflict });
    return failAttempt(
      conflict
        ? 'A etapa ou o arquivo foi atualizado por outra pessoa. Atualize a lista antes de tentar novamente.'
        : 'O arquivo foi enviado, mas não pôde ser registrado com segurança. Tente reenviá-lo.',
      conflict ? 409 : 503,
      finalizeError?.code || (conflict ? 'CONCURRENT_UPDATE' : 'FINALIZE_FAILED')
    );
  }

  const { data: callerMember } = await db.from('members').select('username, display_name').eq('id', locals.user.id).maybeSingle();
  const callerName = callerMember?.display_name || callerMember?.username || 'Membro';
  await Promise.all([
    db.from('scan_chapter_timeline').insert({ scan_id: scanId, production_chapter_id: productionChapterId, stage_id: stageId, stage_slug: stage.slug, event_type: 'FILE_UPLOADED', user_id: locals.user.id, user_name: callerName, details: { file_name: rawFilename, version: currentFile.version, delivery_key: currentFile.delivery_key, byte_size: file.size, note: note || null } })
  ]);
  const { error: resolveError } = await db.rpc('resolve_scan_chapter_dependencies', { p_production_chapter_id: productionChapterId });
  if (resolveError) console.error('scan_pipeline_upload_dependency_resolve_failed', { code: resolveError.code, message: resolveError.message });
  return json({ success: true, file: currentFile, version: currentFile.version, uploadId, deliveryKey: currentFile.delivery_key });
};

// A failed item may be discarded; it must not block a valid partial delivery
// forever. This never touches a successfully stored file.
export const DELETE = async ({ locals, url }) => {
  if (!locals.user) return json({ error: 'Não autenticado' }, { status: 401 });
  const uploadId = url.searchParams.get('upload_id');
  if (!isUuid(uploadId)) return json({ error: 'Upload inválido' }, { status: 400 });
  const db = privileged();
  const { data: attempt, error } = await db.from('scan_pipeline_upload_attempts').select('id, scan_id, user_id, status').eq('id', uploadId).maybeSingle();
  if (error) return json({ error: 'Não foi possível localizar o upload.' }, { status: 503 });
  if (!attempt) return json({ error: 'Upload não encontrado' }, { status: 404 });
  const access = await checkScanAccess(db, attempt.scan_id, locals.user.id, locals.role);
  if (access.error) {
    console.error('scan_pipeline_upload_discard_access_lookup_failed', { code: access.error.code, message: access.error.message });
    return json({ error: 'Não foi possível validar sua permissão agora.' }, { status: 503 });
  }
  if (!access.allowed || (attempt.user_id !== locals.user.id && locals.role !== 'ADMIN')) return json({ error: 'Acesso não autorizado' }, { status: 403 });
  if (attempt.status === 'SUCCEEDED') return json({ error: 'Uploads concluídos não podem ser descartados por esta ação.' }, { status: 409 });
  const { error: updateError } = await db.from('scan_pipeline_upload_attempts').update({ status: 'CANCELLED', updated_at: new Date().toISOString() }).eq('id', uploadId);
  if (updateError) return json({ error: 'Não foi possível descartar o upload.' }, { status: 503 });
  return json({ success: true });
};
