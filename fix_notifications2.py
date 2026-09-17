import re
with open('src/lib/server/notifications.ts', 'r') as f:
    content = f.read()

content = re.sub(r'await db\.select\(\)\.from\(schema\.notifications\)\s*\.insert', r'await db.insert(schema.notifications).values', content)
content = re.sub(r'await db\.select\(\)\.from\(schema\.notifications\)\s*\.select', r'await db.select', content)
content = re.sub(r'await db\.select\(\)\.from\(schema\.scanEmailOutbox\)\s*\.insert', r'await db.insert(schema.scanEmailOutbox).values', content)

with open('src/lib/server/notifications.ts', 'w') as f:
    f.write(content)
