import { WORK_FIELDS } from '$lib/server/db';
import { withTimeout } from '$lib/server/resilience';


let cachedTags: { timestamp: number; data: any[] } | null = null;
const TAGS_CACHE_TTL_MS = 300_000;

let cachedTotalWorksCount: { timestamp: number; count: number } | null = null;
const COUNT_CACHE_TTL_MS = 60_000;

let cachedUnfilteredPage1: { timestamp: number; works: any[]; count: number; tags: any[] } | null = null;
const CATALOGO_CACHE_TTL_MS = 60_000;

export const load = async ({ locals, url, setHeaders }) => {
  const q = (url.searchParams.get('q') || '').slice(0, 100),
    tag = url.searchParams.get('tag') || '',
    kind = url.searchParams.get('tipo') || '',
    status = url.searchParams.get('status') || '',
    sort = url.searchParams.get('ordem') || 'recentes';
  const page = Math.floor(Math.max(1, Math.min(10000, Number(url.searchParams.get('pagina')) || 1)));

  const isUnfiltered = !q && !tag && !kind && !status && page === 1 && sort === 'recentes';

  if (!locals.user) {
    setHeaders({
      'cache-control': 'public, max-age=60, stale-while-revalidate=300'
    });
  }

  // Fast path for unfiltered default catalog view (zero DB wait when cached)
  if (isUnfiltered && cachedUnfilteredPage1 && Date.now() - cachedUnfilteredPage1.timestamp < CATALOGO_CACHE_TTL_MS) {
    return {
      works: cachedUnfilteredPage1.works,
      count: cachedUnfilteredPage1.count,
      tags: cachedUnfilteredPage1.tags,
      q,
      tag,
      kind,
      status,
      sort,
      page
    };
  }

  // Execute tags and works query in parallel when not filtering by tag
  let tagsData: any[] = [];
  const tagsNeedRefresh = !cachedTags || Date.now() - cachedTags.timestamp > TAGS_CACHE_TTL_MS;

  const needExactCount = !isUnfiltered || !cachedTotalWorksCount || Date.now() - cachedTotalWorksCount.timestamp > COUNT_CACHE_TTL_MS;

  let query = locals.db
    .from('works')
    .select(WORK_FIELDS, needExactCount ? { count: 'exact' } : {})
    .eq('published', true);

  if (q) query = query.ilike('search_text', `%${q.replace(/[%_\\]/g, '')}%`);
  if (kind) query = query.eq('kind', kind);
  if (['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED'].includes(status))
    query = query.eq('status', status);

  // If tag filtering is needed, fetch tag IDs first
  if (tag) {
    let currentTags = cachedTags?.data || [];
    if (!currentTags.length) {
      const tRes = await withTimeout(
        locals.db.from('tags').select('*').order('name'),
        1000,
        { data: [] } as any,
        'catalogo_tags'
      );
      currentTags = tRes?.data || [];
      cachedTags = { timestamp: Date.now(), data: currentTags };
    }
    tagsData = currentTags;
    const selected = currentTags.find((t: any) => t.slug === tag);
    const ids = selected
      ? (
          await withTimeout(
            locals.db.from('work_tags').select('work_id').eq('tag_id', selected.id),
            1000,
            { data: [] } as any,
            'catalogo_tag_ids'
          )
        ).data || []
      : [];
    query = query.in('id', ids.map((t: any) => t.work_id));
  }

  const [tagsRes, result] = await Promise.all([
    tag || !tagsNeedRefresh
      ? Promise.resolve({ data: cachedTags?.data || [] })
      : withTimeout(
          locals.db.from('tags').select('*').order('name'),
          1200,
          { data: cachedTags?.data || [] } as any,
          'catalogo_tags'
        ),
    withTimeout(
      query
        .order(sort === 'titulo' ? 'title' : 'updated_at', { ascending: sort === 'titulo' })
        .range((page - 1) * 20, page * 20 - 1),
      6000,
      { data: [], count: 0 } as any,
      'catalogo_works'
    )

  ]);

  if (tagsRes?.data && tagsRes.data.length > 0) {
    tagsData = tagsRes.data;
    cachedTags = { timestamp: Date.now(), data: tagsData };
  } else if (!tagsData.length) {
    tagsData = cachedTags?.data || [];
  }

  let works = result.data || [];
  let totalCount = result.count || 0;

  if (works.length === 0 && isUnfiltered && cachedUnfilteredPage1) {
    works = cachedUnfilteredPage1.works;
    totalCount = cachedUnfilteredPage1.count;
  }


  if (isUnfiltered) {
    if (result.count && result.count > 0) {
      cachedTotalWorksCount = { timestamp: Date.now(), count: result.count };
      totalCount = result.count;
    } else if (cachedTotalWorksCount) {
      totalCount = cachedTotalWorksCount.count;
    }

    if (works.length > 0) {
      cachedUnfilteredPage1 = {
        timestamp: Date.now(),
        works,
        count: totalCount,
        tags: tagsData
      };
    }
  }

  return {
    works,
    count: totalCount,
    tags: tagsData,
    q,
    tag,
    kind,
    status,
    sort,
    page
  };
};
