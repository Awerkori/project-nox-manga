import re

with open('src/routes/admin/importer/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("existingWorkRes.success ? existingWorkRes.data : null", "existingWorkRes.data")
content = content.replace("newWorkRes.success ? newWorkRes.data : null", "newWorkRes.data")

# What about failedJobsRes?
content = content.replace("const failedJobsRes = await safeQuery", "const { data: failedJobs } = await safeQuery")
content = content.replace("const failedJobs = failedJobsRes.success ? failedJobsRes.data : null;", "")
content = content.replace("if (!failedJobsRes.success) return fail", "if (!failedJobs) return fail")

with open('src/routes/admin/importer/+page.server.ts', 'w') as f:
    f.write(content)
