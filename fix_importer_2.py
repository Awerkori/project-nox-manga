import re

with open('src/routes/admin/importer/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("(failedJobsRes.success ? failedJobsRes.data : [])", "(failedJobs || [])")

with open('src/routes/admin/importer/+page.server.ts', 'w') as f:
    f.write(content)
