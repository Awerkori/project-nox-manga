import re

with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = re.sub(r"async \(\{\s*request,\s*locals,\s*platform\s*\}\:\s*any\)\s*=>", r"async ({ request, locals, platform }) =>", content)
content = re.sub(r"async \(\{\s*request,\s*locals,\s*url\s*\}\:\s*any\)\s*=>", r"async ({ request, locals, url }) =>", content)

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
