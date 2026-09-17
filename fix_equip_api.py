import re
with open('src/routes/api/shop/equip/+server.ts', 'r') as f:
    content = f.read()

content = content.replace("import { member } from '$lib/server/db';", "")
content = content.replace("const userId = member(locals);", "if (!locals.user) throw error(401, 'Unauthorized');\n  const userId = locals.user.id;")

with open('src/routes/api/shop/equip/+server.ts', 'w') as f:
    f.write(content)
