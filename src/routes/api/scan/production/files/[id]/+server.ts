import { json } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { resolveBotDownloadClient } from '$lib/server/storage-router';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

export const GET = async ({ locals, params, url }) => {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) {
    return json({ error: 'ID inválido' }, { status: 404 });
  }

  if (!locals.user) {
    return json({ error: 'Autenticação necessária' }, { status: 401 });
  }

  const db = privileged();
  const { data: file } = await db
    .from('scan_production_files')
    .select('*, scan_workflow_stages:stage_id(name, slug)')
    .eq('id', params.id)
    .maybeSingle();

  if (!file) {
    return json({ error: 'Arquivo não encontrado' }, { status: 404 });
  }

  // Cross-scan authorization enforcement: strictly block non-members with 403
  const isGlobalAdmin = locals.role === 'ADMIN';
  if (!isGlobalAdmin) {
    const { data: member } = await db
      .from('scan_members')
      .select('role')
      .eq('scan_id', file.scanId)
      .eq('user_id', locals.user!.id)
      .maybeSingle();

    if (!member) {
      return json({
        error: 'Acesso negado. Este arquivo é estritamente restrito aos membros desta Scan.'
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
      const staffDb = createClient(
        env.STAFF_SUPABASE_URL || 'https://pgumtergvtbeepzpgvkv.supabase.co',
        env.STAFF_SUPABASE_SERVICE_ROLE_KEY || ''
      );
      const { data: blob, error: dlErr } = await staffDb.storage
        .from('scan-artifacts')
        .download(file.fileKey);

      if (dlErr || !blob) {
        return json({
          error: 'Falha ao baixar do storage de artifacts: ' + (dlErr?.message || 'Arquivo não encontrado')
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
    return json({ error: 'Arquivo não possui chave de armazenamento disponível para download.' }, { status: 404 });
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
      error: 'Não foi possível baixar o arquivo do armazenamento Telegram: ' + (err?.message || 'Erro desconhecido')
    }, { status: 502 });
  }
};
