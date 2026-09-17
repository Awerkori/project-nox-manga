with open('src/lib/server/notifications.ts', 'r') as f:
    content = f.read()

content = "import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';\nimport { eq, sql } from 'drizzle-orm';\n" + content
content = content.replace("await db.select().from(schema.scanEmailOutboxs)\n          .update", "await safeQuery(db.update(schema.scanEmailOutboxs).set")
content = content.replace(")\n          .eq('id', item.id);", ").where(eq(schema.scanEmailOutboxs.id, item.id)));")

with open('src/lib/server/notifications.ts', 'w') as f:
    f.write(content)

