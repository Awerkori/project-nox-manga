import re
with open('src/lib/server/notifications.ts', 'r') as f:
    content = f.read()

content = content.replace("db.select().from(schema.notifications).insert", "db.insert(schema.notifications).values")
content = content.replace("db.select().from(schema.notifications).select", "db.select")
content = content.replace("db.select().from(schema.scanEmailOutbox).insert", "db.insert(schema.scanEmailOutbox).values")
content = content.replace("scheduled_at:", "scheduledAt:")
content = content.replace("send_started_at:", "sendStartedAt:")
content = content.replace("delivery_status:", "deliveryStatus:")
content = content.replace("lease_expires_at:", "leaseExpiresAt:")
content = content.replace("db.insert(schema.scanNotifications)(", "db.insert(schema.scanNotifications).values(")
content = content.replace("db.auth", "db")

with open('src/lib/server/notifications.ts', 'w') as f:
    f.write(content)
