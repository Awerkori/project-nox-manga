import { json } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const GET = async ({ locals, params, url, platform }: any) => {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) {
    return json({ error: 'ID de anexo inválido' }, { status: 404 });
  }

  if (!locals.user) {
    return json({ error: 'Autenticação necessária' }, { status: 401 });
  }

  const lookup = await executeYugabyteSql<any>(
    `SELECT * FROM public.scan_attachments WHERE id = $1 LIMIT 1`, [params.id], platform?.env
  );
  const attachment = lookup.rows[0] || null;

  if (!attachment) {
    return json({ error: 'Anexo não encontrado' }, { status: 404 });
  }

  // Cross-scan authorization enforcement
  const isGlobalAdmin = locals.role === 'ADMIN';
  if (!isGlobalAdmin) {
    const member = (await executeYugabyteSql<{ role: string }>(
      `SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1`,
      [attachment.scan_id, locals.user.id], platform?.env
    )).rows[0] || null;

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
