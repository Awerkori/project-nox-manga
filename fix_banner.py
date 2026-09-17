import re

with open('src/routes/api/banner/+server.ts', 'r') as f:
    content = f.read()

content = content.replace("const { error: problem } = await privileged()\n    .from('members')\n    .update({bannerId: image.id, bannerCrop: crop})\n    .eq('id', userId);", "const { error: problem } = await safeQuery(db.update(schema.members).set({ bannerId: image.id, bannerCrop: crop }).where(eq(schema.members.id, userId)));")

with open('src/routes/api/banner/+server.ts', 'w') as f:
    f.write(content)
