import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Autenticação necessária para enviar uma denúncia.');
  }

  const parsed = await request.json().catch(() => null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw error(400, 'Solicitação inválida.');
  const body = parsed as Record<string, unknown>;
  const targetType = typeof body.targetType === 'string' ? body.targetType : '';
  const workId = typeof body.workId === 'string' ? body.workId : undefined;
  const chapterId = typeof body.chapterId === 'string' ? body.chapterId : undefined;
  const commentId = typeof body.commentId === 'string' ? body.commentId : undefined;
  const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId : undefined;
  const reason = typeof body.reason === 'string' ? body.reason : '';
  const details = typeof body.details === 'string' ? body.details : '';

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

  const targetId =
    targetType === 'WORK'
      ? workId
      : targetType === 'CHAPTER'
        ? chapterId
        : targetType === 'COMMENT'
          ? commentId
          : targetUserId;
  if (typeof targetId !== 'string') throw error(400, 'Identificador do alvo é obrigatório.');

  const { data, error: submitError } = await locals.db.rpc('submit_report', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: cleanReason,
    p_details: cleanDetails || undefined
  });
  if (submitError) {
    throw error(submitError.code === '42501' ? 403 : 400, 'Não foi possível registrar a denúncia.');
  }
  const result = data as { ok?: boolean; rate_limited?: boolean; already_reported?: boolean; report_id?: string };
  if (result.rate_limited) throw error(429, 'Limite de denúncias atingido. Tente novamente mais tarde.');
  if (result.already_reported) {
    return json({
      ok: true,
      alreadyReported: true,
      message: 'Você já possui uma denúncia em análise para este item.'
    });
  }

  return json({
    ok: true,
    reportId: result.report_id,
    message: 'Denúncia recebida pela equipe editorial com sucesso.'
  });
};
