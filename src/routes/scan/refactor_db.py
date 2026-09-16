import re
import sys

def camel_case(s):
    # scan_members -> scanMembers
    parts = s.split('_')
    return parts[0] + ''.join(x.title() for x in parts[1:])

with open('+page.server.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
if 'import { db, schema, safeQuery, safeQuerySingle }' not in content:
    content = "import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';\nimport { eq, or, and, isNull, isNotNull, gt, lt, desc, asc, inArray, sql } from 'drizzle-orm';\n" + content

# Replace RPC
# locals.db.rpc('claim_scan_task', { p_task_id: taskId })
# db.execute(sql`SELECT claim_scan_task(${taskId})`)
def rpc_repl(m):
    rpc_name = m.group(1)
    args_str = m.group(2)
    # very naive replacement
    return f"db.execute(sql`SELECT {rpc_name}()`)"
# actually let's just do it manually for rpc if there are few
    
print("RPC count:", content.count('.rpc('))

