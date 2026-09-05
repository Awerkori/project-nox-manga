import { describe, expect, it, vi } from 'vitest';
import { createBridge } from '../supabase/functions/nox-public-bridge/handler';
const request = (body: unknown, token = 'test-token') =>
  new Request('https://bridge.invalid', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
describe('limited staff bridge', () => {
  for (const role of [null, 'USER'])
    it(`denies ${role} before source access`, async () => {
      const source = vi.fn();
      const handle = createBridge({ source, authorize: async () => (role ? { role, caller: {} } : null) });
      expect((await handle(request({ action: 'works' }))).status).toBe(403);
      expect(source).not.toHaveBeenCalled();
    });
  for (const action of ['members', 'authorize_staff'])
    it(`editor cannot use ${action}`, async () => {
      const source = vi.fn();
      const handle = createBridge({ source, authorize: async () => ({ role: 'EDITOR', caller: {} }) });
      expect((await handle(request({ action, id: '10000000-0000-4000-8000-000000000000' }))).status).toBe(
        403
      );
      expect(source).not.toHaveBeenCalled();
    });
  it('denies arbitrary tables, oversized bodies and malformed ids', async () => {
    const source = vi.fn();
    const handle = createBridge({ source, authorize: async () => ({ role: 'ADMIN', caller: {} }) });
    expect((await handle(request({ action: 'sql', sql: 'select * from auth.users' }))).status).toBe(400);
    expect((await handle(request({ action: 'works', extra: 'a'.repeat(5000) }))).status).toBe(413);
    expect((await handle(request({ action: 'final', id: '../raw' }))).status).toBe(400);
    expect(source).not.toHaveBeenCalled();
  });
  it('does not query artifacts until review is complete', async () => {
    const chain: any = {};
    for (const method of ['select', 'eq']) chain[method] = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const from = vi.fn(() => chain);
    const handle = createBridge({
      source: () => ({ from }),
      authorize: async () => ({ role: 'EDITOR', caller: {} })
    });
    expect(
      (await handle(request({ action: 'final', id: '10000000-0000-4000-8000-000000000000' }))).status
    ).toBe(403);
    expect(from).toHaveBeenCalledExactlyOnceWith('chapter_stages');
    expect(chain.eq).toHaveBeenCalledWith('stage', 'READY');
    expect(chain.eq).toHaveBeenCalledWith('status', 'COMPLETED');
  });
});
