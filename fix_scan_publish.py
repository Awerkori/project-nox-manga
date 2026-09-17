import re
with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("""    // Update in-production chapter if exists
    await safeQuery(db.update(schema.scanProductionChapters).set({status: 'PUBLISHED',

    return { success: true, chapterPublished: true };""", """    // Update in-production chapter if exists
    await safeQuery(db.update(schema.scanProductionChapters).set({status: 'PUBLISHED'}).where(eq(schema.scanProductionChapters.targetChapterId, chapterId)));

    return { success: true, chapterPublished: true };""")

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
