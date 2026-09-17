import { json } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, isNotNull, and, asc } from 'drizzle-orm';

export const GET = async ({ params, locals, cookies }) => {
  const { id } = params;

  const isStaff = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
  
  let conditions = eq(schema.chapters.id, id);
  if (!isStaff) {
    conditions = and(conditions, isNotNull(schema.chapters.publishedAt)) as any;
  }

  const { data: chapter, error: chErr } = await safeQuerySingle(
    db.select({
      id: schema.chapters.id,
      number: schema.chapters.number,
      title: schema.chapters.title,
      publishedAt: schema.chapters.publishedAt,
      workId: schema.chapters.workId,
      works: {
        id: schema.works.id,
        title: schema.works.title,
        slug: schema.works.slug,
        contentRating: schema.works.contentRating,
        published: schema.works.published
      }
    })
    .from(schema.chapters)
    .innerJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
    .where(conditions)
    .limit(1)
  );

  if (chErr || !chapter) {
    return json({ error: 'Captulo no encontrado' }, { status: 404 });
  }

  const work = chapter.works;
  if (!work || (!isStaff && !work.published)) {
    return json({ error: 'Obra no publicada' }, { status: 404 });
  }

  if (work.contentRating === 'ADULT_18') {
    const rawAgeCookie = cookies.get('nox-age-status');
    let ageStatus = rawAgeCookie;
    if (locals.user) {
      const p = await safeQuerySingle(
        db.select({ ageStatus: schema.members.ageStatus }).from(schema.members).where(eq(schema.members.id, locals.user.id)).limit(1)
      );
      if (p.data?.ageStatus) ageStatus = p.data.ageStatus;
    }
    if (ageStatus === 'MINOR') {
      return json({ error: 'Contedo restrito (+18).' }, { status: 403 });
    }
  }

  const { data: pages, error: pErr } = await safeQuery(
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

  if (pErr) {
    return json({ error: 'Erro ao carregar pginas' }, { status: 500 });
  }

  return json({
    chapterId: chapter.id,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
    workId: work.id,
    work_title: work.title,
    work_slug: work.slug,
    pages: pages || []
  });
};
