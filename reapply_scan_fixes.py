import re

with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

# 1. Remove updatedAt: new Date().toISOString()
content = re.sub(r'updatedAt: new Date\(\)\.toISOString\(\),?\s*', '', content)

# 2. Fix post null check
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

# 3. Fix post.id to post!.id
content = content.replace("contextId: post.id", "contextId: post!.id")
content = content.replace("postId=${post.id}", "postId=${post!.id}")

# 4. Fix to_user_id
content = content.replace("schema.scanTransferRequests.to_user_id", "schema.scanTransferRequests.toUserId")

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
