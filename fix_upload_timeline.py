import re
with open('src/routes/api/scan/production/upload/+server.ts', 'r') as f:
    content = f.read()
content = content.replace("details: {\\n          fileName: rawFilename,\\n          version: nextVersion,\\n          byteSize: file.size,\\n          note: note || null\\n        }", "details: JSON.stringify({\\n          fileName: rawFilename,\\n          version: nextVersion,\\n          byteSize: file.size,\\n          note: note || null\\n        })")
with open('src/routes/api/scan/production/upload/+server.ts', 'w') as f:
    f.write(content)
