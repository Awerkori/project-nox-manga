import { withTimeout } from '$lib/server/resilience';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, desc, asc, isNotNull, and, inArray } from 'drizzle-orm';

type HomeCachePayload = {
  timestamp: number;
  works: any[];
  featuredList: any[];
  recentReleases: any[];
  mostReadWorks: any[];
  loadError: boolean;
  isStale: boolean;
};

// In-memory single-flight & stale-while-revalidate public cache
let homePublicCache: HomeCachePayload | null = null;
let inFlightRefreshPromise: Promise<HomeCachePayload> | null = null;
const FRESH_CACHE_TTL_MS = 60_000;      // 60 seconds fresh window
const STALE_CACHE_MAX_AGE_MS = 600_000; // 10 minutes stale window

declare global {
  var __nox_invalidate_home: (() => void) | undefined;
}

globalThis.__nox_invalidate_home = () => {
  if (homePublicCache) {
    homePublicCache.timestamp = 0;
    homePublicCache.isStale = true;
  }
};

type ReleaseGroup = {
  workId: string;
  workSlug: string;
  workTitle: string;
  coverId: string | null;
  kind: string;
  contentRating?: string;
  latestPublishedAt: string;
  chapters: Array<{
    id: string;
    number: number;
    title: string | null;
    publishedAt: string;
  }>;
};

/**
 * Consolidated single-query releases fetcher:
 * Replaces multiple sequential queries and eliminates redundant scanning of the 'pages' table.
 * Uses index idx_works_latest_pub + idx_chapters_work_pub to retrieve top 15 works
 * (5 complete rows of 3 columns on desktop) and their 3 latest chapters in ~5ms.
 */
async function fetchRecentReleases(dbInstance: any) {
  const sql = `
    WITH top_works AS (
      SELECT id, slug, title, cover_id, kind, content_rating, latest_chapter_published_at
      FROM works
      WHERE published = true AND latest_chapter_published_at IS NOT NULL
      ORDER BY latest_chapter_published_at DESC, id DESC
      LIMIT 15
    ),
    ranked_chapters AS (
      SELECT ch.id, ch.number, ch.title, ch.published_at, ch.work_id,
             ROW_NUMBER() OVER (PARTITION BY ch.work_id ORDER BY ch.published_at DESC) as rn
      FROM chapters ch
      JOIN top_works tw ON tw.id = ch.work_id
      WHERE ch.published_at IS NOT NULL
    )
    SELECT rc.id, rc.number, rc.title, rc.published_at,
           tw.id as work_id, tw.slug as work_slug, tw.title as work_title, tw.cover_id as work_cover_id,
           tw.kind as work_kind, tw.content_rating as work_content_rating,
           tw.latest_chapter_published_at as latest_published_at
    FROM top_works tw
    LEFT JOIN ranked_chapters rc ON rc.work_id = tw.id AND rc.rn <= 3
    ORDER BY tw.latest_chapter_published_at DESC, tw.id DESC, rc.published_at DESC NULLS LAST;
  `;
  const res = await safeQuery(dbInstance.execute(sql));
  const rows = res?.data || [];
  return { data: Array.isArray(rows) ? rows : (rows ? [rows] : []) };
}

/**
 * Single-flight coalesced public cache refresher.
 * Guarantees that at most 1 database query is in flight for public home content.
 */
