import { json } from '@sveltejs/kit';
import { db, schema, safeQuerySingle } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import crypto from 'node:crypto';

const BLOCKED_EXTENSIONS = [
  '.exe', '.apk', '.bat', '.cmd', '.sh', '.bin', '.dll', '.msi',
  '.vbs', '.ps1', '.scr', '.com', '.pif', '.hta', '.cpl', '.jar'
];

export const POST = async ({ locals, request }) => {
  if (!locals.user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  const formData = await request.formData();
  const scanId = formData.get('scan_id')?.toString();
  const contextType = formData.get('context_type')?.toString() || 'MURAL_POST';
  const contextId = formData.get('context_id')?.toString();
  const file = formData.get('file');

  if (!scanId || !contextId) {return json({ error: 'scanId e contextId so obrigatrios'}, { status: 400 });
  }

  if (!file || !(file instanceof Blob)) {
    return json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
  }

  // Verify scan membership or Global Admin
  const isGlobalAdmin = locals.role === 'ADMIN';
  if (!isGlobalAdmin) {
    const { data: member } = await safeQuerySingle(
      db.select({ role: schema.scanMembers.role })
        .from(schema.scanMembers)
        .where(
          and(
            eq(schema.scanMembers.scanId, scanId),
            eq(schema.scanMembers.userId, locals.user!.id)
          )
        )
    );

    if (!member) {
      return json({ error: 'Acesso no autorizado a esta Scan' }, { status: 403 });
    }
  }

  const rawFilename = file.name || 'arquivo';
  const ext = rawFilename.lastIndexOf('.') !== -1 ? rawFilename.slice(rawFilename.lastIndexOf('.')).toLowerCase() : '';

  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return json({
      error: 'Formato de arquivo executvel bloqueado por polticas de segurana da plataforma.'
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
  const { data: attachment, error: dbErr } = await safeQuerySingle(
    db.insert(schema.scanAttachments)
      .values({
        scanId: scanId,
        contextType: contextType as any,
        contextId: contextId,
        uploadedBy: locals.user!.id,
        originalFilename: rawFilename,
        safeFilename: safeFilename,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        checksum: checksum,
        storageReference: 'att_' + checksum.slice(0, 16) + '_' + Date.now(),
        storageProvider: 'PRIVATE_STORAGE' as any
      })
      .returning()
  );

  if (dbErr) {
    return json({ error: 'Falha ao salvar anexo: ' + (dbErr as any).message }, { status: 500 });
  }

  return json({
    success: true,
    attachment
  });
};
