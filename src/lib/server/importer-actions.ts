import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'node:crypto';

export async function importer_prioritize_work(workId: string, reason: string | undefined, forceReplace: boolean, userId: string) {
  const now = new Date().toISOString();
  
  const activeRes = await safeQuerySingle(
    db.select().from(schema.importerStaffRequests).where(eq(schema.importerStaffRequests.status, 'QUEUED')).limit(1)
  );

  const active = activeRes.data;
  
  if (active && active.workId !== workId && !forceReplace) {
    return { data: { conflict: true, active_request_id: active.id, active_work_title: active.workId, message: 'J existe uma obra em prioridade.' }, error: null };
  }

  if (active && active.workId !== workId && forceReplace) {
    await safeQuery(
      db.update(schema.importerStaffRequests)
        .set({ status: 'CANCELLED_BY_STAFF', cancelledBy: userId, cancelledAt: now, updatedAt: now })
        .where(eq(schema.importerStaffRequests.id, active.id))
    );
  }

  const { data, error } = await safeQuerySingle(
    db.insert(schema.importerStaffRequests).values({
      id: crypto.randomUUID(),
      workId,
      requestedBy: userId,
      priorityBoost: 1000,
      reason: reason || null,
      status: 'QUEUED',
      createdAt: now,
      updatedAt: now
    } as any).returning()
  );

  return { data: { success: true, message: 'Prioridade Absoluta ativada com sucesso.' }, error };
}

export async function importer_cancel_staff_request(requestId: string, userId: string) {
  const now = new Date().toISOString();
  const { data, error } = await safeQuerySingle(
    db.update(schema.importerStaffRequests)
      .set({ status: 'CANCELLED_BY_STAFF', cancelledBy: userId, cancelledAt: now, updatedAt: now })
      .where(eq(schema.importerStaffRequests.id, requestId))
      .returning()
  );
  return { data: { success: true, message: 'Prioridade cancelada.' }, error };
}

export async function importer_staff_pause_job(jobId: string, actorId: string, reason: string) {
  const now = new Date().toISOString();
  const { error } = await safeQuery(
    db.update(schema.importerQueue)
      .set({ status: 'PAUSED_BY_STAFF', updatedAt: now } as any)
      .where(eq(schema.importerQueue.id, jobId))
  );
  return { error };
}

export async function importer_staff_resume_job(jobId: string, actorId: string) {
  const now = new Date().toISOString();
  const { error } = await safeQuery(
    db.update(schema.importerQueue)
      .set({ status: 'QUEUED', updatedAt: now, nextRunAt: now } as any)
      .where(eq(schema.importerQueue.id, jobId))
  );
  return { error };
}

export async function importer_staff_postpone_job(jobId: string, hours: number, actorId: string) {
  const nextRun = new Date(Date.now() + hours * 3600000).toISOString();
  const { error } = await safeQuery(
    db.update(schema.importerQueue)
      .set({ status: 'QUEUED', updatedAt: new Date().toISOString(), nextRunAt: nextRun } as any)
      .where(eq(schema.importerQueue.id, jobId))
  );
  return { error };
}

export async function importer_staff_cancel_job(jobId: string, actorId: string, reason: string) {
  const now = new Date().toISOString();
  const { error } = await safeQuery(
    db.update(schema.importerQueue)
      .set({ status: 'CANCELLED_BY_STAFF', updatedAt: now } as any)
      .where(eq(schema.importerQueue.id, jobId))
  );
  return { data: { message: 'Job cancelado' }, error };
}

export async function importer_request_reconciliation(workId: string) {
  const { error } = await safeQuery(
    db.insert(schema.importerQueue).values({
      id: crypto.randomUUID(),
      taskType: 'SYNC_WORK',
      source: 'multi',
      priority: 90,
      payload: { workId },
      dedupeKey: `SYNC_WORK:multi:${workId}`,
      status: 'QUEUED',
      attempts: 0,
      maxAttempts: 3,
      nextRunAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any).onConflictDoUpdate({
      target: [schema.importerQueue.dedupeKey],
      set: { status: 'QUEUED' as any, nextRunAt: new Date().toISOString() }
    })
  );
  return { data: { success: true }, error };
}

export async function importer_staff_freeze_work(workId: string, actorId: string, reason: string) {
  const { error } = await safeQuery(
    db.insert(schema.settings).values({
      key: `frozen_work_${workId}`,
      value: { reason, actorId, at: new Date().toISOString() },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any).onConflictDoUpdate({
      target: [schema.settings.key],
      set: { value: { reason, actorId, at: new Date().toISOString() } as any }
    })
  );
  return { data: { message: 'Work frozen' }, error };
}

export async function importer_staff_unfreeze_work(workId: string, actorId: string) {
  const { error } = await safeQuery(
    db.delete(schema.settings).where(eq(schema.settings.key, `frozen_work_${workId}`))
  );
  return { data: { message: 'Work unfrozen' }, error };
}
