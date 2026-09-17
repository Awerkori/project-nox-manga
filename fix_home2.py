import re

with open('src/routes/+page.server.ts', 'r') as f:
    content = f.read()

func_code = """
async function fetchRecentReleases(db: any) {
    const fallbackWorksRes = await safeQuery(
        db.select({
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
        .limit(16)
    );

    const fallbackWorks = fallbackWorksRes?.data || [];
    if (fallbackWorks.length === 0) return { data: [] };

    const workIds = fallbackWorks.map((w: any) => w.id);
    const fallbackChaptersRes = await safeQuery(
        db.select({
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
        .orderBy(desc(schema.chapters.publishedAt))
    );

    return { data: fallbackChaptersRes.data || [] };
}
"""

if "async function fetchRecentReleases" not in content:
    content = content.replace("export const load = async ({ locals, setHeaders }) => {", func_code + "\nexport const load = async ({ locals, setHeaders }) => {")

with open('src/routes/+page.server.ts', 'w') as f:
    f.write(content)
