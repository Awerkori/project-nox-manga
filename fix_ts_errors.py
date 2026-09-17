import re

# 1. session-cache.ts
with open('src/lib/server/session-cache.ts', 'r') as f:
    content = f.read()
content = content.replace("s.scan?.id || s.id", "s.scan?.id || (s as any).id")
content = content.replace("s.scan?.name || s.name", "s.scan?.name || (s as any).name")
content = content.replace("s.scan?.slug || s.slug", "s.scan?.slug || (s as any).slug")
content = content.replace("s.scan?.logoId || s.logoId", "s.scan?.logoId || (s as any).logoId")
content = content.replace("s.scan?.status || s.status", "s.scan?.status || (s as any).status")
with open('src/lib/server/session-cache.ts', 'w') as f:
    f.write(content)

# 2. api/action/+server.ts
with open('src/routes/api/action/+server.ts', 'r') as f:
    content = f.read()
if "member(locals);" in content:
    content = content.replace("member(locals);", "")
with open('src/routes/api/action/+server.ts', 'w') as f:
    f.write(content)

# 3. api/mihon/catalog/+server.ts
with open('src/routes/api/mihon/catalog/+server.ts', 'r') as f:
    content = f.read()
content = content.replace("countRes.data[0]", "countRes.data?.[0]")
with open('src/routes/api/mihon/catalog/+server.ts', 'w') as f:
    f.write(content)

# 4. api/mihon/token/+server.ts
with open('src/routes/api/mihon/token/+server.ts', 'r') as f:
    content = f.read()
if "import { error } from" not in content:
    content = "import { error } from '@sveltejs/kit';\n" + content
with open('src/routes/api/mihon/token/+server.ts', 'w') as f:
    f.write(content)

# 5. api/upload/+server.ts
with open('src/routes/api/upload/+server.ts', 'r') as f:
    content = f.read()
content = content.replace("userRoleRows[0]", "(userRoleRows as any[])[0]")
with open('src/routes/api/upload/+server.ts', 'w') as f:
    f.write(content)

