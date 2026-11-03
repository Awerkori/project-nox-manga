import { describe, expect, it, vi } from 'vitest';
import {
  resolveSessionData,
  invalidateUserSession
} from '../src/lib/server/session-cache';
import { signSessionJwt } from '../src/lib/server/yugabyte-auth';
import { POST as actionPost } from '../src/routes/api/action/+server';

const TEST_SECRET = 'test-secret-at-least-32-chars-long-1234567890';
process.env.AUTH_SECRET = TEST_SECRET;

const userRoles = new Map<string, { role: string; suspended: boolean }>();
let sqlQueryCount = 0;

vi.mock('$lib/server/yugabyte', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/server/yugabyte')>();
  return {
    ...actual,
    executeYugabyteSql: vi.fn(async (sql: string, params: any[]) => {
      sqlQueryCount++;
      if (sql.includes('UPDATE public.access_roles SET suspended')) {
        const suspended = params[0];
        const targetUserId = params[1];
        const existing = userRoles.get(targetUserId) || { role: 'USER', suspended: false };
        userRoles.set(targetUserId, { ...existing, suspended });
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes('FROM members WHERE id = $1')) {
        const userId = params[0];
        const r = userRoles.get(userId) || { role: 'USER', suspended: false };
        return {
          rows: [{
            profile: { id: userId, username: userId, display_name: userId },
            role: { role: r.role, suspended: r.suspended },
            scans: [],
            unread_count: 0
          }]
        };
      }
      return { rowCount: 0, rows: [] };
    })
  };
});

describe('RBAC enforcement and immediate session cache revocation', () => {
  it('immediately revokes cached session and role state when invalidateUserSession is called', async () => {
    const userId = '11111111-2222-3333-4444-555555555555';
    const decoded = { sub: userId, email: 'editor1@nox.test', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = await signSessionJwt(decoded, TEST_SECRET);

    userRoles.set(userId, { role: 'EDITOR', suspended: false });
    const queryCountBefore = sqlQueryCount;
    const firstSession = await resolveSessionData(null, decoded, token);
    expect(firstSession.role).toBe('EDITOR');
    expect(sqlQueryCount).toBe(queryCountBefore + 1);

    // Second call with updated DB still hits memory cache before invalidation
    userRoles.set(userId, { role: 'USER', suspended: false });
    const cachedSession = await resolveSessionData(null, decoded, token);
    expect(cachedSession.role).toBe('EDITOR');
    expect(sqlQueryCount).toBe(queryCountBefore + 1); // No new DB query

    // Calling invalidateUserSession immediately revokes both sessionCache and verifiedTokens
    invalidateUserSession(userId);
    const refreshedSession = await resolveSessionData(null, decoded, token);
    expect(refreshedSession.role).toBe('USER');
    expect(sqlQueryCount).toBe(queryCountBefore + 2); // DB query executed again
  });

  it('rejects ANONYMOUS callers on /api/action with 401', async () => {
    const req = new Request('https://nox.test/api/action', {
      method: 'POST',
      body: JSON.stringify({ scope: 'member', action: 'profile', data: {} })
    });
    await expect(
      actionPost({
        request: req,
        locals: { user: null, role: null }
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
        locals: { user: { id: 'reader-1' }, role: 'USER' }
      } as any)
    ).rejects.toMatchObject({ status: 403 });

    const ownerReq = new Request('https://nox.test/api/action', {
      method: 'POST',
      body: JSON.stringify({ scope: 'owner', action: 'set_role', data: { id: 'reader-1', role: 'ADMIN' } })
    });
    await expect(
      actionPost({
        request: ownerReq,
        locals: { user: { id: 'reader-1' }, role: 'USER' }
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
        locals: { user: { id: 'editor-1' }, role: 'EDITOR' }
      } as any)
    ).rejects.toMatchObject({ status: 403 });
  });

  it('allows ADMIN on owner scope and immediately invalidates the mutated user session cache', async () => {
    const targetUserId = '99999999-8888-7777-6666-555555555555';
    const decoded = { sub: targetUserId, email: 'target99@nox.test', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = await signSessionJwt(decoded, TEST_SECRET);

    userRoles.set(targetUserId, { role: 'EDITOR', suspended: false });
    const activeSession = await resolveSessionData(null, decoded, token);
    expect(activeSession.role).toBe('EDITOR');

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
      locals: { user: { id: 'admin-1' }, role: 'ADMIN' }
    } as any);

    expect(response.status).toBe(200);

    // Next session resolution for targetUserId must re-query and see suspended=true -> role=null
    const postSuspendSession = await resolveSessionData(null, decoded, token);
    expect(postSuspendSession.role).toBeNull();
  });
});
