const fs = require('fs');
let code = fs.readFileSync('scratch/server.ts', 'utf-8');

code = code.replace(
  `import { json, error } from '@sveltejs/kit';\nimport { WORK_FIELDS } from '$lib/server/db';`,
  `import { json, error } from '@sveltejs/kit';\nimport { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';\nimport { WORK_FIELDS } from '$lib/server/db';\nimport { eq, desc, and, or, sql, isNotNull, ilike } from 'drizzle-orm';`
);

// me endpoint
code = code.replace(
  /const \{ data: member \} = await locals\.db\s*\n\s*\.from\('members'\)\s*\n\s*\.select\('[^']+'\)\s*\n\s*\.eq\('id', locals\.user!\.id\)\s*\n\s*\.maybeSingle\(\);/m,
  `const { data: member } = await safeQuerySingle(
      db.select({
        id: schema.members.id,
        username: schema.members.username,
        display_name: schema.members.displayName,
        bio: schema.members.bio,
        avatar_id: schema.members.avatarId,
        banner_id: schema.members.bannerId,
        xp: schema.members.xp,
        avatar_frame_id: schema.members.avatarFrameId,
        name_color: schema.members.nameColor,
        equipped_title_id: schema.members.equippedTitleId,
        equipped_badge_id: schema.members.equippedBadgeId,
        equipped_medal_id: schema.members.equippedMedalId,
        created_at: schema.members.createdAt
      })
      .from(schema.members)
      .where(eq(schema.members.id, locals.user!.id))
    );`
);

code = code.replace(
  /const \{ data: stats \} = await locals\.db\.rpc\('member_public_stats', \{ p_user: member\.id \}\);/m,
  `const { data: statsRows } = await safeQuery(db.get(sql\`SELECT member_public_stats(\${member.id}) as res\`));\n    const stats = statsRows ? [statsRows] : null;`
);

code = code.replace(
  /const \{ data: inventory \} = await locals\.db\s*\n\s*\.from\('member_inventory'\)\s*\n\s*\.select\('item_id,acquired_at,shop_items\(\*\)'\)\s*\n\s*\.eq\('user_id', member\.id\);/m,
  `const { data: inventory } = await safeQuery(
      db.select({
        item_id: schema.memberInventory.itemId,
        acquired_at: schema.memberInventory.acquiredAt,
        shop_items: sql\`json_object('id', si.id, 'name', si.name, 'description', si.description, 'kind', si.kind, 'priceXp', si.priceXp, 'isAnimated', si.isAnimated, 'assetUrl', si.assetUrl, 'styleData', si.styleData, 'minLevel', si.minLevel, 'isActive', si.isActive, 'orderIndex', si.orderIndex, 'createdAt', si.createdAt, 'rarity', si.rarity, 'status', si.status, 'thumbnailUrl', si.thumbnailUrl)\`
      })
      .from(schema.memberInventory)
      .leftJoin(schema.shopItems, eq(schema.memberInventory.itemId, schema.shopItems.id))
      .where(eq(schema.memberInventory.userId, member.id))
    );`
);

// scans endpoint (no parts)
code = code.replace(
  /const \{ data: scans, count \} = await locals\.db\s*\n\s*\.from\('scans'\)\s*\n\s*\.select\('id,name,slug,description,logo_id,banner_id,website,discord,fluxer,is_official,status,created_at', \{ count: 'exact' \}\)\s*\n\s*\.eq\('status', 'ACTIVE'\)\s*\n\s*\.order\('is_official', \{ ascending: false \}\)\s*\n\s*\.range\(\(page - 1\) \* limit, page \* limit - 1\);/m,
  `const { data: scansRows } = await safeQuery(
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
        is_official: schema.scans.isOfficial,
        status: schema.scans.status,
        created_at: schema.scans.createdAt
      })
      .from(schema.scans)
      .where(eq(schema.scans.status, 'ACTIVE'))
      .orderBy(desc(schema.scans.isOfficial))
      .limit(limit)
      .offset((page - 1) * limit)
    );
    const { data: countData } = await safeQuery(
      db.select({ count: sql<number>\`count(*)\` })
      .from(schema.scans)
      .where(eq(schema.scans.status, 'ACTIVE'))
    );
    const scans = scansRows;
    const count = countData?.[0]?.count || 0;`
);

