with open('src/routes/+page.server.ts', 'r') as f:
    content = f.read()

import re

# Flatten the `works` object out of `chapters` in `db.select()`
# Because Drizzle only allows one level of nesting
original = """            chapters: {
              id: schema.chapters.id,
              number: schema.chapters.number,
              workId: schema.chapters.workId,
              publishedAt: schema.chapters.publishedAt,
              works: {
                id: schema.works.id,
                slug: schema.works.slug,
                title: schema.works.title,
                coverId: schema.works.coverId,
                published: schema.works.published,
                contentRating: schema.works.contentRating
              }
            }"""

replacement = """            chapters: {
              id: schema.chapters.id,
              number: schema.chapters.number,
              workId: schema.chapters.workId,
              publishedAt: schema.chapters.publishedAt
            },
            works: {
              id: schema.works.id,
              slug: schema.works.slug,
              title: schema.works.title,
              coverId: schema.works.coverId,
              published: schema.works.published,
              contentRating: schema.works.contentRating
            }"""

content = content.replace(original, replacement)

# We also need to map the result to nest `works` back into `chapters` so the rest of the code works!
# Let's find the assignment of readingRes
content = re.sub(
    r"(const readingRes = await \([\s\S]*?readingRes\.data\) \{)",
    r"\1\n      readingRes.data = readingRes.data.map((r: any) => ({ ...r, chapters: { ...r.chapters, works: r.works } }));",
    content
)

with open('src/routes/+page.server.ts', 'w') as f:
    f.write(content)
