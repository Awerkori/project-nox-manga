import re

with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

# Replace `locals.db.from('xxx').delete().eq('y', z)` with `safeQuery(db.delete(schema.xxx).where(eq(schema.xxx.y, z)))`
# This is tricky because of chaining, but we can do some common patterns.

# Actually, an agent will do this much better and safely.
