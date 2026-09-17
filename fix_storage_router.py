import re
with open('src/lib/server/storage-router.ts', 'r') as f:
    content = f.read()

content = re.sub(r'\}\)\s*\.eq\(\'id\', mediaId\);', r'}).where(eq(schema.media.id, mediaId)));', content)
content = re.sub(r'\}\)\s*\.eq\(\'id\', shardId\);', r'}).where(eq(schema.storageShards.id, shardId)));', content)

with open('src/lib/server/storage-router.ts', 'w') as f:
    f.write(content)
