import re
with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = re.sub(r'const res = \(await db\.execute\((sql`[^`]*`)\);', r'const res = (await db.execute(\1)) as any;', content)

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
