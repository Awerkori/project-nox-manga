import re

with open('src/routes/api/v1/[...path]/+server.ts', 'r') as f:
    content = f.read()
content = content.replace("db.get(sql`SELECT public_chapter(${parts[1]}) as res`)", "(db as any).execute(sql`SELECT public_chapter(${parts[1]}) as res`)")
content = content.replace("db.get(sql`SELECT record_chapter_view(${chapterId}, ${userId || null}, NULL, ${origin}) as res`)", "(db as any).execute(sql`SELECT record_chapter_view(${chapterId}, ${userId || null}, NULL, ${origin}) as res`)")
content = content.replace("db.get(sql`SELECT claim_chapter_xp(${chapterId}) as res`)", "(db as any).execute(sql`SELECT claim_chapter_xp(${chapterId}) as res`)")
with open('src/routes/api/v1/[...path]/+server.ts', 'w') as f:
    f.write(content)

with open('src/routes/api/action/+server.ts', 'r') as f:
    content = f.read()
content = content.replace("await locals.db\n      .from('members')\n      .select('display_name, username')\n      .eq('id', locals.user!.id)\n      .maybeSingle()", "await safeQuerySingle(db.select({ displayName: schema.members.displayName, username: schema.members.username }).from(schema.members).where(eq(schema.members.id, locals.user!.id)))")
with open('src/routes/api/action/+server.ts', 'w') as f:
    f.write(content)
