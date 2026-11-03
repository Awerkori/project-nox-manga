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

const tags = [{ id: '1', name: 'Ação', slug: 'acao', kind: 'GENRE' }];
const env = { HYPERDRIVE: { connectionString: 'postgres://test/db' } };

describe('public catalog tag edge cache', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
    mock.query.mockReset();
  });

  it('serves a valid cached result on a cold isolate without a SQL query', async () => {
    const match = vi.fn().mockResolvedValue(new Response(JSON.stringify({ timestamp: Date.now(), tags })));
    vi.stubGlobal('caches', { default: { match } });
    const { fetchTagsFromYugabyte } = await import('../src/lib/server/yugabyte');
    expect(await fetchTagsFromYugabyte(env)).toEqual(tags);
    expect(match).toHaveBeenCalledTimes(1);
    expect(mock.query).not.toHaveBeenCalled();
  });

  it('falls back to SQL when an edge entry is expired and stores the result', async () => {
    vi.useFakeTimers();
    const put = vi.fn().mockResolvedValue(undefined);
    const match = vi.fn().mockResolvedValue(new Response(JSON.stringify({ timestamp: Date.now() - 300_000, tags })));
    vi.stubGlobal('caches', { default: { match, put } });
    mock.query.mockResolvedValue({ rows: tags, rowCount: 1 });
    const { fetchTagsFromYugabyte } = await import('../src/lib/server/yugabyte');
    expect(await fetchTagsFromYugabyte(env)).toEqual(tags);
    expect(mock.query).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][1].headers.get('cache-control')).toBe('public, max-age=300');
    expect(await put.mock.calls[0][1].json()).toEqual({ timestamp: Date.now(), tags });
  });

  it('keeps the original timestamp and does not extend the tag lifetime on a cache hit', async () => {
    vi.useFakeTimers();
    const timestamp = Date.now() - 299_000;
    vi.stubGlobal('caches', { default: {
      match: vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ timestamp, tags })))),
      put: vi.fn()
    } });
    mock.query.mockResolvedValue({ rows: tags, rowCount: 1 });
    const { fetchTagsFromYugabyte } = await import('../src/lib/server/yugabyte');
    expect(await fetchTagsFromYugabyte(env)).toEqual(tags);
    expect(mock.query).not.toHaveBeenCalled();
    vi.advanceTimersByTime(301_001);
    expect(await fetchTagsFromYugabyte(env)).toEqual(tags);
    expect(mock.query).toHaveBeenCalledTimes(1);
  });

  it('ignores malformed cache entries', async () => {
    vi.stubGlobal('caches', { default: {
      match: vi.fn().mockResolvedValue(new Response(JSON.stringify({ timestamp: Date.now(), tags: [{ id: '1' }] }))),
      put: vi.fn()
    } });
    mock.query.mockResolvedValue({ rows: tags, rowCount: 1 });
    const { fetchTagsFromYugabyte } = await import('../src/lib/server/yugabyte');
    expect(await fetchTagsFromYugabyte(env)).toEqual(tags);
    expect(mock.query).toHaveBeenCalledTimes(1);
  });

  it('falls back to SQL when the edge cache throws', async () => {
    vi.stubGlobal('caches', { default: { match: vi.fn().mockRejectedValue(new Error('cache unavailable')), put: vi.fn().mockRejectedValue(new Error('cache unavailable')) } });
    mock.query.mockResolvedValue({ rows: tags, rowCount: 1 });
    const { fetchTagsFromYugabyte } = await import('../src/lib/server/yugabyte');
    expect(await fetchTagsFromYugabyte(env)).toEqual(tags);
    expect(mock.query).toHaveBeenCalledTimes(1);
  });
});