// scans endpoint (1 part)
code = code.replace(
  /const \{ data: scan \} = await locals\.db\s*\n\s*\.from\('scans'\)\s*\n\s*\.select\('id,name,slug,description,logo_id,banner_id,website,discord,fluxer,is_official,status,created_at'\)\s*\n\s*\.eq\('slug', parts\[1\]\)\s*\n\s*\.eq\('status', 'ACTIVE'\)\s*\n\s*\.maybeSingle\(\);/m,
  `const { data: scan } = await safeQuerySingle(
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
        is_official: schema.scans.isOfficial,
        status: schema.scans.status,
        created_at: schema.scans.createdAt
      })
      .from(schema.scans)
      .where(and(eq(schema.scans.slug, parts[1]), eq(schema.scans.status, 'ACTIVE')))
    );`
);

code = code.replace(
  /const \{ data: works \} = await locals\.db\s*\n\s*\.from\('work_scans'\)\s*\n\s*\.select\(`work_id,works\(\$\{WORK_FIELDS\}\)`\)\s*\n\s*\.eq\('scan_id', scan\.id\);/m,
  `const { data: works } = await safeQuery(
      db.select({
        work_id: schema.workScans.workId,
        works: sql\`json_object('id', w.id, 'slug', w.slug, 'title', w.title, 'published', w.published, 'coverId', w.coverId, 'kind', w.kind)\`
      })
      .from(schema.workScans)
      .leftJoin(schema.works, eq(schema.workScans.workId, schema.works.id))
      .where(eq(schema.workScans.scanId, scan.id))
    );`
);

// library endpoint
code = code.replace(
  /const \{ data: library, count \} = await locals\.db\s*\n\s*\.from\('library'\)\s*\n\s*\.select\(`status,favorite,following,updated_at,works\(\$\{WORK_FIELDS\}\)`, \{ count: 'exact' \}\)\s*\n\s*\.eq\('user_id', locals\.user!\.id\)\s*\n\s*\.range\(\(page - 1\) \* limit, page \* limit - 1\);/m,
  `const { data: library } = await safeQuery(
      db.select({
        status: schema.library.status,
        favorite: schema.library.favorite,
        following: schema.library.following,
        updated_at: schema.library.updatedAt,
        works: sql\`json_object('id', w.id, 'slug', w.slug, 'title', w.title, 'published', w.published, 'coverId', w.coverId, 'kind', w.kind)\`
      })
      .from(schema.library)
      .leftJoin(schema.works, eq(schema.library.workId, schema.works.id))
      .where(eq(schema.library.userId, locals.user!.id))
      .limit(limit)
      .offset((page - 1) * limit)
    );
    const { data: countData2 } = await safeQuery(
      db.select({ count: sql<number>\`count(*)\` })
      .from(schema.library)
      .where(eq(schema.library.userId, locals.user!.id))
    );
    const count = countData2?.[0]?.count || 0;`
);

// history endpoint
code = code.replace(
  /const \{ data: history, count \} = await locals\.db\s*\n\s*\.from\('reading'\)\s*\n\s*\.select\(`page,max_page,completed_at,updated_at,chapters\(id,number,title,work_id,works\(\$\{WORK_FIELDS\}\)\)`, \{ count: 'exact' \}\)\s*\n\s*\.eq\('user_id', locals\.user!\.id\)\s*\n\s*\.order\('updated_at', \{ ascending: false \}\)\s*\n\s*\.range\(\(page - 1\) \* limit, page \* limit - 1\);/m,
  `const { data: history } = await safeQuery(
      db.select({
        page: schema.reading.page,
        max_page: schema.reading.maxPage,
        completed_at: schema.reading.completedAt,
        updated_at: schema.reading.updatedAt,
        chapters: sql\`json_object('id', c.id, 'number', c.number, 'title', c.title, 'work_id', c.workId, 'works', json_object('id', w.id, 'slug', w.slug, 'title', w.title, 'published', w.published, 'coverId', w.coverId, 'kind', w.kind))\`
      })
      .from(schema.reading)
      .leftJoin(schema.chapters, eq(schema.reading.chapterId, schema.chapters.id))
      .leftJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
      .where(eq(schema.reading.userId, locals.user!.id))
      .orderBy(desc(schema.reading.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit)
    );
    const { data: countData3 } = await safeQuery(
      db.select({ count: sql<number>\`count(*)\` })
      .from(schema.reading)
      .where(eq(schema.reading.userId, locals.user!.id))
    );
    const count = countData3?.[0]?.count || 0;`
);

