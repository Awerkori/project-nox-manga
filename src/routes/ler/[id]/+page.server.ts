import { error } from '@sveltejs/kit';
import { safeDbQuery, withTimeout } from '$lib/server/resilience';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, and, desc, asc, isNull, isNotNull, count, inArray, notIlike, ilike } from 'drizzle-orm';
import { primeMediaMetadata } from '$lib/server/media-cache';
import { getSharedCache, setSharedCache, SHARED_CACHE_KEYS } from '$lib/server/shared-cache';

type ReaderCacheEntry = {
  timestamp: number;
  chapter: any;
  pages: any[];
  siblings: any[];
  scans: any[];
};

const readerCache = new Map<string, ReaderCacheEntry>();
const READER_CACHE_TTL_MS = 300_000; // 5 minutes fresh memory cache

type WorkSiblingsCacheEntry = {
  timestamp: number;
  siblings: any[];
  workScans: any[];
};
const workSiblingsCache = new Map<string, WorkSiblingsCacheEntry>();
const WORK_SIBLINGS_CACHE_TTL_MS = 300_000; // 5 minutes fresh work siblings cache

export const load = async ({ locals, params, url, cookies, setHeaders }) => {
  const isStaff = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
  const isPreviewRequested = url.searchParams.get('preview') === '1' || url.searchParams.get('preview') === 'true';
  const canAccessUnpublished = isStaff && isPreviewRequested;

  // 1. Cross-isolate shared Cloudflare edge cache lookup for anonymous readers (~0.3ms, 0 Hyperdrive queries)
  if (!isPreviewRequested && !locals.user) {
    const edgeCached = await getSharedCache<any>(`${SHARED_CACHE_KEYS.READER_PREFIX}${params.id}`);
    if (edgeCached) {
      setHeaders({
        'cache-control': 'private, no-cache'
      });
      return {
        ...edgeCached,
        progress: null,
        preview: false
      };
    }
  }

  // 2. Instant in-memory reader cache for published chapters (served to all readers, including staff, unless explicit preview requested)
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
          'cache-control': 'private, no-cache'
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

  // PARALLEL DISPATCH: Launch chapter metadata, pages, chapter-scans, and user progress concurrently
  const chapterPromise = safeDbQuery(safeQuerySingle(query), 4500, 'reader_chapter');

  const pagesPromise = safeDbQuery(
    safeQuery(
      db.select({
        position: schema.pages.position,
        mediaId: schema.pages.mediaId,
        width: schema.pages.width,
        height: schema.pages.height,
        mediaProvider: schema.media.provider,
        mediaProviderKey: schema.media.providerKey,
        mediaMime: schema.media.mime,
        mediaBytes: schema.media.bytes,
        mediaSha256: schema.media.sha256,
        mediaBotReference: schema.media.botReference,
        mediaStorageShardId: schema.media.storageShardId,
        mediaAccessClass: schema.media.accessClass,
        mediaPurpose: schema.media.purpose,
        mediaCreatedBy: schema.media.createdBy,
        mediaStatus: schema.media.status,
        mediaStorageReady: schema.media.storageReady
      })
      .from(schema.pages)
      .leftJoin(schema.media, eq(schema.pages.mediaId, schema.media.id))
      .where(eq(schema.pages.chapterId, params.id))
      .orderBy(asc(schema.pages.position))
    ),
    6000,
    'reader_pages'
  );

  const chapterScansPromise = safeQuery(
    db.select({
      scans: {
        id: schema.scans.id,
        name: schema.scans.name,
        slug: schema.scans.slug
      }
    })
    .from(schema.chapterScans)
    .innerJoin(schema.scans, eq(schema.chapterScans.scanId, schema.scans.id))
    .where(eq(schema.chapterScans.chapterId, params.id))
  );

  const progressPromise = locals.user
    ? withTimeout(
        safeQuerySingle(
          db.select({
            page: schema.reading.page,
            completedAt: schema.reading.completedAt
          })
          .from(schema.reading)
          .where(and(eq(schema.reading.userId, locals.user.id), eq(schema.reading.chapterId, params.id)))
        ),
        1500,
        { data: null } as any,
        'reader_progress'
      )
    : Promise.resolve({ data: null });

  const chapterRes = await chapterPromise;
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
          title: prodChapter.chapterLabel || prodChapter.chapterTitle || `Capítulo ${prodChapter.chapterNumber}`,
          workId: prodChapter.workId,
          publishedAt: null,
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
      error(403, 'Conteúdo restrito: este capítulo é destinado exclusivamente a maiores de 18 anos.');
    }
  }

  const workId = chapter.workId;

  // Retrieve sibling chapters from memory cache or query in parallel
  let siblingsData: any[] | null = null;
  let workScansData: any[] | null = null;

  const cachedWork = workSiblingsCache.get(workId);
  if (cachedWork && Date.now() - cachedWork.timestamp < WORK_SIBLINGS_CACHE_TTL_MS) {
    siblingsData = cachedWork.siblings;
    workScansData = cachedWork.workScans;
  }

  const siblingsPromise = siblingsData
    ? Promise.resolve({ data: siblingsData, status: 'SUCCESS' })
    : safeDbQuery(
        safeQuery(
          db.select({
            id: schema.chapters.id,
            number: schema.chapters.number
          })
          .from(schema.chapters)
          .where(and(eq(schema.chapters.workId, workId), isNotNull(schema.chapters.publishedAt)))
          .orderBy(asc(schema.chapters.number))
        ),
        5000,
        'reader_siblings'
      );

  const workScansPromise = workScansData
    ? Promise.resolve({ data: workScansData, status: 'SUCCESS' })
    : safeQuery(
        db.select({
          scans: {
            id: schema.scans.id,
            name: schema.scans.name,
            slug: schema.scans.slug
          }
        })
        .from(schema.workScans)
        .innerJoin(schema.scans, eq(schema.workScans.scanId, schema.scans.id))
        .where(eq(schema.workScans.workId, workId))
      );

  const [pagesRes, siblingsRes, chapterScansRes, workScansRes, progress] = await Promise.all([
    pagesPromise,
    siblingsPromise,
    chapterScansPromise,
    workScansPromise,
    progressPromise
  ]);

  if (!siblingsData && siblingsRes.data) {
    if (workSiblingsCache.size >= 200) {
      const oldestKey = workSiblingsCache.keys().next().value;
      if (oldestKey) workSiblingsCache.delete(oldestKey);
    }
    workSiblingsCache.set(workId, {
      timestamp: Date.now(),
      siblings: (siblingsRes.data || []) as any[],
      workScans: (workScansRes.data || []) as any[]
    });
  }

  if (pagesRes.status === 'TIMEOUT') {
    error(503, 'A conexão com as páginas está temporariamente lenta. Tente recarregar em instantes.');
  }

  if (pagesRes.status === 'ERROR') {
    error(500, 'Instabilidade ao carregar as páginas do capítulo.');
  }

  const rawPages = (pagesRes.data || []) as any[];

  // If chapter is published but has 0 pages returned, throw 503 so it re-attempts rather than showing an empty black box
  if (!preview && rawPages.length === 0) {
    error(503, 'Capítulo em processamento ou temporariamente indisponível. Tente novamente em instantes.');
  }

  // Prime worker isolate in-memory cache for media files
  if (rawPages.length > 0) {
    primeMediaMetadata(
      rawPages.map((p) => ({
        id: p.mediaId,
        provider: p.mediaProvider,
        providerKey: p.mediaProviderKey,
        mime: p.mediaMime,
        bytes: p.mediaBytes,
        sha256: p.mediaSha256,
        botReference: p.mediaBotReference,
        storageShardId: p.mediaStorageShardId,
        accessClass: p.mediaAccessClass,
        purpose: p.mediaPurpose,
        createdBy: p.mediaCreatedBy,
        status: p.mediaStatus,
        storageReady: p.mediaStorageReady
      }))
    );
  }

  const pagesData = rawPages.map((p) => ({
    position: p.position,
    mediaId: p.mediaId,
    width: p.width,
    height: p.height
  }));

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
    if (readerCache.size >= 500) {
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

    const sharedPayload = {
      chapter,
      pages: pagesData,
      previous: all[index - 1] || null,
      next: all[index + 1] || null,
      siblings: all,
      comments: [],
      scans,
      preview: false
    };
    setSharedCache(`${SHARED_CACHE_KEYS.READER_PREFIX}${chapter.id}`, sharedPayload, 180).catch(() => {});
  }

  if (!locals.user && !preview) {
    setHeaders({
      'cache-control': 'private, no-cache'
    });
  }

  return {
    chapter,
    pages: pagesData,
    previous: all[index - 1] || null,
    next: all[index + 1] || null,
    siblings: all,
    progress: progress?.data || null,
    comments: [],
    scans,
    preview
  };
};
