import re

with open('src/routes/admin/reports/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("countsRes.success ? countsRes.data : []", "countsRes.data || []")
content = content.replace("repRes.success ? repRes.data : null", "repRes.data")
content = content.replace("repsRes.success ? repsRes.data : []", "repsRes.data || []")
content = content.replace("if (!res.success)", "if (res.error)")
content = content.replace("return { reports: reportsRes.success ? reportsRes.data : [],", "return { reports: reportsRes.data || [],")

with open('src/routes/admin/reports/+page.server.ts', 'w') as f:
    f.write(content)
