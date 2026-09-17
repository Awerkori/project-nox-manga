import re

with open('src/routes/u/[username]/+page.server.ts', 'r') as f:
    content = f.read()

def replace_all(content, old, new):
    if old not in content:
        print("NOT FOUND:", old[:50])
    return content.replace(old, new)

fav_old = """    canViewFavorites
      ? locals.db
          .from('library')
          .select(`
            favorite,
            updated_at,
            works!inner(
              id,
              slug,
              title,
              cover_id,
              kind,
              status,
              year,
              content_rating,
              views_total
            )
          `)
          .eq('user_id', member.id)
          .eq('favorite', true)
          .eq('works.published', true)
          .order('updated_at', { ascending: false })
          .limit(24)
      : Promise.resolve({ data: [] }),"""
fav_new = """    canViewFavorites
      ? safeQuery(
          db.select({
            favorite: schema.library.favorite,
            updatedAt: schema.library.updatedAt,
            works: {
              id: schema.works.id,
              slug: schema.works.slug,
              title: schema.works.title,
              coverId: schema.works.coverId,
              kind: schema.works.kind,
              status: schema.works.status,
              year: schema.works.year,
              contentRating: schema.works.contentRating,
              viewsTotal: schema.works.viewsTotal
            }
          })
          .from(schema.library)
          .innerJoin(schema.works, eq(schema.library.workId, schema.works.id))
          .where(and(eq(schema.library.userId, member.id), eq(schema.library.favorite, true), eq(schema.works.published, true)))
          .orderBy(desc(schema.library.updatedAt))
          .limit(24)
        )
      : Promise.resolve({ data: [] }),"""
content = replace_all(content, fav_old, fav_new)

read_old = """    canViewReadingHistory
      ? locals.db
          .from('reading')
          .select(`
            chapter_id,
            page,
            max_page,
            completed_at,
            updated_at,
            chapters!inner(
              id,
              number,
              title,
              work_id,
              works!inner(
                id,
                slug,
                title,
                cover_id,
                kind,
                status,
                content_rating
              )
            )
          `)
          .eq('user_id', member.id)
          .eq('chapters.works.published', true)
          .order('updated_at', { ascending: false })
          .limit(80)
      : Promise.resolve({ data: [] }),"""
read_new = """    canViewReadingHistory
      ? safeQuery(
          db.select({
            chapterId: schema.reading.chapterId,
            page: schema.reading.page,
            maxPage: schema.reading.maxPage,
            completedAt: schema.reading.completedAt,
            updatedAt: schema.reading.updatedAt,
            chapters: {
              id: schema.chapters.id,
              number: schema.chapters.number,
              title: schema.chapters.title,
              workId: schema.chapters.workId,
              works: {
                id: schema.works.id,
                slug: schema.works.slug,
                title: schema.works.title,
                coverId: schema.works.coverId,
                kind: schema.works.kind,
                status: schema.works.status,
                contentRating: schema.works.contentRating
              }
            }
          })
          .from(schema.reading)
          .innerJoin(schema.chapters, eq(schema.reading.chapterId, schema.chapters.id))
          .innerJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
          .where(and(eq(schema.reading.userId, member.id), eq(schema.works.published, true)))
          .orderBy(desc(schema.reading.updatedAt))
          .limit(80)
        )
      : Promise.resolve({ data: [] }),"""
content = replace_all(content, read_old, read_new)

with open('src/routes/u/[username]/+page.server.ts', 'w') as f:
    f.write(content)
