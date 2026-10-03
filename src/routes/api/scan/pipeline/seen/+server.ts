import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const POST: RequestHandler = async ({ request, locals, platform }: any) => {
  if (!locals.user) {
    throw error(401, 'Não autenticado');
  }

  const body = await request.json().catch(() => ({}));
  const chapterStageId = body.chapter_stage_id;

  if (!chapterStageId) {
    throw error(400, 'chapter_stage_id é obrigatório');
  }

  try {
    const result = await executeYugabyteSql<{ result: any }>(
      `SELECT public.mark_pipeline_stage_seen_ysql($1,$2,$3) AS result`,
      [chapterStageId, locals.user.id, locals.role === 'ADMIN'], platform?.env
    );
    return json(result.rows[0]?.result ?? { success: false, error: 'empty_result' });
  } catch (err: any) {
    const detail = String(err?.message || 'unknown');
    const expected = /CHAPTER_STAGE_NOT_FOUND|SCAN_MEMBERSHIP_REQUIRED/.test(detail);
    return json({ success: false, error: expected ? 'Etapa inexistente ou sem permissão.' : 'Não foi possível registrar a visualização.' }, { status: expected ? 403 : 503 });
  }
};
