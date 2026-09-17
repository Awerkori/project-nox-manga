import re
with open('src/routes/api/scan/production/upload/+server.ts', 'r') as f:
    content = f.read()

content = content.replace("""        const staffDb = (null as any); /* createClient(
          env.STAFF_SUPABASE_URL || 'https://pgumtergvtbeepzpgvkv.supabase.co',
          env.STAFF_SUPABASE_SERVICE_ROLE_KEY || ''
        );""", """        const staffDb = (null as any); /* createClient(
          env.STAFF_SUPABASE_URL || 'https://pgumtergvtbeepzpgvkv.supabase.co',
          env.STAFF_SUPABASE_SERVICE_ROLE_KEY || ''
        );*/""")

with open('src/routes/api/scan/production/upload/+server.ts', 'w') as f:
    f.write(content)
