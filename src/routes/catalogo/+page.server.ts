import { db, schema, safeQuery } from '$lib/server/db';
import { withTimeout } from '$lib/server/resilience';
import { eq, ilike, and, inArray, desc, asc, count, sql } from 'drizzle-orm';

let cachedTags: { timestamp: number; data: any[] } | null = null;
const TAGS_CACHE_TTL_MS = 600_000;

let cachedTotalWorksCount: { timestamp: number; count: number } | null = null;
const COUNT_CACHE_TTL_MS = 600_000;

let cachedUnfilteredPage1: { timestamp: number; works: any[]; count: number; tags: any[] } | null = null;
const CATALOGO_CACHE_TTL_MS = 60_000;

export const load = async ({ locals, url, setHeaders }: any) => {
  const q = (url.searchParams.get('q') || '').slice(0, 100),
    tag = url.searchParams.get('tag') || '',
    kind = url.searchParams.get('tipo') || '',
    status = url.searchParams.get('status') || '',
    sort = url.searchParams.get('ordem') || 'recentes';
  const page = Math.floor(Math.max(1, Math.min(10000, Number(url.searchParams.get('pagina')) || 1)));

  const isUnfiltered = !q && !tag && !kind && !status && page === 1 && sort === 'recentes';

  if (!locals.user) {
    setHeaders({
      'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
    });
  }

  // Fast-path for unfiltered default catalog view (zero DB wait when cached in isolate)
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

  let filters = [eq(schema.works.published, true)];
  
  if (q) filters.push(ilike(schema.works.searchText, `%${q.replace(/[%_\\]/g, '')}%`));
  if (kind) filters.push(eq(schema.works.kind, kind));
  if (['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED'].includes(status))
    filters.push(eq(schema.works.status, status));

  // If tag filtering is needed, fetch tag IDs first
  if (tag) {
    let currentTags = cachedTags?.data || [];
    if (!currentTags.length) {
      const tRes = await safeQuery(db.select().from(schema.tags).orderBy(schema.tags.name));
      currentTags = tRes?.data || [];
      cachedTags = { timestamp: Date.now(), data: currentTags };
    }
    tagsData = currentTags;
    const selected = currentTags.find((t: any) => t.slug === tag);
    const ids = selected
      ? (
          await safeQuery(db.select({ workId: schema.workTags.workId }).from(schema.workTags).where(eq(schema.workTags.tagId, selected.id)))
        ).data || []
      : [];
    if (ids.length > 0) {
      filters.push(inArray(schema.works.id, ids.map(t => t.workId)));
    } else {
      // no results possible since tag matches nothing
      filters.push(eq(schema.works.id, 'NO_MATCH'));
    }
  }

  const orderBy = sort === 'titulo' ? asc(schema.works.title) : desc(schema.works.updatedAt);
  
  const worksPromise = async () => {
    let countResult = 0;
    if (needExactCount) {
      const { data: countData } = await safeQuery(
        db.select({ count: count() }).from(schema.works).where(and(...filters))
      );
      countResult = countData?.[0]?.count || 0;
    }
    
    const { data: worksData } = await safeQuery(
      db.select().from(schema.works).where(and(...filters))
        .orderBy(orderBy)
        .limit(20)
        .offset((page - 1) * 20)
    );
    
    return { data: worksData || [], count: countResult };
  };

  const [tagsRes, result] = await Promise.all([
    tag || !tagsNeedRefresh
      ? Promise.resolve({ data: cachedTags?.data || [] })
      : safeQuery(db.select().from(schema.tags).orderBy(schema.tags.name)),
    worksPromise()
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
