import { db, schema } from './src/lib/server/db/index.js';
import { eq, isNotNull, desc, and, inArray } from 'drizzle-orm';

async function test() {
    console.log("Fetching fallback works...");
    const fallbackWorksRes = await db.select({
          id: schema.works.id,
          slug: schema.works.slug,
          title: schema.works.title,
          coverId: schema.works.coverId,
          kind: schema.works.kind,
          contentRating: schema.works.contentRating,
          latestChapterPublishedAt: schema.works.latestChapterPublishedAt
        })
        .from(schema.works)
        .where(
          and(
            eq(schema.works.published, true),
            isNotNull(schema.works.latestChapterPublishedAt)
          )
        )
        .orderBy(desc(schema.works.latestChapterPublishedAt))
        .limit(16);
        
    console.log("Works found:", fallbackWorksRes.length);
    if (fallbackWorksRes.length === 0) return;
    
    console.log(fallbackWorksRes[0]);
    
    const workIds = fallbackWorksRes.map(w => w.id);
    const fallbackChaptersRes = await db.select({
            id: schema.chapters.id,
            number: schema.chapters.number,
            title: schema.chapters.title,
            publishedAt: schema.chapters.publishedAt,
            workId: schema.chapters.workId,
            work_slug: schema.works.slug,
            work_title: schema.works.title,
            work_cover_id: schema.works.coverId,
            work_kind: schema.works.kind,
            work_content_rating: schema.works.contentRating
        })
        .from(schema.chapters)
        .innerJoin(schema.works, eq(schema.works.id, schema.chapters.workId))
        .where(
            and(
                inArray(schema.chapters.workId, workIds),
                isNotNull(schema.chapters.publishedAt)
            )
        )
        .orderBy(desc(schema.chapters.publishedAt));
        
    console.log("Chapters found:", fallbackChaptersRes.length);
    console.log(fallbackChaptersRes[0]);
}
test().catch(console.error);
