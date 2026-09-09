import { describe, it, expect, vi } from 'vitest';
import { load, actions } from '../src/routes/admin/staff/+page.server.js';

describe('/admin/staff PageServerLoad & Actions', () => {
  it('redirects unauthorized users to /entrar', async () => {
    const unauthLocals = {
      user: null,
      role: 'USER',
      db: {} as any
    };

    await expect(load({ locals: unauthLocals } as any)).rejects.toThrow();

    const memberLocals = {
      user: { id: 'user-123' },
      role: 'USER',
      db: {} as any
    };

    await expect(load({ locals: memberLocals } as any)).rejects.toThrow();
  });

  it('loads staff members cleanly for ADMIN role without 500 errors', async () => {
    const mockStaffData = [
      {
        user_id: 'admin-uuid',
        role: 'ADMIN',
        suspended: false,
        members: {
          id: 'admin-uuid',
          username: 'awerkori',
          display_name: 'Awerkori',
          avatar_id: null,
          xp: 500,
          created_at: '2026-09-01T00:00:00Z'
        }
      }
    ];

    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockStaffData, error: null })
          })
        })
      })
    };

    const adminLocals = {
      user: { id: 'admin-uuid' },
      role: 'ADMIN',
      db: mockDb as any
    };

    const result = (await load({ locals: adminLocals } as any)) as any;
    expect(result.staff.length).toBe(1);
    expect(result.staff[0].username).toBe('awerkori');
    expect(result.staff[0].role).toBe('ADMIN');
    expect(result.counts.admins).toBe(1);
    expect(result.isAdmin).toBe(true);
  });

  it('handles fallback query gracefully if join fails', async () => {
    const mockRawRoles = [
      { user_id: 'editor-uuid', role: 'EDITOR', suspended: false }
    ];
    const mockMembers = [
      { id: 'editor-uuid', username: 'editor1', display_name: 'Editor Um', avatar_id: null, xp: 100, created_at: '2026-09-05T00:00:00Z' }
    ];

    const mockDb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'access_roles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockImplementation((col: string) => {
                if (col === 'role') {
                  return {
                    order: vi.fn().mockResolvedValue({ data: null, error: { message: 'column access_roles.members does not exist' } }),
                    then: (r: any) => r({ data: mockRawRoles, error: null })
                  };
                }
                return Promise.resolve({ data: mockRawRoles, error: null });
              })
            })
          };
        }
        if (table === 'members') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockMembers, error: null })
            })
          };
        }
        return {};
      })
    };

    const adminLocals = {
      user: { id: 'admin-uuid' },
      role: 'ADMIN',
      db: mockDb as any
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

    const res = await (actions.updateRole as any)({
      request: {
        formData: async () => new Map([['userId', 'user-1'], ['role', 'ADMIN']])
      },
      locals: editorLocals
    });

    expect(res.status).toBe(403);
  });
});
