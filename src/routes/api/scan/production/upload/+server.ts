import { json } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { uploadPipelineFileToStorage } from '$lib/server/storage-router';
import { RateLimitError } from '$lib/server/media';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import crypto from 'node:crypto';

const BLOCKED_EXTENSIONS = [
  '.exe', '.apk', '.bat', '.cmd', '.sh', '.bin', '.dll', '.msi',
  '.vbs', '.ps1', '.scr', '.com', '.pif', '.hta', '.cpl', '.jar'
];

export const POST = async ({ locals, request }) => {
  if (!locals.user) {
    return json({ error: 'Não autenticado' }, { status: 401 });
  }

  const formData = await request.formData();
  const scanId = formData.get('scan_id')?.toString();
  const productionChapterId = formData.get('production_chapter_id')?.toString();
  const stageId = formData.get('stage_id')?.toString();
  const note = formData.get('note')?.toString() || '';
  const file = formData.get('file');

  if (!scanId || !productionChapterId || !stageId) {return json({ error: 'scanId, productionChapterId e stageId são obrigatórios'}, { status: 400 });
  }

  if (!file || !(file instanceof Blob)) {
    return json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
  }

  const db = privileged();

  // Verify scan membership or Global Admin
  const isGlobalAdmin = locals.role === 'ADMIN';
  if (!isGlobalAdmin) {
    const { data: member } = await db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scanId)
      .eq('user_id', locals.user!.id)
      .maybeSingle();

    if (!member) {
      return json({ error: 'Acesso não autorizado a esta Scan' }, { status: 403 });
    }
  }

  // Get chapter info
  const { data: chapter } = await db
    .from('scan_production_chapters')
    .select('id, work_id, chapter_number')
    .eq('id', productionChapterId)
    .single();

  if (!chapter) {
    return json({ error: 'Capítulo não encontrado' }, { status: 404 });
  }

  // Get stage info
  const { data: stage } = await db
    .from('scan_workflow_stages')
    .select('id, slug, name')
    .eq('id', stageId)
    .single();

  if (!stage) {
    return json({ error: 'Etapa não encontrada' }, { status: 404 });
  }

  const rawFilename = (file as any).name || 'arquivo';
  const ext = rawFilename.lastIndexOf('.') !== -1 ? rawFilename.slice(rawFilename.lastIndexOf('.')).toLowerCase() : '';

  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return json({
      error: 'Formato de arquivo executável bloqueado por políticas de segurança da plataforma.'
    }, { status: 400 });
  }

  const safeFilename = rawFilename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase();

  // 500 MB ceiling for RAW archives and working packages
  const MAX_PIPELINE_SIZE = 524_288_000;
  if (file.size > MAX_PIPELINE_SIZE) {
    return json({
      error: `Arquivo excede o limite máximo permitido de 500 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB enviado).`
    }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const bytes = new Uint8Array(buffer);
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  // Determine next version
  const { data: existingFiles } = await db
    .from('scan_production_files')
    .select('version')
    .eq('production_chapter_id', productionChapterId)
    .eq('stage_id', stageId)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersion = (existingFiles?.[0]?.version || 0) + 1;

  const isLargeFile = file.size > 20_971_520;
  let storedRecord: {
    provider: string;
    fileKey: string;
    shardId: string | null;
    poolId: string | null;
    botReference: string;
    telegramFileId: string | null;
    sha256: string;
    byteSize: number;
  };

  if (isLargeFile) {
    // Dedicated Artifact Storage for large files (> 20 MB up to 500 MB)
    try {
      const staffDb = createClient(
        env.STAFF_SUPABASE_URL || 'https://pgumtergvtbeepzpgvkv.supabase.co',
        env.STAFF_SUPABASE_SERVICE_ROLE_KEY || ''
      );
      const artifactKey = `production/${scanId}/${productionChapterId}/${stage.slug}/v${nextVersion}/${crypto.randomUUID()}-${safeFilename}`;
      const { error: upErr } = await staffDb.storage
        .from('scan-artifacts')
        .upload(artifactKey, buffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: false
        });

      if (upErr) {
        return json({ error: 'Falha no storage de artifacts: ' + upErr.message }, { status: 502 });
      }

      storedRecord = {
        provider: 'STORAGE',
        fileKey: artifactKey,
        shardId: null,
        poolId: null,
        botReference: 'PRODUCTION_STORAGE',
        telegramFileId: null,
        sha256: checksum,
        byteSize: file.size
      };
    } catch (err: any) {
      return json({ error: 'Erro ao enviar para storage de artifacts: ' + (err?.message || 'Erro desconhecido') }, { status: 502 });
    }
  } else {
    // Standard pipeline upload: try Telegram PRODUCTION_STORAGE shard; fallback to dedicated artifact bucket if bot unprovisioned
    try {
      const tgRecord = await uploadPipelineFileToStorage({
        bytes,
        fileName: safeFilename,
        mime: file.type || 'application/octet-stream',
        userId: locals.user!.id,
        scanId,
        productionChapterId,
        stageId
      });
      storedRecord = {
        provider: 'TELEGRAM',
        fileKey: 'prod_' + checksum.slice(0, 16) + '_' + Date.now(),
        shardId: tgRecord.shardId,
        poolId: tgRecord.poolId,
        botReference: tgRecord.botReference,
        telegramFileId: tgRecord.telegramFileId,
        sha256: tgRecord.sha256 || checksum,
        byteSize: bytes.byteLength
      };
    } catch (err: any) {
      if (err instanceof RateLimitError) {
        return new Response(
          JSON.stringify({ error: 'Rate limit temporário do armazenamento. Tente novamente em instantes.', retryAfter: err.retryAfter }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(err.retryAfter)
            }
          }
        );
      }
      // If Telegram bot fails or throws FAIL_CLOSED because bot is not configured, fall back to dedicated scan-artifacts bucket
      if (err?.message?.includes('FAIL_CLOSED') || err?.message?.includes('TELEGRAM_BOT_PRODUCTION_STORAGE')) {
        const staffDb = createClient(
          env.STAFF_SUPABASE_URL || 'https://pgumtergvtbeepzpgvkv.supabase.co',
          env.STAFF_SUPABASE_SERVICE_ROLE_KEY || ''
        );
        const artifactKey = `production/${scanId}/${productionChapterId}/${stage.slug}/v${nextVersion}/${crypto.randomUUID()}-${safeFilename}`;
        const { error: upErr } = await staffDb.storage
          .from('scan-artifacts')
          .upload(artifactKey, buffer, {
            contentType: file.type || 'application/octet-stream',
            upsert: false
          });

        if (upErr) {
          return json({ error: 'Falha no storage de artifacts: ' + upErr.message }, { status: 502 });
        }

        storedRecord = {
          provider: 'STORAGE',
          fileKey: artifactKey,
          shardId: null,
          poolId: null,
          botReference: 'PRODUCTION_STORAGE',
          telegramFileId: null,
          sha256: checksum,
          byteSize: file.size
        };
      } else {
        return json({ error: 'Falha no envio para o armazenamento de produção: ' + (err?.message || 'Erro desconhecido') }, { status: 502 });
      }
    }
  }

  // Mark previous versions as not current
  await db
    .from('scan_production_files')
    .update({isCurrent: false})
    .eq('production_chapter_id', productionChapterId)
    .eq('stage_id', stageId);

  // Insert new version
  const { data: newFile, error: insertErr } = await db
    .from('scan_production_files')
    .insert({scanId: scanId,
      workId: chapter.workId,
      productionChapterId: productionChapterId,
      stageId: stageId,
      stageSlug: stage.slug,
      fileName: rawFilename,
      byteSize: storedRecord.byteSize,
      mimeType: file.type || 'application/octet-stream',
      fileKey: storedRecord.fileKey,
      storagePoolId: storedRecord.poolId,
      storageShardId: storedRecord.shardId,
      botReference: storedRecord.botReference,
      telegramFileId: storedRecord.telegramFileId,
      sha256: storedRecord.sha256,
      provider: storedRecord.provider,
      version: nextVersion,
      uploadedBy: locals.user!.id,
      isCurrent: true,
      note: note || null})
    .select()
    .single();

  if (insertErr) {
    return json({ error: 'Falha ao registrar arquivo: ' + insertErr.message }, { status: 500 });
  }

  // Update stage activity
  await db
    .from('scan_chapter_stages')
    .update({lastActivityAt: new Date().toISOString()})
    .eq('production_chapter_id', productionChapterId)
    .eq('stage_id', stageId);

  // Record in timeline
  const { data: callerMember } = await db
    .from('members')
    .select('username, display_name')
    .eq('id', locals.user!.id)
    .single();

  const callerName = callerMember?.displayName || callerMember?.username || 'Membro';

  await db
    .from('scan_chapter_timeline')
    .insert({scanId: scanId,
      productionChapterId: productionChapterId,
      stageId: stageId,
      stageSlug: stage.slug,
      eventType: 'FILE_UPLOADED',
      userId: locals.user!.id,
      userName: callerName,
      details: {
        fileName: rawFilename,
        version: nextVersion,
        byteSize: file.size,
        note: note || null}
    });

  // Re-resolve DAG dependencies
  await db.rpc('resolve_scan_chapter_dependencies', { p_production_chapter_id: productionChapterId });

  return json({
    success: true,
    file: newFile,
    version: nextVersion
  });
};
