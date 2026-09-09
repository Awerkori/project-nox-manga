import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Autenticação necessária para enviar uma denúncia.');
  }

  const body = await request.json();
  const { targetType, workId, chapterId, commentId, targetUserId, reason, details } = body;

  if (!targetType || !['WORK', 'CHAPTER', 'USER', 'COMMENT'].includes(targetType)) {
    throw error(400, 'Tipo de denúncia inválido.');
  }

  const cleanReason = (reason || '').trim();
  if (cleanReason.length < 2 || cleanReason.length > 200) {
    throw error(400, 'Motivo da denúncia deve ter entre 2 e 200 caracteres.');
  }

  const cleanDetails = (details || '').trim();
  if (cleanDetails.length > 2000) {
    throw error(400, 'Detalhes não podem exceder 2000 caracteres.');
  }

  // Rate limit / cooldown: max 6 reports in 10 minutes per user
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recentCount } = await locals.db
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_id', locals.user.id)
    .gte('created_at', tenMinutesAgo);

  if ((recentCount || 0) >= 6) {
    throw error(429, 'Limite de denúncias atingido. Aguarde alguns minutos antes de enviar outro reporte.');
  }

  // Anti-spam check: check if a pending report already exists from this user for this target
  let existingCheck = locals.db
    .from('reports')
    .select('id')
    .eq('reporter_id', locals.user.id)
    .eq('target_type', targetType)
    .in('status', ['NOVO', 'EM_ANALISE']);

  if (targetType === 'WORK' && workId) {
    existingCheck = existingCheck.eq('work_id', workId);
  } else if (targetType === 'CHAPTER' && chapterId) {
    existingCheck = existingCheck.eq('chapter_id', chapterId);
  } else if (targetType === 'COMMENT' && commentId) {
    existingCheck = existingCheck.eq('comment_id', commentId);
  } else if (targetType === 'USER' && targetUserId) {
    existingCheck = existingCheck.eq('target_user_id', targetUserId);
  }

  const { data: existing } = await existingCheck.maybeSingle();
  if (existing) {
    return json({
      ok: true,
      alreadyReported: true,
      message: 'Você já possui uma denúncia em análise para este item.'
    });
  }

  const { data: inserted, error: insertError } = await locals.db
    .from('reports')
    .insert({
      reporter_id: locals.user.id,
      target_type: targetType,
      work_id: workId || null,
      chapter_id: chapterId || null,
      comment_id: commentId || null,
      target_user_id: targetUserId || null,
      reason: cleanReason,
      details: cleanDetails || null,
      status: 'NOVO'
    })
    .select('id')
    .single();

  if (insertError) {
    throw error(500, 'Erro ao registrar denúncia: ' + insertError.message);
  }

  return json({
    ok: true,
    reportId: inserted.id,
    message: 'Denúncia recebida pela equipe editorial com sucesso.'
  });
};
