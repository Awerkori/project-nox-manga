import { safeDbQuery, withTimeout } from '$lib/server/resilience';

import {
  fetchHomeWorksFromYugabyte,
  fetchMostReadFromYugabyte,
  fetchRecentReleasesFromYugabyte
} from '$lib/server/yugabyte';
import { chapterDisplayNumber, compareChapterIdentity } from '$lib/chapter-identity';

type HomeCachePayload = {
  timestamp: number;
  works: any[];
  featuredList: any[];
  recentReleases: any[];
  mostReadWorks: any[];
};

// Public content cache (updated dynamically from live database queries)
let homePublicCache: HomeCachePayload | null = null;
const HOME_CACHE_TTL_MS = 30_000;

export const load = async ({ locals, setHeaders, url, platform, cookies }: any) => {
  const forceFresh = url.searchParams.has('fresh') || url.searchParams.has('nocache');
  // Age and blur preferences affect the server-rendered page. Only the default,
  // truly anonymous Home response is safe to share at the edge.
  const hasHomePreference = Boolean(cookies.get('nox-age-status') || cookies.get('nox-blur-nsfw'));
  const canSharePublicHome = !locals.user && !forceFresh && !hasHomePreference;
  setHeaders({
    'cache-control': canSharePublicHome
      ? 'public, max-age=30, s-maxage=30, stale-while-revalidate=60'
      : 'private, no-cache, no-store, must-revalidate'
  });

  const hasFreshPublicCache = !forceFresh && Boolean(homePublicCache && Date.now() - homePublicCache.timestamp < HOME_CACHE_TTL_MS);

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
  if (hasFreshPublicCache && homePublicCache && locals.user) {
    const readingRes = await safeDbQuery(
      locals.db
        .from('reading')
        .select(
          'chapter_id,page,max_page,completed_at,updated_at,chapters!inner(id,number,display_number,canonical_chapter_key,chapter_order_key,work_id,published_at,works!inner(id,slug,title,cover_id,published,content_rating))'
        )
        .not('chapters.published_at', 'is', null)
        .eq('chapters.works.published', true)
        .order('updated_at', { ascending: false })
        .limit(20),
      3000,
      'home_reading'
    );

    let continueReading: any[] = [];
    if (readingRes.data && readingRes.data.length > 0) {
      const grouped = new Map<string, typeof readingRes.data>();
      for (const row of readingRes.data) {
        const wid = (row as any).chapters?.work_id;
        if (!wid) continue;
        if (!grouped.has(wid)) grouped.set(wid, []);
        grouped.get(wid)!.push(row);
      }
      for (const [wid, rows] of grouped.entries()) {
        const sorted = rows.sort((a: any, b: any) => compareChapterIdentity(b.chapters || {}, a.chapters || {}));
        const mostRecent = rows.sort((a: any, b: any) => b.updated_at.localeCompare(a.updated_at))[0];
        const highestRead = sorted[0];
        const currentCh = highestRead.chapters as any;
        const work = currentCh.works as any;
        if (!work) continue;
        // This compact cache path only sees chapters already in the user's
        // history. It must not infer a non-existent "next" chapter by adding
        // one to a decimal (which also collapses 12.1/12.10).
        continueReading.push({
          workId: wid,
          workTitle: work.title,
          workSlug: work.slug,
          coverId: work.cover_id,
          contentRating: work.content_rating,
          chapterId: currentCh.id,
          chapterNumber: chapterDisplayNumber(currentCh),
          destinationUrl: `/obra/${work.slug}`,
          progressText: `Em dia · Cap. ${chapterDisplayNumber(currentCh)}`,
          actionLabel: 'Ver obra ↗',
          updatedAt: mostRecent.updated_at
        });
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

  // Cold cache: fetch public data from authoritative Yugabyte and reading from Supabase
  const [worksData, chaptersData, readingRes, mostReadData] = await Promise.all([
    fetchHomeWorksFromYugabyte(platform?.env),
    fetchRecentReleasesFromYugabyte(15, 4, null, null, platform?.env),
    locals.user
      ? safeDbQuery(
          locals.db
            .from('reading')
            .select(
              'chapter_id,page,max_page,completed_at,updated_at,chapters!inner(id,number,display_number,canonical_chapter_key,chapter_order_key,work_id,published_at,works!inner(id,slug,title,cover_id,published,content_rating))'
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
      ? Promise.resolve(homePublicCache!.mostReadWorks)
      : fetchMostReadFromYugabyte(platform?.env)
  ]);

  const worksRes = { data: worksData, isDegraded: !worksData || worksData.length === 0 };
  const chaptersRes = { data: chaptersData, isDegraded: !chaptersData || chaptersData.length === 0 };
  const mostReadRes = { data: mostReadData, isDegraded: !mostReadData || mostReadData.length === 0 };


  let continueReading: Array<{
    workId: string;
    workTitle: string;
    workSlug: string;
    coverId: string | null;
    contentRating?: string;
    chapterId: string;
    chapterNumber: number | string;
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
          chapterNumber: chapterDisplayNumber(ch),
          destinationUrl: `/ler/${ch.id}`,
          progressText: `Capítulo ${chapterDisplayNumber(ch)} · Pág. ${incomplete.page}`,
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
          .select('id,number,display_number,canonical_chapter_key,chapter_order_key,work_id')
          .in('work_id', workIds)
          .not('published_at', 'is', null)
          .order('chapter_order_key', { ascending: true, nullsFirst: false })
          .order('canonical_chapter_key', { ascending: true, nullsFirst: false })
          .order('id', { ascending: true }),
        1500,
        { data: [] } as any,
        'home_batch_next_chapters'
      );

      const allNext = nextChaptersRes?.data || [];

      for (const { wid, rows, currentCh } of needsNextChapter) {
        const ordered = allNext.filter((c: any) => c.work_id === wid)
          .sort((a: any, b: any) => compareChapterIdentity(a, b));
        const currentIndex = ordered.findIndex((c: any) => c.id === currentCh.id);
        const nextCh = currentIndex >= 0 ? ordered[currentIndex + 1] : null;
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
            chapterNumber: chapterDisplayNumber(nextCh),
            destinationUrl: `/ler/${nextCh.id}`,
            progressText: `Próximo: Capítulo ${chapterDisplayNumber(nextCh)}`,
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
            chapterNumber: chapterDisplayNumber(currentCh),
            destinationUrl: `/obra/${work.slug}`,
            progressText: `Em dia · Cap. ${chapterDisplayNumber(currentCh)}`,
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
      number: number | string | null;
      display_number?: string | null;
      canonical_chapter_key?: string | null;
      chapter_order_key?: string | null;
      chapter_kind?: string | null;
      edition?: string | null;
      language?: string | null;
      title: string | null;
      publishedAt: string;
    }>;
  };

  const releasesMap = new Map<string, ReleaseGroup>();
  if (chaptersRes.data && Array.isArray(chaptersRes.data)) {
    for (const row of chaptersRes.data) {
      // RPC get_recent_releases returns flat rows with work_id, work_slug, etc.
      const workId = (row as any).work_id as string;
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
          chapters: []
        });
      }
      const group = releasesMap.get(workId)!;
      if (group.chapters.length < 4) {
        group.chapters.push({
          id: (row as any).chapter_id,
          number: (row as any).chapter_number,
          display_number: (row as any).chapter_display_number,
          canonical_chapter_key: (row as any).canonical_chapter_key,
          chapter_order_key: (row as any).chapter_order_key,
          chapter_kind: (row as any).chapter_kind,
          edition: (row as any).chapter_edition,
          language: (row as any).chapter_language,
          title: (row as any).chapter_title,
          publishedAt: (row as any).chapter_published_at || ''
        });
      }
    }
  }

  let recentReleases = Array.from(releasesMap.values());

  // Derive works from RPC data if works query timed out but chapters succeeded
  if (works.length === 0 && chaptersRes.data && chaptersRes.data.length > 0) {
    const derivedWorks = new Map<string, any>();
    for (const row of chaptersRes.data) {
      const wid = (row as any).work_id;
      if (wid && !derivedWorks.has(wid)) {
        derivedWorks.set(wid, {
          id: wid,
          slug: (row as any).work_slug,
          title: (row as any).work_title,
          cover_id: (row as any).work_cover_id,
          kind: (row as any).work_kind,
          content_rating: (row as any).work_content_rating,
          published: true
        });
      }
    }
    works = Array.from(derivedWorks.values());
  }

  // Most Read works (from concurrent batch or derived from works)
  let mostReadWorks: typeof works;
  if (mostReadRes?.data && mostReadRes.data.length > 0) {
    mostReadWorks = mostReadRes.data;
  } else {
    console.warn('[MAIS_LIDOS_FALLBACK] mostReadRes empty or error, falling back to works slice:', mostReadRes?.error);
    mostReadWorks = works.slice(0, 24);
  }

  // --- DIVERSIFIED 10-ITEM HERO CAROUSEL SELECTION (ROUND 5) ---
  // Target balance:
  // ~3 Recém-adicionadas / Novidades
  // ~3 Em alta / Atualizações Recentes (from recent releases)
  // ~2 Populares / Mais Lidos
  // ~2 Descoberta / Títulos do acervo (with periodic 3-hour deterministic rotation)
  const seenIds = new Set<string>();
  let featuredList: typeof works = [];

  const tryAdd = (w?: any) => {
    if (!w || !w.id || !w.title || seenIds.has(w.id)) return false;
    const cover = w.cover_id || w.coverId;
    if (!cover) return false;
    seenIds.add(w.id);
    featuredList.push(w);
    return true;
  };

  // 1. Explicitly featured works take prime spots first
  for (const w of works) {
    if (w.featured) {
      tryAdd(w);
      if (featuredList.length >= 2) break;
    }
  }

  // 2. Obras Recém-adicionadas (Novidades do catálogo) - target up to 3
  let recentCount = 0;
  for (const w of works) {
    if (recentCount >= 3) break;
    if (tryAdd(w)) recentCount++;
  }

  // 3. Obras em Alta (works that had recent releases/chapter updates) - target up to 3
  let trendingCount = 0;
  for (const rel of recentReleases) {
    if (trendingCount >= 3) break;
    const match = works.find((w) => w.id === rel.workId) || mostReadWorks.find((w) => w.id === rel.workId);
    if (match) {
      if (tryAdd(match)) trendingCount++;
    } else if (rel.workId && rel.workTitle && rel.coverId) {
      if (
        tryAdd({
          id: rel.workId,
          slug: rel.workSlug,
          title: rel.workTitle,
          cover_id: rel.coverId,
          kind: rel.kind,
          content_rating: rel.contentRating,
          published: true
        })
      )
        trendingCount++;
    }
  }

  // 4. Obras Populares (Top Mais Lidos) - target up to 2
  let popularCount = 0;
  for (const w of mostReadWorks) {
    if (popularCount >= 2) break;
    if (tryAdd(w)) popularCount++;
  }

  // 5. Obras de Descoberta (Títulos do acervo com rotação estável de 3 horas) - target up to 2
  const rotationEpoch = Math.floor(Date.now() / (3 * 3600 * 1000));
  const discoveryPool = works.filter((w) => !seenIds.has(w.id));
  if (discoveryPool.length > 0) {
    const offset = rotationEpoch % discoveryPool.length;
    for (let i = 0; i < discoveryPool.length && featuredList.length < 10; i++) {
      const idx = (offset + i) % discoveryPool.length;
      tryAdd(discoveryPool[idx]);
    }
  }

  // 6. Safety fill: ensure exactly 10 works if available
  if (featuredList.length < 10) {
    for (const w of works) {
      tryAdd(w);
      if (featuredList.length === 10) break;
    }
  }
  if (featuredList.length < 10) {
    for (const w of mostReadWorks) {
      tryAdd(w);
      if (featuredList.length === 10) break;
    }
  }

  let isStale = false;
  const isDegraded = chaptersRes.isDegraded || worksRes.isDegraded;

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
