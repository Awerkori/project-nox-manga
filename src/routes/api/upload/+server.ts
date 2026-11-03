import { json, error as kitError } from '@sveltejs/kit';
import { editor } from '$lib/server/db';
import { storeImage, RateLimitError } from '$lib/server/media';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const POST = async ({ request, locals, url, platform }: any) => {
  if (!locals.user) {
    throw kitError(401, 'Entre em uma conta confirmada para continuar.');
  }

  const rawPurpose = url.searchParams.get('purpose') || request.headers.get('x-media-purpose');
  const scanId = url.searchParams.get('scan_id') || request.headers.get('x-scan-id');
  const workId = url.searchParams.get('work_id') || request.headers.get('x-work-id');
  const chapterId = url.searchParams.get('chapter_id') || request.headers.get('x-chapter-id');
  const sessionId = url.searchParams.get('session_id') || request.headers.get('x-session-id');
  const platformEnv = platform?.env;

  let resolvedPurpose = rawPurpose;

  // If uploading candidate media for scan application / admission:
  if (['scan_candidate_logo', 'scan_candidate_banner', 'scan_candidate_media'].includes(rawPurpose || '')) {
    resolvedPurpose = rawPurpose || 'scan_candidate_media';
  } else if (scanId) {
    if (['scan_logo', 'scan_banner', 'scan_media'].includes(rawPurpose || '')) {
      // Check if caller is OWNER, ADMIN or platform ADMIN
      if (locals.role !== 'ADMIN') {
        const memRes = await executeYugabyteSql(
          `SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1;`,
          [scanId, locals.user.id],
          platformEnv
        );
        const member = memRes.rows[0];

        if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
          throw kitError(403, 'Apenas o Dono ou Administrador da Scan podem alterar mídias institucionais.');
        }
      }
      resolvedPurpose = resolvedPurpose || 'scan_media';
    } else {
      if (!workId) {
        throw kitError(400, 'Identificador da obra (work_id) é obrigatório para envio de capítulos.');
      }

      // Check per-work upload authorization using the database function
      const authRes = await executeYugabyteSql(
        `SELECT public.can_upload_to_scan_work($1, $2, $3) AS authorized;`,
        [scanId, workId, locals.user.id],
        platformEnv
      );
      const isAuthorized = Boolean(authRes.rows[0]?.authorized);

      if (!isAuthorized) {
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

  try {
    const result = await storeImage(request, locals.user.id, resolvedPurpose);

    // If tracked by an upload session, touch session updated_at
    if (sessionId && /^[0-9a-f-]{36}$/.test(sessionId)) {
      try {
        await executeYugabyteSql(
          `UPDATE public.upload_sessions SET updated_at = now() WHERE id = $1;`,
          [sessionId],
          platformEnv
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
