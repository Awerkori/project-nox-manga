import { json } from '@sveltejs/kit';
import { verifyMihonAuth } from '$lib/server/mihon';
import { db, schema, safeQuerySingle, safeQuery } from '$lib/server/db';
import { eq, asc } from 'drizzle-orm';

export const GET = async ({ params, request, url }) => {
  const { id } = params;
  const auth = await verifyMihonAuth(request);
  const allowAdult = auth.authenticated && auth.ageStatus === 'ADULT';

  const chapterRes = await safeQuerySingle(
    db.select({
      id: schema.chapters.id,
      number: schema.chapters.number,
      title: schema.chapters.title,
      publishedAt: schema.chapters.publishedAt,
      workId: schema.chapters.workId,
      workTitle: schema.works.title,
      workSlug: schema.works.slug,
      workContentRating: schema.works.contentRating,
      workPublished: schema.works.published
    })
    .from(schema.chapters)
    .innerJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
    .where(eq(schema.chapters.id, id))
  );

  if (chapterRes.error || !chapterRes.data || !chapterRes.data.publishedAt) {
    return json({ error: 'Captulo no encontrado' }, { status: 404 });
  }

  const chapter = chapterRes.data;

  if (!chapter.workPublished) {
    return json({ error: 'Obra no publicada' }, { status: 404 });
  }

  if (chapter.workContentRating === 'ADULT_18' && !allowAdult) {
    return json(
      { error: 'Contedo Adulto (+18). Requer autenticao com token de usurio maior de idade.' },
      { status: 403 }
    );
  }

  const pagesRes = await safeQuery(
    db.select({
      position: schema.pages.position,
      mediaId: schema.pages.mediaId,
      width: schema.pages.width,
      height: schema.pages.height
    })
    .from(schema.pages)
    .where(eq(schema.pages.chapterId, chapter.id))
    .orderBy(asc(schema.pages.position))
  );

  if (pagesRes.error) {
    return json({ error: 'Erro ao carregar pginas' }, { status: 500 });
  }

  const origin = url.origin;
  const pages = pagesRes.data || [];

  return json({
    chapterId: chapter.id,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
    work_title: chapter.workTitle,
    work_slug: chapter.workSlug,
    totalPages: pages.length,
    pages: pages.map((p) => ({
      position: p.position,
      url: `${origin}/media/${p.mediaId}`,
      width: p.width,
      height: p.height
    }))
  });
};
