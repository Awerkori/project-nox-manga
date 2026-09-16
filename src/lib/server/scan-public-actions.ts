import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';

export async function apply_for_scan_opening(openingId: string, experience: string, availability: string, presentation: string, portfolioUrl: string | null, contactInfo: string, userId: string) {
  const { data: opening } = await safeQuerySingle(db.select().from(schema.scanRecruitmentOpenings).where(eq(schema.scanRecruitmentOpenings.id, openingId)));
  if (!opening) return { error: { message: 'Vaga não encontrada' } };

  const id = crypto.randomUUID();
  const { error } = await safeQuery(db.insert(schema.scanApplications).values({
    id, scanId: opening.scanId, openingId, userId,
    experience, availability, presentation, portfolioUrl, contactInfo,
    status: 'PENDING', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  }));

  return {data: { applicationId: id}, error };
}

export async function post_scan_comment(scanId: string, body: string, parentId: string | null, userId: string) {
  const id = crypto.randomUUID();
  const { error } = await safeQuery(db.insert(schema.scanComments).values({
    id, scanId, userId, body, parentId, createdAt: new Date().toISOString()
  }));
  return {data: { commentId: id}, error };
}

export async function like_scan_comment(commentId: string, userId: string) {
  const { data: existing } = await safeQuerySingle(db.select().from(schema.scanCommentLikes).where(and(eq(schema.scanCommentLikes.commentId, commentId), eq(schema.scanCommentLikes.userId, userId))));
  if (existing) {
    await safeQuery(db.delete(schema.scanCommentLikes).where(and(eq(schema.scanCommentLikes.commentId, commentId), eq(schema.scanCommentLikes.userId, userId))));
    return { data: { action: 'removed' }, error: null };
  } else {
    await safeQuery(db.insert(schema.scanCommentLikes).values({ commentId, userId, createdAt: new Date().toISOString() }));
    return { data: { action: 'added' }, error: null };
  }
}

export async function moderate_scan_comment(commentId: string, action: string, adminId: string) {
  if (action === 'REMOVE') {
    const { error } = await safeQuery(db.update(schema.scanComments).set({ removed: 1 }).where(eq(schema.scanComments.id, commentId)));
    return { data: { action }, error };
  } else if (action === 'RESTORE') {
    const { error } = await safeQuery(db.update(schema.scanComments).set({ removed: 0 }).where(eq(schema.scanComments.id, commentId)));
    return { data: { action }, error };
  }
  return { error: { message: 'Ação de moderação desconhecida' } };
}

export async function report_scan_comment(commentId: string, reason: string, userId: string) {
  const id = crypto.randomUUID();
  const { data: c } = await safeQuerySingle(db.select().from(schema.scanComments).where(eq(schema.scanComments.id, commentId)));
  const { error } = await safeQuery(db.insert(schema.reports).values({
    id, reporterId: userId, targetType: 'COMMENT' as any, targetUserId: c?.userId, commentId, reason, status: 'NOVO' as any, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  }));
  return { data: { success: true }, error };
}
