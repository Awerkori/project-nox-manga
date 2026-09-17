with open('src/routes/me/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("memberRes,", "{ data: memberRes },")
content = content.replace("libraryRes,", "{ data: libraryRes },")
content = content.replace("readingRes,", "{ data: readingRes },")
content = content.replace("notificationsRes,", "{ data: notificationsRes },")
content = content.replace("achievementsRes,", "{ data: achievementsRes },")
content = content.replace("unlockedAchievRes,", "{ data: unlockedAchievRes },")
content = content.replace("inventoryRes", "{ data: inventoryRes }")

content = content.replace("const hasAchiev = await safeQuerySingle", "const { data: hasAchiev } = await safeQuerySingle")
content = content.replace("if (hasAchiev.error || !hasAchiev.data)", "if (!hasAchiev)")

with open('src/routes/me/+page.server.ts', 'w') as f:
    f.write(content)
