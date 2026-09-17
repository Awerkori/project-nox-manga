import re
with open('src/lib/server/notifications.ts', 'r') as f:
    content = f.read()

# I will just use regex to replace `db.select().from(schema.X)\n        .update({` to `safeQuery(db.update(schema.X).set({`
content = re.sub(r'db\.select\(\)\.from\(schema\.scanEmailOutbox\)\s*\.update\(\{', r'safeQuery(db.update(schema.scanEmailOutbox).set({', content)
content = re.sub(r'\.eq\(\'id\', item\.id\);', r'.where(eq(schema.scanEmailOutbox.id, item.id)));', content)

with open('src/lib/server/notifications.ts', 'w') as f:
    f.write(content)

with open('src/lib/server/storage-router.ts', 'r') as f:
    content = f.read()

content = re.sub(r'db\.select\(\)\.from\(schema\.media\)\s*\.update\(\{', r'safeQuery(db.update(schema.media).set({', content)
content = re.sub(r'\.eq\(\'id\', id\);', r'.where(eq(schema.media.id, id)));', content)
content = re.sub(r'db\.select\(\)\.from\(schema\.storageShards\)\s*\.update\(\{', r'safeQuery(db.update(schema.storageShards).set({', content)
content = re.sub(r'\.eq\(\'id\', shard\.id\);', r'.where(eq(schema.storageShards.id, shard.id)));', content)

with open('src/lib/server/storage-router.ts', 'w') as f:
    f.write(content)

