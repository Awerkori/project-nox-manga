import re
with open('src/lib/server/invites.ts', 'r') as f:
    content = f.read()

content = re.sub(r'import \{[^}]*eq[^}]*\} from [\'"]\$lib/server/db[\'"];?', r'import { db, schema, safeQuery, safeQuerySingle } from "$lib/server/db";\nimport { eq } from "drizzle-orm";', content)

with open('src/lib/server/invites.ts', 'w') as f:
    f.write(content)
