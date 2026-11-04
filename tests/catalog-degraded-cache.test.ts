import { describe, expect, it, vi } from 'vitest';

const fetchCatalog = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/server/yugabyte', () => ({ fetchCatalogFromYugabyte: fetchCatalog }));
import { load } from '../src/routes/catalogo/+page.server';

function request(query: string) {
  const setHeaders = vi.fn();
  return { setHeaders, event: { locals: {}, url: new URL(`https://projectnox.org/catalogo?${query}`), setHeaders, platform: {} } };
}

describe('catalog failure handling', () => {
  it('does not cache or describe an unavailable query as an empty result', async () => {
    fetchCatalog.mockResolvedValueOnce({ works: [], total: 0, hasMore: false, isDegraded: true });
    const { event, setHeaders } = request('tag=test-failure');
    const result = await load(event);
    expect(result.loadError).toBe(true);
    expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
  });

  it('keeps a successful empty filtered result cacheable', async () => {
    fetchCatalog.mockResolvedValueOnce({ works: [], total: 0, hasMore: false });
    const { event, setHeaders } = request('tag=test-empty');
    const result = await load(event);
    expect(result.loadError).toBe(false);
    expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': expect.stringContaining('public') });
  });

  it('marks a timed out query as unavailable', async () => {
    vi.useFakeTimers();
    try {
      fetchCatalog.mockReturnValueOnce(new Promise(() => {}));
      const { event, setHeaders } = request('tag=test-timeout');
      const pending = load(event);
      await vi.advanceTimersByTimeAsync(6000);
      expect((await pending).loadError).toBe(true);
      expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
    } finally { vi.useRealTimers(); }
  });

  it('does not publish stale unfiltered data to shared cache after a failure', async () => {
    vi.useFakeTimers();
    try {
      fetchCatalog.mockResolvedValueOnce({ works: [{ id: 'work' }], total: 1, hasMore: false });
      await load(request('').event);
      vi.advanceTimersByTime(301_000);
      fetchCatalog.mockResolvedValueOnce({ works: [], total: 0, hasMore: false, isDegraded: true });
      const { event, setHeaders } = request('');
      const result = await load(event);
      expect(result.works).toHaveLength(1);
      expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
    } finally { vi.useRealTimers(); }
  });

  it('stores a successful late search for another request without caching the timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const entries = new Map<string, Response>();
    const cache = {
      match: vi.fn(async (key: string) => entries.get(key)?.clone()),
      put: vi.fn(async (key: string, response: Response) => { entries.set(key, response.clone()); })
    };
    vi.stubGlobal('caches', { default: cache });
    try {
      let finish!: (value: any) => void;
      fetchCatalog.mockImplementationOnce((_options, _env, onFresh) => new Promise(resolve => {
        finish = value => { onFresh(value); resolve(value); };
      }));
      const tasks: Promise<unknown>[] = [];
      const first = request('q=late-success');
      first.event.platform = { context: { waitUntil: (task: Promise<unknown>) => tasks.push(task) } };
      const pending = load(first.event);
      while (!finish) await new Promise(resolve => setImmediate(resolve));
      await vi.advanceTimersByTimeAsync(6000);
      expect((await pending).loadError).toBe(true);
      expect(entries.size).toBe(0);
      finish({ works: [], total: 0, hasMore: false });
      await Promise.all(tasks);
      expect(entries.size).toBe(1);
      const second = request('q=late-success');
      second.event.platform = first.event.platform;
      expect((await load(second.event)).loadError).toBe(false);
      expect(fetchCatalog).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); vi.useRealTimers(); }
  });

  it('never stores a degraded search response in the edge cache', async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn() };
    vi.stubGlobal('caches', { default: cache });
    try {
      fetchCatalog.mockResolvedValueOnce({ works: [], total: 0, hasMore: false, isDegraded: true });
      const tasks: Promise<unknown>[] = [];
      const { event } = request('q=database-error');
      event.platform = { context: { waitUntil: (task: Promise<unknown>) => tasks.push(task) } };
      expect((await load(event)).loadError).toBe(true);
      await Promise.all(tasks);
      expect(cache.put).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});
