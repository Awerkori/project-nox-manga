const fs = require('fs');

let code = `
import { error } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, desc, asc, and } from 'drizzle-orm';
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const { data: work } = await safeQuerySingle(
    db.select({ id: schema.works.id, title: schema.works.title })
      .from(schema.works)
      .where(eq(schema.works.id, params.id))
  );
  if (!work) error(404);

  const { data: chapter } = params.chapter === 'novo'
    ? { data: null, error: null }
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

  const { data: pagesRes } = chapter
    ? await safeQuery(
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
    : { data: [], error: null };

  const { data: allScansRes } = await safeQuery(
    db.select({
      id: schema.scans.id,
      name: schema.scans.name,
      slug: schema.scans.slug,
      isOfficial: schema.scans.isOfficial,
      status: schema.scans.status
    })
    .from(schema.scans)
    .orderBy(desc(schema.scans.isOfficial), asc(schema.scans.name))
  );

  const { data: workScansRes } = await safeQuery(
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
  );

  const { data: chapterScansRes } = chapter
    ? await safeQuery(
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
    : { data: [], error: null };

  const pages = pagesRes || [];
  const allScans = allScansRes || [];
  const workScans = workScansRes || [];
  const chapterScans = chapter
    ? chapterScansRes || []
    : workScans.map((ws: any) => ({ scanId: ws.scanId, scans: ws.scans }));

  return { work, chapter, pages, allScans, workScans, chapterScans };
};
`;

fs.writeFileSync('src/routes/admin/obras/[id]/capitulos/[chapter]/+page.server.ts', code);
