import re
with open('src/lib/server/notifications.ts', 'r') as f:
    content = f.read()

content = content.replace("""    const { data: authUser } = await db.admin.getUserById(userId);
    if (authUser?.user?.email) {
      email = authUser.user.email;""", """    const [authUser] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, userId));
    if (authUser?.email) {
      email = authUser.email;""")

with open('src/lib/server/notifications.ts', 'w') as f:
    f.write(content)
