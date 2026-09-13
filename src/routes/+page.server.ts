import { WORK_FIELDS } from '$lib/server/db';
import { safeDbQuery, withTimeout } from '$lib/server/resilience';


const HOME_WORK_FIELDS = `${WORK_FIELDS}, work_scans(is_primary, status, scans(id, name, slug, logo_id, is_official))`;

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
  // If public content cache is fresh, authenticated users only need their personal reading data
  const hasFreshPublicCache = Boolean(homePublicCache && Date.now() - homePublicCache.timestamp < HOME_CACHE_TTL_MS);

  if (!locals.user && hasFreshPublicCache && homePublicCache) {
    setHeaders({
      'cache-control': 'public, max-age=60, stale-while-revalidate=300'
    });
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

  // Execute reading query and (if cache is cold) public queries concurrently
  const [worksRes, chaptersRes, readingRes, mostReadRes] = await Promise.all([
    hasFreshPublicCache
      ? Promise.resolve({ data: homePublicCache!.works, error: null, status: 'SUCCESS' as const, isDegraded: false })
      : safeDbQuery(
          locals.db
            .from('works')
            .select(HOME_WORK_FIELDS)
            .eq('published', true)
            .order('updated_at', { ascending: false })
            .limit(16),
          3000,
          'home_works'
        ),
    hasFreshPublicCache
      ? Promise.resolve({ data: null, error: null, status: 'SUCCESS' as const, isDegraded: false })
      : safeDbQuery(
          locals.db
            .from('chapters')
            .select('id,number,title,published_at,work_id,works!inner(id,slug,title,cover_id,kind,published,content_rating)')
            .not('published_at', 'is', null)
            .eq('works.published', true)
            .order('published_at', { ascending: false })
            .limit(48),
          4500,
          'home_chapters'
        ),
    locals.user
      ? safeDbQuery(
          locals.db
            .from('reading')
            .select(
              'chapter_id,page,max_page,completed_at,updated_at,chapters!inner(id,number,work_id,published_at,works!inner(id,slug,title,cover_id,published,content_rating))'
            )
            .not('chapters.published_at', 'is', null)
            .eq('chapters.works.published', true)
            .order('updated_at', { ascending: false })
            .limit(20),
          3000,
          'home_reading'
        )
      : Promise.resolve({ data: null, error: null, status: 'SUCCESS' as const, isDegraded: false }),
    hasFreshPublicCache
      ? Promise.resolve({ data: homePublicCache!.mostReadWorks, error: null, status: 'SUCCESS' as const, isDegraded: false })
      : safeDbQuery(
          locals.db
            .from('works')
            .select(HOME_WORK_FIELDS)
            .eq('published', true)
            .order('views_total', { ascending: false })
            .limit(16),
          3000,
          'home_most_read'
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
      const wid = (row.chapters as any).work_id as string;
      const list = grouped.get(wid) || [];
      list.push(row);
      grouped.set(wid, list);
    }

    const needsNextChapter: Array<{ wid: string; rows: typeof readingRes.data; currentCh: any }> = [];

    for (const [wid, rows] of grouped.entries()) {
      const work = (rows[0].chapters as any).works;
      const incomplete = rows.find((r) => !r.completed_at);
      if (incomplete) {
        const ch = incomplete.chapters as any;
        continueReading.push({
          workId: wid,
          workTitle: work.title,
          workSlug: work.slug,
          coverId: work.cover_id,
          contentRating: work.content_rating,
          chapterId: ch.id,
          chapterNumber: ch.number,
          destinationUrl: `/ler/${ch.id}`,
          progressText: `Capítulo ${ch.number} · Pág. ${incomplete.page}`,
          actionLabel: 'Retomar leitura ↗',
          updatedAt: incomplete.updated_at
        });
      } else {
        needsNextChapter.push({ wid, rows, currentCh: rows[0].chapters as any });
      }
    }

    // Single batch query for next chapters instead of N separate round-trips
    if (needsNextChapter.length > 0) {
      const workIds = Array.from(new Set(needsNextChapter.map((n) => n.wid)));
      const nextChaptersRes = await withTimeout(
        locals.db
          .from('chapters')
          .select('id,number,work_id')
          .in('work_id', workIds)
          .not('published_at', 'is', null)
          .order('number', { ascending: true }),
        1500,
        { data: [] } as any,
        'home_batch_next_chapters'
      );

      const allNext = nextChaptersRes?.data || [];

      for (const { wid, rows, currentCh } of needsNextChapter) {
        const nextCh = allNext.find((c: any) => c.work_id === wid && c.number > currentCh.number);
        const work = (rows[0].chapters as any).works;
        const mostRecent = rows[0];
        if (nextCh) {
          continueReading.push({
            workId: wid,
            workTitle: work.title,
            workSlug: work.slug,
            coverId: work.cover_id,
            contentRating: work.content_rating,
            chapterId: nextCh.id,
            chapterNumber: nextCh.number,
            destinationUrl: `/ler/${nextCh.id}`,
            progressText: `Próximo: Capítulo ${nextCh.number}`,
            actionLabel: 'Ler próximo ↗',
            updatedAt: mostRecent.updated_at
          });
        } else {
          continueReading.push({
            workId: wid,
            workTitle: work.title,
            workSlug: work.slug,
            coverId: work.cover_id,
            contentRating: work.content_rating,
            chapterId: currentCh.id,
            chapterNumber: currentCh.number,
            destinationUrl: `/obra/${work.slug}`,
            progressText: `Em dia · Cap. ${currentCh.number}`,
            actionLabel: 'Ver obra ↗',
            updatedAt: mostRecent.updated_at
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
  if (chaptersRes.data && Array.isArray(chaptersRes.data)) {
    for (const row of chaptersRes.data) {
      const w = row.works as any;
      if (!w) continue;
      if (!releasesMap.has(w.id)) {
        releasesMap.set(w.id, {
          workId: w.id,
          workSlug: w.slug,
          workTitle: w.title,
          coverId: w.cover_id,
          kind: w.kind,
          contentRating: w.content_rating,
          latestPublishedAt: row.published_at || '',
          chapters: []
        });
      }
      const group = releasesMap.get(w.id)!;
      if (group.chapters.length < 3) {
        group.chapters.push({
          id: row.id,
          number: row.number,
          title: row.title,
          publishedAt: row.published_at || ''
        });
      }
    }
  }

  let recentReleases = Array.from(releasesMap.values());

  // Resilient secondary fallback: if chapters query timed out but works succeeded, fetch recent chapters by work_id (uses fast chapters_work_idx)
  if (recentReleases.length === 0 && works.length > 0) {
    const workIds = works.map((w: any) => w.id).filter(Boolean);
    const fallbackChaptersRes = await withTimeout(
      locals.db
        .from('chapters')
        .select('id,number,title,published_at,work_id')
        .in('work_id', workIds)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(48),
      1500,
      { data: [] } as any,
      'home_chapters_fallback'
    );

    const fallbackChapters = fallbackChaptersRes?.data || [];
    if (fallbackChapters.length > 0) {
      const worksById = new Map(works.map((w: any) => [w.id, w]));
      for (const row of fallbackChapters) {
        const w = worksById.get(row.work_id);
        if (!w) continue;
        if (!releasesMap.has(w.id)) {
          releasesMap.set(w.id, {
            workId: w.id,
            workSlug: w.slug,
            workTitle: w.title,
            coverId: w.cover_id,
            kind: w.kind,
            contentRating: w.content_rating,
            latestPublishedAt: row.published_at || '',
            chapters: []
          });
        }
        const group = releasesMap.get(w.id)!;
        if (group.chapters.length < 3) {
          group.chapters.push({
            id: row.id,
            number: row.number,
            title: row.title,
            publishedAt: row.published_at || ''
          });
        }
      }
      recentReleases = Array.from(releasesMap.values());
    }
  }

  // Derive works from chapters if works query timed out but chapters succeeded
  if (works.length === 0 && chaptersRes.data && chaptersRes.data.length > 0) {
    const derivedWorks = new Map<string, any>();
    for (const row of chaptersRes.data) {
      const w = (row as any).works;
      if (w && !derivedWorks.has(w.id)) {
        derivedWorks.set(w.id, w);
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
  let isDegraded = chaptersRes.isDegraded || worksRes.isDegraded;

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


  if (!locals.user) {
    if (isDegraded) {
      setHeaders({
        'x-degraded': 'true',
        'cache-control': 'public, max-age=10, stale-while-revalidate=30'
      });
    } else {
      setHeaders({
        'cache-control': 'public, max-age=60, stale-while-revalidate=300'
      });
    }
  } else {
    setHeaders({
      'cache-control': 'private, no-cache, no-store, must-revalidate'
    });
  }

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

