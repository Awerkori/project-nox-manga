import { json } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import { resolveBotDownloadClient } from '$lib/server/storage-router';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function ysql<T>(platform: any, query: string, params: any[] = []) {
  return executeYugabyteSql<T>(query, params, platform?.env);
}

function logYsqlFailure(operation: string, error: any) {
  console.error('scan_pipeline_file_ysql_failed', {
    operation,
    code: typeof error?.code === 'string' ? error.code : null,
    message: String(error?.message || 'unknown').slice(0, 240)
  });
}

async function canAccessScan(platform: any, scanId: string, userId: string, isGlobalAdmin: boolean) {
  if (isGlobalAdmin) return { allowed: true, role: 'ADMIN' };
  const member = await ysql<{ role: string }>(platform,
    'SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1', [scanId, userId]);
  return { allowed: Boolean(member.rows[0]), role: member.rows[0]?.role || null };
}

export const GET = async ({ locals, params, url, platform }) => {
  if (!UUID.test(params.id)) return json({ error: 'ID inválido' }, { status: 404 });
  if (!locals.user) return json({ error: 'Autenticação necessária' }, { status: 401 });

  let file: any;
  try {
    const lookup = await ysql<any>(platform, `
      SELECT file.*, stage.name AS stage_name, stage.slug AS workflow_stage_slug
      FROM public.scan_production_files file
      LEFT JOIN public.scan_workflow_stages stage ON stage.id = file.stage_id
      WHERE file.id = $1
      LIMIT 1
    `, [params.id]);
    file = lookup.rows[0];
  } catch (error) {
    logYsqlFailure('lookup', error);
    return json({ error: 'Não foi possível consultar o arquivo agora.' }, { status: 503 });
  }
  if (!file) return json({ error: 'Arquivo não encontrado' }, { status: 404 });

  try {
    const access = await canAccessScan(platform, file.scan_id, locals.user.id, locals.role === 'ADMIN');
    if (!access.allowed) return json({ error: 'Acesso negado. Este arquivo é estritamente restrito aos membros desta Scan.' }, { status: 403 });
  } catch (error) {
    logYsqlFailure('membership_lookup', error);
    return json({ error: 'Não foi possível validar sua permissão agora.' }, { status: 503 });
  }

  if (url.searchParams.get('meta') === '1') {
    return json({
      id: file.id, filename: file.file_name, size: file.byte_size, mimeType: file.mime_type,
      version: file.version, isCurrent: file.is_current, stage: file.stage_name,
      stageSlug: file.stage_slug || file.workflow_stage_slug, scanId: file.scan_id,
      createdAt: file.created_at, status: 'AUTHORIZED'
    });
  }

  const disposition = url.searchParams.get('download') === '0' ? 'inline' : 'attachment';
  const headers = {
    'Content-Type': file.mime_type || 'application/octet-stream',
    'Content-Disposition': `${disposition}; filename="${encodeURIComponent(file.file_name)}"`,
    'Content-Length': String(file.byte_size),
    'Cache-Control': 'private, no-transform, max-age=3600',
    'X-Content-Type-Options': 'nosniff'
  };

  // Artifact bytes are private storage, while file records and authorization
  // above are authoritative YSQL. No client receives a storage URL.
  if (['STORAGE', 'scan_artifacts', 'supabase'].includes(file.provider)) {
    try {
      const staffStorage = createClient(
        env.STAFF_SUPABASE_URL || 'https://pgumtergvtbeepzpgvkv.supabase.co',
        env.STAFF_SUPABASE_SERVICE_ROLE_KEY || ''
      );
      const { data: blob, error } = await staffStorage.storage.from('scan-artifacts').download(file.file_key);
      if (error || !blob) {
        console.error('scan_pipeline_file_storage_download_failed', { code: error?.name || null, message: String(error?.message || 'not_found').slice(0, 240) });
        return json({ error: 'O arquivo não está disponível no armazenamento neste momento.' }, { status: 502 });
      }
      return new Response(blob.stream(), { status: 200, headers });
    } catch (error: any) {
      console.error('scan_pipeline_file_storage_stream_failed', { message: String(error?.message || 'unknown').slice(0, 240) });
      return json({ error: 'Não foi possível iniciar o download agora.' }, { status: 502 });
    }
  }

  const telegramFileId = file.telegram_file_id || (file.provider === 'TELEGRAM' ? file.file_key : null);
  if (!telegramFileId) return json({ error: 'Arquivo não possui chave de armazenamento disponível para download.' }, { status: 404 });
  try {
    const client = resolveBotDownloadClient(file.bot_reference || 'PRODUCTION_STORAGE');
    return new Response(await client.download(telegramFileId), { status: 200, headers });
  } catch (error: any) {
    console.error('scan_pipeline_file_telegram_download_failed', { message: String(error?.message || 'unknown').slice(0, 240) });
    return json({ error: 'Não foi possível iniciar o download agora.' }, { status: 502 });
  }
};

export const DELETE = async ({ locals, params, platform }) => {
  if (!UUID.test(params.id)) return json({ error: 'ID inválido' }, { status: 404 });
  if (!locals.user) return json({ error: 'Autenticação necessária' }, { status: 401 });

  try {
    const found = await ysql<any>(platform, `
      SELECT id, scan_id, production_chapter_id, stage_id, stage_slug, file_name, uploaded_by, is_current
      FROM public.scan_production_files WHERE id = $1 LIMIT 1
    `, [params.id]);
    const file = found.rows[0];
    if (!file) return json({ error: 'Arquivo não encontrado' }, { status: 404 });

    const access = await canAccessScan(platform, file.scan_id, locals.user.id, locals.role === 'ADMIN');
    if (!access.allowed) return json({ error: 'Acesso não autorizado' }, { status: 403 });
    const mayRemove = locals.role === 'ADMIN' || ['OWNER', 'ADMIN'].includes(access.role || '') || file.uploaded_by === locals.user.id;
    if (!mayRemove) return json({ error: 'Apenas quem enviou o arquivo ou a liderança da Scan pode removê-lo.' }, { status: 403 });

    const member = await ysql<{ username: string | null; display_name: string | null }>(platform,
      'SELECT username, display_name FROM public.members WHERE id = $1 LIMIT 1', [locals.user.id]);
    const actorName = member.rows[0]?.display_name || member.rows[0]?.username || 'Membro';
    const withdrawn = await ysql<{ result: any }>(platform, `
      SELECT public.withdraw_scan_pipeline_file_ysql($1, $2, $3, $4) AS result
    `, [file.id, locals.user.id, locals.role === 'ADMIN', actorName]);
    return json(withdrawn.rows[0]?.result || { success: true });
  } catch (error) {
    logYsqlFailure('withdraw', error);
    const conflict = /FILE_WITHDRAW_NOT_ALLOWED|CHAPTER_STAGE_NOT_FOUND/.test(String((error as any)?.message || ''));
    return json({ error: conflict ? 'O arquivo ou a etapa mudou antes da remoção. Atualize a lista.' : 'Não foi possível remover o arquivo da entrega.' }, { status: conflict ? 409 : 503 });
  }
};
