with open('src/lib/server/notifications.ts', 'r') as f:
    content = f.read()

content = content.replace(
"""    const { data: m } = await db.select().from(schema.members)
      .select('username, display_name')
      .eq('id', userId)
      .maybeSingle();""",
"""    const { data: m } = await safeQuerySingle(db.select({ username: schema.members.username, displayName: schema.members.displayName }).from(schema.members).where(eq(schema.members.id, userId)));"""
)
content = content.replace(
"""  const { data: existing, error } = await db.select().from(schema.notifications)
    .select('id, type, target_url')
    .eq('recipient_user_id', params.recipientUserId)
    .eq('type', params.type)
    .eq('actor_user_id', params.actorUserId || '')
    .eq('target_url', params.deepLink || '')
    .eq('is_read', false)
    .maybeSingle();""",
"""  const { data: existing, error } = await safeQuerySingle(db.select({ id: schema.notifications.id, type: schema.notifications.type, deepLink: schema.notifications.deepLink }).from(schema.notifications).where(and(eq(schema.notifications.recipientUserId, params.recipientUserId), eq(schema.notifications.type, params.type), eq(schema.notifications.actorUserId, params.actorUserId || ''), eq(schema.notifications.deepLink, params.deepLink || ''), eq(schema.notifications.isRead, false))));"""
)

with open('src/lib/server/notifications.ts', 'w') as f:
    f.write(content)
