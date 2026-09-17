with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("scans: schema.scans", "scans: { id: schema.scans.id, name: schema.scans.name, slug: schema.scans.slug }")
content = content.replace("works: schema.works", "works: { id: schema.works.id, title: schema.works.title, slug: schema.works.slug, coverId: schema.works.coverId }")
content = content.replace("completer: schema.members", "completer: { id: schema.members.id, username: schema.members.username, displayName: schema.members.displayName, avatarId: schema.members.avatarId }")
content = content.replace("members: schema.members", "members: { id: schema.members.id, username: schema.members.username, displayName: schema.members.displayName, avatarId: schema.members.avatarId }")
content = content.replace("user: schema.members", "user: { id: schema.members.id, username: schema.members.username, displayName: schema.members.displayName, avatarId: schema.members.avatarId }")
content = content.replace("reactions: schema.scanMessageReactions", "reactions: { id: schema.scanMessageReactions.id, emoji: schema.scanMessageReactions.emoji, userId: schema.scanMessageReactions.userId }")

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
