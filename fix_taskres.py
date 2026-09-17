import re

with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("const task = taskRes.data;", "const task = taskRes;")

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
