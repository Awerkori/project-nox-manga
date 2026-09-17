
import { withTimeout } from '$lib/server/resilience';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, desc, asc, isNotNull, and, inArray } from 'drizzle-orm';




type HomeCachePayload = {
  timestamp: number;
  works: any[];
  featuredList: any[];
  recentReleases: any[];
  mostReadWorks: any[];
};

// Public content cache (updated dynamically from live database queries)
let homePublicCache: HomeCachePayload | null = null;
const HOME_CACHE_TTL_MS = 60_000;

export const load = async ({ locals, setHeaders }) => {
  // Always enforce private no-cache on HTML documents so edge proxies never serve anonymous HTML to authenticated users
  setHeaders({
    'cache-control': 'private, no-cache, no-store, must-revalidate'
  });

  const hasFreshPublicCache = Boolean(homePublicCache && Date.now() - homePublicCache.timestamp < HOME_CACHE_TTL_MS);

  // If public content cache is fresh and user is anonymous, return directly without hitting DB
  if (!locals.user && hasFreshPublicCache && homePublicCache) {
    return {
      works: homePublicCache.works,
      featuredList: homePublicCache.featuredList,
      recentReleases: homePublicCache.recentReleases,
      mostReadWorks: homePublicCache.mostReadWorks,
      recent: [],
      loadError: false,
      isStale: false
    };
  }

  // If public content cache is fresh and user is authenticated, use cached public content and only fetch personal reading data
  if (hasFreshPublicCache && homePublicCache && locals.user) {const readingRes = await safeQuery(
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
          publishedAt: schema.chapters.publishedAt,
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
          isNotNull(schema.chapters.publishedAt),
          eq(schema.works.published, true)
        )
      )
      .orderBy(desc(schema.reading.updatedAt))
      .limit(20)
    );

    let continueReading: any[] = [];
    if (readingRes.data && readingRes.data.length > 0) {
      const grouped = new Map<string, typeof readingRes.data>();
      for (const row of readingRes.data) {
        const wid = (row as any).chapters?.workId;
        if (!wid) continue;
        if (!grouped.has(wid)) grouped.set(wid, []);
        grouped.get(wid)!.push(row);
      }
      for (const [wid, rows] of grouped.entries()) {
        const sorted = rows.sort((a: any, b: any) => (b.chapters?.number ?? 0) - (a.chapters?.number ?? 0));
        const mostRecent = rows.sort((a: any, b: any) => b.updatedAt.localeCompare(a.updatedAt))[0];
        const highestRead = sorted[0];
        const currentCh = highestRead.chapters as any;
        const work = currentCh.works as any;
        if (!work) continue;
        const nextNumber = (currentCh.number ?? 0) + 1;
        const nextCh = sorted.find((r: any) => (r.chapters as any)?.number === nextNumber)?.chapters as any;
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
            progressText: `Prximo: Captulo ${nextCh.number}`,
            actionLabel: 'Ler prximo ↗',
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
      continueReading.sort((a: any, b: any) => b.updatedAt.localeCompare(a.updatedAt));
      continueReading = continueReading.slice(0, 10);
    }

    return {
      works: homePublicCache.works,
      featuredList: homePublicCache.featuredList,
      recentReleases: homePublicCache.recentReleases,
      mostReadWorks: homePublicCache.mostReadWorks,
      recent: continueReading,
      loadError: false,
      isStale: false
    };
  }

  // Cold cache: execute reading query and public queries concurrently
  const [worksRes, chaptersRes, readingRes, mostReadRes] = await Promise.all([
    safeQuery(
      db.query.works.findMany({
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
    Promise.resolve({ data: null, error: null,  }),
    locals.user
      ? safeQuery(
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
              isNotNull(schema.chapters.publishedAt),
              eq(schema.works.published, true)
            )
          )
          .orderBy(desc(schema.reading.updatedAt))
          .limit(20)
        )
      : Promise.resolve({ data: null, error: null, status: 'SUCCESS' as const,  }),
    hasFreshPublicCache
      ? Promise.resolve({ data: homePublicCache!.mostReadWorks, error: null, status: 'SUCCESS' as const,  })
      : safeQuery(
          db.query.works.findMany({
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


  let continueReading: Array<{
    workId: string;
    workTitle: string;
    workSlug: string;
    coverId: string | null;
    contentRating?: string;
    chapterId: string;
    chapterNumber: number;
    destinationUrl: string;
    progressText: string;
    actionLabel: string;
    updatedAt: string;
  }> = [];

  if (readingRes.data && readingRes.data.length > 0) {
    const grouped = new Map<string, typeof readingRes.data>();
    for (const row of readingRes.data) {
      const wid = (row.chapters as any).workId as string;
      const list = grouped.get(wid) || [];
      list.push(row);
      grouped.set(wid, list);
    }

    const needsNextChapter: Array<{ wid: string; rows: typeof readingRes.data; currentCh: any }> = [];

    for (const [wid, rows] of grouped.entries()) {
      const work = (rows[0] as any).works;
      const incomplete = rows.find((r) => !r.completedAt);
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
          progressText: `Captulo ${ch.number} · Pg. ${incomplete.page}`,
          actionLabel: 'Retomar leitura ↗',
          updatedAt: incomplete.updatedAt as string
        });
      } else {
        needsNextChapter.push({ wid, rows, currentCh: rows[0].chapters as any });
      }
    }

    // Single batch query for next chapters instead of N separate round-trips
    if (needsNextChapter.length > 0) {const workIds = Array.from(new Set(needsNextChapter.map((n) => n.wid)));
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
        1500,
        { data: [] } as any,
        'home_batch_next_chapters'
      );

      const allNext = nextChaptersRes?.data || [];

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
            progressText: `Prximo: Captulo ${nextCh.number}`,
            actionLabel: 'Ler prximo ↗',
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

  let works = worksRes.data || [];

  // High-density recent releases (grouped by work, Kuro style)
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

  const releasesMap = new Map<string, ReleaseGroup>();
  if (chaptersRes.data && Array.isArray(chaptersRes.data)) {for (const row of chaptersRes.data) {
      // RPC get_recent_releases returns flat rows with workId, work_slug, etc.
      const workId = (row as any).workId as string;
      if (!workId) continue;
      if (!releasesMap.has(workId)) {
        releasesMap.set(workId, {
          workId,
          workSlug: (row as any).work_slug || '',
          workTitle: (row as any).work_title || '',
          coverId: (row as any).work_cover_id || null,
          kind: (row as any).work_kind || 'UNKNOWN',
          contentRating: (row as any).work_content_rating || null,
          latestPublishedAt: (row as any).latest_published_at || '',
          chapters: []});
      }
      const group = releasesMap.get(workId)!;
      if (group.chapters.length < 3) {
        group.chapters.push({
          id: (row as any).chapterId,
          number: (row as any).chapterNumber,
          title: (row as any).chapterTitle,
          publishedAt: (row as any).chapter_published_at || ''
        });
      }
    }
  }

  let recentReleases = Array.from(releasesMap.values());

  // Resilient secondary fallback: if RPC timed out, do it manually with two queries
  if (recentReleases.length === 0) {const fallbackWorksRes = await withTimeout(
      safeQuery(
        db.select({
          id: schema.works.id,
          slug: schema.works.slug,
          title: schema.works.title,
          coverId: schema.works.coverId,
          kind: schema.works.kind,
          contentRating: schema.works.contentRating,
          latestChapterPublishedAt: schema.works.latestChapterPublishedAt
        })
        .from(schema.works)
        .where(
          and(
            eq(schema.works.published, true),
            isNotNull(schema.works.latestChapterPublishedAt)
          )
        )
        .orderBy(desc(schema.works.latestChapterPublishedAt))
        .limit(16)
      ),
      1500,
      { data: [] } as any,
      'home_chapters_fallback_works'
    );

    const fallbackWorks = fallbackWorksRes?.data || [];
    if (fallbackWorks.length > 0) {const workIds = fallbackWorks.map((w: any) => w.id);
      const fallbackChaptersRes = await withTimeout(
        safeQuery(
          db.select({
            id: schema.chapters.id,
            number: schema.chapters.number,
            title: schema.chapters.title,
            publishedAt: schema.chapters.publishedAt,
            workId: schema.chapters.workId
          })
          .from(schema.chapters)
          .where(
            and(
              inArray(schema.chapters.workId, workIds),
              isNotNull(schema.chapters.publishedAt)
            )
          )
          .orderBy(desc(schema.chapters.publishedAt))
        ),
        1500,
        { data: [] } as any,
        'home_chapters_fallback_chapters'
      );

      const fallbackChapters = fallbackChaptersRes?.data || [];
      const worksById = new Map(fallbackWorks.map((w: any) => [w.id, w]));
      for (const row of fallbackChapters) {
        const w = worksById.get(row.workId) as any;
        if (!w) continue;
        if (!releasesMap.has(w.id)) {
          releasesMap.set(w.id, {
            workId: w.id,
            workSlug: w.slug,
            workTitle: w.title,
            coverId: w.coverId,
            kind: w.kind,
            contentRating: w.contentRating,
            latestPublishedAt: w.latestChapterPublishedAt || '',
            chapters: []
          });
        }
        const group = releasesMap.get(w.id)!;
        if (group.chapters.length < 3) {
          group.chapters.push({
            id: row.id,
            number: row.number,
            title: row.title,
            publishedAt: row.publishedAt || ''
          });
        }
      }
      recentReleases = Array.from(releasesMap.values());
      // Sort to guarantee correct order
      recentReleases.sort((a, b) => new Date(b.latestPublishedAt).getTime() - new Date(a.latestPublishedAt).getTime());
    }
  }

  // Derive works from RPC data if works query timed out but chapters succeeded
  if (works.length === 0 && chaptersRes.data && chaptersRes.data.length > 0) {const derivedWorks = new Map<string, any>();
    for (const row of chaptersRes.data) {
      const wid = (row as any).workId;
      if (wid && !derivedWorks.has(wid)) {
        derivedWorks.set(wid, {
          id: wid,
          slug: (row as any).work_slug,
          title: (row as any).work_title,
          coverId: (row as any).work_cover_id,
          kind: (row as any).work_kind,
          contentRating: (row as any).work_content_rating,
          published: true});
      }
    }
    works = Array.from(derivedWorks.values());
  }

  // Featured works for hero carousel (works marked featured, or newest published works up to 5)
  const featuredCandidates = works.filter((w) => w.featured);
  let featuredList = featuredCandidates.length > 0 ? featuredCandidates : works.slice(0, 5);

  // Most Read works (from concurrent batch or derived from works)
  let mostReadWorks: typeof works = [];
  if (mostReadRes?.data && mostReadRes.data.length > 0) {
    mostReadWorks = mostReadRes.data;
  } else {
    mostReadWorks = works.slice(0, 16);
  }

  let isStale = false;
  let isDegraded = false;

  // Stale-While-Revalidate / Last-Known-Good fallback
  if (works.length > 0 && recentReleases.length > 0 && !isDegraded) {
    // Only cache verified complete and fresh data
    homePublicCache = {
      timestamp: Date.now(),
      works,
      featuredList,
      recentReleases,
      mostReadWorks
    };
  } else if (homePublicCache && (recentReleases.length === 0 || isDegraded)) {
    // Upstream query failed or returned empty due to degradation - use Last-Known-Good from real previous runs
    works = homePublicCache.works;
    featuredList = homePublicCache.featuredList;
    recentReleases = homePublicCache.recentReleases;
    mostReadWorks = homePublicCache.mostReadWorks;
    isStale = true;
  }

  // Load error is only true if we truly have NO releases to display at all
  const loadError = isDegraded && recentReleases.length === 0;

  return {
    works,
    featuredList,
    recentReleases,
    mostReadWorks,
    recent: continueReading,
    loadError,
    isStale
  };
};

