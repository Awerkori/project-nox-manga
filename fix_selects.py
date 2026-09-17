with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("from_user: schema.members", "from_user: { id: schema.members.id, username: schema.members.username, displayName: schema.members.displayName, avatarId: schema.members.avatarId }")
content = content.replace("to_user: schema.members", "to_user: { id: schema.members.id, username: schema.members.username, displayName: schema.members.displayName, avatarId: schema.members.avatarId }")
content = content.replace("scans: schema.scans,", "scans: { id: schema.scans.id, name: schema.scans.name, slug: schema.scans.slug },")

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
