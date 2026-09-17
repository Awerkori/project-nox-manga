with open('src/lib/server/session-cache.ts', 'r') as f:
    content = f.read()

content = content.replace("""      const ownedScansRes = await safeQuery(
        db.select()
        .from(schema.scans)
        .where(and(eq(schema.scans.ownerId, userId), eq(schema.scans.status, 'ACTIVE')))
      );""", """      const ownedScansRes = await safeQuery(
        db.select({ scan: schema.scans })
        .from(schema.scanMembers)
        .innerJoin(schema.scans, eq(schema.scanMembers.scanId, schema.scans.id))
        .where(and(eq(schema.scanMembers.userId, userId), eq(schema.scanMembers.role, 'LEADER'), eq(schema.scans.status, 'ACTIVE')))
      );""")

with open('src/lib/server/session-cache.ts', 'w') as f:
    f.write(content)
