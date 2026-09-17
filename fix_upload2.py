import re

with open('src/routes/api/upload/+server.ts', 'r') as f:
    content = f.read()

content = re.sub(
    r"const \{ data: member \} = await locals\.db\s*\.from\('scan_members'\)\s*\.select\('role'\)\s*\.eq\('scan_id', scanId\)\s*\.eq\('user_id', ([^\)]+)\)\s*\.maybeSingle\(\);",
    r"""const { data: members } = await safeQuerySingle(
          db.select({ role: schema.scanMembers.role })
            .from(schema.scanMembers)
            .where(and(eq(schema.scanMembers.scanId, scanId), eq(schema.scanMembers.userId, \1)))
        );
        const member = members?.[0];""",
    content
)

content = re.sub(
    r"const \{ data: isAuthorized, error: authErr \} = await locals\.db\.rpc\('can_upload_to_scan_work', \{\s*p_scan_id: scanId,\s*p_work_id: workId,\s*p_user_id: ([^\}]+)\s*\}\);",
    r"""const { data: authRes, error: authErr } = await safeQuery(
        db.execute(sql`SELECT can_upload_to_scan_work(${scanId}, ${workId}, ${\1}) as is_authorized`)
      );
      const isAuthorized = (authRes as any[])?.[0]?.is_authorized;""",
    content
)

with open('src/routes/api/upload/+server.ts', 'w') as f:
    f.write(content)

