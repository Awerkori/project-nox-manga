import { db, safeQuery } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { getSharedCache, setSharedCache, SHARED_CACHE_KEYS } from '$lib/server/shared-cache';

interface ReleasesCacheEntry {
  timestamp: number;
  releases: any[];
  hasMore: boolean;
  nextCursorTime: string | null;
  nextCursorId: string | null;
}

const releasesPageCache = new Map<string, ReleasesCacheEntry>();

declare global {
  var __nox_invalidate_releases: (() => void) | undefined;
}

globalThis.__nox_invalidate_releases = () => {
  releasesPageCache.clear();
};

export const load = async ({ url, setHeaders }) => {
  // Enforce private no-cache on HTML documents so edge wrapper delegates caching to shared-cache
  setHeaders({
    'cache-control': 'private, no-cache, no-store, must-revalidate'
  });

  const rawKind = url.searchParams.get('kind');
  const kind = rawKind && rawKind.toUpperCase() !== 'ALL' ? rawKind.toUpperCase() : null;
  const cacheKey = kind || 'ALL';
  const sharedKey = `${SHARED_CACHE_KEYS.LANCAMENTOS_PREFIX}${cacheKey}`;

  // 1. Cross-isolate shared Cloudflare edge cache lookup (0 Hyperdrive queries, ~0.3ms latency)
  const shared = await getSharedCache<ReleasesCacheEntry>(sharedKey);
  if (shared && shared.releases) {
    releasesPageCache.set(cacheKey, shared);
    return {
      releases: shared.releases,
      hasMore: shared.hasMore,
      nextCursorTime: shared.nextCursorTime,
      nextCursorId: shared.nextCursorId,
      selectedKind: kind || 'ALL',
      loadError: false
    };
  }

  // 2. Micro-cache in local isolate memory for ultra-fast fallback
  const localCached = releasesPageCache.get(cacheKey);
  if (localCached && Date.now() - localCached.timestamp < 3000) {
    return {
      releases: localCached.releases,
      hasMore: localCached.hasMore,
      nextCursorTime: localCached.nextCursorTime,
      nextCursorId: localCached.nextCursorId,
      selectedKind: kind || 'ALL',
      loadError: false
    };
  }

  // 3. Cache miss / eviction: execute single consolidated CTE query
  const querySql = sql`
    WITH top_works AS (
      SELECT id, slug, title, cover_id, kind, content_rating, latest_chapter_published_at
      FROM works
      WHERE published = true
        AND latest_chapter_published_at IS NOT NULL
        AND (${kind}::text IS NULL OR kind = ${kind}::text)
      ORDER BY latest_chapter_published_at DESC, id DESC
      LIMIT 24
    ),
    ranked_chapters AS (
      SELECT ch.id, ch.number, ch.title, ch.published_at, ch.work_id,
             ROW_NUMBER() OVER (PARTITION BY ch.work_id ORDER BY ch.published_at DESC, ch.number DESC) as rn
      FROM chapters ch
      JOIN top_works tw ON tw.id = ch.work_id
      WHERE ch.published_at IS NOT NULL
    )
    SELECT rc.id, rc.number, rc.title, rc.published_at,
           tw.id as actual_work_id,
           tw.slug as work_slug, tw.title as work_title, tw.cover_id as work_cover_id,
           tw.kind as work_kind, tw.content_rating as work_content_rating,
           tw.latest_chapter_published_at as latest_published_at
    FROM top_works tw
    LEFT JOIN ranked_chapters rc ON rc.work_id = tw.id AND rc.rn <= 50
    ORDER BY tw.latest_chapter_published_at DESC, tw.id DESC, rc.published_at DESC NULLS LAST, rc.number DESC NULLS LAST;
  `;

  const { data: rows, error: qErr } = await safeQuery(db.execute(querySql));

  if (qErr || !rows) {
    console.error('[LANCAMENTOS LOAD ERROR]:', qErr);
    return {
      releases: [],
      hasMore: false,
      nextCursorTime: null,
      nextCursorId: null,
      selectedKind: kind || 'ALL',
      loadError: true
    };
  }

  const releasesMap = new Map<string, any>();
  const rawList = Array.isArray(rows) ? rows : [rows];

  for (const r of rawList) {
    const workId = r.actual_work_id || r.work_id;
    if (!workId) continue;
    if (!releasesMap.has(workId)) {
      releasesMap.set(workId, {
        workId,
        workSlug: r.work_slug,
        workTitle: r.work_title,
        coverId: r.work_cover_id,
        kind: r.work_kind,
        contentRating: r.work_content_rating,
        latestPublishedAt: r.latest_published_at,
        chapters: []
      });
    }
    const group = releasesMap.get(workId)!;
    if (r.id && !group.chapters.some((c: any) => c.id === r.id || c.number === Number(r.number))) {
      group.chapters.push({
        id: r.id,
        number: Number(r.number),
        title: r.title,
        publishedAt: r.published_at
      });
    }
  }

  const releases = Array.from(releasesMap.values()).slice(0, 24);
  const lastItem = releases.length > 0 ? releases[releases.length - 1] : null;
  const hasMore = releases.length === 24;
  const nextCursorTime = lastItem ? lastItem.latestPublishedAt : null;
  const nextCursorId = lastItem ? lastItem.workId : null;

  const entry: ReleasesCacheEntry = {
    timestamp: Date.now(),
    releases,
    hasMore,
    nextCursorTime,
    nextCursorId
  };

  releasesPageCache.set(cacheKey, entry);

  // Broadcast to Cloudflare shared edge cache so all isolates share it with 0 Hyperdrive queries
  setSharedCache(sharedKey, entry, 20).catch(() => {});

  return {
    releases,
    hasMore,
    nextCursorTime,
    nextCursorId,
    selectedKind: kind || 'ALL',
    loadError: false
  };
};
