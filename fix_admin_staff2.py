import re

with open('tests/admin-staff.test.ts', 'r') as f:
    content = f.read()

content = content.replace("(safeQuery as any).mockResolvedValueOnce({ data: mockStaffData, error: null });",
"""
    (safeQuery as any).mockImplementation(async (q) => {
        const { sql } = (q as any).toSQL();
        if (sql.includes('"access_roles"')) return { data: [{ userId: 'admin-uuid', role: 'ADMIN', suspended: false }], error: null };
        if (sql.includes('"members"')) return { data: [{ id: 'admin-uuid', username: 'awerkori', displayName: 'Awerkori' }], error: null };
        return { data: [], error: null };
    });
""")

content = content.replace("""    const mockStaffData = [
      {
        access_roles: { userId: 'editor-uuid', role: 'EDITOR', suspended: false },
        members: { id: 'editor-uuid', username: 'editor1', displayName: 'Editor Um' }
      }
    ];
    (safeQuery as any).mockResolvedValueOnce({ data: mockStaffData, error: null });""",
"""
    (safeQuery as any).mockImplementation(async (q) => {
        const { sql } = (q as any).toSQL();
        if (sql.includes('"access_roles"')) return { data: [{ userId: 'editor-uuid', role: 'EDITOR', suspended: false }], error: null };
        if (sql.includes('"members"')) return { data: [{ id: 'editor-uuid', username: 'editor1', displayName: 'Editor Um' }], error: null };
        return { data: [], error: null };
    });
""")

with open('tests/admin-staff.test.ts', 'w') as f:
    f.write(content)
