import { error } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, desc, asc } from 'drizzle-orm';

export const load = async ({ params }) => {
  const [work, tags, selected, chapters, allScans, workScans] = await Promise.all([
    params.id === 'nova'
      ? Promise.resolve(null)
      : safeQuerySingle(db.select().from(schema.works).where(eq(schema.works.id, params.id))),
    safeQuery(db.select().from(schema.tags).orderBy(asc(schema.tags.name))),
    params.id === 'nova'
      ? Promise.resolve([])
      : safeQuery(db.select({ tagId: schema.workTags.tagId }).from(schema.workTags).where(eq(schema.workTags.workId, params.id))),
    params.id === 'nova'
      ? Promise.resolve([])
      : safeQuery(
          db.select({
            id: schema.chapters.id,
            number: schema.chapters.number,
            title: schema.chapters.title,
            publishedAt: schema.chapters.publishedAt
          })
          .from(schema.chapters)
          .where(eq(schema.chapters.workId, params.id))
          .orderBy(desc(schema.chapters.number))
        ),
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
    params.id === 'nova'
      ? Promise.resolve([])
      : safeQuery(
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
          .where(eq(schema.workScans.workId, params.id))
        )
  ]);

  if (params.id !== 'nova' && !work) error(404, 'Obra não encontrada');
  return {
    work,
    tags: tags || [],
    selected: selected?.map((t) => t.tagId) || [],
    chapters: chapters || [],
    allScans: allScans || [],
    workScans: workScans || []
  };
};
