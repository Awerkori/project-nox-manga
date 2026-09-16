import { json, error as kitError } from '@sveltejs/kit';
import { editor, db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, and, sql } from 'drizzle-orm';
import { storeImage, RateLimitError } from '$lib/server/media';

export const POST = async ({ request, locals, url }) => {
  if (!locals.user) {
    throw kitError(401, 'Entre em uma conta confirmada para continuar.');
  }

  const rawPurpose = url.searchParams.get('purpose') || request.headers.get('x-media-purpose');
  const scanId = url.searchParams.get('scan_id') || request.headers.get('x-scan-id');
  const workId = url.searchParams.get('work_id') || request.headers.get('x-work-id');
  const chapterId = url.searchParams.get('chapter_id') || request.headers.get('x-chapter-id');
  const sessionId = url.searchParams.get('session_id') || request.headers.get('x-session-id');

  let resolvedPurpose = rawPurpose;

  // If uploading on behalf of a partner scan:
  if (scanId) {
    if (['scan_logo', 'scan_banner', 'scan_media'].includes(rawPurpose || '')) {
      // Check if caller is OWNER, ADMIN or platform ADMIN
      if (locals.role !== 'ADMIN') {
        const { data: members } = await safeQuerySingle(
          db.select({ role: schema.scanMembers.role })
            .from(schema.scanMembers)
            .where(and(eq(schema.scanMembers.scanId, scanId), eq(schema.scanMembers.userId, locals.user!.id)))
        );
        const member = members?.[0];

        if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
          throw kitError(403, 'Apenas o Dono ou Administrador da Scan podem alterar mídias institucionais.');
        }
      }
      resolvedPurpose = resolvedPurpose || 'scan_media';
    } else {if (!workId) {
        throw kitError(400, 'Identificador da obra (workId) é obrigatório para envio de capítulos.');}

      // Check per-work upload authorization using the database RPC
      const { data: authRes, error: authErr } = await safeQuery(
        db.execute(sql`SELECT can_upload_to_scan_work(${scanId}, ${workId}, ${locals.user!.id
      }) as is_authorized`)
      );
      const isAuthorized = (authRes as any[])?.[0]?.is_authorized;

      if (authErr || !isAuthorized) {
        throw kitError(403, 'Você não possui autorização para enviar capítulos desta obra ou a Scan está com envios pausados/em emergência.');
      }
      resolvedPurpose = 'scan_chapter';
    }
  } else {
    // Normal platform manual upload: require site staff role
    editor(locals);
    // Platform staff manual uploads must strictly route to STAFF_STORAGE (never MANGA_STORAGE)
    if (!resolvedPurpose || resolvedPurpose === 'editorial') {
      resolvedPurpose = 'staff_manual';
    }
  }

  try {const result = await storeImage(request, locals.user!.id, resolvedPurpose);

    // If tracked by an upload session, touch session updatedAt
    if (sessionId && /^[0-9a-f-]{36}$/.test(sessionId)) {try {
        await safeQuery(
          db.update(schema.uploadSessions)
            .set({ updatedAt: new Date().toISOString() })
            .where(eq(schema.uploadSessions.id, sessionId))
        );
      } catch {}
    }

    return json(result);
  } catch (failure) {
    if (failure instanceof RateLimitError) {
      const retryAfter = failure.retryAfter;
      return new Response(
        JSON.stringify({ error: 'Rate limit temporário. O envio será retomado automaticamente.', retryAfter }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter)
          }
        }
      );
    }
    throw failure;
  }
};
