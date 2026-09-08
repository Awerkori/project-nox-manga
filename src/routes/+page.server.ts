import { WORK_FIELDS, check } from '$lib/server/db';

export const load = async ({ locals }) => {
  const result = await locals.db
    .from('works')
    .select(WORK_FIELDS)
    .eq('published', true)
    .order('updated_at', { ascending: false })
    .limit(16);
  check(result);

  let continueReading: Array<{
    workId: string;
    workTitle: string;
    workSlug: string;
    coverId: string | null;
    chapterId: string;
    chapterNumber: number;
    destinationUrl: string;
    progressText: string;
    actionLabel: string;
    updatedAt: string;
  }> = [];

  if (locals.user) {
    const readingRes = await locals.db
      .from('reading')
      .select(
        'chapter_id,page,max_page,completed_at,updated_at,chapters!inner(id,number,work_id,published_at,works!inner(id,slug,title,cover_id,published))'
      )
      .not('chapters.published_at', 'is', null)
      .eq('chapters.works.published', true)
      .order('updated_at', { ascending: false })
      .limit(30);

    if (readingRes.data && readingRes.data.length > 0) {
      const grouped = new Map<string, typeof readingRes.data>();
      for (const row of readingRes.data) {
        const wid = (row.chapters as any).work_id as string;
        const list = grouped.get(wid) || [];
        list.push(row);
        grouped.set(wid, list);
      }

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
            chapterId: ch.id,
            chapterNumber: ch.number,
            destinationUrl: `/ler/${ch.id}`,
            progressText: `Capítulo ${ch.number} · Pág. ${incomplete.page}`,
            actionLabel: 'Retomar leitura ↗',
            updatedAt: incomplete.updated_at
          });
        } else {
          const mostRecent = rows[0];
          const currentCh = mostRecent.chapters as any;
          const nextChRes = await locals.db
            .from('chapters')
            .select('id,number')
            .eq('work_id', wid)
            .gt('number', currentCh.number)
            .not('published_at', 'is', null)
            .order('number', { ascending: true })
            .limit(1);

          const nextCh = nextChRes.data?.[0];
          if (nextCh) {
            continueReading.push({
              workId: wid,
              workTitle: work.title,
              workSlug: work.slug,
              coverId: work.cover_id,
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
      continueReading = continueReading.slice(0, 4);
    }
  }

  const works = result.data || [];
  
  // Featured works for hero carousel (works marked featured, or newest published works up to 5)
  const featuredCandidates = works.filter((w) => w.featured);
  const featuredList = featuredCandidates.length > 0 ? featuredCandidates : works.slice(0, 5);

  // High-density recent releases (grouped by work, Kuro style)
  const chaptersRes = await locals.db
    .from('chapters')
    .select('id,number,title,published_at,work_id,works!inner(id,slug,title,cover_id,kind,published)')
    .not('published_at', 'is', null)
    .eq('works.published', true)
    .order('published_at', { ascending: false })
    .limit(30);

  type ReleaseGroup = {
    workId: string;
    workSlug: string;
    workTitle: string;
    coverId: string | null;
    kind: string;
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
          latestPublishedAt: row.published_at,
          chapters: []
        });
      }
      const group = releasesMap.get(w.id)!;
      if (group.chapters.length < 3) {
        group.chapters.push({
          id: row.id,
          number: row.number,
          title: row.title,
          publishedAt: row.published_at
        });
      }
    }
  }

  const recentReleases = Array.from(releasesMap.values());

  // Check real metrics for popular works (only if real engagement exists)
  // Per rule: "A seção Mais Populares só deve aparecer se houver métrica REAL suficiente para sustentá-la"
  let popularWorks: typeof works = [];
  if (works.length >= 2) {
    const popularChecks = await Promise.all(
      works.map(async (w) => {
        const m = await locals.db.rpc('work_metrics', { p_work: w.id });
        const data = m.data?.[0] || { favorites: 0, likes: 0, readers: 0 };
        const score = Number(data.likes || 0) + Number(data.favorites || 0) * 2 + Number(data.readers || 0);
        return { work: w, score };
      })
    );
    const withEngagement = popularChecks.filter((item) => item.score > 0);
    if (withEngagement.length >= 2) {
      withEngagement.sort((a, b) => b.score - a.score);
      popularWorks = withEngagement.map((item) => item.work);
    }
  }

  return {
    works,
    featuredList,
    recentReleases,
    popularWorks,
    recent: continueReading
  };
};

