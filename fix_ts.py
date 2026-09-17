import re

with open('src/routes/u/[username]/+page.server.ts', 'r') as f:
    content = f.read()

# Fix booleans to integers
content = content.replace("eq(schema.works.published, true)", "eq(schema.works.published, 1)")
content = content.replace("eq(schema.accessRoles.suspended, false)", "eq(schema.accessRoles.suspended, 0)")
content = content.replace("eq(schema.library.favorite, true)", "eq(schema.library.favorite, 1)")

# Fix db.execute to db.get for RPCs returning single objects or running functions
content = content.replace("db.execute(sql`SELECT toggle_user_scan_privacy", "db.get(sql`SELECT toggle_user_scan_privacy")
content = content.replace("db.execute(sql`SELECT admin_moderate_user_scans", "db.get(sql`SELECT admin_moderate_user_scans")
content = content.replace("safeQuery(db.execute(sql`SELECT * FROM member_public_profile_stats(${member.id})`))", "safeQuerySingle(db.get(sql`SELECT * FROM member_public_profile_stats(${member.id})`))")

# Fix rpcStats usage since it's now safeQuerySingle
content = content.replace("const rpcStats = statsRes.data?.[0];", "const rpcStats = statsRes.data as any;")

with open('src/routes/u/[username]/+page.server.ts', 'w') as f:
    f.write(content)
