with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace(
"""    const { data: post, error } = await safeQuerySingle(
      db.insert(schema.scanMuralPosts).values({
        id: crypto.randomUUID(),""", 
"""    const { data: post, error } = await safeQuerySingle(
      db.insert(schema.scanMuralPosts).values({
        id: crypto.randomUUID(),"""
)
content = content.replace(
"""        pinnedBy: isPinned ? locals.user.id : null
      }).returning()
    );

    const files = formData.getAll('attachments') as File[];""",
"""        pinnedBy: isPinned ? locals.user.id : null
      }).returning()
    );
    if (!post) return fail(500, { message: 'Erro ao criar post' });

    const files = formData.getAll('attachments') as File[];"""
)

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
