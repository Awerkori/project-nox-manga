import re

with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

# Replace: const memberRow = await safeQuerySingle(
# With:    const { data: memberRow } = await safeQuerySingle(
content = content.replace("const memberRow = await safeQuerySingle(", "const { data: memberRow } = await safeQuerySingle(")

# Replace: const taskRes = await safeQuerySingle(
# With:    const { data: taskRes } = await safeQuerySingle(
content = content.replace("const taskRes = await safeQuerySingle(", "const { data: taskRes } = await safeQuerySingle(")

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
