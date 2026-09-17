import re
with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

# Fix `const res = (await db.execute(sql`...`);` -> `const res = (await db.execute(sql`...`)) as any;`
content = re.sub(r'const res = \(await db\.execute\((sql`[^`]*`)\);', r'const res = (await db.execute(\1)) as any;', content)
# Fix `const result = await db.execute(...)` -> `const result = (await db.execute(...)) as any`
content = re.sub(r'const result = await db\.execute\((sql`[^`]*`)\);', r'const result = (await db.execute(\1)) as any;', content)

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
