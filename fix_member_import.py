import re
import glob

files = [
    'src/routes/api/action/+server.ts',
    'src/routes/api/mihon/token/+server.ts',
    'src/routes/api/shop/purchase/+server.ts',
    'src/routes/api/banner/+server.ts'
]

for file in files:
    try:
        with open(file, 'r') as f:
            content = f.read()

        content = content.replace("import { member } from '$lib/server/db';", "")
        content = content.replace("import { db, schema, member, safeQuery } from '$lib/server/db';", "import { db, schema, safeQuery } from '$lib/server/db';")
        content = content.replace("import { db, schema, safeQuery, safeQuerySingle, member } from '$lib/server/db';", "import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';")
        content = content.replace("const userId = member(locals);", "if (!locals.user) throw error(401, 'Unauthorized');\n  const userId = locals.user.id;")
        
        with open(file, 'w') as f:
            f.write(content)
    except FileNotFoundError:
        pass

