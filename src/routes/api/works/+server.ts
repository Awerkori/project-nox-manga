import { json } from '@sveltejs/kit';
import { db, schema, safeQuery } from '$lib/server/db';
import { eq, desc, inArray } from 'drizzle-orm';

export const GET = async ({ url }) => {
  const sort = url.searchParams.get('sort') || 'latest';
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));
  const limit = Math.min(24, Math.max(1, parseInt(url.searchParams.get('limit') || '8', 10)));

  let query = db
    .select()
    .from(schema.works)
    .where(eq(schema.works.published, true as any));

  if (sort === 'most_read' || sort === 'popular') {
    query = query
      .orderBy(desc(schema.works.viewsTotal), desc(schema.works.updatedAt)) as any;
  } else {
    query = query.orderBy(desc(schema.works.updatedAt)) as any;
  }

  const { data: works, error } = await safeQuery(query.limit(limit).offset(offset));

  if (error) {
    return json({ works: [], error: error.message }, { status: 500 });
  }

  // Fetch relations separately to avoid complex aggregation logic
  const workIds = works?.map(w => w.id) || [];
  if (workIds.length > 0) {
    const { data: scanLinks } = await safeQuery(
      db.select({
        workId: schema.workScans.workId,
        isPrimary: schema.workScans.isPrimary,
        status: schema.workScans.status,
        scans: {
          id: schema.scans.id,
          name: schema.scans.name,
          slug: schema.scans.slug,
          logoId: schema.scans.logoId,
          isOfficial: schema.scans.isOfficial
        }
      })
      .from(schema.workScans)
      .innerJoin(schema.scans, eq(schema.workScans.scanId, schema.scans.id))
      .where(inArray(schema.workScans.workId, workIds))
    );

    const scansByWork = new Map<string, any[]>();
    if (scanLinks) {
      for (const link of scanLinks) {
        if (!scansByWork.has(link.workId)) scansByWork.set(link.workId, []);
        scansByWork.get(link.workId)!.push({
          isPrimary: link.isPrimary,
          status: link.status,
          scans: link.scans
        });
      }
    }

    for (const w of works!) {
      (w as any).workScans = scansByWork.get(w.id) || [];
    }
  }

  return json({
    works: works || [],
    hasMore: (works || []).length === limit
  });
};
