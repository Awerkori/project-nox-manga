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
  const { data: file, error: fileLookupError } = await db
    .from('scan_production_files')
    .select('*, scan_workflow_stages:stage_id(name, slug)')
    .eq('id', params.id)
    .maybeSingle();

  if (fileLookupError) {
    console.error('scan_pipeline_file_lookup_failed', { code: fileLookupError.code, message: fileLookupError.message });
    return json({ error: 'Não foi possível consultar o arquivo agora.' }, { status: 503 });
  }

  if (!file) {
    return json({ error: 'Arquivo não encontrado' }, { status: 404 });
  }

  // Cross-scan authorization enforcement: strictly block non-members with 403
  const isGlobalAdmin = locals.role === 'ADMIN';
  if (!isGlobalAdmin) {
    const { data: member, error: memberLookupError } = await db
      .from('scan_members')
      .select('role')
      .eq('scan_id', file.scan_id)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (memberLookupError) {
      console.error('scan_pipeline_file_membership_lookup_failed', { code: memberLookupError.code, message: memberLookupError.message });
      return json({ error: 'Não foi possível validar sua permissão agora.' }, { status: 503 });
    }

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
      filename: file.file_name,
      size: file.byte_size,
      mimeType: file.mime_type,
      version: file.version,
      isCurrent: file.is_current,
      stage: file.scan_workflow_stages?.name,
      stageSlug: file.stage_slug || file.scan_workflow_stages?.slug,
      scanId: file.scan_id,
      createdAt: file.created_at,
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
        .download(file.file_key);

      if (dlErr || !blob) {
        console.error('scan_pipeline_file_storage_download_failed', { code: dlErr?.name || null, message: dlErr?.message || 'not_found' });
        return json({ error: 'O arquivo não está disponível no armazenamento neste momento.' }, { status: 502 });
      }

      return new Response(blob.stream(), {
        status: 200,
        headers: {
          'Content-Type': file.mime_type || 'application/octet-stream',
          'Content-Disposition': `${disposition}; filename="${encodeURIComponent(file.file_name)}"`,
          'Content-Length': String(file.byte_size),
          'Cache-Control': 'private, no-transform, max-age=3600',
          'X-Content-Type-Options': 'nosniff'
        }
      });
  } catch (err: any) {
      console.error('scan_pipeline_file_storage_stream_failed', { message: err?.message || 'unknown' });
      return json({ error: 'Não foi possível iniciar o download agora.' }, { status: 502 });
    }
  }

  // Otherwise Telegram Bot API streaming download
  const telegramFileId = file.telegram_file_id || (file.provider === 'TELEGRAM' ? file.file_key : null);
  if (!telegramFileId) {
    return json({ error: 'Arquivo não possui chave de armazenamento disponível para download.' }, { status: 404 });
  }

  const botRef = file.bot_reference || 'PRODUCTION_STORAGE';

  try {
    const client = resolveBotDownloadClient(botRef);
    const stream = await client.download(telegramFileId);

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': file.mime_type || 'application/octet-stream',
        'Content-Disposition': `${disposition}; filename="${encodeURIComponent(file.file_name)}"`,
        'Content-Length': String(file.byte_size),
        'Cache-Control': 'private, no-transform, max-age=3600',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (err: any) {
    console.error('scan_pipeline_file_telegram_download_failed', { message: err?.message || 'unknown' });
    return json({ error: 'Não foi possível iniciar o download agora.' }, { status: 502 });
  }
};

// Removing a file means withdrawing that deliverable from the active delivery.
// The private object is retained for audit/retention; it is never made public.
export const DELETE = async ({ locals, params }) => {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) {
    return json({ error: 'ID inválido' }, { status: 404 });
  }
  if (!locals.user) return json({ error: 'Autenticação necessária' }, { status: 401 });

  const db = privileged();
  const { data: file, error: fileError } = await db
    .from('scan_production_files')
    .select('id, scan_id, production_chapter_id, stage_id, stage_slug, file_name, uploaded_by, is_current')
    .eq('id', params.id)
    .maybeSingle();
  if (fileError) {
    console.error('scan_pipeline_file_remove_lookup_failed', { code: fileError.code, message: fileError.message });
    return json({ error: 'Não foi possível localizar o arquivo.' }, { status: 503 });
  }
  if (!file) return json({ error: 'Arquivo não encontrado' }, { status: 404 });

  let memberRole: string | null = null;
  if (locals.role !== 'ADMIN') {
    const { data: member, error: memberError } = await db
      .from('scan_members')
      .select('role')
      .eq('scan_id', file.scan_id)
      .eq('user_id', locals.user.id)
      .maybeSingle();
    if (memberError) return json({ error: 'Não foi possível validar sua permissão.' }, { status: 503 });
    memberRole = member?.role || null;
  }

  const mayRemove = locals.role === 'ADMIN' || ['OWNER', 'ADMIN'].includes(memberRole || '') || file.uploaded_by === locals.user.id;
  if (!mayRemove) return json({ error: 'Apenas quem enviou o arquivo ou a liderança da Scan pode removê-lo.' }, { status: 403 });
  const { data: member } = await db.from('members').select('username, display_name').eq('id', locals.user.id).maybeSingle();
  const isLeadership = locals.role === 'ADMIN' || ['OWNER', 'ADMIN'].includes(memberRole || '');
  const { data: withdrawal, error: removeError } = await db.rpc('withdraw_scan_pipeline_file', {
    p_file_id: file.id,
    p_actor_id: locals.user.id,
    p_actor_name: member?.display_name || member?.username || 'Membro',
    p_is_leadership: isLeadership
  });
  if (removeError) {
    const conflict = /FILE_WITHDRAW_NOT_ALLOWED|CHAPTER_STAGE_NOT_FOUND/.test(removeError.message || '');
    console.error('scan_pipeline_file_remove_failed', { code: removeError.code || null, message: removeError.message || 'unknown', conflict });
    return json({ error: conflict ? 'O arquivo ou a etapa mudou antes da remoção. Atualize a lista.' : 'Não foi possível remover o arquivo da entrega.' }, { status: conflict ? 409 : 503 });
  }
  return json(withdrawal || { success: true });
};
