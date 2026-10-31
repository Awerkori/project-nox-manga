import { describe, expect, it, vi } from 'vitest';
import {
  resolveSessionData,
  invalidateUserSession
} from '../src/lib/server/session-cache';
import { POST as actionPost } from '../src/routes/api/action/+server';

function createMockSessionDb(userId: string, role = 'EDITOR', suspended = false) {
  const getUser = vi.fn().mockResolvedValue({
    data: { user: { id: userId, email: `${userId}@nox.test` } },
    error: null
  });
  const from = vi.fn((table: string) => {
    const query: any = {};
    for (const method of ['select', 'eq', 'is']) query[method] = vi.fn(() => query);
    query.maybeSingle = vi.fn(async () => {
      if (table === 'members') return { data: { id: userId, username: userId, display_name: userId } };
      if (table === 'access_roles') return { data: { role, suspended } };
      return { data: null };
    });
    query.then = (resolve: any, reject: any) => {
      if (table === 'scan_members' || table === 'scans') return Promise.resolve({ data: [] }).then(resolve, reject);
      if (table === 'notifications') return Promise.resolve({ count: 0 }).then(resolve, reject);
      return Promise.resolve({ data: null }).then(resolve, reject);
    };
    return query;
  });
  return { auth: { getUser }, from } as any;
}

describe('RBAC enforcement and immediate session cache revocation', () => {
  it('immediately revokes cached session and role state when invalidateUserSession is called', async () => {
    const userId = 'user-rbac-test-1';
    const token = 'token-rbac-test-1';
    const decoded = { sub: userId, email: 'editor1@nox.test', exp: Math.floor(Date.now() / 1000) + 3600 };

    const dbInitial = createMockSessionDb(userId, 'EDITOR', false);
    const firstSession = await resolveSessionData(dbInitial, decoded, token);
    expect(firstSession.role).toBe('EDITOR');
    expect(dbInitial.auth.getUser).toHaveBeenCalledTimes(1);

    // Second call with updated DB still hits memory cache before invalidation
    const dbDemoted = createMockSessionDb(userId, 'USER', false);
    const cachedSession = await resolveSessionData(dbDemoted, decoded, token);
    expect(cachedSession.role).toBe('EDITOR');
    expect(dbDemoted.auth.getUser).toHaveBeenCalledTimes(0);

    // Calling invalidateUserSession immediately revokes both sessionCache and verifiedTokens
    invalidateUserSession(userId);
    const refreshedSession = await resolveSessionData(dbDemoted, decoded, token);
    expect(refreshedSession.role).toBe('USER');
    expect(dbDemoted.auth.getUser).toHaveBeenCalledTimes(1);
  });

  it('rejects ANONYMOUS callers on /api/action with 401', async () => {
    const req = new Request('https://nox.test/api/action', {
      method: 'POST',
      body: JSON.stringify({ scope: 'member', action: 'profile', data: {} })
    });
    await expect(
      actionPost({
        request: req,
        locals: { user: null, role: null, db: {} }
      } as any)
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rejects USER/LEITOR callers attempting editor or owner scopes on /api/action with 403', async () => {
    const editorReq = new Request('https://nox.test/api/action', {
      method: 'POST',
      body: JSON.stringify({ scope: 'editor', action: 'save_tag', data: { name: 'Ação' } })
    });
    await expect(
      actionPost({
        request: editorReq,
        locals: { user: { id: 'reader-1' }, role: 'USER', db: {} }
      } as any)
    ).rejects.toMatchObject({ status: 403 });

    const ownerReq = new Request('https://nox.test/api/action', {
      method: 'POST',
      body: JSON.stringify({ scope: 'owner', action: 'set_role', data: { id: 'reader-1', role: 'ADMIN' } })
    });
    await expect(
      actionPost({
        request: ownerReq,
        locals: { user: { id: 'reader-1' }, role: 'USER', db: {} }
      } as any)
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects EDITOR/STAFF_SITE callers attempting owner scope on /api/action with 403', async () => {
    const ownerReq = new Request('https://nox.test/api/action', {
      method: 'POST',
      body: JSON.stringify({ scope: 'owner', action: 'set_role', data: { id: 'target-user', role: 'ADMIN' } })
    });
    await expect(
      actionPost({
        request: ownerReq,
        locals: { user: { id: 'editor-1' }, role: 'EDITOR', db: {} }
      } as any)
    ).rejects.toMatchObject({ status: 403 });
  });

  it('allows ADMIN on owner scope and immediately invalidates the mutated user session cache', async () => {
    const targetUserId = 'user-to-suspend-99';
    const token = 'token-to-suspend-99';
    const decoded = { sub: targetUserId, email: 'target99@nox.test', exp: Math.floor(Date.now() / 1000) + 3600 };

    const dbActive = createMockSessionDb(targetUserId, 'EDITOR', false);
    const activeSession = await resolveSessionData(dbActive, decoded, token);
    expect(activeSession.role).toBe('EDITOR');

    const rpc = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    const ownerReq = new Request('https://nox.test/api/action', {
      method: 'POST',
      body: JSON.stringify({
        scope: 'owner',
        action: 'suspend_member',
        data: { user_id: targetUserId, suspended: true }
      })
    });

    const response = await actionPost({
      request: ownerReq,
      locals: { user: { id: 'admin-1' }, role: 'ADMIN', db: { rpc } }
    } as any);

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('owner_action', {
      p_action: 'suspend_member',
      p_data: { user_id: targetUserId, suspended: true }
    });

    // Next session resolution for targetUserId must re-query and see suspended=true -> role=null
    const dbSuspended = createMockSessionDb(targetUserId, 'EDITOR', true);
    const postSuspendSession = await resolveSessionData(dbSuspended, decoded, token);
    expect(postSuspendSession.role).toBeNull();
    expect(dbSuspended.auth.getUser).toHaveBeenCalledTimes(1);
  });
});
