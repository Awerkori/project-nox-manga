import re
with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("""    const { error } = await safeQuery(db.update(schema.scanProductionChapters).set({currentStageSlug: stageSlug,
    if (error) return fail(400, { message: error.message });""", """    const { error } = await safeQuery(db.update(schema.scanProductionChapters).set({currentStageSlug: stageSlug}).where(eq(schema.scanProductionChapters.id, chapterId)));
    if (error) return fail(400, { message: error.message });""")

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
