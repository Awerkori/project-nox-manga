import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, schema, safeQuery } from '$lib/server/db';
import { eq, asc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url, locals }) => {
  const workId = url.searchParams.get('workId');
  if (!workId) {
    return json({ error: 'Missing workId' }, { status: 400 });
  }

  // Ensure user is staff
  if (!locals.user || locals.role !== 'ADMIN' && locals.role !== 'MODERATOR' && locals.role !== 'SCAN_LEADER') {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { data: chapters, error } = await safeQuery(
    db.select()
      .from(schema.importerChapterManifest)
      .where(eq(schema.importerChapterManifest.workId, workId))
      .orderBy(asc(schema.importerChapterManifest.chapterSortKey))
  );

  if (error) {
    return json({ error: (error as any).message }, { status: 500 });
  }

  return json({ chapters: chapters || [] });
};
