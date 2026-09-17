import re
with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("""        isPublished: isPublished,
        targetPositionId: targetPositionId || null,
      if (error) return fail(400, { message: error.message });""", """        isPublished: isPublished,
        targetPositionId: targetPositionId || null
      }).where(eq(schema.scanAcademyTutorials.id, tutorialId)));
      if (error) return fail(400, { message: error.message });""")

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
