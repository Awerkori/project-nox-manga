import re

with open('src/routes/+page.server.ts', 'r') as f:
    content = f.read()

# Find Promise.resolve({ data: null, error: null,  }), and replace with fetchRecentReleases()
# And inject fetchRecentReleases before the load function

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

if "fetchRecentReleases(db" not in content:
    content = content.replace("export const load: PageServerLoad = async ({ locals }) => {", func_code + "\nexport const load: PageServerLoad = async ({ locals }) => {")

content = content.replace("Promise.resolve({ data: null, error: null,  }),", "withTimeout(fetchRecentReleases(db), 4500, { data: [] } as any, 'home_chapters'),")

# We can also clean up the old fallback logic inside the load function to avoid duplication,
# but it's easier to just let it exist since it won't be triggered (recentReleases.length will be > 0)
# Wait, actually `fetchRecentReleases` returns flattened chapter records with work fields!
# The `chaptersRes` expects fields like: work_slug, work_title, work_cover_id, work_kind, work_content_rating.
# My `fetchRecentReleases` adds those via the innerJoin!
# So it perfectly emulates the RPC output!

with open('src/routes/+page.server.ts', 'w') as f:
    f.write(content)

print("Home fixed!")
