import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, schema, safeQuery } from '$lib/server/db';
import { eq, desc } from 'drizzle-orm';
import { aliasedTable } from 'drizzle-orm/sqlite-core';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    throw error(401, 'Autenticação necessária.');
  }

  const chapterWorks = aliasedTable(schema.works, 'chapterWorks');

  const { data: rawReports, error: dbError } = await safeQuery(
    db.select({
      id: schema.reports.id,
      targetType: schema.reports.targetType,
      reason: schema.reports.reason,
      details: schema.reports.details,
      status: schema.reports.status,
      createdAt: schema.reports.createdAt,
      updatedAt: schema.reports.updatedAt,
      workId: schema.works.id,
      workTitle: schema.works.title,
      workSlug: schema.works.slug,
      chapterId: schema.chapters.id,
      chapterNumber: schema.chapters.number,
      chapterTitle: schema.chapters.title,
      chapterWorkTitle: chapterWorks.title,
      chapterWorkSlug: chapterWorks.slug,
      commentId: schema.comments.id,
      commentBody: schema.comments.body
    })
    .from(schema.reports)
    .leftJoin(schema.works, eq(schema.reports.workId, schema.works.id))
    .leftJoin(schema.chapters, eq(schema.reports.chapterId, schema.chapters.id))
    .leftJoin(chapterWorks, eq(schema.chapters.workId, chapterWorks.id))
    .leftJoin(schema.comments, eq(schema.reports.commentId, schema.comments.id))
    .where(eq(schema.reports.reporterId, locals.user.id))
    .orderBy(desc(schema.reports.createdAt))
    .limit(50)
  );

  if (dbError) {
    throw error(500, 'Erro ao carregar denúncias: ' + dbError.message);
  }

  const reports = (rawReports || []).map((rep) => {
    let targetTitle = 'Conteúdo da plataforma';
    let targetUrl: string | null = null;

    if (rep.targetType === 'CHAPTER' && rep.chapterId) {
      targetTitle = `${rep.chapterWorkTitle || 'Obra'} — Cap. ${rep.chapterNumber}`;
      targetUrl = `/ler/${rep.chapterId}`;
    } else if (rep.targetType === 'WORK' && rep.workId) {
      targetTitle = rep.workTitle || '';
      targetUrl = `/obra/${rep.workSlug}`;
    } else if (rep.targetType === 'COMMENT' && rep.commentId) {
      targetTitle = `Comentário: "${rep.commentBody?.slice(0, 35)}..."`;
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
      targetType: rep.targetType,
      targetTitle,
      targetUrl,
      reason: rep.reason,
      details: rep.details,
      status: rep.status,
      statusLabel: statusInfo.label,
      statusDescription: statusInfo.description,
      createdAt: rep.createdAt,
      updatedAt: rep.updatedAt
    };
  });

  return json({ ok: true, reports });
};
