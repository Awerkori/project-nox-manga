import { WORK_FIELDS, check } from '$lib/server/db';
export const load = async ({ locals, url }) => {
  const q = (url.searchParams.get('q') || '').slice(0, 100),
    tag = url.searchParams.get('tag') || '',
    kind = url.searchParams.get('tipo') || '',
    sort = url.searchParams.get('ordem') || 'recentes';
  const page = Math.floor(Math.max(1, Math.min(10000, Number(url.searchParams.get('pagina')) || 1)));
  const tags = await locals.db.from('tags').select('*').order('name');
  check(tags);
  let query = locals.db.from('works').select(WORK_FIELDS, { count: 'exact' }).eq('published', true);
  if (q) query = query.ilike('search_text', `%${q.replace(/[%_\\]/g, '')}%`);
  if (kind) query = query.eq('kind', kind);
  if (tag) {
    const selected = tags.data?.find((t) => t.slug === tag);
    const ids = selected
      ? (await locals.db.from('work_tags').select('work_id').eq('tag_id', selected.id)).data || []
      : [];
    query = query.in(
      'id',
      ids.map((t) => t.work_id)
    );
  }
  const result = await query
    .order(sort === 'titulo' ? 'title' : 'updated_at', { ascending: sort === 'titulo' })
    .range((page - 1) * 20, page * 20 - 1);
  check(result);
  return {
    works: result.data || [],
    count: result.count || 0,
    tags: tags.data || [],
    q,
    tag,
    kind,
    sort,
    page
  };
};
