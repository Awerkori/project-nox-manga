with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("""      await db.insert(schema.scanProjectRequests).values({
        scanId: scanId,
        workId: workId,
        userId: locals.user!.id,
        message
      });""", """      await db.insert(schema.scanProjectRequests).values({
        scanId: scanId,
        workId: workId,
        userId: locals.user!.id,
        message,
        status: 'PENDING'
      });""")

content = content.replace("""    const res = await safeQuery(db.insert(schema.scanTasks).values({
      scanId: scanId,
      workId: workId,
      stageId: stageId,
      title,
      description,
      assignedTo: assignedTo,
      createdBy: locals.user!.id,
      priority,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null
    })) as any;""", """    const res = await safeQuery(db.insert(schema.scanTasks).values({
      scanId: scanId,
      workId: workId,
      stageId: stageId,
      title,
      description,
      assignedTo: assignedTo,
      createdBy: locals.user!.id,
      priority,
      status: 'TODO',
      dueAt: dueAt ? new Date(dueAt).toISOString() : null
    })) as any;""")

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
