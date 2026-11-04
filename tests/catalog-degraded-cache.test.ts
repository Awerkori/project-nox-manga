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
});
