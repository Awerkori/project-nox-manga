with open('src/routes/api/mihon/progress/+server.ts', 'r') as f:
    content = f.read()

content = content.replace("""  await db.select().from(schema.readingSessions).upsert(
    {userId: userId,
      chapterId: body.chapterId,
      nextPage: body.page + 1,
      acceptedAt: now},
    {onConflict: 'userId,chapterId'}
  );""", """  await safeQuery(
    db.insert(schema.readingSessions)
      .values({
        userId: userId,
        chapterId: body.chapterId,
        nextPage: body.page + 1,
        acceptedAt: now
      })
      .onConflictDoUpdate({
        target: [schema.readingSessions.userId, schema.readingSessions.chapterId],
        set: {
          nextPage: body.page + 1,
          acceptedAt: now
        }
      })
  );""")

content = content.replace("""  // 3. Upsert reading entry
  const { data: existingRead } = await db.select().from(schema.reading)
    .select('page, max_page, completed_at')
    .eq('user_id', userId)
    .eq('chapter_id', body.chapterId)
    .maybeSingle();

  const completedAt =
    existingRead?.completedAt || (body.completed ? now : null);

  await db.select().from(schema.reading).upsert(
    {userId: userId,
      chapterId: body.chapterId,
      page: body.page,
      maxPage: Math.max(existingRead?.maxPage || 1, body.page),
      completedAt: completedAt,
      updatedAt: now},
    {onConflict: 'userId,chapterId'}
  );""", """  // 3. Upsert reading entry
  const { data: existingRead } = await safeQuerySingle(
    db.select({ page: schema.reading.page, maxPage: schema.reading.maxPage, completedAt: schema.reading.completedAt })
      .from(schema.reading)
      .where(and(eq(schema.reading.userId, userId), eq(schema.reading.chapterId, body.chapterId)))
  );

  const completedAt =
    existingRead?.completedAt || (body.completed ? now : null);

  await safeQuery(
    db.insert(schema.reading)
      .values({
        userId: userId,
        chapterId: body.chapterId,
        page: body.page,
        maxPage: Math.max(existingRead?.maxPage || 1, body.page),
        completedAt: completedAt,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [schema.reading.userId, schema.reading.chapterId],
        set: {
          page: body.page,
          maxPage: Math.max(existingRead?.maxPage || 1, body.page),
          completedAt: completedAt,
          updatedAt: now
        }
      })
  );""")

with open('src/routes/api/mihon/progress/+server.ts', 'w') as f:
    f.write(content)
