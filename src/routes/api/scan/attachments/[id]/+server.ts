import { error, json } from '@sveltejs/kit';
import { db, schema, safeQuerySingle } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';

export const GET = async ({ locals, params, url }) => {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) {
    return json({ error: 'ID de anexo invlido' }, { status: 404 });
  }

  if (!locals.user) {
    return json({ error: 'Autenticao necessria' }, { status: 401 });
  }

  const { data: attachment } = await safeQuerySingle(
    db.select().from(schema.scanAttachments).where(eq(schema.scanAttachments.id, params.id))
  );

  if (!attachment) {
    return json({ error: 'Anexo no encontrado' }, { status: 404 });
  }

  // Cross-scan authorization enforcement
  const isGlobalAdmin = locals.role === 'ADMIN';
  if (!isGlobalAdmin) {
    const { data: member } = await safeQuerySingle(
      db.select({ role: schema.scanMembers.role })
        .from(schema.scanMembers)
        .where(
          and(
            eq(schema.scanMembers.scanId, attachment.scanId),
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

  // Return file metadata and mock/signed stream header
  const isDownload = url.searchParams.get('download') === '1';
  const disposition = isDownload ? 'attachment' : 'inline';

  return new Response(JSON.stringify({
    id: attachment.id,
    filename: attachment.originalFilename,
    size: attachment.size,
    mimeType: attachment.mimeType,
    contextType: attachment.contextType,
    scanId: attachment.scanId,
    createdAt: attachment.createdAt,
    status: 'AUTHORIZED'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': disposition + '; filename="' + encodeURIComponent(attachment.safeFilename) + '"',
      'Cache-Control': 'private, no-transform, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    }
  });
};
