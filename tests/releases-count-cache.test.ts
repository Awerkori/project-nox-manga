import { afterEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('pg', () => ({
  Client: class {},
  Pool: class {
    on() {}
    query(...args: unknown[]) { return mock.query(...args); }
    async end() {}
  }
}));

describe('public release counts', () => {
  afterEach(() => { vi.useRealTimers(); vi.resetModules(); mock.query.mockReset(); });

  it('reuses a kind count across requests, normalizes case and refreshes after the existing TTL', async () => {
    vi.useFakeTimers();
    mock.query.mockResolvedValue({ rows: [{ count: '42' }], rowCount: 1 });
    const { fetchReleasesWorksCountFromYugabyte: count } = await import('../src/lib/server/yugabyte');
    const env = { HYPERDRIVE: { connectionString: 'postgres://test/db' } };
    expect(await count(env, 'manga')).toBe(42);
    expect(await count(env, 'MANGA')).toBe(42);
    expect(mock.query).toHaveBeenCalledTimes(1);
    expect(mock.query.mock.calls[0][1]).toEqual(['MANGA']);
    expect(await count(env, 'manhwa')).toBe(42);
    expect(mock.query).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(120_000);
    expect(await count(env, 'MANGA')).toBe(42);
    expect(mock.query).toHaveBeenCalledTimes(3);
  });

  it('does not cache failed queries or the existing empty-count fallback', async () => {
    mock.query.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 }).mockResolvedValueOnce({ rows: [{ count: '7' }], rowCount: 1 });
    const { fetchReleasesWorksCountFromYugabyte: count } = await import('../src/lib/server/yugabyte');
    const env = { HYPERDRIVE: { connectionString: 'postgres://test/db' } };
    await expect(count(env, 'MANGA')).rejects.toThrow('unavailable');
    expect(await count(env, 'MANGA')).toBe(9430);
    expect(await count(env, 'MANGA')).toBe(7);
    expect(mock.query).toHaveBeenCalledTimes(3);
  });
});
