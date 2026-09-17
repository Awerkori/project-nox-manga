import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, and, gte, inArray, count } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Autenticao necessria para enviar uma denncia.');
  }

  const body = await request.json();
  const { targetType, workId, chapterId, commentId, targetUserId, reason, details } = body;

  if (!targetType || !['WORK', 'CHAPTER', 'USER', 'COMMENT'].includes(targetType)) {
    throw error(400, 'Tipo de denncia invlido.');
  }

  const cleanReason = (reason || '').trim();
  if (cleanReason.length < 2 || cleanReason.length > 200) {
    throw error(400, 'Motivo da denncia deve ter entre 2 e 200 caracteres.');
  }

  const cleanDetails = (details || '').trim();
  if (cleanDetails.length > 2000) {
    throw error(400, 'Detalhes no podem exceder 2000 caracteres.');
  }

  // Rate limit / cooldown: max 6 reports in 10 minutes per user
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  const { data: countData } = await safeQuery(
    db.select({ value: count() })
      .from(schema.reports)
      .where(and(
        eq(schema.reports.reporterId, locals.user.id),
        gte(schema.reports.createdAt, tenMinutesAgo)
      ))
  );

  if ((countData?.[0]?.value || 0) >= 6) {
    throw error(429, 'Limite de denncias atingido. Aguarde alguns minutos antes de enviar outro reporte.');
  }

  // Anti-spam check: check if a pending report already exists from this user for this target
  const conditions = [
    eq(schema.reports.reporterId, locals.user.id),
    eq(schema.reports.targetType, targetType),
    inArray(schema.reports.status, ['NOVO', 'EM_ANALISE'])
  ];

  if (targetType === 'WORK' && workId) conditions.push(eq(schema.reports.workId, workId));
  else if (targetType === 'CHAPTER' && chapterId) conditions.push(eq(schema.reports.chapterId, chapterId));
  else if (targetType === 'COMMENT' && commentId) conditions.push(eq(schema.reports.commentId, commentId));
  else if (targetType === 'USER' && targetUserId) conditions.push(eq(schema.reports.targetUserId, targetUserId));

  const { data: existing } = await safeQuerySingle(
    db.select({ id: schema.reports.id })
      .from(schema.reports)
      .where(and(...conditions))
      .limit(1)
  );

  if (existing) {
    return json({
      ok: true,
      alreadyReported: true,
      message: 'Voc j possui uma denncia em anlise para este item.'
    });
  }

  const newId = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data: inserted, error: insertError } = await safeQuerySingle(
    db.insert(schema.reports)
      .values({
        id: newId,
        reporterId: locals.user.id,
        targetType: targetType,
        workId: workId || null,
        chapterId: chapterId || null,
        commentId: commentId || null,
        targetUserId: targetUserId || null,
        reason: cleanReason,
        details: cleanDetails || null,
        status: 'NOVO',
        createdAt: now,
        updatedAt: now
      })
      .returning({ id: schema.reports.id })
  );

  if (insertError) {
    throw error(500, 'Erro ao registrar denncia: ' + (insertError as any).message);
  }

  return json({
    ok: true,
    reportId: inserted?.id,
    message: 'Denncia recebida pela equipe editorial com sucesso.'
  });
};
