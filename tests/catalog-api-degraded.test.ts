import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchCatalog, verifyAuth } = vi.hoisted(() => ({
  fetchCatalog: vi.fn(),
  verifyAuth: vi.fn()
}));
vi.mock('../src/lib/server/yugabyte', () => ({ fetchCatalogFromYugabyte: fetchCatalog }));
vi.mock('../src/lib/server/mihon', () => ({ verifyMihonAuth: verifyAuth }));

import { GET as works } from '../src/routes/api/works/+server';
import { GET as mihon } from '../src/routes/api/mihon/catalog/+server';
import { GET as v1 } from '../src/routes/api/v1/[...path]/+server';

const event = {
  url: new URL('https://projectnox.org/api/works?q=alias'),
  request: new Request('https://projectnox.org/api/works?q=alias'),
  params: { path: 'works' }, locals: {}, platform: {}
};

describe.each([['works', works], ['mihon', mihon], ['v1', v1]] as const)('%s catalog API', (_name, get) => {
  beforeEach(() => {
    fetchCatalog.mockReset();
    verifyAuth.mockResolvedValue({ authenticated: false });
  });

  it('returns an uncached error instead of a false empty result when SQL fails', async () => {
    fetchCatalog.mockResolvedValue({ works: [], total: 0, hasMore: false, isDegraded: true });
    const response = await get(event);
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toEqual({ error: 'Catálogo temporariamente indisponível' });
  });

  it('keeps successful empty results cacheable', async () => {
    fetchCatalog.mockResolvedValue({ works: [], total: 0, hasMore: false });
    const response = await get(event);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('public');
  });
});
