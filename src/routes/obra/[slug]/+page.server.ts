import { error, redirect } from '@sveltejs/kit';
import { WORK_FIELDS } from '$lib/server/db';
import { structuredDataScript, workStructuredData } from '$lib/seo';
import { safeDbQuery, withTimeout } from '$lib/server/resilience';
import { fetchFullWorkPageFromYugabyte, fetchWorkChaptersFromYugabyte, fetchWorkTagsFromYugabyte } from '$lib/server/yugabyte';
import { getWorkRating } from '$lib/server/ratings';
import { getObraAuxCache, setObraAuxCache } from '$lib/server/obra-cache';

const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export const load = async ({ locals, params, url, cookies, platform, setHeaders }: any) => {
  const isTargetUuid = isUuid(params.slug);

  let visitorId = locals.user?.id;
  if (!visitorId) {
    visitorId = cookies?.get?.('nox-vid');
    if (!visitorId && cookies?.set) {
      visitorId = crypto.randomUUID();
      cookies.set('nox-vid', visitorId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 31536000
      });
    }
  }

  const isStaff = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
  const preview = isStaff && ['1', 'true'].includes(url.searchParams.get('preview') || '');

  // 1. Authoritative lookup of complete work bundle in YugabyteDB in a SINGLE round-trip
  let work: any = null;
  let chaptersList: any[] = [];
  let publicTags: any[] = [];
  let ratingRes: any = null;

  const yugabyteBundle = await fetchFullWorkPageFromYugabyte(
    params.slug,
    visitorId,
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

  // 2. Resilient fallback to Supabase if not found in Yugabyte
  if (!work) {
    let workQuery = locals.db
      .from('works')
      .select(WORK_FIELDS)
      .eq('published', true);

    if (isTargetUuid) {
      workQuery = workQuery.eq('id', params.slug);
    } else {
      workQuery = workQuery.eq('slug', params.slug);
    }

    const result = await safeDbQuery(
      workQuery.maybeSingle(),
      4000,
      'obra_work'
    );
    work = result.data;

    if (!work && result.status === 'SUCCESS_EMPTY' && !isTargetUuid) {
      const fallbackRes = await safeDbQuery(
        locals.db.from('works').select(WORK_FIELDS).ilike('slug', params.slug).eq('published', true).maybeSingle(),
        2000,
        'obra_slug_fallback'
      );
      if (fallbackRes.data) {
        redirect(301, `/obra/${fallbackRes.data.slug}`);
      }
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
      // Adult content is strictly kept private from edge cache to enforce the minor age gate on every request
      setHeaders({
        'cache-control': 'private, no-cache, no-store, must-revalidate'
      });
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
      const p = await locals.db.from('members').select('age_status').eq('id', locals.user.id).maybeSingle();
      if (p.data?.age_status) ageStatus = p.data.age_status;
    }
    if (ageStatus === 'MINOR') {
      error(403, 'Conteúdo restrito: esta obra é destinada exclusivamente a maiores de 18 anos.');
    }
  }

  // Check in-memory aux cache for public comments, likes, metrics and scans
  const cachedAuxEntry = getObraAuxCache(work.id);

  const publicAuxPromise = cachedAuxEntry
    ? Promise.resolve({
        comments: cachedAuxEntry.comments,
        likes: cachedAuxEntry.likes,
        metrics: cachedAuxEntry.metrics,
        workScans: cachedAuxEntry.workScans
      })
    : withTimeout(
        Promise.all([
          locals.db
            .from('comments')
            .select(
              'id,user_id,body,created_at,parent_id,members!comments_user_id_fkey(username,display_name,avatar_id,avatar_crop,name_color,avatar_frame_id,equipped_comment_banner_id,equipped_banner_id,equipped_title_id),comment_likes(user_id)'
            )
            .eq('work_id', work.id)
            .eq('removed', false)
            .is('chapter_id', null)
            .order('created_at', { ascending: false })
            .limit(100),
          locals.db.from('likes').select('user_id').eq('work_id', work.id),
          locals.db.rpc('work_metrics', { p_work: work.id }),
          locals.db
            .from('work_scans')
            .select('is_primary,scans(id,name,slug,logo_id,description,is_official,discord,fluxer,website)')
            .eq('work_id', work.id)
        ]).then(([commentsRes, likesRes, metricsRes, scansRes]: any) => {
          const entry = {
            comments: commentsRes?.data || [],
            likes: likesRes?.data || [],
            metrics: metricsRes?.data?.[0] || null,
            workScans: scansRes?.data || []
          };
          setObraAuxCache(work.id, entry);
          return { ...entry, timestamp: Date.now() };
        }),
        3500,
        {
          comments: cachedAuxEntry?.comments || [],
          likes: cachedAuxEntry?.likes || [],
          metrics: cachedAuxEntry?.metrics || null,
          workScans: cachedAuxEntry?.workScans || []
        },
        'obra_public_aux'
      );

  const personalPromise = locals.user
    ? withTimeout(
        Promise.all([
          locals.db
            .from('library')
            .select('*')
            .eq('user_id', locals.user.id)
            .eq('work_id', work.id)
            .maybeSingle(),
          locals.db
            .from('reading')
            .select('chapter_id,page,completed_at')
            .eq('user_id', locals.user.id)
            .eq('work_id', work.id)
            .order('updated_at', { ascending: false })
        ]),
        2500,
        [{ data: null }, { data: [] }] as any,
        'obra_personal_data'
      )
    : Promise.resolve([{ data: null }, { data: [] }]);

  const chaptersPromise = (chaptersList && chaptersList.length > 0)
    ? Promise.resolve(chaptersList)
    : fetchWorkChaptersFromYugabyte(work.id, preview, platform?.env).then(async (list) => {
        if (list && list.length > 0) return list;
        // Resilient fallback to Supabase if Yugabyte chapters empty
        let chaptersQuery = locals.db
          .from('chapters')
          .select('id,number,display_number,canonical_chapter_key,chapter_order_key,chapter_kind,edition,language,title,published_at,views_total')
          .eq('work_id', work.id)
          .order('chapter_order_key', { ascending: false, nullsFirst: false })
          .order('canonical_chapter_key', { ascending: false, nullsFirst: false })
          .order('id', { ascending: false });

        if (!preview) {
          chaptersQuery = chaptersQuery.not('published_at', 'is', null);
        }

        const res = await withTimeout(chaptersQuery, 3000, { data: [] } as any, 'obra_chapters_fallback');
        return res?.data || [];
      });

  const tagsPromise = (publicTags && publicTags.length > 0)
    ? Promise.resolve(publicTags)
    : fetchWorkTagsFromYugabyte(work.id, platform?.env);

  const ratingPromise = ratingRes
    ? Promise.resolve(ratingRes)
    : getWorkRating(work.id, visitorId, locals.user?.id, platform?.env);

  // Concurrently resolve remaining data
  const [resolvedChapters, resolvedTags, publicAux, [libraryRes, progressRes], resolvedRating] = await Promise.all([
    chaptersPromise,
    tagsPromise,
    publicAuxPromise,
    personalPromise,
    ratingPromise
  ]);

  const comments = publicAux.comments || [];
  const likes = publicAux.likes || [];
  const metrics = publicAux.metrics;
  const scansList = (publicAux.workScans || []).map((ws: any) => ws.scans).filter(Boolean);
  const library = libraryRes?.data || null;
  const progress = progressRes?.data || [];
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
    likes,
    progress,
    metrics,
    rating: resolvedRating,
    canonical: `${url.origin}/obra/${work.slug}`,
    coverUrl,
    metaImage,
    hasCustomMetaImage: true
  };
};
