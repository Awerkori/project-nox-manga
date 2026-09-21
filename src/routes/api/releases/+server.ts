import { json } from '@sveltejs/kit';
import { db, safeQuery } from '$lib/server/db';
import { sql } from 'drizzle-orm';

export const GET = async ({ url, setHeaders }) => {
  const cursorTime = url.searchParams.get('cursorTime') || null;
  const cursorId = url.searchParams.get('cursorId') || null;
  const rawKind = url.searchParams.get('kind');
  const kind = rawKind && rawKind.toUpperCase() !== 'ALL' ? rawKind.toUpperCase() : null;
  const limit = Math.min(48, Math.max(3, parseInt(url.searchParams.get('limit') || '24', 10)));

  const querySql = sql`
    WITH top_works AS (
      SELECT id, slug, title, cover_id, kind, content_rating, latest_chapter_published_at
      FROM works
      WHERE published = true
        AND latest_chapter_published_at IS NOT NULL
        AND (${kind}::text IS NULL OR kind = ${kind}::text)
        AND (
          ${cursorTime}::timestamptz IS NULL 
          OR latest_chapter_published_at < ${cursorTime}::timestamptz 
          OR (latest_chapter_published_at = ${cursorTime}::timestamptz AND id < ${cursorId}::uuid)
        )
      ORDER BY latest_chapter_published_at DESC, id DESC
      LIMIT ${limit}::int
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
    console.error('[API RELEASES ERROR]:', qErr);
    return json({ releases: [], error: qErr?.message || 'Database error' }, { status: 500 });
  }

  const releasesMap = new Map<string, any>();
  const rawList = Array.isArray(rows) ? rows : (rows ? [rows] : []);

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

  const releases = Array.from(releasesMap.values());
  const lastItem = releases.length > 0 ? releases[releases.length - 1] : null;

  setHeaders({
    'cache-control': 'public, max-age=15, stale-while-revalidate=60'
  });

  return json({
    releases,
    hasMore: releases.length === limit,
    nextCursorTime: lastItem ? lastItem.latestPublishedAt : null,
    nextCursorId: lastItem ? lastItem.workId : null
  });
};
