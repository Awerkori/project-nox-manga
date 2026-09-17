with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace(
"""      safeQuerySingle(
        db.query.scanTransferRequests.findFirst({""",
"""      safeQuery(
        db.query.scanTransferRequests.findFirst({"""
)
content = content.replace(
"""      safeQuerySingle(
        db.query.scanMembers.findFirst({""",
"""      safeQuery(
        db.query.scanMembers.findFirst({"""
)
with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
