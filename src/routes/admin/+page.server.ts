import { error } from '@sveltejs/kit';
import { db, schema, safeQuery } from '$lib/server/db';
import { eq, inArray, isNull, isNotNull, desc, count, gte, and } from 'drizzle-orm';
import { withTimeout } from '$lib/server/resilience';

const snapshots = new Map<string, { timestamp: number; payload: any }>();
const inFlight = new Map<string, Promise<any>>();
const ADMIN_CACHE_TTL_MS = 30_000;

const loadSnapshot = async (locals: App.Locals) => {
  const twentyFourHoursAgo = new Date(Date.now() - 86400_000).toISOString();

  const [
    works,
    publishedChapters,
    draftsCountRes,
    tags,
    drafts,
    recentPublished,
    recentWorks,
    importerQueue,
    pendingReports,
    staffCountRes,
    failedJobsRes,
    failedMappingsRes
  ] = await Promise.all([
    safeQuery(db.select({ count: count() }).from(schema.works)),
    safeQuery(db.select({ count: count() }).from(schema.chapters).where(isNotNull(schema.chapters.publishedAt))),
    safeQuery(db.select({ count: count() }).from(schema.chapters).where(and(isNull(schema.chapters.publishedAt), eq(schema.chapters.origin, 'MANUAL')))),
    safeQuery(db.select({ count: count() }).from(schema.tags)),
    safeQuery(db.select({
      id: schema.chapters.id,
      number: schema.chapters.number,
      title: schema.chapters.title,
      createdAt: schema.chapters.createdAt,
      works: {
        id: schema.works.id,
        title: schema.works.title,
        slug: schema.works.slug,
        coverId: schema.works.coverId
      }
    }).from(schema.chapters).leftJoin(schema.works, eq(schema.chapters.workId, schema.works.id)).where(and(isNull(schema.chapters.publishedAt), eq(schema.chapters.origin, 'MANUAL'))).orderBy(desc(schema.chapters.createdAt)).limit(8)),
    safeQuery(db.select({
      id: schema.chapters.id,
      number: schema.chapters.number,
      title: schema.chapters.title,
      publishedAt: schema.chapters.publishedAt,
      works: {
        id: schema.works.id,
        title: schema.works.title,
        slug: schema.works.slug,
        coverId: schema.works.coverId
      }
    }).from(schema.chapters).leftJoin(schema.works, eq(schema.chapters.workId, schema.works.id)).where(isNotNull(schema.chapters.publishedAt)).orderBy(desc(schema.chapters.publishedAt)).limit(6)),
    safeQuery(db.select({
      id: schema.works.id,
      title: schema.works.title,
      slug: schema.works.slug,
      kind: schema.works.kind,
      status: schema.works.status,
      published: schema.works.published,
      coverId: schema.works.coverId,
      updatedAt: schema.works.updatedAt
    }).from(schema.works).orderBy(desc(schema.works.updatedAt)).limit(5)),
    safeQuery(db.select({ count: count() }).from(schema.importerQueue).where(inArray(schema.importerQueue.status, ['QUEUED', 'IMPORTING', 'RETRY']))),
    safeQuery(db.select({ count: count() }).from(schema.reports).where(inArray(schema.reports.status, ['NOVO', 'EM_ANALISE']))),
    safeQuery(db.select({ count: count() }).from(schema.accessRoles).where(and(inArray(schema.accessRoles.role, ['ADMIN', 'STAFF_SITE', 'EDITOR']), eq(schema.accessRoles.suspended, false)))),
    safeQuery(db.select({ count: count() }).from(schema.importerQueue).where(and(eq(schema.importerQueue.status, 'FAILED'), gte(schema.importerQueue.updatedAt, twentyFourHoursAgo)))),
    safeQuery(db.select({ count: count() }).from(schema.importerChapterMappings).where(inArray(schema.importerChapterMappings.status, ['FAILED', 'VERIFICATION_FAILED'])))
  ].map(async (query) => {
    try { return await withTimeout(query, 3500, { error: true as any, data: null }, 'admin_metric'); }
    catch { return { error: true as any, data: null }; }
  }));

  const metricsUnavailable = [works, publishedChapters, draftsCountRes, tags, drafts,
    recentPublished, recentWorks, importerQueue, pendingReports, staffCountRes,
    failedJobsRes, failedMappingsRes].some(result => result.error);

  const totalFailedJobs24h = failedJobsRes.data?.[0]?.count ?? null;
  const unrecoveredFailures = failedMappingsRes.data?.[0]?.count ?? null;
  const recoveredFailures = totalFailedJobs24h === null || unrecoveredFailures === null
    ? null : Math.max(0, totalFailedJobs24h - unrecoveredFailures);

  const payload = {
    metricsUnavailable,
    works: works.data?.[0]?.count ?? null,
    chapters: publishedChapters.data?.[0]?.count ?? null,
    draftsCount: draftsCountRes.data?.[0]?.count ?? null,
    tagsCount: tags.data?.[0]?.count ?? null,
    drafts: (drafts.data as any[]) || [],
    recentPublished: (recentPublished.data as any[]) || [],
    recentWorks: (recentWorks.data as any[]) || [],
    importerActiveCount: importerQueue.data?.[0]?.count ?? null,
    pendingReportsCount: pendingReports.data?.[0]?.count ?? null,
    staffCount: staffCountRes.data?.[0]?.count ?? null,
    failedJobs24h: totalFailedJobs24h,
    unrecoveredFailures,
    recoveredFailures
  };

  return payload;
};

export const load = async ({ locals }: { locals: App.Locals }) => {
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    throw error(403, 'Acesso restrito  equipe');
  }
  const key = `${locals.user.id}:${locals.role}`;
  const cached = snapshots.get(key);
  if (cached && Date.now() - cached.timestamp < ADMIN_CACHE_TTL_MS) return cached.payload;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const pending = loadSnapshot(locals).then(payload => {
    if (!payload.metricsUnavailable) {
      if (snapshots.size >= 50) snapshots.delete(snapshots.keys().next().value!);
      snapshots.set(key, { timestamp: Date.now(), payload });
    }
    return payload;
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, pending);
  return pending;
};
