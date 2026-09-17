import { json } from '@sveltejs/kit';
import { verifyMihonAuth } from '$lib/server/mihon';
import { db, schema, safeQuery } from '$lib/server/db';
import { eq, ne, like, and, desc, count } from 'drizzle-orm';

export const GET = async ({ request, url }) => {
  const auth = await verifyMihonAuth(request);
  const allowAdult = auth.authenticated && auth.ageStatus === 'ADULT';

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '24', 10)));
  const search = (url.searchParams.get('query') || url.searchParams.get('search') || '').trim();
  const status = url.searchParams.get('status')?.toUpperCase();
  const tagSlug = url.searchParams.get('tag')?.trim();

  const conditions = [eq(schema.works.published, true)];

  if (!allowAdult) {
    conditions.push(ne(schema.works.contentRating, 'ADULT_18'));
  }

  if (search) {
    conditions.push(like(schema.works.title, `%${search}%`));
  }

  if (status && (status === 'ONGOING' || status === 'COMPLETED' || status === 'HIATUS')) {
    conditions.push(eq(schema.works.status, status));
  }

  const from = (page - 1) * limit;
  const whereClause = and(...conditions);

  const [worksRes, countRes] = await Promise.all([
    safeQuery(db.select({
      id: schema.works.id,
      title: schema.works.title,
      slug: schema.works.slug,
      coverId: schema.works.coverId,
      kind: schema.works.kind,
      status: schema.works.status,
      contentRating: schema.works.contentRating,
      synopsis: schema.works.synopsis,
      updatedAt: schema.works.updatedAt,
    })
    .from(schema.works)
    .where(whereClause)
    .orderBy(desc(schema.works.updatedAt))
    .limit(limit)
    .offset(from)),

    safeQuery(db.select({ value: count() }).from(schema.works).where(whereClause))
  ]);

  if (worksRes.error || countRes.error) {
    return json({ error: 'Erro ao consultar catlogo' }, { status: 500 });
  }

  const works = worksRes.data || [];
  const totalCount = countRes.data?.[0]?.value ?? works.length;

  const origin = url.origin;
  const items = works.map((w) => ({
    id: w.id,
    title: w.title,
    slug: w.slug,
    kind: w.kind,
    status: w.status,
    contentRating: w.contentRating || 'GENERAL',
    synopsis: w.synopsis,
    cover_url: w.coverId ? `${origin}/media/${w.coverId}` : null,
    updatedAt: w.updatedAt
  }));

  return json({
    page,
    limit,
    total: totalCount,
    has_more: (from + works.length) < totalCount,
    works: items
  });
};
