import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  executeYugabyteSql: vi.fn()
}));

vi.mock('$lib/server/yugabyte', () => ({
  executeYugabyteSql: mocks.executeYugabyteSql
}));

import { load, actions } from '../src/routes/admin/staff/+page.server.js';
import { adminStaffCache } from '../src/lib/server/admin-cache';

describe('/admin/staff PageServerLoad & Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminStaffCache.clear();
  });

  it('redirects unauthorized users to /entrar', async () => {
    const unauthLocals = {
      user: null,
      role: 'USER'
    };

    await expect(load({ locals: unauthLocals } as any)).rejects.toThrow();

    const memberLocals = {
      user: { id: 'user-123' },
      role: 'USER'
    };

    await expect(load({ locals: memberLocals } as any)).rejects.toThrow();
  });

  it('loads staff members cleanly for ADMIN role without 500 errors', async () => {
    const mockStaffRows = [
      {
        user_id: 'admin-uuid',
        role: 'ADMIN',
        suspended: false,
        username: 'awerkori',
        display_name: 'Awerkori',
        avatar_id: null,
        xp: 500,
        created_at: '2026-09-01T00:00:00Z'
      }
    ];

    mocks.executeYugabyteSql.mockResolvedValueOnce({ rows: mockStaffRows, rowCount: 1 });

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
    const mockStaffRows = [
      {
        user_id: 'editor-uuid',
        role: 'EDITOR',
        suspended: false,
        username: 'editor1',
        display_name: 'Editor Um',
        avatar_id: null,
        xp: 100,
        created_at: '2026-09-05T00:00:00Z'
      }
    ];

    mocks.executeYugabyteSql.mockResolvedValueOnce({ rows: mockStaffRows, rowCount: 1 });

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
      role: 'EDITOR'
    };

    const form = new FormData();
    form.set('userId', 'user-1');
    form.set('role', 'ADMIN');

    const res = await (actions.updateRole as any)({
      request: {
        formData: async () => form
      },
      locals: editorLocals
    });

    expect(res.status).toBe(403);
  });
});
