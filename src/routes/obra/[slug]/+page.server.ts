import { error, redirect } from '@sveltejs/kit';
import { WORK_FIELDS } from '$lib/server/db';
import { structuredDataScript, workStructuredData } from '$lib/seo';
import { safeDbQuery, withTimeout } from '$lib/server/resilience';


const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export const load = async ({ locals, params, url, cookies }) => {
  const isTargetUuid = isUuid(params.slug);

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
    6000,
    'obra_work'
  );

  let work: any = result.data;


  // If not found by exact slug, attempt case-insensitive or ID lookup fallback in DB
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

  if (!work && result.status === 'TIMEOUT') {
    error(503, 'A conexão com a obra está temporariamente lenta. Tente recarregar em instantes.');
  }

  if (!work && result.status === 'ERROR') {
    error(500, 'Instabilidade temporária ao carregar a obra. Tente novamente em instantes.');
  }

  if (!work) {
    error(404, 'Obra não encontrada');
  }

  // Redirect to canonical slug if accessed by UUID
  if (isTargetUuid && work.slug && work.slug !== params.slug) {
    redirect(301, `/obra/${work.slug}`);
  }

  if ((work as any).content_rating === 'ADULT_18') {
    const rawAgeCookie = cookies.get('nox-age-status');
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
  const isStaff = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
  let chaptersQuery = locals.db
    .from('chapters')
    .select('id,number,title,published_at,views_total,chapter_scans(scans(id,name,slug,is_official))')
    .eq('work_id', work.id)
    .order('number', { ascending: false });

  const preview = isStaff && ['1', 'true'].includes(url.searchParams.get('preview') || '');
  if (!preview) {
    chaptersQuery = chaptersQuery.not('published_at', 'is', null);
  }

  const chaptersPromise = withTimeout(
    chaptersQuery,
    6000,
    { data: [] } as any,
    'obra_chapters'
  );

  const auxPromise = withTimeout(
    Promise.all([
      locals.db.from('work_tags').select('tags(id,name,slug,kind)').eq('work_id', work.id),
      locals.db
        .from('comments')
        .select(
          'id,user_id,body,created_at,parent_id,members!comments_user_id_fkey(username,display_name,avatar_id,name_color,avatar_frame_id,equipped_comment_banner_id,equipped_title_id),comment_likes(user_id)'
        )
        .eq('work_id', work.id)
        .eq('removed', false)
        .is('chapter_id', null)
        .order('created_at', { ascending: false })
        .limit(100),
      locals.user
        ? locals.db
            .from('library')
            .select('*')
            .eq('user_id', locals.user.id)
            .eq('work_id', work.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      locals.db.from('likes').select('user_id').eq('work_id', work.id),
      locals.user
        ? locals.db
            .from('reading')
            .select('chapter_id,page,completed_at,chapters!inner(work_id)')
            .eq('chapters.work_id', work.id)
            .order('updated_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      locals.db.rpc('work_metrics', { p_work: work.id }),
      locals.db
        .from('work_scans')
        .select('is_primary,scans(id,name,slug,logo_id,description,is_official,discord,fluxer,website)')
        .eq('work_id', work.id)
    ]),
    4000,
    [{ data: [] }, { data: [] }, { data: null }, { data: [] }, { data: [] }, { data: null }, { data: [] }] as any,
    'obra_aux_details'
  );

  const [chapters, [tags, comments, library, likes, progress, metrics, workScans]] = await Promise.all([
    chaptersPromise,
    auxPromise
  ]);
  const publicTags = (tags.data || []).flatMap((entry) => (entry.tags ? [entry.tags] : []));
  const scansList = (workScans.data || []).map((ws: any) => ws.scans).filter(Boolean);
  const isAdult = (work as any).content_rating === 'ADULT_18';
  const coverUrl = work.cover_id
    ? work.cover_id.startsWith('/') || work.cover_id.startsWith('http')
      ? work.cover_id.startsWith('http') ? work.cover_id : `${url.origin}${work.cover_id}`
      : `${url.origin}/media/${work.cover_id}`
    : null;

  const metaImage = isAdult
    ? `${url.origin}/brand/nox-symbol-256.webp`
    : coverUrl || `${url.origin}/brand/nox-symbol-256.webp`;

  let chaptersList = chapters.data || [];


  return {
    work,
    chapters: chaptersList,
    tags: publicTags,
    scans: scansList,
    structuredData: structuredDataScript(workStructuredData(work, publicTags, url.origin)),
    comments: comments.data || [],
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
