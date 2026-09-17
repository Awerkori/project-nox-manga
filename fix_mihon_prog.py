with open('src/routes/api/mihon/progress/+server.ts', 'r') as f:
    content = f.read()

content = content.replace(
    "await db.select().from(schema.chapters)\n    .select('id, work_id, number')\n    .eq('id', body.chapterId)\n    .maybeSingle();",
    "await safeQuerySingle(db.select({ id: schema.chapters.id, workId: schema.chapters.workId, number: schema.chapters.number }).from(schema.chapters).where(eq(schema.chapters.id, body.chapterId)));"
)

content = content.replace(
    "await db.select().from(schema.reading)\n    .select('id, chapters_read')\n    .eq('user_id', userId)\n    .eq('work_id', chapter.workId)\n    .maybeSingle();",
    "await safeQuerySingle(db.select({ id: schema.reading.id, chaptersRead: schema.reading.chaptersRead }).from(schema.reading).where(and(eq(schema.reading.userId, userId), eq(schema.reading.workId, chapter.workId))));"
)

content = content.replace(
    "await db.select().from(schema.members)\n    .select('id')\n    .eq('id', auth.user.id)\n    .maybeSingle();",
    "await safeQuerySingle(db.select({ id: schema.members.id }).from(schema.members).where(eq(schema.members.id, auth.user.id)));"
)

with open('src/routes/api/mihon/progress/+server.ts', 'w') as f:
    f.write(content)
