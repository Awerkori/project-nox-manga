with open('src/lib/server/notifications.ts', 'r') as f:
    content = f.read()

content = content.replace("await db.select().from(schema.scanEmailOutbox)\n          .update", "await safeQuery(db.update(schema.scanEmailOutbox).set")
content = content.replace("await db.select().from(schema.scanEmailOutboxs)\n          .update", "await safeQuery(db.update(schema.scanEmailOutbox).set")

with open('src/lib/server/notifications.ts', 'w') as f:
    f.write(content)

with open('src/lib/server/storage-router.ts', 'r') as f:
    content = f.read()
content = content.replace("schema.medias", "schema.media")
with open('src/lib/server/storage-router.ts', 'w') as f:
    f.write(content)

