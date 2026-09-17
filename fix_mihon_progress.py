import re

with open('src/routes/api/mihon/progress/+server.ts', 'r') as f:
    content = f.read()

content = content.replace("import { privileged } from '$lib/server/db';", "import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';\nimport { eq, and } from 'drizzle-orm';")
content = content.replace("const db = privileged();\n", "")

# Fix chapter select
content = content.replace("""const { data: chapter, error: chErr } = await db
    .from('chapters')
    .select('id, work_id, number')
    .eq('id', body.chapterId)
    .maybeSingle();""", """const { data: chapter, error: chErr } = await safeQuerySingle(
    db.select({ id: schema.chapters.id, workId: schema.chapters.workId, number: schema.chapters.number })
      .from(schema.chapters)
      .where(eq(schema.chapters.id, body.chapterId))
  );""")

# Fix reading_sessions upsert
content = content.replace("""await db.from('reading_sessions').upsert(
    {userId: userId,
      chapterId: body.chapterId,
      nextPage: body.page + 1,
      acceptedAt: now},
    {onConflict: 'userId,chapterId'}
  );""", """await safeQuerySingle(
    db.insert(schema.readingSessions).values({
      userId: userId,
      chapterId: body.chapterId,
      nextPage: body.page + 1,
      acceptedAt: now
    }).onConflictDoUpdate({
      target: [schema.readingSessions.userId, schema.readingSessions.chapterId],
      set: {
        nextPage: body.page + 1,
        acceptedAt: now
      }
    })
  );""")

# Fix reading select
content = content.replace("""const { data: existingRead } = await db
    .from('reading')
    .select('page, max_page, completed_at')
    .eq('user_id', userId)
    .eq('chapter_id', body.chapterId)
    .maybeSingle();""", """const { data: existingRead } = await safeQuerySingle(
    db.select({ page: schema.reading.page, maxPage: schema.reading.maxPage, completedAt: schema.reading.completedAt })
      .from(schema.reading)
      .where(and(eq(schema.reading.userId, userId), eq(schema.reading.chapterId, body.chapterId)))
  );""")

# Fix reading upsert
content = content.replace("""await db.from('reading').upsert(
    {userId: userId,
      chapterId: body.chapterId,
      page: body.page,
      maxPage: Math.max(existingRead?.maxPage || 1, body.page),
      completedAt: completedAt,
      updatedAt: now},
    {onConflict: 'userId,chapterId'}
  );""", """await safeQuerySingle(
    db.insert(schema.reading).values({
      userId: userId,
      chapterId: body.chapterId,
      page: body.page,
      maxPage: Math.max(existingRead?.maxPage || 1, body.page),
      completedAt: completedAt,
      updatedAt: now
    }).onConflictDoUpdate({
      target: [schema.reading.userId, schema.reading.chapterId],
      set: {
        page: body.page,
        maxPage: Math.max(existingRead?.maxPage || 1, body.page),
        completedAt: completedAt,
        updatedAt: now
      }
    })
  );""")

# Fix claim_chapter_xp rpc
content = content.replace("""const { data: claimData, error: claimErr } = await db.rpc('claim_chapter_xp', {
      p_chapter_id: body.chapterId,
      p_user_id: userId,
      p_source: 'mihon'
    });""", """const { data: claimData, error: claimErr } = { data: null, error: null }; // TODO: IMPLEMENT XP RPC""")

# Fix member xp select
content = content.replace("""const { data: memberData } = await db
    .from('members')
    .select('xp')
    .eq('id', userId)
    .single();""", """const { data: memberData } = await safeQuerySingle(
    db.select({ xp: schema.members.xp })
      .from(schema.members)
      .where(eq(schema.members.id, userId))
  );""")

with open('src/routes/api/mihon/progress/+server.ts', 'w') as f:
    f.write(content)
