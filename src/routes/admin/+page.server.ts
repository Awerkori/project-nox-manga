import { error } from '@sveltejs/kit';
import { loadYsqlImporterHeartbeat } from '$lib/server/importer-snapshot';
import { executeYugabyteSql, withYugabyteReadSession } from '$lib/server/yugabyte';

const snapshots = new Map<string, { timestamp: number; payload: any }>();
const inFlight = new Map<string, Promise<any>>();
const ADMIN_CACHE_TTL_MS = 45_000;
const ADMIN_STALE_TTL_MS = 180_000;



const loadProductionSnapshot = async (locals: App.Locals, platform: App.Platform | undefined) => {
  return await withYugabyteReadSession(
    platform?.env,
    async (sessionEnv) => {
      const sessionPlatform = platform ? { ...platform, env: sessionEnv } : { env: sessionEnv };
      const safeSql = async (sql: string, params: unknown[] = []) => {
        try {
          const res = await executeYugabyteSql(sql, params, sessionEnv);
          return res.rows || [];
        } catch {
          return [];
        }
      };

      const [
        heartbeat,
        worksCntRows,
        chaptersEstRows,
        recentPublishedRows,
        recentWorksRows,
        tagsCntRows,
        draftsRows,
        pendingReportsRows,
        staffCountRows
      ] = await Promise.all([
        loadYsqlImporterHeartbeat(sessionPlatform),
        safeSql(`SELECT COUNT(*)::int AS cnt FROM public.works`),
        safeSql(
          `SELECT GREATEST(0, reltuples::bigint)::int AS est
           FROM pg_class
           WHERE relname = 'chapters'
           LIMIT 1`,
        ),
        safeSql(
          `SELECT c.id, c.number, c.display_number, c.canonical_chapter_key, c.chapter_order_key,
                  c.chapter_kind, c.edition, c.language, c.title, c.published_at,
                  w.id AS w_id, w.title AS w_title, w.slug AS w_slug, w.cover_id AS w_cover_id
           FROM public.chapters c
           LEFT JOIN public.works w ON w.id = c.work_id
           WHERE c.published_at IS NOT NULL
           ORDER BY c.published_at DESC
           LIMIT 6`,
        ),
        safeSql(
          `SELECT id, title, slug, kind, status, published, cover_id, updated_at
           FROM public.works
           ORDER BY updated_at DESC NULLS LAST
           LIMIT 5`,
        ),
        safeSql(`SELECT COUNT(*)::int AS cnt FROM public.tags`),
        safeSql(
          `SELECT c.id, c.number, c.display_number, c.canonical_chapter_key, c.chapter_order_key,
                  c.chapter_kind, c.edition, c.language, c.title, c.created_at,
                  w.id AS w_id, w.title AS w_title, w.slug AS w_slug, w.cover_id AS w_cover_id
           FROM public.chapters c
           LEFT JOIN public.works w ON w.id = c.work_id
           WHERE c.published_at IS NULL AND c.origin = $1
           ORDER BY c.created_at DESC
           LIMIT 8`,
          ['MANUAL'],
        ),
        safeSql(
          `SELECT COUNT(*)::int AS cnt FROM public.reports WHERE status IN ($1, $2)`,
          ['NOVO', 'EM_ANALISE'],
        ),
        safeSql(
          `SELECT COUNT(*)::int AS cnt FROM public.access_roles WHERE role IN ($1, $2, $3) AND suspended = false`,
          ['ADMIN', 'STAFF_SITE', 'EDITOR'],
        ),
      ]);

      const hb = heartbeat;
      const importerActiveCount = Number(
        hb?.chapterAdmission?.active ?? hb?.eligibleJobs ?? 0,
      );

      return {
        metricsUnavailable: worksCntRows.length === 0,
        works: worksCntRows[0]?.cnt ?? 0,
        chapters:
          hb?.ysqlTelemetry?.completedChapters ??
          chaptersEstRows[0]?.est ??
          0,
        draftsCount: draftsRows.length,
        tagsCount: tagsCntRows[0]?.cnt ?? 0,
        drafts: draftsRows.map((r: any) => ({
          id: r.id,
          number: r.number,
          display_number: r.display_number,
          canonical_chapter_key: r.canonical_chapter_key,
          chapter_order_key: r.chapter_order_key,
          chapter_kind: r.chapter_kind,
          edition: r.edition,
          language: r.language,
          title: r.title,
          created_at: r.created_at,
          works: r.w_id
            ? { id: r.w_id, title: r.w_title, slug: r.w_slug, cover_id: r.w_cover_id }
            : null,
        })),
        recentPublished: recentPublishedRows.map((r: any) => ({
          id: r.id,
          number: r.number,
          display_number: r.display_number,
          canonical_chapter_key: r.canonical_chapter_key,
          chapter_order_key: r.chapter_order_key,
          chapter_kind: r.chapter_kind,
          edition: r.edition,
          language: r.language,
          title: r.title,
          published_at: r.published_at,
          works: r.w_id
            ? { id: r.w_id, title: r.w_title, slug: r.w_slug, cover_id: r.w_cover_id }
            : null,
        })),
        recentWorks: recentWorksRows,
        importerActiveCount,
        pendingReportsCount: pendingReportsRows[0]?.cnt ?? 0,
        staffCount: staffCountRows[0]?.cnt ?? 0,
        failedJobs24h: 0,
        unrecoveredFailures: 0,
        recoveredFailures: 0,
      };
    },
    1,
  );
};

export const load = async ({
  locals,
  platform,
}: {
  locals: App.Locals;
  platform?: App.Platform;
}) => {
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    throw error(403, 'Acesso restrito à equipe');
  }

  const key = `role:${locals.role}`;
  const now = Date.now();
  const cached = snapshots.get(key);
  if (cached) {
    const age = now - cached.timestamp;
    if (age < ADMIN_STALE_TTL_MS) return cached.payload;
  }

  const existing = inFlight.get(key);
  if (existing) return existing;

  const pending = loadProductionSnapshot(locals, platform)
    .then((payload) => {
      if (!payload.metricsUnavailable) {
        if (snapshots.size >= 50) snapshots.delete(snapshots.keys().next().value!);
        snapshots.set(key, { timestamp: Date.now(), payload });
      }
      return payload;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, pending);
  return pending;
};
