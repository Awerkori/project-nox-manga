import re

with open('src/routes/admin/staff/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("rawRoles.success && rawRoles.data", "!rawRoles.error && rawRoles.data")
content = content.replace("memberRows.success", "!memberRows.error")

with open('src/routes/admin/staff/+page.server.ts', 'w') as f:
    f.write(content)
