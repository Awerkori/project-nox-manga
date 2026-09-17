import { error as svelteError, fail } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, desc, asc } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.role !== 'ADMIN') {
    throw svelteError(403, 'Acesso restrito exclusivamente a Administradores Globais do Project Nox.');
  }

  const [
    scansRes,
    workCountsRes,
    chapterCountsRes,
    memberCountsRes,
    openingsCountsRes,
    ownersRes,
    partnerReqsRes,
    projectReqsRes,
    auditLogsRes,
    usersRes
  ] = await Promise.all([
    safeQuery(db.select().from(schema.scans).orderBy(desc(schema.scans.isOfficial), asc(schema.scans.name))),
    safeQuery(db.select({ scanId: schema.workScans.scanId }).from(schema.workScans)),
    safeQuery(db.select({ scanId: schema.chapterScans.scanId }).from(schema.chapterScans)),
    safeQuery(db.select({ scanId: schema.scanMembers.scanId }).from(schema.scanMembers)),
    safeQuery(db.select({ scanId: schema.scanRecruitmentOpenings.scanId }).from(schema.scanRecruitmentOpenings).where(eq(schema.scanRecruitmentOpenings.status, 'OPEN'))),
    safeQuery(db.select().from(schema.scanMembers).where(eq(schema.scanMembers.role, 'OWNER'))), // Note: Need relations for members ideally, simplified here
    safeQuery(db.select().from(schema.scanPartnerRequests).orderBy(desc(schema.scanPartnerRequests.createdAt))),
    safeQuery(db.select().from(schema.scanProjectRequests).orderBy(desc(schema.scanProjectRequests.createdAt))),
    safeQuery(db.select().from(schema.scanGlobalAuditLog).orderBy(desc(schema.scanGlobalAuditLog.createdAt)).limit(50)),
    safeQuery(db.select({ id: schema.members.id, username: schema.members.username, displayName: schema.members.displayName, avatarId: schema.members.avatarId }).from(schema.members).orderBy(asc(schema.members.username)).limit(100))
  ]);

  if (scansRes.error) throw svelteError(500, scansRes.error ? (scansRes.error as any).message : 'Erro');

  const workCountMap: Record<string, number> = {};
  for (const row of (workCountsRes.data || [])) {
    workCountMap[row.scanId] = (workCountMap[row.scanId] || 0) + 1;
  }

  const chapterCountMap: Record<string, number> = {};
  for (const row of (chapterCountsRes.data || [])) {
    chapterCountMap[row.scanId] = (chapterCountMap[row.scanId] || 0) + 1;
  }

  const memberCountMap: Record<string, number> = {};
  for (const row of (memberCountsRes.data || [])) {
    memberCountMap[row.scanId] = (memberCountMap[row.scanId] || 0) + 1;
  }

  const openingsCountMap: Record<string, number> = {};
  for (const row of (openingsCountsRes.data || [])) {
    openingsCountMap[row.scanId] = (openingsCountMap[row.scanId] || 0) + 1;
  }

  const scans = (scansRes.data || []).map((s: any) => ({
    ...s,
    works_count: workCountMap[s.id] || 0,
    chapters_count: chapterCountMap[s.id] || 0,
    members_count: memberCountMap[s.id] || 0,
    openings_count: openingsCountMap[s.id] || 0,
    owner: null
  }));

  return {
    scans,
    partnerRequests: partnerReqsRes.data || [],
    projectRequests: projectReqsRes.data || [],
    auditLogs: auditLogsRes.data || [],
    users: usersRes.data || []
  };
};

export const actions: Actions = {
  setStatus: async ({ request, locals }) => {
    return fail(400, { message: 'Not implemented in Drizzle yet.' });
  },

  recoverOwner: async ({ request, locals }) => {
    return fail(400, { message: 'Not implemented in Drizzle yet.' });
  },

  hardDelete: async ({ request, locals }) => {
    return fail(400, { message: 'Not implemented in Drizzle yet.' });
  },

  reviewPartner: async ({ request, locals }) => {
    return fail(400, { message: 'Not implemented in Drizzle yet.' });
  },

  reviewProject: async ({ request, locals }) => {
    return fail(400, { message: 'Not implemented in Drizzle yet.' });
  }
};
