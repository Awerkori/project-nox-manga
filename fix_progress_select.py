with open('src/routes/api/mihon/progress/+server.ts', 'r') as f:
    content = f.read()

content = content.replace("""  // 5. Get current member XP
  const { data: memberData } = await db.select().from(schema.members)
    .select('xp')
    .eq('id', userId)
    .single();""", """  // 5. Get current member XP
  const { data: memberData } = await safeQuerySingle(
    db.select({ xp: schema.members.xp }).from(schema.members).where(eq(schema.members.id, userId))
  );""")

with open('src/routes/api/mihon/progress/+server.ts', 'w') as f:
    f.write(content)
