import { error, redirect } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, ilike, desc, and, isNotNull, isNull, inArray, exists } from 'drizzle-orm';
import { structuredDataScript, workStructuredData } from '$lib/seo';
import { withTimeout } from '$lib/server/resilience';

const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

interface ObraCacheEntry {
  timestamp: number;
  work: any;
  chapters: any[];
  tags: any[];
  scans: any[];
  likes: any[];
}

const obraCache = new Map<string, ObraCacheEntry>();
const OBRA_CACHE_TTL_MS = 300_000; // 5 minutes fresh memory cache

declare global {
  var __nox_invalidate_obra: ((workId?: string, workSlug?: string) => void) | undefined;
}

globalThis.__nox_invalidate_obra = (workId?: string, workSlug?: string) => {
  if (workId) obraCache.delete(workId);
  if (workSlug) obraCache.delete(workSlug);
  if (!workId && !workSlug) obraCache.clear();
};

export const load = async ({ locals, params, url, cookies, setHeaders }) => {
  const isTargetUuid = isUuid(params.slug);
  const isStaff = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
  const preview = isStaff && ['1', 'true'].includes(url.searchParams.get('preview') || '');

  // Instant in-memory cache lookup for public obra view
  if (!preview && obraCache.has(params.slug)) {
    const cached = obraCache.get(params.slug)!;
    if (Date.now() - cached.timestamp < OBRA_CACHE_TTL_MS) {
      const work = cached.work;

      if ((work as any).contentRating === 'ADULT_18') {
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
          error(403, 'Conteúdo restrito: esta obra é destinada exclusivamente a maiores de 18 anos.');
        }
      }

      if (isTargetUuid && work.slug && work.slug !== params.slug) {
        redirect(301, `/obra/${work.slug}`);
      }

      let libraryData = null;
      let progressData: any[] = [];
      if (locals.user) {
        const [libRes, progRes] = await Promise.all([
          safeQuerySingle(
            db.select()
              .from(schema.library)
              .where(
                and(
                  eq(schema.library.userId, locals.user.id),
                  eq(schema.library.workId, work.id)
                )
              )
          ),
          safeQuery(
            db.select({
              chapterId: schema.reading.chapterId,
              page: schema.reading.page,
              completedAt: schema.reading.completedAt,
              chapters: {
                workId: schema.chapters.workId
              }
            })
            .from(schema.reading)
            .innerJoin(schema.chapters, eq(schema.reading.chapterId, schema.chapters.id))
            .where(eq(schema.chapters.workId, work.id))
            .orderBy(desc(schema.reading.updatedAt))
          )
        ]);
        libraryData = libRes.data;
        progressData = progRes.data || [];
      } else {
        setHeaders({
          'cache-control': 'public, max-age=60, stale-while-revalidate=300'
        });
      }

      const coverUrl = work.coverId
        ? work.coverId.startsWith('/') || work.coverId.startsWith('http')
          ? work.coverId.startsWith('http') ? work.coverId : `${url.origin}${work.coverId}`
          : `${url.origin}/media/${work.coverId}`
        : null;

      const isAdult = (work as any).contentRating === 'ADULT_18';
      const metaImage = isAdult
        ? `${url.origin}/brand/nox-symbol-256.webp`
        : coverUrl || `${url.origin}/brand/nox-symbol-256.webp`;

      return {
        work,
        chapters: cached.chapters,
        tags: cached.tags,
        scans: cached.scans,
        structuredData: structuredDataScript(workStructuredData(work, cached.tags, url.origin)),
        comments: [],
        library: libraryData,
        likes: cached.likes || [],
        progress: progressData,
        metrics: null,
        canonical: `${url.origin}/obra/${work.slug}`,
        coverUrl,
        metaImage,
        hasCustomMetaImage: true
      };
    }
  }

  let condition = and(
    eq(schema.works.published, true),
    isTargetUuid ? eq(schema.works.id, params.slug) : eq(schema.works.slug, params.slug)
  );

  let workQuery = db.select().from(schema.works).where(condition);

  const resultPromise = safeQuerySingle(workQuery);
  const result = await withTimeout(
    resultPromise,
    6000,
    { data: null, error: 'TIMEOUT' },
    'obra_work'
  );

  let work: any = result.data;

  // If not found by exact slug, attempt case-insensitive or ID lookup fallback in DB
  if (!work && !result.error && !isTargetUuid) {
    const fallbackRes = await withTimeout(
      safeQuerySingle(
        db.select()
          .from(schema.works)
          .where(
            and(
              ilike(schema.works.slug, params.slug),
              eq(schema.works.published, true)
            )
          )
      ),
      2000,
      { data: null, error: 'TIMEOUT' },
      'obra_slug_fallback'
    );
    if (fallbackRes.data) {
      redirect(301, `/obra/${fallbackRes.data.slug}`);
    }
  }

  if (!work && result.error === 'TIMEOUT') {
    error(503, 'A conexão com a obra está temporariamente lenta. Tente recarregar em instantes.');
  }

  if (!work && result.error) {
    error(500, 'Instabilidade temporária ao carregar a obra. Tente novamente em instantes.');
  }

  if (!work) {
    error(404, 'Obra não encontrada');
  }

  // Redirect to canonical slug if accessed by UUID
  if (isTargetUuid && work.slug && work.slug !== params.slug) {
    redirect(301, `/obra/${work.slug}`);
  }

  if ((work as any).contentRating === 'ADULT_18') {
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
      error(403, 'Conteúdo restrito: esta obra é destinada exclusivamente a maiores de 18 anos.');
    }
  }

  let chaptersCondition: any = eq(schema.chapters.workId, work.id);
  if (!preview) {
    chaptersCondition = and(
      chaptersCondition, 
      isNotNull(schema.chapters.publishedAt),
      exists(
        db.select({ pos: schema.pages.position })
          .from(schema.pages)
          .where(eq(schema.pages.chapterId, schema.chapters.id))
      )
    );
  }

  const chaptersPromise = withTimeout(
    (async () => {
      const chaptersListRaw = await safeQuery(
        db.select({
            id: schema.chapters.id,
            number: schema.chapters.number,
            title: schema.chapters.title,
            publishedAt: schema.chapters.publishedAt,
            viewsTotal: schema.chapters.viewsTotal,
          })
          .from(schema.chapters)
          .where(chaptersCondition)
          .orderBy(desc(schema.chapters.number))
      );

      const chapterIds = chaptersListRaw.data?.map(c => c.id) || [];
      let allChapterScans: any[] = [];
      if (chapterIds.length > 0) {
        const scansRes = await safeQuery(
          db.select({
            chapterId: schema.chapterScans.chapterId,
            scans: {
              id: schema.scans.id,
              name: schema.scans.name,
              slug: schema.scans.slug,
              isOfficial: schema.scans.isOfficial
            }
          })
          .from(schema.chapterScans)
          .leftJoin(schema.scans, eq(schema.chapterScans.scanId, schema.scans.id))
          .where(inArray(schema.chapterScans.chapterId, chapterIds))
        );
        allChapterScans = scansRes.data || [];
      }

      return {
        data: (chaptersListRaw.data || []).map(ch => ({
          ...ch,
          chapterScans: allChapterScans.filter(cs => cs.chapterId === ch.id).map(cs => ({ scans: cs.scans }))
        }))
      };
    })(),
    6000,
    { data: [] } as any,
    'obra_chapters'
  );

  const auxPromise = withTimeout(
    Promise.all([
      safeQuery(
        db.select({
          tags: {
            id: schema.tags.id,
            name: schema.tags.name,
            slug: schema.tags.slug,
            kind: schema.tags.kind
          }
        })
        .from(schema.workTags)
        .leftJoin(schema.tags, eq(schema.workTags.tagId, schema.tags.id))
        .where(eq(schema.workTags.workId, work.id))
      ),
      Promise.resolve({ data: [] }),
      locals.user
        ? safeQuerySingle(
            db.select()
              .from(schema.library)
              .where(
                and(
                  eq(schema.library.userId, locals.user.id),
                  eq(schema.library.workId, work.id)
                )
              )
          )
        : Promise.resolve({ data: null }),
      safeQuery(
        db.select({ userId: schema.likes.userId })
          .from(schema.likes)
          .where(eq(schema.likes.workId, work.id))
      ),
      locals.user
        ? safeQuery(
            db.select({
              chapterId: schema.reading.chapterId,
              page: schema.reading.page,
              completedAt: schema.reading.completedAt,
              chapters: {
                workId: schema.chapters.workId
              }
            })
            .from(schema.reading)
            .innerJoin(schema.chapters, eq(schema.reading.chapterId, schema.chapters.id))
            .where(eq(schema.chapters.workId, work.id))
            .orderBy(desc(schema.reading.updatedAt))
          )
        : Promise.resolve({ data: [] }),
      Promise.resolve({ data: [] }), // work_metrics not directly supported, returning empty
      safeQuery(
        db.select({
          isPrimary: schema.workScans.isPrimary,
          scans: {
            id: schema.scans.id,
            name: schema.scans.name,
            slug: schema.scans.slug,
            logoId: schema.scans.logoId,
            description: schema.scans.description,
            isOfficial: schema.scans.isOfficial,
            discord: schema.scans.discord,
            fluxer: schema.scans.fluxer,
            website: schema.scans.website
          }
        })
        .from(schema.workScans)
        .leftJoin(schema.scans, eq(schema.workScans.scanId, schema.scans.id))
        .where(eq(schema.workScans.workId, work.id))
      )
    ]),
    4000,
    [{ data: [] }, { data: [] }, { data: null }, { data: [] }, { data: [] }, { data: null }, { data: [] }] as any,
    'obra_aux_details'
  );

  const [chapters, [tags, comments, library, likes, progress, metrics, workScans]] = await Promise.all([
    chaptersPromise,
    auxPromise
  ]);

  const publicTags = (tags.data || []).flatMap((entry: any) => (entry.tags ? [entry.tags] : []));
  const scansList = (workScans.data || []).map((ws: any) => ws.scans).filter(Boolean);
  const isAdult = (work as any).contentRating === 'ADULT_18';
  const coverUrl = work.coverId
    ? work.coverId.startsWith('/') || work.coverId.startsWith('http')
      ? work.coverId.startsWith('http') ? work.coverId : `${url.origin}${work.coverId}`
      : `${url.origin}/media/${work.coverId}`
    : null;

  const metaImage = isAdult
    ? `${url.origin}/brand/nox-symbol-256.webp`
    : coverUrl || `${url.origin}/brand/nox-symbol-256.webp`;

  let chaptersList = chapters.data || [];

  if (!preview && work) {
    if (obraCache.size >= 500) {
      const oldestKey = obraCache.keys().next().value;
      if (oldestKey) obraCache.delete(oldestKey);
    }
    const cacheEntry: ObraCacheEntry = {
      timestamp: Date.now(),
      work,
      chapters: chaptersList,
      tags: publicTags,
      scans: scansList,
      likes: likes.data || []
    };
    obraCache.set(work.id, cacheEntry);
    if (work.slug) {
      obraCache.set(work.slug, cacheEntry);
    }
  }

  if (!locals.user && !preview) {
    setHeaders({
      'cache-control': 'public, max-age=60, stale-while-revalidate=300'
    });
  }

  return {
    work,
    chapters: chaptersList,
    tags: publicTags,
    scans: scansList,
    structuredData: structuredDataScript(workStructuredData(work, publicTags, url.origin)),
    comments: [],
    library: library.data,
    likes: likes.data || [],
    progress: progress.data || [],
    metrics: metrics.data?.[0] || null,
    canonical: `${url.origin}/obra/${work.slug}`,
    coverUrl,
    metaImage,
    hasCustomMetaImage: true
  };
};