async function refreshHomePublicCache(dbInstance: any): Promise<HomeCachePayload> {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  inFlightRefreshPromise = (async () => {
    try {
      const [worksRes, chaptersRes, mostReadRes] = await Promise.all([
        safeQuery(
          dbInstance.query.works.findMany({
            where: eq(schema.works.published, true),
            orderBy: [desc(schema.works.updatedAt)],
            limit: 16,
            with: {
              workScans: {
                columns: { isPrimary: true, status: true },
                with: {
                  scans: { columns: { id: true, name: true, slug: true, logoId: true, isOfficial: true } }
                }
              }
            }
          })
        ),
        withTimeout(fetchRecentReleases(dbInstance), 3500, { data: [] } as any, 'home_chapters'),
        safeQuery(
          dbInstance.query.works.findMany({
            where: eq(schema.works.published, true),
            orderBy: [desc(schema.works.viewsTotal)],
            limit: 16,
            with: {
              workScans: {
                columns: { isPrimary: true, status: true },
                with: {
                  scans: { columns: { id: true, name: true, slug: true, logoId: true, isOfficial: true } }
                }
              }
            }
          })
        )
      ]);

      let works = (worksRes?.data || []) as any[];

      const releasesMap = new Map<string, ReleaseGroup>();
      if (chaptersRes?.data && Array.isArray(chaptersRes.data)) {
        for (const row of chaptersRes.data) {
          const workId = (row as any).work_id || (row as any).workId;
          if (!workId) continue;
          if (!releasesMap.has(workId)) {
            releasesMap.set(workId, {
              workId,
              workSlug: (row as any).work_slug || '',
              workTitle: (row as any).work_title || '',
              coverId: (row as any).work_cover_id || null,
              kind: (row as any).work_kind || 'UNKNOWN',
              contentRating: (row as any).work_content_rating || null,
              latestPublishedAt: (row as any).latest_published_at || (row as any).published_at || '',
              chapters: []
            });
          }
          const group = releasesMap.get(workId)!;
          if ((row as any).id && group.chapters.length < 3) {
            group.chapters.push({
              id: (row as any).id,
              number: Number((row as any).number),
              title: (row as any).title,
              publishedAt: (row as any).published_at || ''
            });
          }
        }
      }

      let recentReleases = Array.from(releasesMap.values()).slice(0, 15);

      // Fallback derivation if works query was empty but releases succeeded
      if (works.length === 0 && recentReleases.length > 0) {
        works = recentReleases.map(r => ({
          id: r.workId,
          slug: r.workSlug,
          title: r.workTitle,
          coverId: r.coverId,
          kind: r.kind,
          contentRating: r.contentRating,
          published: true,
          updatedAt: r.latestPublishedAt
        }));
      }

      const featuredCandidates = works.filter((w) => w.featured);
      const featuredList = featuredCandidates.length > 0 ? featuredCandidates : works.slice(0, 5);
      const mostReadWorks = (mostReadRes?.data && mostReadRes.data.length > 0) ? mostReadRes.data : works.slice(0, 16);

      const payload: HomeCachePayload = {
        timestamp: Date.now(),
        works,
        featuredList,
        recentReleases,
        mostReadWorks,
        loadError: recentReleases.length === 0,
        isStale: false
      };

      if (works.length > 0 || recentReleases.length > 0) {
        homePublicCache = payload;
      }

      return payload;
    } catch (err) {
      console.warn('[HOME CACHE REFRESH ERROR]', err);
      if (homePublicCache) {
        return {
          ...homePublicCache,
          isStale: true
        };
      }
      return {
        timestamp: Date.now(),
        works: [],
        featuredList: [],
        recentReleases: [],
        mostReadWorks: [],
        loadError: true,
        isStale: true
      };
    } finally {
      inFlightRefreshPromise = null;
    }
  })();

  return inFlightRefreshPromise;
}

/**
 * Fast SWR (Stale-While-Revalidate) accessor for public home contents
 */
async function getOrRefreshHomePublic(dbInstance: any): Promise<HomeCachePayload> {
  const now = Date.now();
  const cacheAge = homePublicCache ? now - homePublicCache.timestamp : Infinity;

  // 1. Fresh cache: instantaneous return (0ms DB delay)
  if (homePublicCache && cacheAge < FRESH_CACHE_TTL_MS) {
    return homePublicCache;
  }

  // 2. Stale cache: return stale immediately, revalidate in background (0ms DB delay for caller)
  if (homePublicCache && cacheAge < STALE_CACHE_MAX_AGE_MS) {
    refreshHomePublicCache(dbInstance).catch(() => {});
    return {
      ...homePublicCache,
      isStale: true
    };
  }

  // 3. Cold start: single-flight await (coalesced across all concurrent requests)
  return await refreshHomePublicCache(dbInstance);
}

