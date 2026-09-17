import re
with open('src/lib/server/notifications.ts', 'r') as f:
    content = f.read()

content = content.replace("""    const { data: existing } = await db.select('id')
      .eq('user_id', recipientUserId)
      .eq('dedupe_key', cleanDedupeKey)
      .maybeSingle();""", """    const { data: existing } = await safeQuerySingle(
      db.select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(and(eq(schema.notifications.userId, recipientUserId), eq(schema.notifications.dedupeKey, cleanDedupeKey)))
    );""")

with open('src/lib/server/notifications.ts', 'w') as f:
    f.write(content)
