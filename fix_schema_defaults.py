import re

with open('src/lib/server/db/schema.ts', 'r') as f:
    content = f.read()

# For id: text("id").primaryKey().notNull() -> add .$defaultFn(() => crypto.randomUUID())
# Wait, some id are integer()! We only want text UUIDs.
content = re.sub(
    r'(id: text\([^)]*\)\.primaryKey\(\)\.notNull\(\))',
    r'\1.$defaultFn(() => crypto.randomUUID())',
    content
)
# for id: text().primaryKey().notNull()
content = re.sub(
    r'(id: text\(\)\.primaryKey\(\)\.notNull\(\))',
    r'\1.$defaultFn(() => crypto.randomUUID())',
    content
)

# For createdAt: text("createdAt").notNull()
content = re.sub(
    r'(createdAt: text\([^)]*\)\.notNull\(\))',
    r'\1.$defaultFn(() => new Date().toISOString())',
    content
)
# For createdAt: integer('createdAt', { mode: 'timestamp' }).notNull()
content = re.sub(
    r'(createdAt: integer\([^)]*\)\.notNull\(\))',
    r'\1.$defaultFn(() => new Date())',
    content
)

# For updatedAt: text("updatedAt").notNull()
content = re.sub(
    r'(updatedAt: text\([^)]*\)\.notNull\(\))',
    r'\1.$defaultFn(() => new Date().toISOString()).$onUpdateFn(() => new Date().toISOString())',
    content
)
# For updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull()
content = re.sub(
    r'(updatedAt: integer\([^)]*\)\.notNull\(\))',
    r'\1.$defaultFn(() => new Date()).$onUpdateFn(() => new Date())',
    content
)

with open('src/lib/server/db/schema.ts', 'w') as f:
    f.write(content)
