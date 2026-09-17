with open('src/routes/[area=member]/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("""      chapters: {
        id: schema.chapters.id,
        number: schema.chapters.number,
        works: {
          slug: schema.works.slug,
          title: schema.works.title,
          coverId: schema.works.coverId
        }
      }""", """      chapters: {
        id: schema.chapters.id,
        number: schema.chapters.number,
      },
      works: {
        slug: schema.works.slug,
        title: schema.works.title,
        coverId: schema.works.coverId
      }""")

content = content.replace("row.chapters.works = row.works", "row.chapters.works = row.works")
# Actually we need to make sure the mapping is updated!
with open('src/routes/[area=member]/+page.server.ts', 'w') as f:
    f.write(content)
