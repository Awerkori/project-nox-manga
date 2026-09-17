with open('src/routes/admin/scans/+page.server.ts', 'r') as f:
    content = f.read()

# Fix the destructuring and use variables
content = content.replace("const [\n    { data: scansRes },\n    { data: workCountsRes },\n    { data: chapterCountsRes },\n    { data: memberCountsRes },\n    { data: openingsCountsRes },\n    { data: ownersRes },\n    { data: partnerReqsRes },\n    { data: projectReqsRes },\n    { data: auditLogsRes },\n    { data: usersRes }\n  ] = ", 
    "const [\n    scansRes,\n    workCountsRes,\n    chapterCountsRes,\n    memberCountsRes,\n    openingsCountsRes,\n    ownersRes,\n    partnerReqsRes,\n    projectReqsRes,\n    auditLogsRes,\n    usersRes\n  ] = ")

# Fix scansRes.(error as any).message -> scansRes.error?.message
content = content.replace("scansRes.(error as any).message", "scansRes.error ? (scansRes.error as any).message : 'Erro'")
content = content.replace("if (!scansRes.success)", "if (scansRes.error)")

content = content.replace("(workCountsRes.success ? workCountsRes.data : [])", "(workCountsRes.data || [])")
content = content.replace("(chapterCountsRes.success ? chapterCountsRes.data : [])", "(chapterCountsRes.data || [])")
content = content.replace("(memberCountsRes.success ? memberCountsRes.data : [])", "(memberCountsRes.data || [])")
content = content.replace("(openingsCountsRes.success ? openingsCountsRes.data : [])", "(openingsCountsRes.data || [])")

# Same for other success checks
content = content.replace("!ownersRes.success", "ownersRes.error")
content = content.replace("ownersRes.data", "(ownersRes.data || [])")
content = content.replace("usersRes.success ? usersRes.data : []", "usersRes.data || []")
content = content.replace("usersRes.data.map", "(usersRes.data || []).map")

with open('src/routes/admin/scans/+page.server.ts', 'w') as f:
    f.write(content)
