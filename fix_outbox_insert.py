import re
with open('src/lib/server/notifications.ts', 'r') as f:
    content = f.read()

content = content.replace("""      const { data: outboxItem, error: outboxErr } = await db.insert(schema.scanEmailOutbox).values({scanId: scanId,
          recipientUserId: recipientUserId,
          recipientEmail: recipientEmail,
          subject,
          htmlBody: html,
          status: 'PENDING',
          deliveryStatus: 'QUEUED',
          priority: outboxPriority,
          idempotencyKey: emailIdempotencyKey, scheduledAt: new Date().toISOString(),
          notificationId: notificationId,
          attempts: 0})
        .select('id')
        .maybeSingle();""", """      const { data: outboxItem, error: outboxErr } = await safeQuerySingle(
        db.insert(schema.scanEmailOutbox).values({
          scanId: scanId,
          recipientUserId: recipientUserId,
          recipientEmail: recipientEmail,
          subject,
          htmlBody: html,
          status: 'PENDING',
          deliveryStatus: 'QUEUED',
          priority: outboxPriority,
          idempotencyKey: emailIdempotencyKey,
          scheduledAt: new Date().toISOString(),
          notificationId: notificationId,
          attempts: 0
        }).returning({ id: schema.scanEmailOutbox.id })
      );""")

with open('src/lib/server/notifications.ts', 'w') as f:
    f.write(content)
