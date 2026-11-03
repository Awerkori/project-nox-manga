import { json, error } from '@sveltejs/kit';
import { notifyAdminsForModeration, notifyStaffForReport } from '$lib/server/notifications';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, platform }: any) => {
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
  const countRes = await executeYugabyteSql<{ count: number }>(`
    SELECT COUNT(*)::int as count
    FROM reports
    WHERE reporter_id = $1 AND created_at >= $2;
  `, [locals.user.id, tenMinutesAgo], platform?.env).catch(() => ({ rows: [{ count: 0 }] }));

  const recentCount = countRes.rows[0]?.count || 0;
  if (recentCount >= 6) {
    throw error(429, 'Limite de denúncias atingido. Aguarde alguns minutos antes de enviar outro reporte.');
  }

  // Anti-spam check: check if a pending report already exists from this user for this target
  const existingRes = await executeYugabyteSql<{ id: string }>(`
    SELECT id
    FROM reports
    WHERE reporter_id = $1
      AND target_type = $2
      AND status IN ('NOVO', 'EM_ANALISE')
      AND ($3::uuid IS NULL OR work_id = $3)
      AND ($4::uuid IS NULL OR chapter_id = $4)
      AND ($5::uuid IS NULL OR comment_id = $5)
      AND ($6::uuid IS NULL OR target_user_id = $6)
    LIMIT 1;
  `, [
    locals.user.id,
    targetType,
    workId || null,
    chapterId || null,
    commentId || null,
    targetUserId || null
  ], platform?.env).catch(() => ({ rows: [] }));

  if (existingRes.rows.length > 0) {
    return json({
      ok: true,
      alreadyReported: true,
      message: 'Você já possui uma denúncia em análise para este item.'
    });
  }

  // Context auto-resolution: guarantee work_id and chapter_id are populated
  let resolvedWorkId = workId || null;
  let resolvedChapterId = chapterId || null;

  if (targetType === 'CHAPTER' && resolvedChapterId && !resolvedWorkId) {
    const chRes = await executeYugabyteSql<{ work_id: string }>(`
      SELECT work_id FROM chapters WHERE id = $1 LIMIT 1;
    `, [resolvedChapterId], platform?.env).catch(() => ({ rows: [] }));
    if (chRes.rows[0]?.work_id) resolvedWorkId = chRes.rows[0].work_id;
  } else if (targetType === 'COMMENT' && commentId) {
    const commRes = await executeYugabyteSql<{ work_id: string; chapter_id: string }>(`
      SELECT work_id, chapter_id FROM comments WHERE id = $1 LIMIT 1;
    `, [commentId], platform?.env).catch(() => ({ rows: [] }));
    if (commRes.rows[0]) {
      if (!resolvedWorkId && commRes.rows[0].work_id) resolvedWorkId = commRes.rows[0].work_id;
      if (!resolvedChapterId && commRes.rows[0].chapter_id) resolvedChapterId = commRes.rows[0].chapter_id;
    }
  }

  const insertRes = await executeYugabyteSql<{ id: string }>(`
    INSERT INTO reports (
      reporter_id, target_type, work_id, chapter_id, comment_id, target_user_id,
      reason, details, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'NOVO')
    RETURNING id;
  `, [
    locals.user.id,
    targetType,
    resolvedWorkId,
    resolvedChapterId,
    commentId || null,
    targetUserId || null,
    cleanReason,
    cleanDetails || null
  ], platform?.env).catch((err: any) => {
    throw error(500, 'Erro ao registrar denúncia: ' + (err?.message || 'Falha no banco de dados'));
  });

  const inserted = insertRes.rows[0];

  // Real-time notification dispatch
  try {
    if (targetType === 'COMMENT' || targetType === 'USER') {
      let snippet: string | undefined = undefined;
      if (commentId) {
        const commSnippetRes = await executeYugabyteSql<{ body: string }>(`
          SELECT body FROM comments WHERE id = $1 LIMIT 1;
        `, [commentId], platform?.env).catch(() => ({ rows: [] }));
        snippet = commSnippetRes.rows[0]?.body;
      }
      await notifyAdminsForModeration({
        reason: cleanReason,
        details: cleanDetails,
        targetType: targetType,
        commentSnippet: snippet,
        platform
      });
    } else {
      let targetTitle = 'Conteúdo';
      if (targetType === 'CHAPTER' && chapterId) {
        const chapTitleRes = await executeYugabyteSql<{ number: any; title: string; work_title: string }>(`
          SELECT c.number, c.title, w.title AS work_title
          FROM chapters c
          LEFT JOIN works w ON w.id = c.work_id
          WHERE c.id = $1 LIMIT 1;
        `, [chapterId], platform?.env).catch(() => ({ rows: [] }));
        const chap = chapTitleRes.rows[0];
        const num = chap?.number ?? '';
        targetTitle = `${chap?.work_title || 'Obra'} — Cap. ${num}`;
      } else if (targetType === 'WORK' && workId) {
        const wkTitleRes = await executeYugabyteSql<{ title: string }>(`
          SELECT title FROM works WHERE id = $1 LIMIT 1;
        `, [workId], platform?.env).catch(() => ({ rows: [] }));
        targetTitle = wkTitleRes.rows[0]?.title || 'Obra';
      }
      await notifyStaffForReport({
        reason: cleanReason,
        details: cleanDetails,
        targetTitle,
        targetType: targetType as 'WORK' | 'CHAPTER',
        platform
      });
    }
  } catch (notifErr: any) {
    console.warn('[NOTIF] Falha ao enviar notificação de ticket:', notifErr?.message);
  }

  return json({
    ok: true,
    reportId: inserted.id,
    message: 'Denúncia recebida pela equipe editorial com sucesso.'
  });
};
