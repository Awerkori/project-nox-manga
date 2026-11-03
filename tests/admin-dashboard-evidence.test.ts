import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  executeYugabyteSql: vi.fn(),
  withYugabyteReadSession: vi.fn(async (_env: any, fn: any) => fn(_env)),
  loadYsqlImporterHeartbeat: vi.fn().mockResolvedValue(null)
}));

vi.mock('$lib/server/yugabyte', () => ({
  executeYugabyteSql: mocks.executeYugabyteSql,
  withYugabyteReadSession: mocks.withYugabyteReadSession
}));

vi.mock('$lib/server/importer-snapshot', () => ({
  loadYsqlImporterHeartbeat: mocks.loadYsqlImporterHeartbeat
}));

describe('admin dashboard evidence and request coalescing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function context(id = 'owner') {
    return {
      locals: { user: { id }, role: 'ADMIN' },
      platform: { env: {} }
    };
  }

  it('coalesces simultaneous loads and caches a successful snapshot for the same user', async () => {
    vi.resetModules();
    mocks.executeYugabyteSql.mockImplementation(async (sql: string) => {
      if (sql.includes('public.works')) return { rows: [{ cnt: 7 }] };
      return { rows: [] };
    });

    const { load } = await import('../src/routes/admin/+page.server');
    const ctx = context();
    const [a, b] = await Promise.all([load(ctx as any), load(ctx as any)]);
    expect(a).toEqual(b);
    expect(a.works).toBe(7);
    const firstCallCount = mocks.executeYugabyteSql.mock.calls.length;
    await load(ctx as any);
    // Cached, no extra SQL calls
    expect(mocks.executeYugabyteSql.mock.calls.length).toBe(firstCallCount);
  });

  it('does not expose a cached staff snapshot to an unauthorized user', async () => {
    vi.resetModules();
    const { load } = await import('../src/routes/admin/+page.server');
    const ctx = context();
    await load(ctx as any);
    await expect(load({ locals: { ...ctx.locals, role: 'USER' } } as any)).rejects.toMatchObject({ status: 403 });
  });
});
