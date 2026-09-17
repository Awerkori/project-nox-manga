with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("const activity = activityRes.data || [];", "const activity = (activityRes.data || []).map((r: any) => ({ ...r, chapters: { ...r.chapters, works: r.works } }));")
content = content.replace("const tasks = tasksRes.data || [];", "const tasks = (tasksRes.data || []).map((r: any) => ({ ...r, scan_task_comments: r.scan_task_comments ? { ...r.scan_task_comments, members: r.members } : null }));")
content = content.replace("const messages = messagesRes.data || [];", "const messages = (messagesRes.data || []).map((r: any) => ({ ...r, reply_to: r.reply_to ? { ...r.reply_to, user: r.reply_user } : null }));")

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
