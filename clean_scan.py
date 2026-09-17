import re

with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

# Remove internal imports that were added for chunks
content = re.sub(r"import\s+\{\s*db,\s*schema,\s*safeQuery,\s*safeQuerySingle\s*\}\s*from\s*'\$lib/server/db';\n", "", content)
content = re.sub(r"import\s+\{\s*eq,\s*or,\s*and,\s*isNull,\s*isNotNull,\s*gt,\s*lt,\s*desc,\s*asc,\s*inArray,\s*sql\s*\}\s*from\s*'drizzle-orm';\n", "", content)
content = re.sub(r"import\s+\{\s*fail\s*\}\s*from\s*'@sveltejs/kit';\n", "", content)

# Re-add them cleanly at the very top
imports = """import { fail } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, or, and, isNull, isNotNull, gt, lt, desc, asc, inArray, sql } from 'drizzle-orm';
"""

content = imports + content

# Also, there's multiple "export const actions: Actions = {" maybe?
# No, my split script just split the lines.
# But wait! I added it inside the `actionsChunk` string! So they are at the top of the chunks, inside `export const actions = {`!

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
