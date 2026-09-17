import re
with open('tests/admin-staff.test.ts', 'r') as f:
    content = f.read()

content = content.replace("""    (safeQuery as any).mockImplementation(async (q) => {
        const { sql } = (q as any).toSQL();
        if (sql.includes('"access_roles"')) return { data: [{ userId: 'admin-uuid', role: 'ADMIN', suspended: false }], error: null };
        if (sql.includes('"members"')) return { data: [{ id: 'admin-uuid', username: 'awerkori', displayName: 'Awerkori' }], error: null };
        return { data: [], error: null };
    });""",
"""    (safeQuery as any).mockImplementation(async (q) => {
        const { sql } = (q as any).toSQL();
        if (sql.includes('"access_roles"')) return { data: [{ userId: 'editor-uuid', role: 'EDITOR', suspended: false }], error: null };
        if (sql.includes('"members"')) return { data: [{ id: 'editor-uuid', username: 'editor1', displayName: 'Editor Um' }], error: null };
        return { data: [], error: null };
    });""")

# the first one also gets replaced, so I'll fix the first one back to admin!
content = content.replace("loads staff members cleanly for ADMIN role without 500 errors', async () => {\n    const mockStaffData = [\n      {\n        access_roles: { userId: 'admin-uuid', role: 'ADMIN', suspended: false },\n        members: { id: 'admin-uuid', username: 'awerkori', displayName: 'Awerkori' }\n      }\n    ];\n\n    \n    (safeQuery as any).mockImplementation(async (q) => {\n        const { sql } = (q as any).toSQL();\n        if (sql.includes('\"access_roles\"')) return { data: [{ userId: 'editor-uuid', role: 'EDITOR', suspended: false }], error: null };",
"loads staff members cleanly for ADMIN role without 500 errors', async () => {\n    const mockStaffData = [\n      {\n        access_roles: { userId: 'admin-uuid', role: 'ADMIN', suspended: false },\n        members: { id: 'admin-uuid', username: 'awerkori', displayName: 'Awerkori' }\n      }\n    ];\n\n    \n    (safeQuery as any).mockImplementation(async (q) => {\n        const { sql } = (q as any).toSQL();\n        if (sql.includes('\"access_roles\"')) return { data: [{ userId: 'admin-uuid', role: 'ADMIN', suspended: false }], error: null };")

content = content.replace("if (sql.includes('\"members\"')) return { data: [{ id: 'editor-uuid', username: 'editor1', displayName: 'Editor Um' }], error: null };\n        return { data: [], error: null };\n    });\n\n\n    const adminLocals = {\n      user: { id: 'admin-uuid' },\n      role: 'ADMIN'\n    };",
"if (sql.includes('\"members\"')) return { data: [{ id: 'admin-uuid', username: 'awerkori', displayName: 'Awerkori' }], error: null };\n        return { data: [], error: null };\n    });\n\n\n    const adminLocals = {\n      user: { id: 'admin-uuid' },\n      role: 'ADMIN'\n    };")


with open('tests/admin-staff.test.ts', 'w') as f:
    f.write(content)