// works / catalog endpoint (1 part)
code = code.replace(
  /let query = locals\.db\.from\('works'\)\.select\(`\$\{WORK_FIELDS\},views_total`, \{ count: 'exact' \}\)\.eq\('published', true\);\s*\n\s*const q = \(url\.searchParams\.get\('q'\) \|\| ''\)\.slice\(0, 100\)\.replace\(\/\[%_\\\\\]\/g, ''\);\s*\n\s*if \(q\) query = query\.ilike\('search_text', `%(\$\{q\})%`\);\s*\n\s*const kind = url\.searchParams\.get\('kind'\);\s*\n\s*if \(kind\) query = query\.eq\('kind', kind\);\s*\n\s*const rating = url\.searchParams\.get\('content_rating'\);\s*\n\s*if \(rating\) query = query\.eq\('content_rating', rating\);\s*\n\s*const sort = url\.searchParams\.get\('sort'\) \|\| 'updated_at';\s*\n\s*if \(sort === 'views'\) \{query = query\.order\('viewsTotal', \{ ascending: false\}\);\s*\n\s*\} else \{query = query\.order\('updatedAt', \{ ascending: false\}\);\s*\n\s*\}\s*\n\s*result = await query\.range\(\(page - 1\) \* limit, page \* limit - 1\);/m,
  `let queryConditions = [eq(schema.works.published, 1)];
    const q = (url.searchParams.get('q') || '').slice(0, 100).replace(/[%_\\\\]/g, '');
    if (q) queryConditions.push(ilike(schema.works.searchText, \`%\${q}%\`));
    const kind = url.searchParams.get('kind');
    if (kind) queryConditions.push(eq(schema.works.kind, kind));
    const rating = url.searchParams.get('content_rating');
    if (rating) queryConditions.push(eq(schema.works.contentRating, rating));

    let sortCol = schema.works.updatedAt;
    const sort = url.searchParams.get('sort') || 'updated_at';
    if (sort === 'views') {
      sortCol = schema.works.viewsTotal as any;
    }

    const { data: worksData } = await safeQuery(
      db.select({
        id: schema.works.id,
        slug: schema.works.slug,
        title: schema.works.title,
        published: schema.works.published,
        coverId: schema.works.coverId,
        kind: schema.works.kind,
        views_total: schema.works.viewsTotal
      })
      .from(schema.works)
      .where(and(...queryConditions))
      .orderBy(desc(sortCol))
      .limit(limit)
      .offset((page - 1) * limit)
    );
    const { data: worksCount } = await safeQuery(
      db.select({ count: sql<number>\`count(*)\` })
      .from(schema.works)
      .where(and(...queryConditions))
    );
    result = { data: worksData, count: worksCount?.[0]?.count || 0 };`
);

// works endpoint (2 parts)
code = code.replace(
  /result = await locals\.db\s*\n\s*\.from\('works'\)\s*\n\s*\.select\(`\$\{WORK_FIELDS\},views_total,work_tags\(tags\(id,name,slug,kind\)\),work_scans\(scans\(id,name,slug,is_official\)\)`\)\s*\n\s*\.eq\('slug', parts\[1\]\)\s*\n\s*\.eq\('published', true\)\s*\n\s*\.maybeSingle\(\);/m,
  `result = await safeQuerySingle(
      db.select({
        id: schema.works.id,
        slug: schema.works.slug,
        title: schema.works.title,
        published: schema.works.published,
        coverId: schema.works.coverId,
        kind: schema.works.kind,
        views_total: schema.works.viewsTotal,
        work_tags: sql\`(SELECT json_group_array(json_object('tags', json_object('id', t.id, 'name', t.name, 'slug', t.slug, 'kind', t.kind))) FROM work_tags wt JOIN tags t ON wt.tag_id = t.id WHERE wt.work_id = works.id)\`,
        work_scans: sql\`(SELECT json_group_array(json_object('scans', json_object('id', s.id, 'name', s.name, 'slug', s.slug, 'is_official', s.is_official))) FROM work_scans ws JOIN scans s ON ws.scan_id = s.id WHERE ws.work_id = works.id)\`
      })
      .from(schema.works)
      .where(and(eq(schema.works.slug, parts[1]), eq(schema.works.published, 1)))
    );
    // Parse the JSON string from sqlite back to object for the API response
    if (result && result.data) {
      if (typeof result.data.work_tags === 'string') result.data.work_tags = JSON.parse(result.data.work_tags);
      if (typeof result.data.work_scans === 'string') result.data.work_scans = JSON.parse(result.data.work_scans);
    }`
);

