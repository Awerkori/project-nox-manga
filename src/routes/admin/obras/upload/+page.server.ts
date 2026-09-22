import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, desc, asc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url, locals, setHeaders }) => {
  setHeaders({
    'cache-control': 'private, no-cache, no-store, must-revalidate',
    'pragma': 'no-cache'
  });

  const userRole = String(locals.role || (locals.profile as any)?.role || '').toUpperCase();
  const isStaff = Boolean(locals.user && ['ADMIN', 'STAFF_SITE', 'EDITOR', 'OWNER'].includes(userRole));
  if (!isStaff) {
    error(403, 'Acesso restrito à equipe editorial.');
  }

  const preselectedWorkId = url.searchParams.get('workId') || '';

  // Load all published/draft works for selection dropdown
  const { data: works } = await safeQuery(
    db.select({
      id: schema.works.id,
      title: schema.works.title,
      slug: schema.works.slug,
      coverId: schema.works.coverId
    })
    .from(schema.works)
    .orderBy(asc(schema.works.title))
  );

  // Load all active scans
  const { data: scans } = await safeQuery(
    db.select({
      id: schema.scans.id,
      name: schema.scans.name,
      slug: schema.scans.slug,
      isOfficial: schema.scans.isOfficial
    })
    .from(schema.scans)
    .orderBy(desc(schema.scans.isOfficial), asc(schema.scans.name))
  );

  let preselectedWork = null;
  let latestChapterNumber = 0;

  if (preselectedWorkId) {
    const { data: w } = await safeQuerySingle(
      db.select({
        id: schema.works.id,
        title: schema.works.title,
        slug: schema.works.slug,
        coverId: schema.works.coverId
      })
      .from(schema.works)
      .where(eq(schema.works.id, preselectedWorkId))
    );
    preselectedWork = w;

    if (w) {
      // Find latest chapter number to suggest next chapter
      const { data: latestChap } = await safeQuerySingle(
        db.select({ number: schema.chapters.number })
          .from(schema.chapters)
          .where(eq(schema.chapters.workId, w.id))
          .orderBy(desc(schema.chapters.number))
      );
      if (latestChap?.number !== undefined && latestChap?.number !== null) {
        latestChapterNumber = Number(latestChap.number);
      }
    }
  }

  return {
    works: works || [],
    scans: scans || [],
    preselectedWork,
    suggestedChapterNumber: latestChapterNumber > 0 ? latestChapterNumber + 1 : 1,
    userRole
  };
};
