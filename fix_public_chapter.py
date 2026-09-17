import re

with open('src/routes/api/v1/[...path]/+server.ts', 'r') as f:
    content = f.read()

replacement = """
    const { data: allowedRows } = await safeQuerySingle(
      db.select({ id: schema.chapters.id })
      .from(schema.chapters)
      .leftJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
      .where(and(
        eq(schema.chapters.id, parts[1]),
        isNotNull(schema.chapters.publishedAt),
        eq(schema.works.published, true)
      ))
    );
    const allowed = !!allowedRows;
"""

content = re.sub(
    r"const \{ data: allowedRows \} = await safeQuery\(db\.execute\(sql\`SELECT public_chapter\(\$\{parts\[1\]\}\) as res\`\)\);\n\s*const allowed = allowedRows \? \(allowedRows as any\)\.res : null;",
    replacement,
    content
)

with open('src/routes/api/v1/[...path]/+server.ts', 'w') as f:
    f.write(content)
