import { error, redirect } from '@sveltejs/kit';
import { structuredDataScript, workStructuredData } from '$lib/seo';
import { fetchFullWorkPageFromYugabyte, fetchWorkChaptersFromYugabyte, fetchWorkTagsFromYugabyte, executeYugabyteSql } from '$lib/server/yugabyte';
import { getWorkRating } from '$lib/server/ratings';
import { getObraAuxCache, setObraAuxCache, getOrFetchObraAux } from '$lib/server/obra-cache';
import { sanitizeComments } from '$lib/comments';

const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export const load = async ({ locals, params, url, cookies, platform, setHeaders }: any) => {
  const isTargetUuid = isUuid(params.slug);

  let visitorId = locals.user?.id;
  if (!visitorId) {
    visitorId = cookies?.get?.('nox-vid');
  }

  const isStaff = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
  const preview = isStaff && ['1', 'true'].includes(url.searchParams.get('preview') || '');

  // 1. Authoritative lookup of complete work bundle in YugabyteDB in a SINGLE round-trip
  // To prevent any shared edge cache pollution, only authenticated user IDs are passed for
  // personalized rating resolution during SSR. Anonymous visitors receive clean public aggregates.
  let work: any = null;
  let chaptersList: any[] = [];
  let publicTags: any[] = [];
  let ratingRes: any = null;

  const yugabyteBundle = await fetchFullWorkPageFromYugabyte(
    params.slug,
    locals.user?.id || undefined,
    locals.user?.id,
    preview,
    platform?.env
  );

  if (yugabyteBundle && yugabyteBundle.work) {
    work = yugabyteBundle.work;
    chaptersList = yugabyteBundle.chapters;
    publicTags = yugabyteBundle.tags;
    ratingRes = yugabyteBundle.rating;
  }

  // 2. Direct lookup in YugabyteDB if not found in bundle
  if (!work) {
    try {
      const workSql = isTargetUuid
        ? `SELECT * FROM public.works WHERE published = true AND id = $1 LIMIT 1;`
        : `SELECT * FROM public.works WHERE published = true AND LOWER(slug) = LOWER($1) LIMIT 1;`;
      const ybWorkRes = await executeYugabyteSql(workSql, [params.slug], platform?.env);
      work = ybWorkRes.rows[0] || null;
    } catch (err: any) {
      console.warn('[OBRA_YUGABYTE_WORK_LOOKUP_WARN]', err?.message || err);
    }
  }

  if (!work) {
    error(404, 'Obra não encontrada');
  }

  // Redirect to canonical slug if accessed by UUID
  if (isTargetUuid && work.slug && work.slug !== params.slug) {
    redirect(301, `/obra/${work.slug}`);
  }

  const isAdultWork = (work as any).content_rating === 'ADULT_18';
  if (!locals.user && setHeaders) {
    if (isAdultWork) {
      const rawAgeCookie = cookies?.get?.('nox-age-status') ?? null;
      if (rawAgeCookie === 'MINOR') {
        setHeaders({
          'cache-control': 'private, no-cache, no-store, must-revalidate'
        });
      } else {
        setHeaders({
          'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120'
        });
      }
    } else {
      setHeaders({
        'cache-control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300'
      });
    }
  }

  if (isAdultWork) {
    const rawAgeCookie = cookies?.get?.('nox-age-status') ?? null;
    let ageStatus = rawAgeCookie;
    if (locals.sessionCache?.profile?.age_status) {
      ageStatus = locals.sessionCache.profile.age_status;
    } else if (locals.user) {
      try {
        const mem = await executeYugabyteSql(`SELECT age_status FROM members WHERE id = $1 LIMIT 1;`, [locals.user.id], platform?.env);
        if (mem.rows[0]?.age_status) ageStatus = mem.rows[0].age_status;
      } catch {
        // Age status is a non-critical personalization read.
      }
    }
    if (ageStatus === 'MINOR') {
      error(403, 'Conteúdo restrito: esta obra é destinada exclusivamente a maiores de 18 anos.');
    }
  }

  // Check in-memory aux cache for public comments, aggregate likes, metrics and scans with single-flight deduplication.
  // The page only needs a total and, for a signed-in visitor, its own like state.
  // Fetching every liker ID made popular works needlessly expensive to read and hydrate.
  const cachedAuxEntry = getObraAuxCache(work.id);

  const publicAuxPromise = cachedAuxEntry
    ? Promise.resolve({
        comments: cachedAuxEntry.comments,
        likesCount: cachedAuxEntry.likesCount,
        metrics: cachedAuxEntry.metrics,
        workScans: cachedAuxEntry.workScans
      })
    : getOrFetchObraAux(work.id, async () => {
        try {
          const [commentsRes, metricsRes, scansRes, likesRes] = await Promise.all([
            executeYugabyteSql(
              `SELECT c.id, c.user_id, c.body, c.created_at, c.parent_id, c.removed,
                      json_build_object(
                        'username', m.username,
                        'display_name', m.display_name,
                        'avatar_id', m.avatar_id,
                        'avatar_crop', m.avatar_crop,
                        'name_color', m.name_color,
                        'avatar_frame_id', m.avatar_frame_id,
                        'equipped_comment_banner_id', m.equipped_comment_banner_id,
                        'equipped_banner_id', m.equipped_banner_id,
                        'equipped_title_id', m.equipped_title_id
                      ) AS members,
                      COALESCE((SELECT json_agg(json_build_object('user_id', cl.user_id)) FROM comment_likes cl WHERE cl.comment_id = c.id), '[]'::json) AS comment_likes
               FROM comments c
               LEFT JOIN members m ON m.id = c.user_id
               WHERE c.work_id = $1 AND c.chapter_id IS NULL
               ORDER BY c.created_at DESC
               LIMIT 150;`,
              [work.id],
              platform?.env
            ),
            executeYugabyteSql(`SELECT * FROM public.work_metrics($1);`, [work.id], platform?.env),
            executeYugabyteSql(
              `SELECT ws.is_primary,
                      json_build_object(
                        'id', s.id,
                        'name', s.name,
                        'slug', s.slug,
                        'logo_id', s.logo_id,
                        'description', s.description,
                        'is_official', s.is_official,
                        'discord', s.discord,
                        'fluxer', s.fluxer,
                        'website', s.website
                      ) AS scans
               FROM work_scans ws
               JOIN scans s ON s.id = ws.scan_id
               WHERE ws.work_id = $1;`,
              [work.id],
              platform?.env
            ),
            work.published === true
              ? null
              : executeYugabyteSql(`SELECT COUNT(*)::int AS count FROM likes WHERE work_id = $1;`, [work.id], platform?.env)
          ]);

          const metrics = metricsRes?.rows?.[0] || null;
          const entry = {
            comments: sanitizeComments(commentsRes?.rows || []),
            likesCount: work.published === true ? Number(metrics?.likes ?? 0) : Number(likesRes?.rows?.[0]?.count || 0),
            metrics,
            workScans: scansRes?.rows || []
          };
          setObraAuxCache(work.id, entry);
          return { ...entry, timestamp: Date.now() };
        } catch {
          return {
            timestamp: Date.now(),
            comments: [],
            likesCount: 0,
            metrics: null,
            workScans: []
          };
        }
      });

  const personalPromise = locals.user
    ? (async () => {
        try {
          const [preferenceRes, readRes] = await Promise.all([
            executeYugabyteSql(
              `SELECT
                 (SELECT row_to_json(library_row)
                    FROM (SELECT * FROM library WHERE user_id = $1 AND work_id = $2 LIMIT 1) library_row
                 ) AS library,
                 EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND work_id = $2) AS has_liked;`,
              [locals.user.id, work.id],
              platform?.env
            ),
            executeYugabyteSql(
              `SELECT r.chapter_id, r.page, r.completed_at
               FROM reading r
               JOIN chapters c ON c.id = r.chapter_id
               WHERE r.user_id = $1 AND c.work_id = $2
               ORDER BY r.updated_at DESC;`,
              [locals.user.id, work.id],
              platform?.env
            )
          ]);
          return {
            library: preferenceRes.rows[0]?.library || null,
            hasLiked: Boolean(preferenceRes.rows[0]?.has_liked),
            progress: readRes.rows || []
          };
        } catch (err) {
          console.warn('[OBRA_PERSONAL_DATA_WARN]', err);
          return { library: null, hasLiked: false, progress: [] };
        }
      })()
    : Promise.resolve({ library: null, hasLiked: false, progress: [] });

  const hasYugabyteWorkBundle = Boolean(yugabyteBundle?.work);

  const chaptersPromise = hasYugabyteWorkBundle
    ? Promise.resolve(chaptersList)
    : fetchWorkChaptersFromYugabyte(work.id, preview, platform?.env);

  const tagsPromise = hasYugabyteWorkBundle
    ? Promise.resolve(publicTags)
    : fetchWorkTagsFromYugabyte(work.id, platform?.env);

  const ratingPromise = ratingRes
    ? Promise.resolve(ratingRes)
    : getWorkRating(work.id, visitorId, locals.user?.id, platform?.env);

  // Concurrently resolve remaining data
  const [resolvedChapters, resolvedTags, publicAux, personalData, resolvedRating] = await Promise.all([
    chaptersPromise,
    tagsPromise,
    publicAuxPromise,
    personalPromise,
    ratingPromise
  ]);

  const comments = publicAux.comments || [];
  const likesCount = publicAux.likesCount || 0;
  const metrics = publicAux.metrics;
  const scansList = (publicAux.workScans || []).map((ws: any) => ws.scans).filter(Boolean);
  const library = personalData.library;
  const progress = personalData.progress;
  const tagsList = resolvedTags || [];
  const isAdult = (work as any).content_rating === 'ADULT_18';
  const coverUrl = work.cover_id
    ? work.cover_id.startsWith('/') || work.cover_id.startsWith('http')
      ? work.cover_id.startsWith('http') ? work.cover_id : `${url.origin}${work.cover_id}`
      : `${url.origin}/media/${work.cover_id}`
    : null;

  const metaImage = isAdult
    ? `${url.origin}/brand/nox-symbol-256.webp`
    : coverUrl || `${url.origin}/brand/nox-symbol-256.webp`;

  return {
    work,
    chapters: resolvedChapters,
    tags: tagsList,
    scans: scansList,
    structuredData: structuredDataScript(workStructuredData(work, tagsList, url.origin)),
    comments,
    library,
    likesCount,
    viewerHasLiked: personalData.hasLiked,
    progress,
    metrics,
    rating: resolvedRating,
    canonical: `https://projectnox.org/obra/${work.slug}`,
    coverUrl,
    metaImage,
    hasCustomMetaImage: true
  };
};
