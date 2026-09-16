import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, safeQuery } from '$lib/server/db';
import { sql } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Não autenticado');
  }

  const body = await request.json().catch(() => ({}));
  const chapterStageId = body.chapterStageId;

  if (!chapterStageId) {throw error(400, 'chapterStageId é obrigatório');}

  const { data, error: rpcErr } = await safeQuery(
    db.run(sql`SELECT mark_pipeline_stage_seen(${chapterStageId})`)
  );

  if (rpcErr) {
    return json({ success: false, error: (rpcErr as any).message }, { status: 400 });
  }

  return json(data);
};
