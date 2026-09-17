import { describe, expect, it, vi, beforeEach } from 'vitest';

const { queries, state } = vi.hoisted(() => {
  return {
    queries: [] as string[],
    state: { forceFail: false }
  };
});

vi.mock('@libsql/client/web', () => ({
  createClient: () => ({
    execute: vi.fn(),
    batch: vi.fn(),
  })
}));

vi.mock('$lib/server/db', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    safeQuery: vi.fn(async (query: any) => {
      if (query && query.toSQL) {
        queries.push(query.toSQL().sql);
      }
      if (state.forceFail) {
        return { error: { message: 'timeout' }, data: null };
      }
      return { error: null, data: [{ count: 7 }] };
    })
  };
});

function context(id = 'owner', role = 'ADMIN') {
  return { locals: { user: { id }, role } };
}

describe('admin dashboard evidence and request coalescing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queries.length = 0;
    state.forceFail = false;
  });

  it('coalesces simultaneous loads and caches a successful snapshot for the same user', async () => {
    vi.resetModules();
    const { load } = await import('../src/routes/admin/+page.server');
    const ctx = context();
    const [a, b] = await Promise.all([load(ctx as any), load(ctx as any)]);
    
    expect(a).toEqual(b);
    expect(a.works).toBe(7);
    expect(queries.length).toBe(12);
    
    // Assert against Drizzle query's generated SQL
    expect(queries.some(q => q.includes('select count(*) from "works"'))).toBe(true);
    expect(queries.some(q => q.includes('select count(*) from "chapters"'))).toBe(true);
    expect(queries.some(q => q.includes('select count(*) from "tags"'))).toBe(true);

    await load(ctx as any);
    // Cached snapshot hit, queries length should remain 12
    expect(queries.length).toBe(12);

    const other = context('editor', 'EDITOR');
    await load(other as any);
    // Different key, no cache hit
    expect(queries.length).toBe(24);
  });

  it('reports unknown counts and retries after a failed snapshot instead of caching zero', async () => {
    vi.resetModules();
    const { load } = await import('../src/routes/admin/+page.server');
    const ctx = context('owner');
    state.forceFail = true;
    
    const result = await load(ctx as any);
    expect(result.metricsUnavailable).toBe(true);
    expect(result.works).toBeNull();
    expect(result.recoveredFailures).toBeNull();
    expect(queries.length).toBe(12);
    
    await load(ctx as any);
    // Failed snapshot not cached, retries again
    expect(queries.length).toBe(24);
  });

  it('does not expose a cached staff snapshot to an unauthorized user', async () => {
    vi.resetModules();
    const { load } = await import('../src/routes/admin/+page.server');
    const ctx = context();
    await load(ctx as any);
    
    const unauthorizedCtx = context('owner', 'USER');
    await expect(load(unauthorizedCtx as any)).rejects.toMatchObject({ status: 403 });
  });
});
