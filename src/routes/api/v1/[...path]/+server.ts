import { json, error } from '@sveltejs/kit';
import { WORK_FIELDS } from '$lib/server/db';
export const GET = async ({ locals, params, url }) => {
  const parts = params.path.split('/'),
    page = Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1)),
    limit = 30;
  let result;
  if (parts[0] === 'works' && parts.length === 1) {
    let query = locals.db.from('works').select(WORK_FIELDS, { count: 'exact' }).eq('published', true);
    const q = (url.searchParams.get('q') || '').slice(0, 100).replace(/[%_\\]/g, '');
    if (q) query = query.ilike('title', `%${q}%`);
    result = await query
      .order('updated_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
  } else if (parts[0] === 'works' && parts.length === 2)
    result = await locals.db
      .from('works')
      .select(WORK_FIELDS)
      .eq('slug', parts[1])
      .eq('published', true)
      .maybeSingle();
  else if (parts[0] === 'works' && parts[2] === 'chapters' && parts.length === 3) {
    const { data: work } = await locals.db
      .from('works')
      .select('id')
      .eq('slug', parts[1])
      .eq('published', true)
      .maybeSingle();
    if (!work) error(404);
    result = await locals.db
      .from('chapters')
      .select('id,number,title,published_at')
      .eq('work_id', work.id)
      .not('published_at', 'is', null)
      .order('number', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
  } else if (parts[0] === 'chapters' && parts[2] === 'pages' && parts.length === 3) {
    const { data: allowed } = await locals.db.rpc('public_chapter', { p_id: parts[1] });
    if (!allowed) error(404);
    result = await locals.db
      .from('pages')
      .select('position,media_id,width,height')
      .eq('chapter_id', parts[1])
      .order('position');
    if (result.data)
      return json(
        {
          data: result.data.map((p) => ({
            position: p.position,
            width: p.width,
            height: p.height,
            url: `${url.origin}/media/${p.media_id}`
          }))
        },
        { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' } }
      );
  } else error(404, 'Endpoint não encontrado');
  if (result?.error) error(400, 'Consulta inválida');
  if (!result?.data) error(404);
  return json(
    { data: result.data, page, per_page: limit, ...('count' in result ? { total: result.count } : {}) },
    { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' } }
  );
};
