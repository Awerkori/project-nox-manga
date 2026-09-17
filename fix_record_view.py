import re

with open('src/routes/api/v1/[...path]/+server.ts', 'r') as f:
    content = f.read()

replacement = """
    // Simplified record_chapter_view
    const { data: chapter } = await safeQuerySingle(db.select({ workId: schema.chapters.workId }).from(schema.chapters).where(eq(schema.chapters.id, chapterId)));
    if (chapter) {
      await safeQuery(db.update(schema.chapters).set({ viewsTotal: sql`${schema.chapters.viewsTotal} + 1` }).where(eq(schema.chapters.id, chapterId)));
      await safeQuery(db.update(schema.works).set({ viewsTotal: sql`${schema.works.viewsTotal} + 1` }).where(eq(schema.works.id, chapter.workId)));
    }
    const viewResult = true;
"""

content = re.sub(
    r"const \{ data: viewResultRows \} = await safeQuery\([\s\S]*?const viewResult = viewResultRows \? \(viewResultRows as any\)\.res : null;",
    replacement,
    content
)

with open('src/routes/api/v1/[...path]/+server.ts', 'w') as f:
    f.write(content)
