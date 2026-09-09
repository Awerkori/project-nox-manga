import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const workId = url.searchParams.get('workId');
  if (!workId) {
    return json({ error: 'Missing workId' }, { status: 400 });
  }

  // Ensure user is staff
  if (!locals.user || locals.role !== 'ADMIN' && locals.role !== 'MODERATOR' && locals.role !== 'SCAN_LEADER') {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { data: chapters, error } = await locals.db
    .from('importer_chapter_manifest')
    .select('*')
    .eq('work_id', workId)
    .order('chapter_sort_key', { ascending: true });

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  return json({ chapters: chapters || [] });
};
