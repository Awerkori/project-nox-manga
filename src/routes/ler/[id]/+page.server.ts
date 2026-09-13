import { error } from '@sveltejs/kit';
import { safeDbQuery, withTimeout } from '$lib/server/resilience';

type ReaderCacheEntry = {
  timestamp: number;
  chapter: any;
  pages: any[];
  siblings: any[];
  scans: any[];
};

const readerCache = new Map<string, ReaderCacheEntry>();
const READER_CACHE_TTL_MS = 60_000;

export const load = async ({ locals, params, url, cookies, setHeaders }) => {
  const isStaff = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
  const isPreviewRequested = url.searchParams.get('preview') === '1' || url.searchParams.get('preview') === 'true';
  const canAccessUnpublished = isStaff;

  // Instant in-memory reader cache for published chapters (served to all readers, including staff, unless explicit preview requested)
  if (!isPreviewRequested && readerCache.has(params.id)) {
    const cached = readerCache.get(params.id)!;
    if (Date.now() - cached.timestamp < READER_CACHE_TTL_MS) {
      let userProgress = null;
      if (locals.user) {
        const pRes = await withTimeout(
          locals.db
            .from('reading')
            .select('page,completed_at')
            .eq('user_id', locals.user.id)
            .eq('chapter_id', params.id)
            .maybeSingle(),
          800,
          { data: null } as any,
          'reader_cached_progress'
        );
        userProgress = pRes?.data || null;
      } else {
        setHeaders({
          'cache-control': 'public, max-age=60, stale-while-revalidate=300'
        });
      }

      const all = cached.siblings;
      const index = all.findIndex((c) => c.id === params.id);
      return {
        chapter: cached.chapter,
        pages: cached.pages,
        previous: all[index - 1] || null,
        next: all[index + 1] || null,
        siblings: all,
        progress: userProgress,
        comments: [],
        scans: cached.scans,
        preview: false
      };
    }
  }

  let query = locals.db
    .from('chapters')
    .select('id,number,title,work_id,published_at,works(id,title,slug,kind,published,content_rating)')
    .eq('id', params.id);
  if (!canAccessUnpublished) query = query.not('published_at', 'is', null);

  const chapterRes = await safeDbQuery(query.maybeSingle(), 4500, 'reader_chapter');
  let chapter: any = chapterRes.data || null;

  // If not found directly in chapters and staff is accessing, check scan_production_chapters
  if (!chapter && canAccessUnpublished) {
    const { data: prodChapter } = await (locals.db as any)
      .from('scan_production_chapters')
      .select('id, work_id, chapter_number, chapter_label, chapter_title, target_chapter_id')
      .eq('id', params.id)
      .maybeSingle();

    if (prodChapter) {
      if (prodChapter.target_chapter_id) {
        const { data: targetChap } = await locals.db
          .from('chapters')
          .select('id,number,title,work_id,published_at,works(id,title,slug,kind,published,content_rating)')
          .eq('id', prodChapter.target_chapter_id)
          .maybeSingle();
        chapter = targetChap;
      } else {
        const { data: targetChap } = await locals.db
          .from('chapters')
          .select('id,number,title,work_id,published_at,works(id,title,slug,kind,published,content_rating)')
          .eq('work_id', prodChapter.work_id)
          .eq('number', prodChapter.chapter_number)
          .maybeSingle();
        chapter = targetChap;
      }

      if (!chapter) {
        const { data: workData } = await locals.db
          .from('works')
          .select('id,title,slug,kind,published,content_rating')
          .eq('id', prodChapter.work_id)
          .maybeSingle();

        chapter = {
          id: prodChapter.id,
          number: prodChapter.chapter_number,
          title: prodChapter.chapter_label || prodChapter.chapter_title || `Capítulo ${prodChapter.chapter_number}`,
          work_id: prodChapter.work_id,
          published_at: null,
          works: workData
        };
      }
    }
  }



  if (!chapter && chapterRes.status === 'TIMEOUT') {
    error(503, 'A conexão com o leitor está temporariamente lenta. Tente recarregar em instantes.');
  }

  if (!chapter && chapterRes.status === 'ERROR') {
    error(500, 'Instabilidade temporária ao carregar o capítulo. Tente novamente em instantes.');
  }

  if (!chapter) error(404, 'Capítulo indisponível');
  if (!canAccessUnpublished && !chapter.works?.published) error(404, 'Obra ainda não publicada');

  // Preview mode is active ONLY for unpublished chapters or when staff explicitly requests preview (?preview=1)
  const preview = !chapter.published_at || (isPreviewRequested && isStaff);

  if ((chapter.works as any)?.content_rating === 'ADULT_18') {
    const rawAgeCookie = cookies.get('nox-age-status');
    let ageStatus = rawAgeCookie;
    if (locals.sessionCache?.profile?.age_status) {
      ageStatus = locals.sessionCache.profile.age_status;
    } else if (locals.user) {
      const p = await locals.db.from('members').select('age_status').eq('id', locals.user.id).maybeSingle();
      if (p.data?.age_status) ageStatus = p.data.age_status;
    }
    if (ageStatus === 'MINOR') {
      error(403, 'Conteúdo restrito: este capítulo é destinado exclusivamente a maiores de 18 anos.');
    }
  }
  const [pages, siblings, progress, comments, chapterScansRes, workScansRes] = await withTimeout(
    Promise.all([
      locals.db
        .from('pages')
        .select('position,media_id,width,height')
        .eq('chapter_id', chapter.id)
        .order('position'),
      locals.db
        .from('chapters')
        .select('id,number')
        .eq('work_id', chapter.work_id)
        .not('published_at', 'is', null)
        .order('number'),
      locals.user
        ? locals.db
            .from('reading')
            .select('page,completed_at')
            .eq('user_id', locals.user.id)
            .eq('chapter_id', chapter.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      locals.db
        .from('comments')
        .select(
          'id,user_id,body,created_at,parent_id,members!comments_user_id_fkey(username,display_name,avatar_id,name_color,avatar_frame_id,equipped_comment_banner_id,equipped_title_id),comment_likes(user_id)'
        )
        .eq('chapter_id', chapter.id)
        .eq('removed', false)
        .order('created_at', { ascending: false })
        .limit(100),
      locals.db
        .from('chapter_scans')
        .select('scans(id,name,slug)')
        .eq('chapter_id', chapter.id),
      locals.db
        .from('work_scans')
        .select('scans(id,name,slug)')
        .eq('work_id', chapter.work_id)
    ]),
    3500,
    [{ data: [] }, { data: [] }, { data: null }, { data: [] }, { data: [] }, { data: [] }] as any,
    'reader_batch_data'
  );

  let scans = (((chapterScansRes && chapterScansRes.data) || []) as any[])
    .map((cs) => cs.scans)
    .filter(Boolean);
  if (!scans.length) {
    scans = (((workScansRes && workScansRes.data) || []) as any[])
      .map((s: any) => s.scans)
      .filter(Boolean);
  }
  if (!scans.length) {
    scans = [{ id: '04872e99-37ad-4d45-aed4-35759d0eae33', name: 'Project Nox', slug: 'project-nox' }];
  }

  let all = (siblings.data || []) as any[];

  const index = all.findIndex((c) => c.id === chapter.id);

  if (!preview && chapter && pages.data && pages.data.length > 0) {
    if (readerCache.size >= 100) {
      const oldestKey = readerCache.keys().next().value;
      if (oldestKey) readerCache.delete(oldestKey);
    }
    readerCache.set(chapter.id, {
      timestamp: Date.now(),
      chapter,
      pages: pages.data,
      siblings: all,
      scans
    });
  }

  if (!locals.user && !preview) {
    setHeaders({
      'cache-control': 'public, max-age=60, stale-while-revalidate=300'
    });
  }

  return {
    chapter,
    pages: pages.data || [],
    previous: all[index - 1] || null,
    next: all[index + 1] || null,
    siblings: all,
    progress: progress.data,
    comments: comments.data || [],
    scans,
    preview
  };
};
