with open('src/lib/server/storage-reconciliation.ts', 'r') as f:
    content = f.read()

content = content.replace(
    "await db.select().from(schema.medias)\n    .select('id, provider, provider_key, purpose, storage_pool_id, storage_shard_id, bot_reference, chapter_id, scan_id')\n    .order('created_at', { ascending: false })\n    .limit(sampleLimitPerPool * 7);",
    "await safeQuery(db.select({ id: schema.media.id, provider: schema.media.provider, providerKey: schema.media.providerKey, purpose: schema.media.purpose, storagePoolId: schema.media.storagePoolId, storageShardId: schema.media.storageShardId, botReference: schema.media.botReference, chapterId: schema.media.chapterId, scanId: schema.media.scanId }).from(schema.media).orderBy(desc(schema.media.createdAt)).limit(sampleLimitPerPool * 7));"
)
content = content.replace(
    "await db.select().from(schema.chapters)\n      .select('id')\n      .in('id', chapterIdsToCheck);",
    "await safeQuery(db.select({ id: schema.chapters.id }).from(schema.chapters).where(inArray(schema.chapters.id, chapterIdsToCheck)));"
)

with open('src/lib/server/storage-reconciliation.ts', 'w') as f:
    f.write(content)
