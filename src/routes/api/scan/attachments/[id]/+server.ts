import { error, json } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';

export const GET = async ({ locals, params, url }) => {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) {
    return json({ error: 'ID de anexo inválido' }, { status: 404 });
  }

  if (!locals.user) {
    return json({ error: 'Autenticação necessária' }, { status: 401 });
  }

  const db = privileged();
  const { data: attachment } = await db
    .from('scan_attachments')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!attachment) {
    return json({ error: 'Anexo não encontrado' }, { status: 404 });
  }

  // Cross-scan authorization enforcement
  const isGlobalAdmin = locals.role === 'ADMIN';
  if (!isGlobalAdmin) {
    const { data: member } = await db
      .from('scan_members')
      .select('role')
      .eq('scan_id', attachment.scan_id)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (!member) {
      return json({
        error: 'Acesso negado. Este arquivo é estritamente restrito aos membros desta Scan.'
      }, { status: 403 });
    }
  }

  // Return file metadata and mock/signed stream header
  const isDownload = url.searchParams.get('download') === '1';
  const disposition = isDownload ? 'attachment' : 'inline';

  return new Response(JSON.stringify({
    id: attachment.id,
    filename: attachment.original_filename,
    size: attachment.size,
    mimeType: attachment.mime_type,
    contextType: attachment.context_type,
    scanId: attachment.scan_id,
    createdAt: attachment.created_at,
    status: 'AUTHORIZED'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': disposition + '; filename="' + encodeURIComponent(attachment.safe_filename) + '"',
      'Cache-Control': 'private, no-transform, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    }
  });
};
