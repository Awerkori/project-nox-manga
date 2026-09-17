import { json } from '@sveltejs/kit';
import { verifyMihonAuth } from '$lib/server/mihon';
import { db, schema, safeQuerySingle, safeQuery } from '$lib/server/db';
import { eq, and, isNotNull, asc } from 'drizzle-orm';

export const GET = async ({ params, request, url }) => {
  const { slug } = params;
  const auth = await verifyMihonAuth(request);
  const allowAdult = auth.authenticated && auth.ageStatus === 'ADULT';

  const workRes = await safeQuerySingle(db.select({
    id: schema.works.id,
    title: schema.works.title,
    slug: schema.works.slug,
    coverId: schema.works.coverId,
    kind: schema.works.kind,
    status: schema.works.status,
    contentRating: schema.works.contentRating,
    synopsis: schema.works.synopsis,
    author: schema.works.author,
    artist: schema.works.artist,
    updatedAt: schema.works.updatedAt,
    published: schema.works.published
  }).from(schema.works).where(eq(schema.works.slug, slug)));

  if (workRes.error || !workRes.data || !workRes.data.published) {
    return json({ error: 'Obra no encontrada' }, { status: 404 });
  }

  const work = workRes.data;

  if (work.contentRating === 'ADULT_18' && !allowAdult) {
    return json(
      { error: 'Contedo Adulto (+18). Requer autenticao com token de usurio maior de idade.' },
      { status: 403 }
    );
  }

  const [chaptersRes, tagsRes] = await Promise.all([
    safeQuery(db.select({
      id: schema.chapters.id,
      number: schema.chapters.number,
      title: schema.chapters.title,
      publishedAt: schema.chapters.publishedAt
    })
    .from(schema.chapters)
    .where(and(
      eq(schema.chapters.workId, work.id),
      isNotNull(schema.chapters.publishedAt)
    ))
    .orderBy(asc(schema.chapters.number))),

    safeQuery(db.select({
      name: schema.tags.name,
      slug: schema.tags.slug,
      kind: schema.tags.kind
    })
    .from(schema.workTags)
    .innerJoin(schema.tags, eq(schema.workTags.tagId, schema.tags.id))
    .where(eq(schema.workTags.workId, work.id)))
  ]);

  const origin = url.origin;
  const genres = (tagsRes.data || [])
    .map(t => t.name)
    .filter(Boolean);

  return json({
    id: work.id,
    title: work.title,
    slug: work.slug,
    kind: work.kind,
    status: work.status,
    contentRating: work.contentRating || 'GENERAL',
    synopsis: work.synopsis,
    author: work.author,
    artist: work.artist,
    cover_url: work.coverId ? `${origin}/media/${work.coverId}` : null,
    updatedAt: work.updatedAt,
    genres,
    chapters: (chaptersRes.data || []).map((ch) => ({
      id: ch.id,
      number: ch.number,
      title: ch.title,
      publishedAt: ch.publishedAt
    }))
  });
};
