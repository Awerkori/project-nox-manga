import { error } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, desc, asc, and } from 'drizzle-orm';

export const load = async ({ params }) => {
  const work = await safeQuerySingle(
    db.select({ id: schema.works.id, title: schema.works.title })
      .from(schema.works)
      .where(eq(schema.works.id, params.id))
  );
  if (!work) error(404);

  const chapter = params.chapter === 'novo'
    ? null
    : await safeQuerySingle(
        db.select({
          id: schema.chapters.id,
          number: schema.chapters.number,
          title: schema.chapters.title,
          publishedAt: schema.chapters.publishedAt
        })
        .from(schema.chapters)
        .where(
          and(
            eq(schema.chapters.id, params.chapter),
            eq(schema.chapters.workId, work.id)
          )
        )
      );

  if (params.chapter !== 'novo' && !chapter) error(404);

  const [pagesRes, allScansRes, workScansRes, chapterScansRes] = await Promise.all([
    chapter
      ? safeQuery(
          db.select({
            mediaId: schema.pages.mediaId,
            position: schema.pages.position,
            width: schema.pages.width,
            height: schema.pages.height
          })
          .from(schema.pages)
          .where(eq(schema.pages.chapterId, chapter.id))
          .orderBy(asc(schema.pages.position))
        )
      : Promise.resolve([]),
    safeQuery(
      db.select({
        id: schema.scans.id,
        name: schema.scans.name,
        slug: schema.scans.slug,
        isOfficial: schema.scans.isOfficial,
        status: schema.scans.status
      })
      .from(schema.scans)
      .orderBy(desc(schema.scans.isOfficial), asc(schema.scans.name))
    ),
    safeQuery(
      db.select({
        scanId: schema.workScans.scanId,
        isPrimary: schema.workScans.isPrimary,
        scans: {
          id: schema.scans.id,
          name: schema.scans.name,
          slug: schema.scans.slug,
          isOfficial: schema.scans.isOfficial
        }
      })
      .from(schema.workScans)
      .leftJoin(schema.scans, eq(schema.workScans.scanId, schema.scans.id))
      .where(eq(schema.workScans.workId, work.id))
    ),
    chapter
      ? safeQuery(
          db.select({
            scanId: schema.chapterScans.scanId,
            scans: {
              id: schema.scans.id,
              name: schema.scans.name,
              slug: schema.scans.slug,
              isOfficial: schema.scans.isOfficial
            }
          })
          .from(schema.chapterScans)
          .leftJoin(schema.scans, eq(schema.chapterScans.scanId, schema.scans.id))
          .where(eq(schema.chapterScans.chapterId, chapter.id))
        )
      : Promise.resolve([])
  ]);

  const pages = pagesRes || [];
  const allScans = allScansRes || [];
  const workScans = workScansRes || [];
  const chapterScans = chapter
    ? chapterScansRes || []
    : workScans.map((ws) => ({ scanId: ws.scanId, scans: ws.scans }));

  return { work, chapter, pages, allScans, workScans, chapterScans };
};
