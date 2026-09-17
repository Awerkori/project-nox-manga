import re

with open('src/routes/api/action/+server.ts', 'r') as f:
    content = f.read()

content = content.replace("const { data: authorMem } = await locals.db", "const { data: authorMem } = await safeQuerySingle(db")
content = content.replace(".from('members')", ".select().from(schema.members)")
content = content.replace(".select('role').eq('id', reqUserId).maybeSingle();", ".where(eq(schema.members.id, reqUserId)));")

with open('src/routes/api/action/+server.ts', 'w') as f:
    f.write(content)
