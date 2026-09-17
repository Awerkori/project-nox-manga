import re

with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

# Fix scanMuralPosts
content = content.replace("isPinned,\n        pinnedAt", "isPinned: isPinned ? 1 : 0,\n        pinnedAt")
content = content.replace("db.insert(schema.scanMuralPosts).values({\n        scanId", "db.insert(schema.scanMuralPosts).values({\n        id: crypto.randomUUID(),\n        createdAt: new Date().toISOString(),\n        updatedAt: new Date().toISOString(),\n        scanId")

# Fix scanAttachments
content = content.replace("db.insert(schema.scanAttachments).values({\n            scanId", "db.insert(schema.scanAttachments).values({\n            id: crypto.randomUUID(),\n            createdAt: new Date().toISOString(),\n            updatedAt: new Date().toISOString(),\n            scanId")

# Fix scanMessages
content = content.replace("db.insert(schema.scanMessages).values({\n        scanId", "db.insert(schema.scanMessages).values({\n        id: crypto.randomUUID(),\n        createdAt: new Date().toISOString(),\n        updatedAt: new Date().toISOString(),\n        scanId")

# Fix scanWorkflowStages
content = content.replace("db.insert(schema.scanWorkflowStages).values({\n          scanId", "db.insert(schema.scanWorkflowStages).values({\n          id: crypto.randomUUID(),\n          createdAt: new Date().toISOString(),\n          updatedAt: new Date().toISOString(),\n          scanId")
content = content.replace("db.insert(schema.scanWorkflowStages).values({\n        scanId", "db.insert(schema.scanWorkflowStages).values({\n        id: crypto.randomUUID(),\n        createdAt: new Date().toISOString(),\n        updatedAt: new Date().toISOString(),\n        scanId")

# Fix workGlossaryEntries
content = content.replace("db.insert(schema.workGlossaryEntries).values({\n          scanId", "db.insert(schema.workGlossaryEntries).values({\n          id: crypto.randomUUID(),\n          createdAt: new Date().toISOString(),\n          updatedAt: new Date().toISOString(),\n          scanId")

# Fix scanTasks
content = content.replace("db.insert(schema.scanTasks).values({\n        scanId", "db.insert(schema.scanTasks).values({\n        id: crypto.randomUUID(),\n        createdAt: new Date().toISOString(),\n        updatedAt: new Date().toISOString(),\n        scanId")

# Fix scanChapterQcIssues
content = content.replace("db.insert(schema.scanChapterQcIssues).values({\n        scanId", "db.insert(schema.scanChapterQcIssues).values({\n        id: crypto.randomUUID(),\n        createdAt: new Date().toISOString(),\n        updatedAt: new Date().toISOString(),\n        scanId")

# Fix scanIntegrations
content = content.replace("db.insert(schema.scanIntegrations).values({\n        scanId", "db.insert(schema.scanIntegrations).values({\n        id: crypto.randomUUID(),\n        createdAt: new Date().toISOString(),\n        updatedAt: new Date().toISOString(),\n        scanId")

# Fix scanWikiPages
content = content.replace("db.insert(schema.scanWikiPages).values({\n        scanId", "db.insert(schema.scanWikiPages).values({\n        id: crypto.randomUUID(),\n        createdAt: new Date().toISOString(),\n        updatedAt: new Date().toISOString(),\n        scanId")

# Fix scanWorkWorkflowOverrides
content = content.replace("db.insert(schema.scanWorkWorkflowOverrides)\n        .values({\n          scanId", "db.insert(schema.scanWorkWorkflowOverrides)\n        .values({\n          id: crypto.randomUUID(),\n          createdAt: new Date().toISOString(),\n          updatedAt: new Date().toISOString(),\n          scanId")

# Fix scanMuralComments
content = content.replace("db.insert(schema.scanMuralComments)\n        .values({\n          scanId", "db.insert(schema.scanMuralComments)\n        .values({\n          id: crypto.randomUUID(),\n          createdAt: new Date().toISOString(),\n          updatedAt: new Date().toISOString(),\n          scanId")

# Fix scanAcademyTutorials
content = content.replace("db.insert(schema.scanAcademyTutorials)\n          .values({\n            scanId", "db.insert(schema.scanAcademyTutorials)\n          .values({\n            id: crypto.randomUUID(),\n            createdAt: new Date().toISOString(),\n            updatedAt: new Date().toISOString(),\n            scanId")


with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
