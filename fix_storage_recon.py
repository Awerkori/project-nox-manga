with open('src/lib/server/storage-reconciliation.ts', 'r') as f:
    content = f.read()

content = content.replace(
    "await db.select().from(schema.storagePools).select('id, key');",
    "await safeQuery(db.select({ id: schema.storagePools.id, key: schema.storagePools.key }).from(schema.storagePools));"
)
content = content.replace(
    "await db.select().from(schema.storageShards).select('id, pool_id, bot_reference, display_name');",
    "await safeQuery(db.select({ id: schema.storageShards.id, poolId: schema.storageShards.poolId, botReference: schema.storageShards.botReference, displayName: schema.storageShards.displayName }).from(schema.storageShards));"
)

with open('src/lib/server/storage-reconciliation.ts', 'w') as f:
    f.write(content)
