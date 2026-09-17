import os
import re

# 4. src/routes/api/internal/storage/upload/+server.ts
with open('src/routes/api/internal/storage/upload/+server.ts', 'r') as f:
    content = f.read()
content = content.replace("let db: ReturnType<typeof privileged> | null = null;", "")
content = content.replace("if (env.SUPABASE_SERVICE_ROLE_KEY) {\n    try {\n      db = privileged();\n    } catch {}\n  }", "")
content = content.replace("if (db) {\n      const { data: res } = await db.rpc('register_storage_shard', {\n        p_bot_id: botClient.id\n      });\n      shardId = res;\n    }", "const { data: resRows } = await safeQuerySingle((dbClient as any).execute(sql`SELECT register_storage_shard(${botClient.id}) as res`));\n    shardId = resRows ? (resRows as any).res : null;")
content = content.replace("db.rpc('record_storage_upload_stats', {", "(dbClient as any).execute(sql`SELECT record_storage_upload_stats(")
content = content.replace("  p_bytes: payloadBuffer.length,\n            p_success: true\n          });", "  ${payloadBuffer.length}, true)`);")
content = content.replace("  p_bytes: payloadBuffer.length,\n          p_success: false\n        });", "  ${payloadBuffer.length}, false)`);")
content = content.replace("import { env } from '$env/dynamic/private';", "import { env } from '$env/dynamic/private';\nimport { db as dbClient, safeQuerySingle } from '$lib/server/db';\nimport { sql } from 'drizzle-orm';")
content = content.replace("import { privileged } from '$lib/server/db';", "")
with open('src/routes/api/internal/storage/upload/+server.ts', 'w') as f:
    f.write(content)

