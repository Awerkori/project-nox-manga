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

  const topReaders = await locals.db
    .from('members')
    .select('id,username,display_name,avatar_id,xp')
    .gt('xp', 0)
    .order('xp', { ascending: false })
    .limit(3);

  const works = result.data || [];
  const featured = works.find((w) => w.featured) || works[0] || null;

  return {
    works,
    featured,
    recent: continueReading,
    topReaders: topReaders?.data || []
  };
};
