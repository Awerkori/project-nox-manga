import { WORK_FIELDS, check } from '$lib/server/db';

const HOME_WORK_FIELDS = `${WORK_FIELDS}, work_scans(is_primary, status, scans(id, name, slug, logo_id, is_official))`;

let popularCache: { timestamp: number; works: any[] } | null = null;
const POPULAR_CACHE_TTL_MS = 60_000;

export const load = async ({ locals }) => {
  // Execute top-level independent queries concurrently in a single roundtrip batch
  const [worksRes, chaptersRes, readingRes] = await Promise.all([
    locals.db
      .from('works')
      .select(HOME_WORK_FIELDS)
      .eq('published', true)
      .order('updated_at', { ascending: false })
      .limit(16),
    locals.db
      .from('chapters')
      .select('id,number,title,published_at,work_id,works!inner(id,slug,title,cover_id,kind,published,content_rating)')
      .not('published_at', 'is', null)
      .eq('works.published', true)
      .order('published_at', { ascending: false })
      .limit(80),
    locals.user
      ? locals.db
          .from('reading')
          .select(
            'chapter_id,page,max_page,completed_at,updated_at,chapters!inner(id,number,work_id,published_at,works!inner(id,slug,title,cover_id,published,content_rating))'
          )
          .not('chapters.published_at', 'is', null)
          .eq('chapters.works.published', true)
          .order('updated_at', { ascending: false })
          .limit(30)
      : Promise.resolve({ data: null, error: null })
  ]);

  check(worksRes);

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

    // Batch all next-chapter queries in parallel instead of sequential loop
    if (needsNextChapter.length > 0) {
      const nextLookups = await Promise.all(
        needsNextChapter.map(async ({ wid, rows, currentCh }) => {
          const nextChRes = await locals.db
            .from('chapters')
            .select('id,number')
            .eq('work_id', wid)
            .gt('number', currentCh.number)
            .not('published_at', 'is', null)
            .order('number', { ascending: true })
            .limit(1);
          return { wid, rows, currentCh, nextCh: nextChRes.data?.[0] };
        })
      );

      for (const { wid, rows, currentCh, nextCh } of nextLookups) {
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
            progressText: `Capítulo ${currentCh.number} · Concluído ✓`,
            actionLabel: 'Ver obra ↗',
            updatedAt: mostRecent.updated_at
          });
        }
      }
    }

    continueReading.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    continueReading = continueReading.slice(0, 10);
  }

  const works = worksRes.data || [];

  // Featured works for hero carousel (works marked featured, or newest published works up to 5)
  const featuredCandidates = works.filter((w) => w.featured);
  const featuredList = featuredCandidates.length > 0 ? featuredCandidates : works.slice(0, 5);

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
  if (chaptersRes.data) {
    for (const row of chaptersRes.data) {
      const w = row.works as any;
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

  const recentReleases = Array.from(releasesMap.values());

  // Most Read works based on views_total (real views)
  let mostReadWorks: typeof works = [];
  const mostReadRes = await locals.db
    .from('works')
    .select(HOME_WORK_FIELDS)
    .eq('published', true)
    .gt('views_total', 0)
    .order('views_total', { ascending: false })
    .limit(16);

  if (mostReadRes.data && mostReadRes.data.length >= 2) {
    mostReadWorks = mostReadRes.data;
  } else {
    // Fallback: sort by views_total DESC, updated_at DESC
    const fallbackRes = await locals.db
      .from('works')
      .select(HOME_WORK_FIELDS)
      .eq('published', true)
      .order('views_total', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(16);
    mostReadWorks = fallbackRes.data || [];
  }

  return {
    works,
    featuredList,
    recentReleases,
    mostReadWorks,
    recent: continueReading
  };
};

