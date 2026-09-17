import { error } from '@sveltejs/kit';
import { safeDbQuery, withTimeout } from '$lib/server/resilience';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, and, desc, asc, isNull, isNotNull, count, inArray, notIlike, ilike } from 'drizzle-orm';

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
  const canAccessUnpublished = isStaff && isPreviewRequested;

  // Instant in-memory reader cache for published chapters (served to all readers, including staff, unless explicit preview requested)
  if (!isPreviewRequested && readerCache.has(params.id)) {
    const cached = readerCache.get(params.id)!;
    if (Date.now() - cached.timestamp < READER_CACHE_TTL_MS) {
      let userProgress = null;
      if (locals.user) {
        const pRes = await withTimeout(
          safeQuerySingle(
            db.select({
              page: schema.reading.page,
              completedAt: schema.reading.completedAt
            })
            .from(schema.reading)
            .where(
              and(
                eq(schema.reading.userId, locals.user.id),
                eq(schema.reading.chapterId, params.id)
              )
            )
          ),
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
      const index = all.findIndex((c: any) => c.id === params.id);
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

  let chapterConditions = [eq(schema.chapters.id, params.id)];
  if (!canAccessUnpublished) {
    chapterConditions.push(isNotNull(schema.chapters.publishedAt));
  }

  const query = db
    .select({
      id: schema.chapters.id,
      number: schema.chapters.number,
      title: schema.chapters.title,
      workId: schema.chapters.workId,
      publishedAt: schema.chapters.publishedAt,
      works: {
        id: schema.works.id,
        title: schema.works.title,
        slug: schema.works.slug,
        kind: schema.works.kind,
        published: schema.works.published,
        contentRating: schema.works.contentRating
      }
    })
    .from(schema.chapters)
    .leftJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
    .where(and(...chapterConditions));

  const chapterRes = await safeDbQuery(safeQuerySingle(query), 4500, 'reader_chapter');
  let chapter: any = chapterRes.data || null;

  // If not found directly in chapters and staff is accessing, check scan_production_chapters
  if (!chapter && canAccessUnpublished) {
    const { data: prodChapter } = await safeQuerySingle(
      db.select({
        id: schema.scanProductionChapters.id,
        workId: schema.scanProductionChapters.workId,
        chapterNumber: schema.scanProductionChapters.chapterNumber,
        chapterLabel: schema.scanProductionChapters.chapterLabel,
        chapterTitle: schema.scanProductionChapters.chapterTitle,
        targetChapterId: schema.scanProductionChapters.targetChapterId
      })
      .from(schema.scanProductionChapters)
      .where(eq(schema.scanProductionChapters.id, params.id))
    );

    if (prodChapter) {
      if (prodChapter.targetChapterId) {
        const { data: targetChap } = await safeQuerySingle(
          db.select({
            id: schema.chapters.id,
            number: schema.chapters.number,
            title: schema.chapters.title,
            workId: schema.chapters.workId,
            publishedAt: schema.chapters.publishedAt,
            works: {
              id: schema.works.id,
              title: schema.works.title,
              slug: schema.works.slug,
              kind: schema.works.kind,
              published: schema.works.published,
              contentRating: schema.works.contentRating
            }
          })
          .from(schema.chapters)
          .leftJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
          .where(eq(schema.chapters.id, prodChapter.targetChapterId))
        );
        chapter = targetChap;
      } else {
        const { data: targetChap } = await safeQuerySingle(
          db.select({
            id: schema.chapters.id,
            number: schema.chapters.number,
            title: schema.chapters.title,
            workId: schema.chapters.workId,
            publishedAt: schema.chapters.publishedAt,
            works: {
              id: schema.works.id,
              title: schema.works.title,
              slug: schema.works.slug,
              kind: schema.works.kind,
              published: schema.works.published,
              contentRating: schema.works.contentRating
            }
          })
          .from(schema.chapters)
          .leftJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
          .where(and(eq(schema.chapters.workId, prodChapter.workId), eq(schema.chapters.number, prodChapter.chapterNumber)))
        );
        chapter = targetChap;
      }

      if (!chapter) {
        const { data: workData } = await safeQuerySingle(
          db.select({
            id: schema.works.id,
            title: schema.works.title,
            slug: schema.works.slug,
            kind: schema.works.kind,
            published: schema.works.published,
            contentRating: schema.works.contentRating
          })
          .from(schema.works)
          .where(eq(schema.works.id, prodChapter.workId))
        );

        chapter = {
          id: prodChapter.id,
          number: prodChapter.chapterNumber,
          title: prodChapter.chapterLabel || prodChapter.chapterTitle || `Captulo ${prodChapter.chapterNumber}`,
          workId: prodChapter.workId,
          publishedAt: null,
          works: workData
        };
      }
    }
  }

  if (!chapter && chapterRes.status === 'TIMEOUT') {
    error(503, 'A conexo com o leitor est temporariamente lenta. Tente recarregar em instantes.');
  }

  if (!chapter && chapterRes.status === 'ERROR') {
    error(500, 'Instabilidade temporria ao carregar o captulo. Tente novamente em instantes.');
  }

  if (!chapter) error(404, 'Captulo indisponvel');
  if (!canAccessUnpublished && !chapter.works?.published) error(404, 'Obra ainda no publicada');

  // Preview mode is active ONLY for unpublished chapters or when staff explicitly requests preview (?preview=1)
  const preview = !chapter.publishedAt || (isPreviewRequested && isStaff);

  if ((chapter.works as any)?.contentRating === 'ADULT_18') {
    const rawAgeCookie = cookies.get('nox-age-status');
    let ageStatus = rawAgeCookie;
    if (locals.sessionCache?.profile?.ageStatus) {
      ageStatus = locals.sessionCache.profile.ageStatus;
    } else if (locals.user) {
      const p = await safeQuerySingle(
        db.select({ ageStatus: schema.members.ageStatus })
        .from(schema.members)
        .where(eq(schema.members.id, locals.user.id))
      );
      if (p.data?.ageStatus) ageStatus = p.data.ageStatus;
    }
    if (ageStatus === 'MINOR') {
      error(403, 'Contedo restrito: este captulo  destinado exclusivamente a maiores de 18 anos.');
    }
  }

  // 1. Fetch core chapter pages with dedicated timeout and resilience
  const pagesPromise = safeDbQuery(
    safeQuery(
      db.select({
        position: schema.pages.position,
        mediaId: schema.pages.mediaId,
        width: schema.pages.width,
        height: schema.pages.height
      })
      .from(schema.pages)
      .where(eq(schema.pages.chapterId, chapter.id))
      .orderBy(asc(schema.pages.position))
    ),
    6000,
    'reader_pages'
  );

  // 2. Fetch sibling chapters for navigation
  const siblingsPromise = safeDbQuery(
    safeQuery(
      db.select({
        id: schema.chapters.id,
        number: schema.chapters.number
      })
      .from(schema.chapters)
      .where(and(eq(schema.chapters.workId, chapter.workId), isNotNull(schema.chapters.publishedAt)))
      .orderBy(asc(schema.chapters.number))
    ),
    5000,
    'reader_siblings'
  );

  // 3. Auxiliary metadata (comments, scans, reading progress) with resilient fallback
  const auxPromise = withTimeout(
    Promise.all([
      locals.user
        ? safeQuerySingle(
            db.select({
              page: schema.reading.page,
              completedAt: schema.reading.completedAt
            })
            .from(schema.reading)
            .where(and(eq(schema.reading.userId, locals.user.id), eq(schema.reading.chapterId, chapter.id)))
          )
        : Promise.resolve({ data: null }),
      
      safeQuery(
        db.select({
          id: schema.comments.id,
          userId: schema.comments.userId,
          body: schema.comments.body,
          createdAt: schema.comments.createdAt,
          parentId: schema.comments.parentId,
          members: {
            username: schema.members.username,
            displayName: schema.members.displayName,
            avatarId: schema.members.avatarId,
            nameColor: schema.members.nameColor,
            avatarFrameId: schema.members.avatarFrameId,
            equippedCommentBannerId: schema.members.equippedCommentBannerId,
            equippedTitleId: schema.members.equippedTitleId
          }
        })
        .from(schema.comments)
        .leftJoin(schema.members, eq(schema.comments.userId, schema.members.id))
        .where(and(eq(schema.comments.chapterId, chapter.id), eq(schema.comments.removed, false)))
        .orderBy(desc(schema.comments.createdAt))
        .limit(100)
      ).then(async (res) => {
        if (!res.data || res.data.length === 0) return { data: [] };
        
        const commentIds = res.data.map((c: any) => c.id);
        const likesRes = await safeQuery(
          db.select({
            commentId: schema.commentLikes.commentId,
            userId: schema.commentLikes.userId
          })
          .from(schema.commentLikes)
          .where(inArray(schema.commentLikes.commentId, commentIds))
        );
        
        const likesMap = new Map<string, { userId: string }[]>();
        if (likesRes.data) {
          for (const like of likesRes.data) {
            if (!likesMap.has(like.commentId)) likesMap.set(like.commentId, []);
            likesMap.get(like.commentId)!.push({ userId: like.userId });
          }
        }
        
        return {
          data: res.data.map((c: any) => ({
            ...c,
            commentLikes: likesMap.get(c.id) || []
          }))
        };
      }),

      safeQuery(
        db.select({
          scans: {
            id: schema.scans.id,
            name: schema.scans.name,
            slug: schema.scans.slug
          }
        })
        .from(schema.chapterScans)
        .innerJoin(schema.scans, eq(schema.chapterScans.scanId, schema.scans.id))
        .where(eq(schema.chapterScans.chapterId, chapter.id))
      ),

      safeQuery(
        db.select({
          scans: {
            id: schema.scans.id,
            name: schema.scans.name,
            slug: schema.scans.slug
          }
        })
        .from(schema.workScans)
        .innerJoin(schema.scans, eq(schema.workScans.scanId, schema.scans.id))
        .where(eq(schema.workScans.workId, chapter.workId))
      )
    ]),
    3000,
    [{ data: null }, { data: [] }, { data: [] }, { data: [] }] as any,
    'reader_aux_metadata'
  );

  const [pagesRes, siblingsRes, [progress, comments, chapterScansRes, workScansRes]] = await Promise.all([
    pagesPromise,
    siblingsPromise,
    auxPromise
  ]);

  if (pagesRes.status === 'TIMEOUT') {
    error(503, 'A conexo com as pginas est temporariamente lenta. Tente recarregar em instantes.');
  }

  if (pagesRes.status === 'ERROR') {
    error(500, 'Instabilidade ao carregar as pginas do captulo.');
  }

  const pagesData = (pagesRes.data || []) as any[];

  // If chapter is published but has 0 pages returned, throw 503 so it re-attempts rather than showing an empty black box
  if (!preview && pagesData.length === 0) {
    error(503, 'Captulo em processamento ou temporariamente indisponvel. Tente novamente em instantes.');
  }

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

  let all = (siblingsRes.data || []) as any[];
  const index = all.findIndex((c: any) => c.id === chapter.id);

  if (!preview && chapter && pagesData.length > 0) {
    if (readerCache.size >= 100) {
      const oldestKey = readerCache.keys().next().value;
      if (oldestKey) readerCache.delete(oldestKey);
    }
    readerCache.set(chapter.id, {
      timestamp: Date.now(),
      chapter,
      pages: pagesData,
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
    pages: pagesData,
    previous: all[index - 1] || null,
    next: all[index + 1] || null,
    siblings: all,
    progress: progress?.data || null,
    comments: comments?.data || [],
    scans,
    preview
  };
};
