import { json, error } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, desc, asc, and, or, sql, isNotNull, like } from 'drizzle-orm';
import { WORK_FIELDS } from '$lib/server/db';

export const GET = async ({ locals, params, url }) => {
  const parts = params.path.split('/'),
    page = Math.floor(Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1))),
    limit = 30;
  let result;
  if (parts[0] === 'me') {
    if (!locals.user) error(401, 'Autenticao necessria');
    const { data: member } = await safeQuerySingle(
      db.select({
        id: schema.members.id,
        username: schema.members.username,
        displayName: schema.members.displayName,
        bio: schema.members.bio,
        avatarId: schema.members.avatarId,
        banner_id: schema.members.bannerId,
        xp: schema.members.xp,
        avatar_frame_id: schema.members.avatarFrameId,
        name_color: schema.members.nameColor,
        equipped_title_id: schema.members.equippedTitleId,
        equipped_badge_id: schema.members.equippedBadgeId,
        equipped_medal_id: schema.members.equippedMedalId,
        createdAt: schema.members.createdAt
      })
      .from(schema.members)
      .where(eq(schema.members.id, locals.user!.id))
    );
    if (!member) error(404, 'Perfil no encontrado');

    
    // Simplified member_public_stats
    const stats = [{
      chaptersRead: 0,
      totalXp: member.xp,
      level: 1,
      rank: 'Novato'
    }];


    const { data: inventory } = await safeQuery(
      db.select({
        item_id: schema.memberInventory.itemId,
        acquired_at: schema.memberInventory.acquiredAt,
        shop_items: sql`json_object('id', shop_items.id, 'name', shop_items.name, 'description', shop_items.description, 'kind', shop_items.kind, 'priceXp', shop_items.price_xp, 'isAnimated', shop_items.is_animated, 'assetUrl', shop_items.asset_url, 'styleData', shop_items.style_data, 'minLevel', shop_items.min_level, 'isActive', shop_items.is_active, 'orderIndex', shop_items.order_index, 'createdAt', shop_items.created_at, 'rarity', shop_items.rarity, 'status', shop_items.status, 'thumbnailUrl', shop_items.thumbnail_url)`
      })
      .from(schema.memberInventory)
      .leftJoin(schema.shopItems, eq(schema.memberInventory.itemId, schema.shopItems.id))
      .where(eq(schema.memberInventory.userId, member.id))
    );
    return json({
      data: {
        ...member,
        stats: stats?.[0] || { chapters_read: 0, completed_works: 0, favorites: 0 },
        inventory: inventory?.map(i => ({
           item_id: i.item_id,
           acquired_at: i.acquired_at,
           shop_items: typeof i.shop_items === 'string' ? JSON.parse(i.shop_items) : i.shop_items
        })) || []
      }
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  } else if (parts[0] === 'scans' && parts.length === 1) {
    const { data: scans } = await safeQuery(
      db.select({
        id: schema.scans.id,
        name: schema.scans.name,
        slug: schema.scans.slug,
        description: schema.scans.description,
        logo_id: schema.scans.logoId,
        banner_id: schema.scans.bannerId,
        website: schema.scans.website,
        discord: schema.scans.discord,
        fluxer: schema.scans.fluxer,
        isOfficial: schema.scans.is_official,
        status: schema.scans.status,
        createdAt: schema.scans.createdAt
      })
      .from(schema.scans)
      .where(eq(schema.scans.status, 'ACTIVE'))
      .orderBy(desc(schema.scans.is_official))
      .limit(limit)
      .offset((page - 1) * limit)
    );
    const { data: countRows } = await safeQuery(
      db.select({ count: sql<number>`count(*)` })
      .from(schema.scans)
      .where(eq(schema.scans.status, 'ACTIVE'))
    );
    const count = countRows?.[0]?.count || 0;
    return json({ data: scans || [], page, per_page: limit, total: count }, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' }
    });
  } else if (parts[0] === 'scans' && parts.length === 2) {
    const { data: scan } = await safeQuerySingle(
      db.select({
        id: schema.scans.id,
        name: schema.scans.name,
        slug: schema.scans.slug,
        description: schema.scans.description,
        logo_id: schema.scans.logoId,
        banner_id: schema.scans.bannerId,
        website: schema.scans.website,
        discord: schema.scans.discord,
        fluxer: schema.scans.fluxer,
        isOfficial: schema.scans.is_official,
        status: schema.scans.status,
        createdAt: schema.scans.createdAt
      })
      .from(schema.scans)
      .where(and(eq(schema.scans.slug, parts[1]), eq(schema.scans.status, 'ACTIVE')))
    );
    if (!scan) error(404, 'Scan no encontrada');
    const { data: works } = await safeQuery(
      db.select({
        workId: schema.workScans.workId,
        works: sql`json_object('id', works.id, 'slug', works.slug, 'title', works.title, 'published', works.published, 'coverId', works.cover_id, 'kind', works.kind)`
      })
      .from(schema.workScans)
      .leftJoin(schema.works, eq(schema.workScans.workId, schema.works.id))
      .where(eq(schema.workScans.scanId, scan.id))
    );
    return json({
      data: {
        ...scan,
        works: (works || []).map((ws: any) => typeof ws.works === 'string' ? JSON.parse(ws.works) : ws.works).filter((w: any) => w && works.published)
      }
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  } else if (parts[0] === 'library') {
    if (!locals.user) error(401, 'Autenticao necessria');
    const { data: library } = await safeQuery(
      db.select({
        status: schema.library.status,
        favorite: schema.library.favorite,
        following: schema.library.following,
        updatedAt: schema.library.updatedAt,
        works: sql`json_object('id', works.id, 'slug', works.slug, 'title', works.title, 'published', works.published, 'coverId', works.cover_id, 'kind', works.kind)`
      })
      .from(schema.library)
      .leftJoin(schema.works, eq(schema.library.workId, schema.works.id))
      .where(eq(schema.library.userId, locals.user!.id))
      .limit(limit)
      .offset((page - 1) * limit)
    );
    const { data: countRows } = await safeQuery(
      db.select({ count: sql<number>`count(*)` })
      .from(schema.library)
      .where(eq(schema.library.userId, locals.user!.id))
    );
    const count = countRows?.[0]?.count || 0;
    const parsedLib = (library || []).map(l => ({...l, works: typeof l.works === 'string' ? JSON.parse(l.works) : l.works}));
    return json({ data: parsedLib, page, per_page: limit, total: count }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } else if (parts[0] === 'history') {
    if (!locals.user) error(401, 'Autenticao necessria');
    const { data: history } = await safeQuery(
      db.select({
        page: schema.reading.page,
        max_page: schema.reading.maxPage,
        completed_at: schema.reading.completedAt,
        updatedAt: schema.reading.updatedAt,
        chapters: sql`json_object('id', chapters.id, 'number', chapters.number, 'title', chapters.title, 'work_id', chapters.work_id, 'works', json_object('id', works.id, 'slug', works.slug, 'title', works.title, 'published', works.published, 'coverId', works.cover_id, 'kind', works.kind))`
      })
      .from(schema.reading)
      .leftJoin(schema.chapters, eq(schema.reading.chapterId, schema.chapters.id))
      .leftJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
      .where(eq(schema.reading.userId, locals.user!.id))
      .orderBy(desc(schema.reading.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit)
    );
    const { data: countRows } = await safeQuery(
      db.select({ count: sql<number>`count(*)` })
      .from(schema.reading)
      .where(eq(schema.reading.userId, locals.user!.id))
    );
    const count = countRows?.[0]?.count || 0;
    const parsedHist = (history || []).map(h => ({...h, chapters: typeof h.chapters === 'string' ? JSON.parse(h.chapters) : h.chapters}));
    return json({ data: parsedHist, page, per_page: limit, total: count }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } else if ((parts[0] === 'works' || parts[0] === 'catalog') && parts.length === 1) {
    let conditions = [eq(schema.works.published, true)] as any[];
    const q = (url.searchParams.get('q') || '').slice(0, 100).replace(/[%_\\]/g, '');
    if (q) conditions.push(like(schema.works.searchText, `%${q}%`));
    const kind = url.searchParams.get('kind');
    if (kind) conditions.push(eq(schema.works.kind, kind));
    const rating = url.searchParams.get('content_rating');
    if (rating) conditions.push(eq(schema.works.contentRating, rating));

    let sortCol = schema.works.updatedAt;
    const sort = url.searchParams.get('sort') || 'updated_at';
    if (sort === 'views') {
      sortCol = schema.works.viewsTotal as any;
    }

    const _worksRes = await safeQuery(
      db.select({
        id: schema.works.id,
        slug: schema.works.slug,
        title: schema.works.title,
        aliases: schema.works.aliases,
        synopsis: schema.works.synopsis,
        description: schema.works.description,
        author: schema.works.author,
        artist: schema.works.artist,
        kind: schema.works.kind,
        status: schema.works.status,
        year: schema.works.year,
        ageRating: schema.works.ageRating,
        published: schema.works.published,
        featured: schema.works.featured,
        coverId: schema.works.coverId,
        sourceId: schema.works.sourceId,
        updatedAt: schema.works.updatedAt,
        createdAt: schema.works.createdAt,
        searchText: schema.works.searchText,
        metadataProvenance: schema.works.metadataProvenance,
        contentRating: schema.works.contentRating,
        viewsTotal: schema.works.viewsTotal,
        latestChapterPublishedAt: schema.works.latestChapterPublishedAt
      })
      .from(schema.works)
      .where(and(...conditions))
      .orderBy(desc(sortCol))
      .limit(limit)
      .offset((page - 1) * limit)
    );
    const { data: countRows } = await safeQuery(
      db.select({ count: sql<number>`count(*)` })
      .from(schema.works)
      .where(and(...conditions))
    );
    console.error(_worksRes.error); result = { data: _worksRes.data, count: countRows?.[0]?.count || 0 };
  } else if (parts[0] === 'works' && parts.length === 2) {
    const res = await safeQuerySingle(
      db.select({
        id: schema.works.id,
        slug: schema.works.slug,
        title: schema.works.title,
        aliases: schema.works.aliases,
        synopsis: schema.works.synopsis,
        description: schema.works.description,
        author: schema.works.author,
        artist: schema.works.artist,
        kind: schema.works.kind,
        status: schema.works.status,
        year: schema.works.year,
        ageRating: schema.works.ageRating,
        published: schema.works.published,
        featured: schema.works.featured,
        coverId: schema.works.coverId,
        sourceId: schema.works.sourceId,
        updatedAt: schema.works.updatedAt,
        createdAt: schema.works.createdAt,
        searchText: schema.works.searchText,
        metadataProvenance: schema.works.metadataProvenance,
        contentRating: schema.works.contentRating,
        viewsTotal: schema.works.viewsTotal,
        latestChapterPublishedAt: schema.works.latestChapterPublishedAt,
        work_tags: sql`(SELECT json_group_array(json_object('tags', json_object('id', t.id, 'name', t.name, 'slug', t.slug, 'kind', t.kind))) FROM work_tags wt JOIN tags t ON wt.tag_id = t.id WHERE wt.work_id = works.id)`,
        work_scans: sql`(SELECT json_group_array(json_object('scans', json_object('id', s.id, 'name', s.name, 'slug', s.slug, 'is_official', s.is_official))) FROM work_scans ws JOIN scans s ON ws.scan_id = s.id WHERE ws.work_id = works.id)`
      })
      .from(schema.works)
      .where(and(eq(schema.works.slug, parts[1]), eq(schema.works.published, true)))
    );
    if (res && res.data) {
      if (typeof res.data.work_tags === 'string') res.data.work_tags = JSON.parse(res.data.work_tags);
      if (typeof res.data.work_scans === 'string') res.data.work_scans = JSON.parse(res.data.work_scans);
    }
    result = res;
  } else if (parts[0] === 'works' && parts[2] === 'chapters' && parts.length === 3) {
    const { data: work } = await safeQuerySingle(
      db.select({ id: schema.works.id })
      .from(schema.works)
      .where(and(eq(schema.works.slug, parts[1]), eq(schema.works.published, true)))
    );
    if (!work) error(404);
    const res = await safeQuery(
      db.select({
        id: schema.chapters.id,
        number: schema.chapters.number,
        title: schema.chapters.title,
        publishedAt: schema.chapters.publishedAt,
        viewsTotal: schema.chapters.viewsTotal,
        chapter_scans: sql`(SELECT json_group_array(json_object('scans', json_object('id', s.id, 'name', s.name, 'slug', s.slug, 'is_official', s.is_official))) FROM chapter_scans cs JOIN scans s ON cs.scan_id = s.id WHERE cs.chapter_id = chapters.id)`
      })
      .from(schema.chapters)
      .where(and(eq(schema.chapters.workId, work.id), isNotNull(schema.chapters.publishedAt)))
      .orderBy(desc(schema.chapters.number))
      .limit(limit)
      .offset((page - 1) * limit)
    );
    if (res && res.data) {
      res.data = res.data.map((r: any) => {
        if (typeof r.chapter_scans === 'string') r.chapter_scans = JSON.parse(r.chapter_scans);
        return r;
      });
    }
    result = res;
  } else if (parts[0] === 'chapters' && parts[2] === 'pages' && parts.length === 3) {
    
    const { data: allowedRows } = await safeQuerySingle(
      db.select({ id: schema.chapters.id })
      .from(schema.chapters)
      .leftJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
      .where(and(
        eq(schema.chapters.id, parts[1]),
        isNotNull(schema.chapters.publishedAt),
        eq(schema.works.published, true)
      ))
    );
    const allowed = !!allowedRows;

    if (!allowed) error(404);
    result = await safeQuery(
      db.select({
        position: schema.pages.position,
        media_id: schema.pages.mediaId,
        width: schema.pages.width,
        height: schema.pages.height
      })
      .from(schema.pages)
      .where(eq(schema.pages.chapterId, parts[1]))
      .orderBy(asc(schema.pages.position))
    );
    if (result.data)
      return json(
        {
          data: result.data.map((p: any) => ({
            position: p.position,
            width: p.width,
            height: p.height,
            url: `${url.origin}/media/${p.media_id}`
          }))
        },
        { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' } }
      );
  } else error(404, 'Endpoint no encontrado');
  if (result?.error) { console.error("API ERROR:", result.error); error(400, "Consulta invlida"); }
  if (!result?.data) { console.error("result.data is empty!", result); error(404); }
  return json(
    { data: result.data, page, per_page: limit, ...('count' in result ? { total: result.count } : {}) },
    { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' } }
  );
};

export const POST = async ({ locals, params, request }) => {
  const parts = params.path.split('/');
  if (parts[0] === 'events' && parts[1] === 'read') {
    const body = await request.json().catch(() => ({}));
    const chapterId = String(body.chapterId || '').trim();
    const origin = body.origin === 'MIHON' ? 'MIHON' : 'WEB';
    if (!chapterId) error(400, 'chapter_id  obrigatrio');

    const userId = locals.user?.id || undefined;
    
    // Simplified record_chapter_view
    const { data: chapter } = await safeQuerySingle(db.select({ workId: schema.chapters.workId }).from(schema.chapters).where(eq(schema.chapters.id, chapterId)));
    if (chapter) {
      await safeQuery(db.update(schema.chapters).set({ viewsTotal: sql`${schema.chapters.viewsTotal} + 1` }).where(eq(schema.chapters.id, chapterId)));
      await safeQuery(db.update(schema.works).set({ viewsTotal: sql`${schema.works.viewsTotal} + 1` }).where(eq(schema.works.id, chapter.workId)));
    }
    const viewResult = true;


    let xpResult = null;
    if (userId && body.completed) {
      const { data: claimDataRows } = await safeQuery(
        db.execute(sql`SELECT claim_chapter_xp(${chapterId}) as res`)
      );
      xpResult = claimDataRows ? (claimDataRows as any).res : null;
    }

    return json({
      ok: true,
      view: viewResult,
      xp: xpResult
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  error(404, 'Endpoint no encontrado');
};
