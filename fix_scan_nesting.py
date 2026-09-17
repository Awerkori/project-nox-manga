with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

# 1. chapters -> works
content = content.replace("""        chapters: {
          id: schema.chapters.id,
          number: schema.chapters.number,
          title: schema.chapters.title,
          publishedAt: schema.chapters.publishedAt,
          viewsTotal: schema.chapters.viewsTotal,
          works: {
            id: schema.works.id,
            title: schema.works.title,
            slug: schema.works.slug
          }
        }""", """        chapters: {
          id: schema.chapters.id,
          number: schema.chapters.number,
          title: schema.chapters.title,
          publishedAt: schema.chapters.publishedAt,
          viewsTotal: schema.chapters.viewsTotal,
        },
        works: {
          id: schema.works.id,
          title: schema.works.title,
          slug: schema.works.slug
        }""")

# 2. scan_task_comments -> members
content = content.replace("""        scan_task_comments: {
          id: schema.scanTaskComments.id,
          taskId: schema.scanTaskComments.taskId,
          content: schema.scanTaskComments.content,
          createdAt: schema.scanTaskComments.createdAt,
          members: { id: schema.members.id, username: schema.members.username, displayName: schema.members.displayName, avatarId: schema.members.avatarId }
        }""", """        scan_task_comments: {
          id: schema.scanTaskComments.id,
          taskId: schema.scanTaskComments.taskId,
          content: schema.scanTaskComments.content,
          createdAt: schema.scanTaskComments.createdAt,
        },
        members: { id: schema.members.id, username: schema.members.username, displayName: schema.members.displayName, avatarId: schema.members.avatarId }""")

# 3. reply_to -> user
content = content.replace("""        reply_to: {
          id: schema.scanMessages.id,
          content: schema.scanMessages.content,
          deletedAt: schema.scanMessages.deletedAt,
          user: { id: schema.members.id, username: schema.members.username, displayName: schema.members.displayName, avatarId: schema.members.avatarId }
        },""", """        reply_to: {
          id: schema.scanMessages.id,
          content: schema.scanMessages.content,
          deletedAt: schema.scanMessages.deletedAt,
        },
        reply_user: { id: schema.members.id, username: schema.members.username, displayName: schema.members.displayName, avatarId: schema.members.avatarId },""")

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
