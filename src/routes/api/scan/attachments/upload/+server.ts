import { json } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
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
  const contextType = formData.get('context_type')?.toString() || 'MURAL_POST';
  const contextId = formData.get('context_id')?.toString();
  const file = formData.get('file');

  if (!scanId || !contextId) {return json({ error: 'scanId e contextId são obrigatórios'}, { status: 400 });
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

  // Insert attachment metadata
  const { data: attachment, error: dbErr } = await db
    .from('scan_attachments')
    .insert({scanId: scanId,
      contextType: contextType,
      contextId: contextId,
      uploadedBy: locals.user!.id,
      originalFilename: rawFilename,
      safeFilename: safeFilename,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      checksum: checksum,
      storageReference: 'att_' + checksum.slice(0, 16) + '_' + Date.now(),
      storageProvider: 'PRIVATE_STORAGE'})
    .select()
    .single();

  if (dbErr) {
    return json({ error: 'Falha ao salvar anexo: ' + dbErr.message }, { status: 500 });
  }

  return json({
    success: true,
    attachment
  });
};
