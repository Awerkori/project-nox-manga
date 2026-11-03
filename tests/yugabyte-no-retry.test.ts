import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ queries: 0, poolQueries: 0 }));
vi.mock('pg', () => ({
  Client: class {
    async connect() {}
    async query() { state.queries++; throw new Error('socket hang up after dispatch'); }
    async end() {}
  },
  Pool: class {
    on() {}
    async query() { state.poolQueries++; throw new Error('socket hang up after dispatch'); }
    async end() {}
  }
}));
import { executeYugabyteSql, withYugabyteReadSession } from '../src/lib/server/yugabyte';

describe('Yugabyte uncertain outcomes', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('does not replay a dispatched mutation after session socket failure', async () => {
    state.queries = 0; state.poolQueries = 0;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, rows: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    const env = { HYPERDRIVE: { connectionString: 'postgres://test/db' }, NOX_STORAGE_BRIDGE_TOKEN: 'test' };
    await expect(withYugabyteReadSession(env, e => executeYugabyteSql('UPDATE counters SET n = n + 1', [], e))).rejects.toThrow('socket hang up');
    expect(state.queries).toBe(1);
    expect(state.poolQueries).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not replay a failed pooled query through the gateway', async () => {
    state.poolQueries = 0;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, rows: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    const env = { HYPERDRIVE: { connectionString: 'postgres://test/db' }, NOX_STORAGE_BRIDGE_TOKEN: 'test' };
    await expect(executeYugabyteSql('UPDATE counters SET n = n + 1', [], env)).rejects.toThrow('socket hang up');
    expect(state.poolQueries).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('retains gateway execution when no Hyperdrive binding exists', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, rows: [{ value: 1 }], rowCount: 1 }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(executeYugabyteSql('SELECT 1', [], { NOX_STORAGE_BRIDGE_TOKEN: 'test' })).resolves.toEqual({ rows: [{ value: 1 }], rowCount: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
