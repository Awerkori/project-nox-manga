import { describe, expect, it, vi } from 'vitest';

function context(id = 'owner', fail = false) {
  const aborts: AbortSignal[] = [];
  const from = vi.fn(() => {
    const q: any = {};
    for (const name of ['select', 'not', 'is', 'eq', 'order', 'limit', 'in', 'gte']) q[name] = () => q;
    q.abortSignal = (signal: AbortSignal) => {
      aborts.push(signal);
      return Promise.resolve(fail ? { error: { message: 'timeout' }, count: null, data: null } : { count: 7, data: [], error: null });
    };
    return q;
  });
  return { locals: { user: { id }, role: 'ADMIN', db: { from } }, from, aborts };
}

describe('admin dashboard evidence and request coalescing', () => {
  it('coalesces simultaneous loads and caches a successful snapshot for the same user', async () => {
    vi.resetModules();
    const { load } = await import('../src/routes/admin/+page.server');
    const ctx = context();
    const [a, b] = await Promise.all([load(ctx as any), load(ctx as any)]);
    expect(a).toEqual(b);
    expect(a.works).toBe(7);
    expect(ctx.from).toHaveBeenCalledTimes(12);
    await load(ctx as any);
    expect(ctx.from).toHaveBeenCalledTimes(12);
    expect(ctx.aborts.every(s => s instanceof AbortSignal)).toBe(true);
    const other = context('editor');
    await load(other as any);
    expect(other.from).toHaveBeenCalledTimes(12);
  });
  it('reports unknown counts and retries after a failed snapshot instead of caching zero', async () => {
    vi.resetModules();
    const { load } = await import('../src/routes/admin/+page.server');
    const ctx = context('owner', true);
    const result = await load(ctx as any);
    expect(result.metricsUnavailable).toBe(true);
    expect(result.works).toBeNull();
    expect(result.recoveredFailures).toBeNull();
    await load(ctx as any);
    expect(ctx.from).toHaveBeenCalledTimes(24);
  });
  it('does not expose a cached staff snapshot to an unauthorized user', async () => {
    vi.resetModules();
    const { load } = await import('../src/routes/admin/+page.server');
    const ctx = context();
    await load(ctx as any);
    await expect(load({ locals: { ...ctx.locals, role: 'USER' } } as any)).rejects.toMatchObject({ status: 403 });
  });
});
