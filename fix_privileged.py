import os
import re

files_to_fix = [
    "src/lib/server/notifications.ts",
    "src/lib/server/storage-reconciliation.ts",
    "src/lib/server/storage-router.ts",
    "src/routes/api/internal/storage/upload/+server.ts",
    "src/routes/api/mihon/progress/+server.ts",
    "src/routes/api/chapters/[id]/view/+server.ts",
    "src/routes/api/banner/+server.ts",
    "src/routes/media/[id]/+server.ts",
    "src/lib/server/mentions.ts"
]

def snake_to_camel(snake_str):
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])

for filepath in files_to_fix:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()

    # Replace import { privileged } with import { db, schema, safeQuery }
    content = content.replace("import { privileged } from '$lib/server/db';", "import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';")
    # Replace const db = privileged(); with nothing
    content = content.replace("const db = privileged();\n", "")
    content = content.replace("const db = privileged();", "")
    
    # Replace db.from('table_name') with db.select().from(schema.tableNames)
    def repl_from(m):
        table = m.group(1)
        camel_table = snake_to_camel(table)
        if camel_table.endswith('y') and not camel_table.endswith('ey'):
            camel_table = camel_table[:-1] + 'ies'
        elif not camel_table.endswith('s') and camel_table != 'reading':
            camel_table += 's'
        if camel_table == 'member_positions': camel_table = 'memberPositions'
        if camel_table == 'works': camel_table = 'works'
        return f"db.select().from(schema.{camel_table})"
    
    content = re.sub(r"db\s*\.from\(['\"]([^'\"]+)['\"]\)", repl_from, content)

    # For .upsert(...) -> .onConflictDoUpdate
    # This is harder to do blindly via regex, so let's just write to file and I'll do manual fixes if needed.
    
    with open(filepath, 'w') as f:
        f.write(content)
