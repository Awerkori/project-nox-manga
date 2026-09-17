with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace(
"""    const { data: msg, error: msgErr } = await safeQuerySingle(
    if (msgErr || !msg) return fail(500, { message: "Erro ao inserir mensagem." });
      db.insert(schema.scanMessages).values({""", 
"""    const { data: msg, error: msgErr } = await safeQuerySingle(
      db.insert(schema.scanMessages).values({"""
)

content = content.replace(
"""      }).returning()
    );

    // Reply Notification Dispatch""",
"""      }).returning()
    );
    if (msgErr || !msg) return fail(500, { message: "Erro ao inserir mensagem." });

    // Reply Notification Dispatch"""
)

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