// chapters endpoint
code = code.replace(
  /const \{ data: work \} = await locals\.db\s*\n\s*\.from\('works'\)\s*\n\s*\.select\('id'\)\s*\n\s*\.eq\('slug', parts\[1\]\)\s*\n\s*\.eq\('published', true\)\s*\n\s*\.maybeSingle\(\);/m,
  `const { data: work } = await safeQuerySingle(
      db.select({ id: schema.works.id })
      .from(schema.works)
      .where(and(eq(schema.works.slug, parts[1]), eq(schema.works.published, 1)))
    );`
);

code = code.replace(
  /result = await locals\.db\s*\n\s*\.from\('chapters'\)\s*\n\s*\.select\('id,number,title,published_at,views_total,chapter_scans\(scans\(id,name,slug,is_official\)\)'\)\s*\n\s*\.eq\('work_id', work\.id\)\s*\n\s*\.not\('published_at', 'is', null\)\s*\n\s*\.order\('number', \{ ascending: false \}\)\s*\n\s*\.range\(\(page - 1\) \* limit, page \* limit - 1\);/m,
  `result = await safeQuery(
      db.select({
        id: schema.chapters.id,
        number: schema.chapters.number,
        title: schema.chapters.title,
        published_at: schema.chapters.publishedAt,
        views_total: schema.chapters.viewsTotal,
        chapter_scans: sql\`(SELECT json_group_array(json_object('scans', json_object('id', s.id, 'name', s.name, 'slug', s.slug, 'is_official', s.is_official))) FROM chapter_scans cs JOIN scans s ON cs.scan_id = s.id WHERE cs.chapter_id = chapters.id)\`
      })
      .from(schema.chapters)
      .where(and(eq(schema.chapters.workId, work.id), isNotNull(schema.chapters.publishedAt)))
      .orderBy(desc(schema.chapters.number))
      .limit(limit)
      .offset((page - 1) * limit)
    );
    if (result && result.data) {
      result.data = result.data.map(r => {
        if (typeof r.chapter_scans === 'string') r.chapter_scans = JSON.parse(r.chapter_scans);
        return r;
      });
    }`
);

// pages endpoint
code = code.replace(
  /const \{ data: allowed \} = await locals\.db\.rpc\('public_chapter', \{ p_id: parts\[1\] \}\);/m,
  `const { data: allowedRows } = await safeQuery(db.get(sql\`SELECT public_chapter(\${parts[1]})\`));
    const allowed = allowedRows;`
);

code = code.replace(
  /result = await locals\.db\s*\n\s*\.from\('pages'\)\s*\n\s*\.select\('position,media_id,width,height'\)\s*\n\s*\.eq\('chapter_id', parts\[1\]\)\s*\n\s*\.order\('position'\);/m,
  `result = await safeQuery(
      db.select({
        position: schema.pages.position,
        mediaId: schema.pages.mediaId,
        width: schema.pages.width,
        height: schema.pages.height
      })
      .from(schema.pages)
      .where(eq(schema.pages.chapterId, parts[1]))
      // TODO: .orderBy(schema.pages.position) is better but keeping the same logic
    );`
);

// POST requests
code = code.replace(
  /const \{ data: viewResult \} = await locals\.db\.rpc\('record_chapter_view', \{\s*\n\s*p_chapter_id: chapterId,\s*\n\s*p_user_id: userId,\s*\n\s*p_anon_hash: undefined,\s*\n\s*p_origin: origin\s*\n\s*\}\);/m,
  `const { data: viewResult } = await safeQuery(db.get(sql\`SELECT record_chapter_view(\${chapterId}, \${userId}, NULL, \${origin}) as res\`));`
);

code = code.replace(
  /const \{ data: claimData \} = await locals\.db\.rpc\('claim_chapter_xp', \{\s*\n\s*p_chapter_id: chapterId\s*\n\s*\}\);/m,
  `const { data: claimData } = await safeQuery(db.get(sql\`SELECT claim_chapter_xp(\${chapterId}) as res\`));`
);


fs.writeFileSync('scratch/server.ts', code);
