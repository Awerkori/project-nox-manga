import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchCatalog: vi.fn() }));

vi.mock('$lib/server/yugabyte', () => ({
  fetchCatalogFromYugabyte: mocks.fetchCatalog
}));

vi.mock('$lib/server/resilience', () => ({
  withTimeout: (promise: Promise<unknown>) => promise
}));

import { load } from '../src/routes/catalogo/+page.server';

describe('catalogue SSR payload', () => {
  afterEach(() => vi.clearAllMocks());

  it('does not include the full filter list in the default SSR payload', async () => {
    mocks.fetchCatalog.mockResolvedValue({ works: [{ id: 'work-1' }], total: 1 });

    const result = await load({
      locals: {},
      url: new URL('https://projectnox.org/catalogo'),
      platform: { env: { HYPERDRIVE: 'test' } },
      setHeaders: vi.fn()
    } as any);

    expect(mocks.fetchCatalog).toHaveBeenCalledOnce();
    expect(result.tags).toEqual([]);
    expect(result.works).toEqual([{ id: 'work-1' }]);
  });

  it('keeps a selected filter representable in SSR without loading every tag', async () => {
    mocks.fetchCatalog.mockResolvedValue({ works: [], total: 0 });

    const result = await load({
      locals: {},
      url: new URL('https://projectnox.org/catalogo?tag=acao'),
      platform: { env: { HYPERDRIVE: 'test' } },
      setHeaders: vi.fn()
    } as any);

    expect(result.tags).toEqual([{ id: 'selected:acao', slug: 'acao', name: 'acao', kind: 'TAG' }]);
  });
});
