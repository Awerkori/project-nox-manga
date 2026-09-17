import re

with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = re.sub(r"async \(\{\s*request,\s*locals\s*\}\:\s*any\)\s*=>", r"async ({ request, locals }) =>", content)
content = re.sub(r"async \(\{\s*request,\s*locals,\s*params\s*\}\:\s*any\)\s*=>", r"async ({ request, locals, params }) =>", content)

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
