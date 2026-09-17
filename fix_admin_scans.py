with open('src/routes/admin/scans/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("scansRes,", "{ data: scansRes },")
content = content.replace("workCountsRes,", "{ data: workCountsRes },")
content = content.replace("chapterCountsRes,", "{ data: chapterCountsRes },")
content = content.replace("memberCountsRes,", "{ data: memberCountsRes },")
content = content.replace("openingsCountsRes,", "{ data: openingsCountsRes },")
content = content.replace("ownersRes,", "{ data: ownersRes },")
content = content.replace("partnerReqsRes,", "{ data: partnerReqsRes },")
content = content.replace("projectReqsRes,", "{ data: projectReqsRes },")
content = content.replace("auditLogsRes,", "{ data: auditLogsRes },")
content = content.replace("usersRes", "{ data: usersRes }")

with open('src/routes/admin/scans/+page.server.ts', 'w') as f:
    f.write(content)
