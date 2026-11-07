import { json, error } from '@sveltejs/kit';
import { executeYugabyteSql, fetchWorkFromYugabyte, fetchWorkTagsFromYugabyte, fetchCatalogFromYugabyte, withYugabyteReadSession } from '$lib/server/yugabyte';

export const GET = async ({ locals, params, url, platform }: any) => {
  return withYugabyteReadSession(platform?.env, async (platformEnv) => {
    const parts = params.path.split('/');
    const page = Math.floor(Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1)));
    const limit = 30;

  if (parts[0] === 'me') {
    if (!locals.user) error(401, 'Autenticação necessária');
    const memberRes = await executeYugabyteSql(
      `SELECT id, username, display_name, bio, avatar_id, banner_id, xp, avatar_frame_id, name_color, equipped_title_id, equipped_badge_id, equipped_medal_id, created_at
       FROM public.members WHERE id = $1 LIMIT 1;`,
      [locals.user.id],
      platformEnv
    );
    const member = memberRes.rows[0];
    if (!member) error(404, 'Perfil não encontrado');
    const [statsRes, invRes] = await Promise.all([
      executeYugabyteSql(`SELECT count(*)::int AS chapters_read FROM public.reading WHERE user_id = $1 AND completed_at IS NOT NULL;`, [member.id], platformEnv),
      executeYugabyteSql(
        `SELECT mi.item_id, mi.acquired_at, row_to_json(si.*) AS shop_items
         FROM public.member_inventory mi
         JOIN public.shop_items si ON si.id = mi.item_id
         WHERE mi.user_id = $1;`,
        [member.id],
        platformEnv
      )
    ]);
    return json({
      data: {
        ...member,
        stats: { chapters_read: statsRes.rows[0]?.chapters_read || 0, completed_works: 0, favorites: 0 },
        inventory: invRes.rows || []
      }
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  } else if (parts[0] === 'scans' && parts.length === 1) {
    const [scansRes, countRes] = await Promise.all([
      executeYugabyteSql(
        `SELECT id, name, slug, description, logo_id, banner_id, website, discord, fluxer, is_official, status, created_at
         FROM public.scans
         WHERE status = 'ACTIVE'
         ORDER BY is_official DESC
         LIMIT $1 OFFSET $2;`,
        [limit, (page - 1) * limit],
        platformEnv
      ),
      executeYugabyteSql(`SELECT count(*)::int AS total FROM public.scans WHERE status = 'ACTIVE';`, [], platformEnv)
    ]);
    return json({ data: scansRes.rows || [], page, per_page: limit, total: countRes.rows[0]?.total || 0 }, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' }
    });
  } else if (parts[0] === 'scans' && parts.length === 2) {
    const scanRes = await executeYugabyteSql(
      `SELECT id, name, slug, description, logo_id, banner_id, website, discord, fluxer, is_official, status, created_at
       FROM public.scans
       WHERE slug = $1 AND status = 'ACTIVE'
       LIMIT 1;`,
      [parts[1]],
      platformEnv
    );
    const scan = scanRes.rows[0];
    if (!scan) error(404, 'Scan não encontrada');
    const worksRes = await executeYugabyteSql(
      `SELECT row_to_json(w.*) AS works
       FROM public.work_scans ws
       JOIN public.works w ON w.id = ws.work_id
       WHERE ws.scan_id = $1 AND w.published = true;`,
      [scan.id],
      platformEnv
    );
    return json({
      data: {
        ...scan,
        works: (worksRes.rows || []).map((r: any) => r.works).filter(Boolean)
      }
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  } else if (parts[0] === 'library') {
    if (!locals.user) error(401, 'Autenticação necessária');
    const [libRes, countRes] = await Promise.all([
      executeYugabyteSql(
        `SELECT l.status, l.favorite, l.following, l.updated_at, row_to_json(w.*) AS works
         FROM public.library l
         JOIN public.works w ON w.id = l.work_id
         WHERE l.user_id = $1
         ORDER BY l.updated_at DESC
         LIMIT $2 OFFSET $3;`,
        [locals.user.id, limit, (page - 1) * limit],
        platformEnv
      ),
      executeYugabyteSql(`SELECT count(*)::int AS total FROM public.library WHERE user_id = $1;`, [locals.user.id], platformEnv)
    ]);
    return json({ data: libRes.rows || [], page, per_page: limit, total: countRes.rows[0]?.total || 0 }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } else if (parts[0] === 'history') {
    if (!locals.user) error(401, 'Autenticação necessária');
    const [histRes, countRes] = await Promise.all([
      executeYugabyteSql(
        `SELECT r.page, r.max_page, r.completed_at, r.updated_at,
                json_build_object(
                  'id', c.id, 'number', c.number, 'display_number', c.display_number,
                  'canonical_chapter_key', c.canonical_chapter_key, 'chapter_order_key', c.chapter_order_key,
                  'chapter_kind', c.chapter_kind, 'edition', c.edition, 'language', c.language,
                  'title', c.title, 'work_id', c.work_id,
                  'works', row_to_json(w.*)
                ) AS chapters
         FROM public.reading r
         JOIN public.chapters c ON c.id = r.chapter_id
         JOIN public.works w ON w.id = c.work_id
         WHERE r.user_id = $1
         ORDER BY r.updated_at DESC
         LIMIT $2 OFFSET $3;`,
        [locals.user.id, limit, (page - 1) * limit],
        platformEnv
      ),
      executeYugabyteSql(`SELECT count(*)::int AS total FROM public.reading WHERE user_id = $1;`, [locals.user.id], platformEnv)
    ]);
    return json({ data: histRes.rows || [], page, per_page: limit, total: countRes.rows[0]?.total || 0 }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } else if ((parts[0] === 'works' || parts[0] === 'catalog') && parts.length === 1) {
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
      platformEnv
    );
    if (search.isDegraded) {
      return json({ error: 'Catálogo temporariamente indisponível' }, {
        status: 503,
        headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'private, no-store' }
      });
    }
    return json({ data: search.works, page, per_page: limit, total: search.total }, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' }
    });
  } else if (parts[0] === 'works' && parts.length === 2) {
    const work = await fetchWorkFromYugabyte(parts[1], platformEnv);
    if (!work) error(404, 'Obra não encontrada');
    const tags = await fetchWorkTagsFromYugabyte(work.id, platformEnv);
    return json({
      data: {
        ...work,
        work_tags: tags.map((tag) => ({ tags: tag }))
      }
    }, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' } });
  } else if (parts[0] === 'works' && parts[2] === 'chapters' && parts.length === 3) {
    const workRes = await executeYugabyteSql(
      `SELECT id FROM public.works WHERE slug = $1 AND published = true LIMIT 1;`,
      [parts[1]],
      platformEnv
    );
    const work = workRes.rows[0];
    if (!work) error(404);
    const chapRes = await executeYugabyteSql(
      `SELECT c.id, c.number, c.display_number, c.canonical_chapter_key, c.chapter_order_key,
              c.chapter_kind, c.edition, c.language, c.title, c.published_at, c.views_total
       FROM public.chapters c
       WHERE c.work_id = $1 AND c.published_at IS NOT NULL
       ORDER BY c.chapter_order_key DESC NULLS LAST, c.canonical_chapter_key DESC NULLS LAST, c.id DESC
       LIMIT $2 OFFSET $3;`,
      [work.id, limit, (page - 1) * limit],
      platformEnv
    );
    return json(
      { data: chapRes.rows || [], page, per_page: limit },
      { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' } }
    );
  } else if (parts[0] === 'chapters' && parts[2] === 'pages' && parts.length === 3) {
    const chapRes = await executeYugabyteSql(
      `SELECT c.id FROM public.chapters c JOIN public.works w ON w.id = c.work_id WHERE c.id = $1 AND c.published_at IS NOT NULL AND w.published = true LIMIT 1;`,
      [parts[1]],
      platformEnv
    );
    if (chapRes.rows.length === 0) error(404);
    const pagesRes = await executeYugabyteSql(
      `SELECT position, media_id, width, height FROM public.pages WHERE chapter_id = $1 ORDER BY position;`,
      [parts[1]],
      platformEnv
    );
    const mediaBaseUrl = (platformEnv?.MEDIA_CDN_URL || '').replace(/\/+$/, '') || url.origin;
    return json(
      {
        data: pagesRes.rows.map((p: any) => ({
          position: p.position,
          width: p.width,
          height: p.height,
          url: `${mediaBaseUrl}/media/${p.media_id}`
        }))
      },
      { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' } }
    );
  }

    error(404, 'Endpoint não encontrado');
  });
};

export const POST = async ({ locals, params, request, platform }: any) => {
  const parts = params.path.split('/');
  if (parts[0] === 'events' && parts[1] === 'read') {
    const body = await request.json().catch(() => ({}));
    const chapterId = String(body.chapter_id || '').trim();
    if (!chapterId) error(400, 'chapter_id é obrigatório');

    const userId = locals.user?.id || null;
    const platformEnv = platform?.env;

    if (userId) {
      await executeYugabyteSql(
        `INSERT INTO public.reading (user_id, chapter_id, page, max_page, completed_at, updated_at)
         VALUES ($1, $2, 1, 1, CASE WHEN $3 THEN now() ELSE NULL END, now())
         ON CONFLICT (user_id, chapter_id) DO UPDATE
         SET completed_at = COALESCE(reading.completed_at, EXCLUDED.completed_at),
             updated_at = now();`,
        [userId, chapterId, Boolean(body.completed)],
        platformEnv
      ).catch(() => {});
    }

    await executeYugabyteSql(
      `UPDATE public.chapters SET views_total = views_total + 1 WHERE id = $1;`,
      [chapterId],
      platformEnv
    ).catch(() => {});

    return json({
      ok: true,
      view: { counted: true },
      xp: null
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  error(404, 'Endpoint não encontrado');
};
