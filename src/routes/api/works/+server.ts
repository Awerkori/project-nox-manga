import { json } from '@sveltejs/kit';
import { WORK_FIELDS, privileged } from '$lib/server/db';

export const GET = async ({ url, locals }) => {
  const db = locals.db || privileged();
  const sort = url.searchParams.get('sort') || 'latest';
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));
  const limit = Math.min(24, Math.max(1, parseInt(url.searchParams.get('limit') || '8', 10)));

  const selectFields = `${WORK_FIELDS}, work_scans(is_primary, status, scans(id, name, slug, logo_id, is_official))`;

  let query = db
    .from('works')
    .select(selectFields)
    .eq('published', true);

  if (sort === 'most_read' || sort === 'popular') {
    query = query
      .order('views_total', { ascending: false })
      .order('updated_at', { ascending: false });
  } else {
    query = query.order('updated_at', { ascending: false });
  }

  const { data, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    return json({ works: [], error: error.message }, { status: 500 });
  }

  return json({
    works: data || [],
    hasMore: (data || []).length === limit
  });
};
