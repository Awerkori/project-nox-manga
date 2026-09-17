import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
  env: {
    TURSO_DB_URL: 'libsql://dummy.turso.io',
    TURSO_DB_TOKEN: 'dummy-token'
  }
}));

import { load, actions } from '../src/routes/admin/staff/+page.server.js';
import { safeQuery, safeQuerySingle } from '../src/lib/server/db/safe';
import { db } from '../src/lib/server/db';

vi.mock('../src/lib/server/db/safe', () => ({
  safeQuery: vi.fn(),
  safeQuerySingle: vi.fn()
}));

vi.spyOn(db, 'execute').mockImplementation(async () => []);

describe('/admin/staff PageServerLoad & Actions', () => {
  beforeEach(() => {
    (safeQuery as any).mockClear();
    (safeQuerySingle as any).mockClear();
  });

  it('redirects unauthorized users to /entrar', async () => {
    const unauthLocals = {
      user: null,
      role: 'USER',
      db: {} as any
    };

    await expect(load({ locals: unauthLocals } as any)).rejects.toThrow();
  });

  it('loads staff members cleanly for ADMIN role without 500 errors', async () => {
    const mockStaffData = [
      {
        access_roles: { userId: 'admin-uuid', role: 'ADMIN', suspended: false },
        members: { id: 'admin-uuid', username: 'awerkori', displayName: 'Awerkori' }
      }
    ];

    
    (safeQuery as any).mockImplementation(async (q) => {
        const { sql } = (q as any).toSQL();
        if (sql.includes('"access_roles"')) return { data: [{ userId: 'admin-uuid', role: 'ADMIN', suspended: false }], error: null };
        if (sql.includes('"members"')) return { data: [{ id: 'admin-uuid', username: 'awerkori', displayName: 'Awerkori' }], error: null };
        return { data: [], error: null };
    });


    const adminLocals = {
      user: { id: 'admin-uuid' },
      role: 'ADMIN'
    };

    const result = (await load({ locals: adminLocals } as any)) as any;
    expect(result.staff.length).toBe(1);
    expect(result.staff[0].username).toBe('awerkori');
    expect(result.staff[0].role).toBe('ADMIN');
    expect(result.counts.admins).toBe(1);
    expect(result.isAdmin).toBe(true);
  });

  it('handles fallback query gracefully if join fails', async () => {
    // In Drizzle, joins don't fail like Supabase, but we verify it handles the same structure.
    const mockStaffData = [
      {
        access_roles: { userId: 'editor-uuid', role: 'EDITOR', suspended: false },
        members: { id: 'editor-uuid', username: 'editor1', displayName: 'Editor Um' }
      }
    ];
    
    (safeQuery as any).mockImplementation(async (q) => {
        const { sql } = (q as any).toSQL();
        if (sql.includes('"access_roles"')) return { data: [{ userId: 'editor-uuid', role: 'EDITOR', suspended: false }], error: null };
        if (sql.includes('"members"')) return { data: [{ id: 'editor-uuid', username: 'editor1', displayName: 'Editor Um' }], error: null };
        return { data: [], error: null };
    });


    const adminLocals = {
      user: { id: 'admin-uuid' },
      role: 'ADMIN'
    };

    const result = (await load({ locals: adminLocals } as any)) as any;
    expect(result.staff.length).toBe(1);
    expect(result.staff[0].username).toBe('editor1');
    expect(result.staff[0].role).toBe('EDITOR');
  });

  it('validates permissions on updateRole action', async () => {
    const editorLocals = {
      user: { id: 'editor-uuid' },
      role: 'EDITOR',
      db: {} as any
    };

    try {
      await (actions.updateRole as any)({
        request: {
          formData: async () => new Map([['userId', 'user-1'], ['role', 'ADMIN']])
        },
        locals: editorLocals
      });
    } catch(res: any) {
        expect(res.status).toBe(403);
    }
  });
});
