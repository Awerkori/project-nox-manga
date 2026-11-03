import { json, error } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const GET = async ({ locals, platform }: any) => {
  if (!locals.user) {
    throw error(401, 'Autenticação necessária.');
  }

  const res = await executeYugabyteSql(`
    SELECT r.id, r.target_type, r.reason, r.details, r.status, r.created_at, r.updated_at,
           CASE WHEN w.id IS NOT NULL THEN json_build_object('id', w.id, 'title', w.title, 'slug', w.slug) ELSE NULL END AS work,
           CASE WHEN ch.id IS NOT NULL THEN json_build_object('id', ch.id, 'number', ch.number, 'display_number', ch.display_number, 'title', ch.title, 'works', json_build_object('id', ch_w.id, 'title', ch_w.title, 'slug', ch_w.slug)) ELSE NULL END AS chapter,
           CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'body', c.body) ELSE NULL END AS comment
    FROM reports r
    LEFT JOIN works w ON w.id = r.work_id
    LEFT JOIN chapters ch ON ch.id = r.chapter_id
    LEFT JOIN works ch_w ON ch_w.id = ch.work_id
    LEFT JOIN comments c ON c.id = r.comment_id
    WHERE r.reporter_id = $1
    ORDER BY r.created_at DESC
    LIMIT 50;
  `, [locals.user.id], platform?.env).catch((err: any) => {
    throw error(500, 'Erro ao carregar denúncias: ' + (err?.message || 'Falha no banco de dados'));
  });

  const userReports = res.rows || [];

  const reports = (userReports || []).map((rep: any) => {
    let targetTitle = 'Conteúdo da plataforma';
    let targetUrl: string | null = null;

    if (rep.target_type === 'CHAPTER' && rep.chapter) {
      const displayNumber = rep.chapter.display_number ?? rep.chapter.number ?? 'Especial';
      targetTitle = `${rep.chapter.works?.title || 'Obra'} — Cap. ${displayNumber}`;
      targetUrl = `/ler/${rep.chapter.id}`;
    } else if (rep.target_type === 'WORK' && rep.work) {
      targetTitle = rep.work.title;
      targetUrl = `/obra/${rep.work.slug}`;
    } else if (rep.target_type === 'COMMENT' && rep.comment) {
      targetTitle = `Comentário: "${rep.comment.body.slice(0, 35)}..."`;
    }

    const statusMap: Record<string, { label: string; description: string }> = {
      NOVO: { label: 'Recebida', description: 'Sua denúncia está na fila para análise da moderação.' },
      EM_ANALISE: { label: 'Em Análise', description: 'Um membro da equipe editorial está revisando o incidente.' },
      ATRIBUIDO: { label: 'Em Análise', description: 'Um membro da equipe editorial foi designado para este incidente.' },
      RESOLVIDO: { label: 'Resolvida', description: 'A equipe editorial concluiu a ação corretiva necessária.' },
      REJEITADO: { label: 'Encerrada', description: 'O item foi revisado e considerado em conformidade com as diretrizes.' }
    };

    const statusInfo = statusMap[rep.status] || { label: rep.status, description: '' };

    return {
      id: rep.id,
      targetType: rep.target_type,
      targetTitle,
      targetUrl,
      reason: rep.reason,
      details: rep.details,
      status: rep.status,
      statusLabel: statusInfo.label,
      statusDescription: statusInfo.description,
      createdAt: rep.created_at,
      updatedAt: rep.updated_at
    };
  });

  return json({ ok: true, reports });
};
