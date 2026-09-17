import re
with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

# Replace ...schema.XXXX with ...getTableColumns(schema.XXXX)
content = re.sub(r'\.\.\.schema\.([a-zA-Z0-9_]+)', r'...getTableColumns(schema.\1)', content)

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
