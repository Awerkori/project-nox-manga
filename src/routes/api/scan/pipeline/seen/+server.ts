import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Não autenticado');
  }

  const body = await request.json().catch(() => ({}));
  const chapterStageId = body.chapter_stage_id;

  if (!chapterStageId) {
    throw error(400, 'chapter_stage_id é obrigatório');
  }

  const { data, error: rpcErr } = await locals.db.rpc('mark_pipeline_stage_seen', {
    p_chapter_stage_id: chapterStageId
  });

  if (rpcErr) {
    return json({ success: false, error: rpcErr.message }, { status: 400 });
  }

  return json(data);
};
