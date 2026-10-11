import { json } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import crypto from 'node:crypto';

const BLOCKED_EXTENSIONS = [
  '.exe', '.apk', '.bat', '.cmd', '.sh', '.bin', '.dll', '.msi',
  '.vbs', '.ps1', '.scr', '.com', '.pif', '.hta', '.cpl', '.jar'
];

export const POST = async ({ locals, request, platform }: any) => {
  if (!locals.user) {
    return json({ error: 'Não autenticado' }, { status: 401 });
  }

  const formData = await request.formData();
  const scanId = formData.get('scan_id')?.toString();
  const contextType = formData.get('context_type')?.toString() || 'MURAL_POST';
  const contextId = formData.get('context_id')?.toString();
  const file = formData.get('file');

  if (!scanId || !contextId) {
    return json({ error: 'scan_id e context_id são obrigatórios' }, { status: 400 });
  }

  if (!file || !(file instanceof Blob)) {
    return json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
  }

  // Verify scan membership or Global Admin
  const isGlobalAdmin = locals.role === 'ADMIN';
  if (!isGlobalAdmin) {
    const member = (await executeYugabyteSql<{ role: string }>(
      `SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1`,
      [scanId, locals.user.id], platform?.env
    )).rows[0] || null;

    if (!member) {
      return json({ error: 'Acesso não autorizado a esta Scan' }, { status: 403 });
    }
  }

  const rawFilename = file.name || 'arquivo';
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  const attachmentResult = await executeYugabyteSql<any>(
    `INSERT INTO public.scan_attachments
      (scan_id, context_type, context_id, uploaded_by, original_filename, safe_filename,
       mime_type, size, checksum, storage_reference, storage_provider)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PRIVATE_STORAGE')
     RETURNING *`,
    [scanId, contextType, contextId, locals.user.id, rawFilename, safeFilename,
      file.type || 'application/octet-stream', file.size, checksum,
      'att_' + checksum.slice(0, 16) + '_' + Date.now()], platform?.env
  );
  const attachment = attachmentResult.rows[0];
  if (!attachment) return json({ error: 'Falha ao salvar anexo.' }, { status: 503 });

  return json({
    success: true,
    attachment
  });
};
