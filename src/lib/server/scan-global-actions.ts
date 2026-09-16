import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';

export async function global_admin_set_scan_status(scanId: string, status: string, reason: string, adminId: string) {
  const { error } = await safeQuery(db.update(schema.scans).set({ status: status as any, updatedAt: new Date().toISOString() } as any).where(eq(schema.scans.id, scanId)));
  if (!error) {
    await safeQuery(db.insert(schema.scanGlobalAuditLog).values({ id: crypto.randomUUID(), scanId, adminId, action: 'SET_STATUS', reason, details: { new_status: status } as any, createdAt: new Date().toISOString() } as any));
  }
  return { error };
}

export async function global_admin_recover_scan_ownership(scanId: string, newOwnerId: string, reason: string, adminId: string) {
  await safeQuery(db.update(schema.scanMembers).set({ role: 'MEMBER' as any } as any).where(and(eq(schema.scanMembers.scanId, scanId), eq(schema.scanMembers.role, 'OWNER'))));
  
  const { data: member } = await safeQuerySingle(db.select().from(schema.scanMembers).where(and(eq(schema.scanMembers.scanId, scanId), eq(schema.scanMembers.userId, newOwnerId))));
  if (member) {
    await safeQuery(db.update(schema.scanMembers).set({ role: 'OWNER' as any } as any).where(and(eq(schema.scanMembers.scanId, scanId), eq(schema.scanMembers.userId, newOwnerId))));
  } else {
    await safeQuery(db.insert(schema.scanMembers).values({ scanId, userId: newOwnerId, role: 'OWNER' as any, joinedAt: new Date().toISOString(), scanPoints: 0 } as any));
  }

  await safeQuery(db.insert(schema.scanGlobalAuditLog).values({ id: crypto.randomUUID(), scanId, adminId, action: 'RECOVER_OWNER', reason, details: { new_owner_id: newOwnerId } as any, createdAt: new Date().toISOString() } as any));
  return { error: null };
}

export async function global_admin_hard_delete_scan(scanId: string, reason: string, confirmation: string, adminId: string) {
  if (confirmation !== 'DELETAR_SCAN') return { error: { message: 'Confirmação inválida.' } };
  const { error } = await safeQuery(db.delete(schema.scans).where(eq(schema.scans.id, scanId)));
  if (!error) {
    await safeQuery(db.insert(schema.scanGlobalAuditLog).values({ id: crypto.randomUUID(), scanId: 'DELETED', adminId, action: 'HARD_DELETE', reason, details: { deleted_scan_id: scanId } as any, createdAt: new Date().toISOString() } as any));
  }
  return { error };
}

export async function review_scan_partner_request(requestId: string, action: string, reason: string | undefined, adminId: string) {
  const { data: req } = await safeQuerySingle(db.select().from(schema.scanPartnerRequests).where(eq(schema.scanPartnerRequests.id, requestId)));
  if (!req) return { error: { message: 'Request not found' } };

  if (action === 'APPROVE') {
    await safeQuery(db.insert(schema.scans).values({ id: crypto.randomUUID(), name: req.scanName, slug: req.scanSlug, isOfficial: 1, status: 'ACTIVE', ownerId: req.userId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), recruitmentStatus: 'OPEN' } as any));
    await safeQuery(db.update(schema.scanPartnerRequests).set({ status: 'APPROVED' as any, reviewedBy: adminId, reviewedAt: new Date().toISOString(), reviewNotes: reason } as any).where(eq(schema.scanPartnerRequests.id, requestId)));
  } else {
    await safeQuery(db.update(schema.scanPartnerRequests).set({ status: 'REJECTED' as any, reviewedBy: adminId, reviewedAt: new Date().toISOString(), reviewNotes: reason } as any).where(eq(schema.scanPartnerRequests.id, requestId)));
  }
  return { data: { success: true }, error: null };
}

export async function review_scan_project_request(requestId: string, action: string, reason: string | undefined, adminId: string) {
  const { data: req } = await safeQuerySingle(db.select().from(schema.scanProjectRequests).where(eq(schema.scanProjectRequests.id, requestId)));
  if (!req) return { error: { message: 'Request not found' } };

  if (action === 'APPROVE') {
    await safeQuery(db.insert(schema.workScans).values({ workId: req.workId, scanId: req.scanId, isPrimary: req.type === 'PRIMARY' ? 1 : 0, translationLanguage: 'pt-BR', status: 'ACTIVE' } as any).onConflictDoNothing());
    await safeQuery(db.update(schema.scanProjectRequests).set({ status: 'APPROVED' as any, reviewedBy: adminId, reviewedAt: new Date().toISOString(), reviewNotes: reason } as any).where(eq(schema.scanProjectRequests.id, requestId)));
  } else {
    await safeQuery(db.update(schema.scanProjectRequests).set({ status: 'REJECTED' as any, reviewedBy: adminId, reviewedAt: new Date().toISOString(), reviewNotes: reason } as any).where(eq(schema.scanProjectRequests.id, requestId)));
  }
  return { data: { success: true }, error: null };
}
