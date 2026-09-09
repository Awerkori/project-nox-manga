import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    throw error(401, 'Autenticação necessária.');
  }

  const { data: userReports, error: dbError } = await locals.db
    .from('reports')
    .select(`
      id,
      target_type,
      reason,
      details,
      status,
      created_at,
      updated_at,
      work:works(id, title, slug),
      chapter:chapters(id, number, title, works(id, title, slug)),
      comment:comments(id, body)
    `)
    .eq('reporter_id', locals.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (dbError) {
    throw error(500, 'Erro ao carregar denúncias: ' + dbError.message);
  }

  const reports = (userReports || []).map((rep: any) => {
    let targetTitle = 'Conteúdo da plataforma';
    let targetUrl: string | null = null;

    if (rep.target_type === 'CHAPTER' && rep.chapter) {
      targetTitle = `${rep.chapter.works?.title || 'Obra'} — Cap. ${rep.chapter.number}`;
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