export const load = async ({ locals, setHeaders }) => {
  // Always enforce private no-cache on HTML documents so edge proxies never serve anonymous HTML to authenticated users
  setHeaders({
    'cache-control': 'private, no-cache, no-store, must-revalidate'
  });

  // Fast single-flight / SWR public content retrieval
  const publicData = await getOrRefreshHomePublic(db);

  // If user is anonymous, return directly without hitting DB for personal reading records
  if (!locals.user) {
    return {
      works: publicData.works,
      featuredList: publicData.featuredList,
      recentReleases: publicData.recentReleases,
      mostReadWorks: publicData.mostReadWorks,
      recent: [],
      loadError: publicData.loadError,
      isStale: publicData.isStale
    };
  }

  // Authenticated user: fetch personal reading progress
  let continueReading: any[] = [];
  try {
    const readingRes = await withTimeout(
      safeQuery(
        db.select({
          chapterId: schema.reading.chapterId,
          page: schema.reading.page,
          maxPage: schema.reading.maxPage,
          completedAt: schema.reading.completedAt,
          updatedAt: schema.reading.updatedAt,
          chapters: {
            id: schema.chapters.id,
            number: schema.chapters.number,
            workId: schema.chapters.workId,
            publishedAt: schema.chapters.publishedAt
          },
          works: {
            id: schema.works.id,
            slug: schema.works.slug,
            title: schema.works.title,
            coverId: schema.works.coverId,
            published: schema.works.published,
            contentRating: schema.works.contentRating
          }
        })
        .from(schema.reading)
        .innerJoin(schema.chapters, eq(schema.reading.chapterId, schema.chapters.id))
        .innerJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
        .where(
          and(
            eq(schema.reading.userId, locals.user.id),
            isNotNull(schema.chapters.publishedAt),
            eq(schema.works.published, true)
          )
        )
        .orderBy(desc(schema.reading.updatedAt))
        .limit(20)
      ),
      1200,
      { data: [] } as any,
      'home_reading_progress'
    );

    if (readingRes?.data && readingRes.data.length > 0) {
      const grouped = new Map<string, typeof readingRes.data>();
      for (const row of readingRes.data) {
        const wid = (row as any).chapters?.workId;
        if (!wid) continue;
        if (!grouped.has(wid)) grouped.set(wid, []);
        grouped.get(wid)!.push(row);
      }

      const needsNextChapter: Array<{ wid: string; rows: typeof readingRes.data; currentCh: any }> = [];

      for (const [wid, rows] of grouped.entries()) {
        const work = (rows[0] as any).works;
        const incomplete = rows.find((r: any) => !r.completedAt);
        if (incomplete) {
          const ch = incomplete.chapters as any;
          continueReading.push({
            workId: wid,
            workTitle: work.title,
            workSlug: work.slug,
            coverId: work.coverId,
            contentRating: work.contentRating,
            chapterId: ch.id,
            chapterNumber: ch.number,
            destinationUrl: `/ler/${ch.id}`,
            progressText: `Capítulo ${ch.number} · Pg. ${incomplete.page}`,
            actionLabel: 'Retomar leitura ↗',
            updatedAt: incomplete.updatedAt as string
          });
        } else {
          needsNextChapter.push({ wid, rows, currentCh: rows[0].chapters as any });
        }
      }

      if (needsNextChapter.length > 0) {
        const workIds = Array.from(new Set(needsNextChapter.map((n) => n.wid)));
        const nextChaptersRes = await withTimeout(
          safeQuery(
            db.select({
              id: schema.chapters.id,
              number: schema.chapters.number,
              workId: schema.chapters.workId
            })
            .from(schema.chapters)
            .where(
              and(
                inArray(schema.chapters.workId, workIds),
                isNotNull(schema.chapters.publishedAt)
              )
            )
            .orderBy(asc(schema.chapters.number))
          ),
          1200,
          { data: [] } as any,
          'home_batch_next_chapters'
        );

        const allNext = (nextChaptersRes?.data || []) as any[];

        for (const { wid, rows, currentCh } of needsNextChapter) {
          const nextCh = allNext.find((c: any) => c.workId === wid && c.number > currentCh.number);
          const work = (rows[0] as any).works;
          const mostRecent = rows[0];
          if (nextCh) {
            continueReading.push({
              workId: wid,
              workTitle: work.title,
              workSlug: work.slug,
              coverId: work.coverId,
              contentRating: work.contentRating,
              chapterId: nextCh.id,
              chapterNumber: nextCh.number,
              destinationUrl: `/ler/${nextCh.id}`,
              progressText: `Próximo: Capítulo ${nextCh.number}`,
              actionLabel: 'Ler próximo ↗',
              updatedAt: mostRecent.updatedAt as string
            });
          } else {
            continueReading.push({
              workId: wid,
              workTitle: work.title,
              workSlug: work.slug,
              coverId: work.coverId,
              contentRating: work.contentRating,
              chapterId: currentCh.id,
              chapterNumber: currentCh.number,
              destinationUrl: `/obra/${work.slug}`,
              progressText: `Em dia · Cap. ${currentCh.number}`,
              actionLabel: 'Ver obra ↗',
              updatedAt: mostRecent.updatedAt as string
            });
          }
        }
      }

      continueReading.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      continueReading = continueReading.slice(0, 10);
    }
  } catch (err) {
    console.warn('[HOME USER PROGRESS ERROR]', err);
  }

  return {
    works: publicData.works,
    featuredList: publicData.featuredList,
    recentReleases: publicData.recentReleases,
    mostReadWorks: publicData.mostReadWorks,
    recent: continueReading,
    loadError: publicData.loadError,
    isStale: publicData.isStale
  };
};
