with open('src/routes/+page.server.ts', 'r') as f:
    content = f.read()

# Fix the inner `works` in `chapters` in `.select()`
content = content.replace("""        chapters: {
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
        }""", """        chapters: {
          id: schema.chapters.id,
          number: schema.chapters.number,
          workId: schema.chapters.workId,
          publishedAt: schema.chapters.publishedAt,
        },
        works: {
          id: schema.works.id,
          slug: schema.works.slug,
          title: schema.works.title,
          coverId: schema.works.coverId,
          published: schema.works.published,
          contentRating: schema.works.contentRating
        }""")

content = content.replace("const work = (rows[0].chapters as any).works;", "const work = (rows[0] as any).works;")

with open('src/routes/+page.server.ts', 'w') as f:
    f.write(content)
