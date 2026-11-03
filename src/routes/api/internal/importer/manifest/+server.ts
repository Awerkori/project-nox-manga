import { json } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const GET = async ({ url, locals, platform }: any) => {
  const workId = url.searchParams.get('workId');
  if (!workId) {
    return json({ error: 'Missing workId' }, { status: 400 });
  }

  // Ensure user is staff
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR', 'MODERATOR', 'SCAN_LEADER'].includes(locals.role || '')) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const res = await executeYugabyteSql(`
      SELECT *
      FROM importer_chapter_manifest
      WHERE work_id = $1
      ORDER BY chapter_sort_key ASC;
    `, [workId], platform?.env);

    return json({ chapters: res.rows || [] });
  } catch (err: any) {
    return json({ error: err?.message || 'Database error' }, { status: 500 });
  }
};
