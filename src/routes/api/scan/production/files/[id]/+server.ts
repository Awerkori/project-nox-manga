import { json } from '@sveltejs/kit';
import { db, schema, safeQuerySingle } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import { resolveBotDownloadClient } from '$lib/server/storage-router';

import { env } from '$env/dynamic/private';

export const GET = async ({ locals, params, url }) => {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) {
    return json({ error: 'ID invlido' }, { status: 404 });
  }

  if (!locals.user) {
    return json({ error: 'Autenticao necessria' }, { status: 401 });
  }

  const { data: result } = await safeQuerySingle(
    db.select({
      file: schema.scanProductionFiles,
      stage: schema.scanWorkflowStages
    })
    .from(schema.scanProductionFiles)
    .leftJoin(schema.scanWorkflowStages, eq(schema.scanProductionFiles.stageId, schema.scanWorkflowStages.id))
    .where(eq(schema.scanProductionFiles.id, params.id))
  );

  if (!result || !result.file) {
    return json({ error: 'Arquivo no encontrado' }, { status: 404 });
  }

  const file = {
    ...result.file,
    scan_workflow_stages: result.stage
  };

  // Cross-scan authorization enforcement: strictly block non-members with 403
  const isGlobalAdmin = locals.role === 'ADMIN';
  if (!isGlobalAdmin) {
    const { data: member } = await safeQuerySingle(
      db.select({ role: schema.scanMembers.role })
        .from(schema.scanMembers)
        .where(
          and(
            eq(schema.scanMembers.scanId, file.scanId),
            eq(schema.scanMembers.userId, locals.user!.id)
          )
        )
    );

    if (!member) {
      return json({
        error: 'Acesso negado. Este arquivo  estritamente restrito aos membros desta Scan.'
      }, { status: 403 });
    }
  }

  // Return JSON metadata when explicitly requested
  if (url.searchParams.get('meta') === '1') {
    return json({
      id: file.id,
      filename: file.fileName,
      size: file.byteSize,
      mimeType: file.mimeType,
      version: file.version,
      isCurrent: file.isCurrent,
      stage: file.scan_workflow_stages?.name,
      stageSlug: file.stageSlug || file.scan_workflow_stages?.slug,
      scanId: file.scanId,
      createdAt: file.createdAt,
      status: 'AUTHORIZED'
    });
  }

  // Download does NOT trigger claim or mutate task assignment
  const isDownload = url.searchParams.get('download') !== '0';
  const disposition = isDownload ? 'attachment' : 'inline';

  // Support dedicated artifact storage (Supabase scan-artifacts bucket)
  if (file.provider === 'STORAGE' || file.provider === 'scan_artifacts' || file.provider === 'supabase') {
    try {
      const staffDb = (null as any); /* createClient(
        env.STAFF_SUPABASE_URL || 'https://pgumtergvtbeepzpgvkv.supabase.co',
        env.STAFF_SUPABASE_SERVICE_ROLE_KEY || ''
      );*/
      const { data: blob, error: dlErr } = await staffDb.storage
        .from('scan-artifacts')
        .download(file.fileKey);

      if (dlErr || !blob) {
        return json({
          error: 'Falha ao baixar do storage de artifacts: ' + (dlErr?.message || 'Arquivo no encontrado')
        }, { status: 502 });
      }

      return new Response(blob.stream(), {
        status: 200,
        headers: {
          'Content-Type': file.mimeType || 'application/octet-stream',
          'Content-Disposition': `${disposition}; filename="${encodeURIComponent(file.fileName)}"`,
          'Content-Length': String(file.byteSize),
          'Cache-Control': 'private, no-transform, max-age=3600',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    } catch (err: any) {
      return json({
        error: 'Erro no streaming do storage de artifacts: ' + (err?.message || 'Erro desconhecido')
      }, { status: 502 });
    }
  }

  // Otherwise Telegram Bot API streaming download
  const telegramFileId = file.telegramFileId || (file.provider === 'TELEGRAM' ? file.fileKey : null);
  if (!telegramFileId) {
    return json({ error: 'Arquivo no possui chave de armazenamento disponvel para download.' }, { status: 404 });
  }

  const botRef = file.botReference || 'PRODUCTION_STORAGE';

  try {
    const client = resolveBotDownloadClient(botRef);
    const stream = await client.download(telegramFileId);

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': `${disposition}; filename="${encodeURIComponent(file.fileName)}"`,
        'Content-Length': String(file.byteSize),
        'Cache-Control': 'private, no-transform, max-age=3600',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (err: any) {
    return json({
      error: 'No foi possvel baixar o arquivo do armazenamento Telegram: ' + (err?.message || 'Erro desconhecido')
    }, { status: 502 });
  }
};
