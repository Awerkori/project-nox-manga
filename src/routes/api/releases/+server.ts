import { json } from '@sveltejs/kit';
import { db, schema, safeQuery } from '$lib/server/db';
import { desc, eq, inArray, and, sql } from 'drizzle-orm';
import { withTimeout } from '$lib/server/resilience';

export const GET = async ({ url }) => {
  const cursorTime = url.searchParams.get('cursorTime') || null;
  const cursorId = url.searchParams.get('cursorId') || null;
  const limit = Math.min(24, Math.max(1, parseInt(url.searchParams.get('limit') || '16', 10)));

  let whereClause: any = eq(schema.works.published, true);
  if (cursorTime && cursorId) {
    whereClause = and(
      eq(schema.works.published, true),
      sql`(${schema.works.latestChapterPublishedAt} < ${cursorTime} OR (${schema.works.latestChapterPublishedAt} = ${cursorTime} AND ${schema.works.id} < ${cursorId}))`
    );
  } else if (cursorTime) {
    whereClause = and(
      eq(schema.works.published, true),
      sql`${schema.works.latestChapterPublishedAt} < ${cursorTime}`
    );
  }

  const { data: worksData, error: worksError } = await safeQuery(
    db.select({
      workId: schema.works.id,
      workSlug: schema.works.slug,
      workTitle: schema.works.title,
      coverId: schema.works.coverId,
      kind: schema.works.kind,
      contentRating: schema.works.contentRating,
      latestPublishedAt: schema.works.latestChapterPublishedAt
    })
    .from(schema.works)
    .where(whereClause)
    .orderBy(desc(schema.works.latestChapterPublishedAt), desc(schema.works.id))
    .limit(limit)
  );

  if (worksError || !worksData) {
    return json({ releases: [], error: worksError?.message || 'Error' }, { status: 500 });
  }

  const releasesMap = new Map();
  for (const work of worksData) {
    releasesMap.set(work.workId, {
      ...work,
      chapters: []
    });
  }

  if (worksData.length > 0) {
    const workIds = worksData.map(w => w.workId);
    
    // SQLite window functions to get top 3 chapters
    const topChaptersSq = db.$with('top_chapters').as(
      db.select({
        id: schema.chapters.id,
        workId: schema.chapters.workId,
        number: schema.chapters.number,
        title: schema.chapters.title,
        publishedAt: schema.chapters.publishedAt,
        row_num: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${schema.chapters.workId} ORDER BY ${schema.chapters.publishedAt} DESC)`
      })
      .from(schema.chapters)
      .where(inArray(schema.chapters.workId, workIds))
    );

    const { data: chaptersData } = await safeQuery(
      db.with(topChaptersSq)
        .select()
        .from(topChaptersSq)
        .where(sql`${topChaptersSq.row_num} <= 3`)
        .orderBy(desc(topChaptersSq.publishedAt))
    );

    if (chaptersData) {
      for (const ch of chaptersData) {
        if (releasesMap.has(ch.workId)) {
          releasesMap.get(ch.workId).chapters.push({
            id: ch.id,
            number: ch.number,
            title: ch.title,
            publishedAt: ch.publishedAt
          });
        }
      }
    }
  }

  const releases = Array.from(releasesMap.values());

  return json({
    releases,
    hasMore: releases.length === limit,
    nextCursorTime: releases.length > 0 ? releases[releases.length - 1].latestPublishedAt : null,
    nextCursorId: releases.length > 0 ? releases[releases.length - 1].workId : null
  });
};
