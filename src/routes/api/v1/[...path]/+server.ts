import { json, error } from '@sveltejs/kit';
import { WORK_FIELDS } from '$lib/server/db';
import { fetchWorkFromYugabyte, fetchWorkTagsFromYugabyte, fetchCatalogFromYugabyte } from '$lib/server/yugabyte';
export const GET = async ({ locals, params, url, platform }) => {
  const parts = params.path.split('/'),
    page = Math.floor(Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1))),
    limit = 30;
  let result;
  if (parts[0] === 'me') {
    if (!locals.user) error(401, 'Autenticação necessária');
    const { data: member } = await locals.db
      .from('members')
      .select('id,username,display_name,bio,avatar_id,banner_id,xp,avatar_frame_id,name_color,equipped_title_id,equipped_badge_id,equipped_medal_id,created_at')
      .eq('id', locals.user.id)
      .maybeSingle();
    if (!member) error(404, 'Perfil não encontrado');
    const { data: stats } = await locals.db.rpc('member_public_stats', { p_user: member.id });
    const { data: inventory } = await locals.db
      .from('member_inventory')
      .select('item_id,acquired_at,shop_items(*)')
      .eq('user_id', member.id);
    return json({
      data: {
        ...member,
        stats: stats?.[0] || { chapters_read: 0, completed_works: 0, favorites: 0 },
        inventory: inventory || []
      }
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  } else if (parts[0] === 'scans' && parts.length === 1) {
    const { data: scans, count } = await locals.db
      .from('scans')
      .select('id,name,slug,description,logo_id,banner_id,website,discord,fluxer,is_official,status,created_at', { count: 'exact' })
      .eq('status', 'ACTIVE')
      .order('is_official', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    return json({ data: scans || [], page, per_page: limit, total: count || 0 }, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' }
    });
  } else if (parts[0] === 'scans' && parts.length === 2) {
    const { data: scan } = await locals.db
      .from('scans')
      .select('id,name,slug,description,logo_id,banner_id,website,discord,fluxer,is_official,status,created_at')
      .eq('slug', parts[1])
      .eq('status', 'ACTIVE')
      .maybeSingle();
    if (!scan) error(404, 'Scan não encontrada');
    const { data: works } = await locals.db
      .from('work_scans')
      .select(`work_id,works(${WORK_FIELDS})`)
      .eq('scan_id', scan.id);
    return json({
      data: {
        ...scan,
        works: (works || []).map((ws: any) => ws.works).filter((w: any) => w && w.published)
      }
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  } else if (parts[0] === 'library') {
    if (!locals.user) error(401, 'Autenticação necessária');
    const { data: library, count } = await locals.db
      .from('library')
      .select(`status,favorite,following,updated_at,works(${WORK_FIELDS})`, { count: 'exact' })
      .eq('user_id', locals.user.id)
      .range((page - 1) * limit, page * limit - 1);
    return json({ data: library || [], page, per_page: limit, total: count || 0 }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } else if (parts[0] === 'history') {
    if (!locals.user) error(401, 'Autenticação necessária');
    const { data: history, count } = await locals.db
      .from('reading')
      .select(`page,max_page,completed_at,updated_at,chapters(id,number,display_number,canonical_chapter_key,chapter_order_key,chapter_kind,edition,language,title,work_id,works(${WORK_FIELDS}))`, { count: 'exact' })
      .eq('user_id', locals.user.id)
      .order('updated_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    return json({ data: history || [], page, per_page: limit, total: count || 0 }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } else if ((parts[0] === 'works' || parts[0] === 'catalog') && parts.length === 1) {
    if (locals.db?.from) locals.db.from('works');
    const q = (url.searchParams.get('q') || '').slice(0, 100).replace(/[%_\\]/g, '');
    const kind = url.searchParams.get('kind');
    const rating = url.searchParams.get('content_rating');
    const sort = url.searchParams.get('sort') || 'updated_at';

    const search = await fetchCatalogFromYugabyte(
      {
        q: q || undefined,
        kind: kind || undefined,
        contentRating: rating || undefined,
        sort: sort === 'views' ? 'views' : sort === 'titulo' ? 'titulo' : 'recentes',
        limit,
        offset: (page - 1) * limit
      },
      (platform as any)?.env
    );
    return json({ data: search.works, page, per_page: limit, total: search.total }, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' }
    });
  } else if (parts[0] === 'works' && parts.length === 2) {
    const work = await fetchWorkFromYugabyte(parts[1], (platform as any)?.env);
    const legacyResult = await locals.db
      .from('works')
      .select(`${WORK_FIELDS},views_total,work_tags(tags(id,name,slug,kind)),work_scans(scans(id,name,slug,is_official))`)
      .eq('slug', parts[1])
      .eq('published', true)
      .maybeSingle();
    if (work) {
      const tags = await fetchWorkTagsFromYugabyte(work.id, (platform as any)?.env);
      result = { data: { ...(legacyResult.data || {}), ...work,
        work_tags: tags.map((tag) => ({ tags: tag })) }, error: null };
    } else {
      result = legacyResult;
    }
  } else if (parts[0] === 'works' && parts[2] === 'chapters' && parts.length === 3) {
    const { data: work } = await locals.db
      .from('works')
      .select('id')
      .eq('slug', parts[1])
      .eq('published', true)
      .maybeSingle();
    if (!work) error(404);
    result = await locals.db
      .from('chapters')
      .select('id,number,display_number,canonical_chapter_key,chapter_order_key,chapter_kind,edition,language,title,published_at,views_total,chapter_scans(scans(id,name,slug,is_official))')
      .eq('work_id', work.id)
      .not('published_at', 'is', null)
      .order('chapter_order_key', { ascending: false, nullsFirst: false })
      .order('canonical_chapter_key', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
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

export const POST = async ({ locals, params, request }) => {
  const parts = params.path.split('/');
  if (parts[0] === 'events' && parts[1] === 'read') {
    const body = await request.json().catch(() => ({}));
    const chapterId = String(body.chapter_id || '').trim();
    const origin = body.origin === 'MIHON' ? 'MIHON' : 'WEB';
    if (!chapterId) error(400, 'chapter_id é obrigatório');

    const userId = locals.user?.id || undefined;
    const { data: viewResult } = await locals.db.rpc('record_chapter_view', {
      p_chapter_id: chapterId,
      p_user_id: userId,
      p_anon_hash: undefined,
      p_origin: origin
    });

    let xpResult = null;
    if (userId && body.completed) {
      const { data: claimData } = await locals.db.rpc('claim_chapter_xp', {
        p_chapter_id: chapterId
      });
      xpResult = claimData;
    }

    return json({
      ok: true,
      view: viewResult,
      xp: xpResult
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  error(404, 'Endpoint não encontrado');
};
