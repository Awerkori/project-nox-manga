with open('src/lib/server/notifications.ts', 'r') as f:
    content = f.read()

content = content.replace("""  const { data: insertedNotif, error: notifErr } = await db.insert(schema.notifications).values(notifInsertPayload)
    .select('id')
    .maybeSingle();""", """  const { data: insertedNotif, error: notifErr } = await safeQuerySingle(
    db.insert(schema.notifications).values(notifInsertPayload).returning({ id: schema.notifications.id })
  );""")

with open('src/lib/server/notifications.ts', 'w') as f:
    f.write(content)
