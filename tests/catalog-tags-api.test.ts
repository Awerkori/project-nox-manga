import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchTags: vi.fn() }));

vi.mock('$lib/server/yugabyte', () => ({
  fetchTagsFromYugabyte: mocks.fetchTags
}));

import { GET } from '../src/routes/api/catalog/tags/+server';

describe('catalog filter tags endpoint', () => {
  afterEach(() => vi.clearAllMocks());

  it('uses the shared public cache contract and forwards the Worker environment', async () => {
    const tags = [{ id: 'tag-1', name: 'Ação', slug: 'acao', kind: 'GENRE' }];
    const setHeaders = vi.fn();
    mocks.fetchTags.mockResolvedValue(tags);

    const response = await GET({ platform: { env: { HYPERDRIVE: 'test' } }, setHeaders } as any);

    expect(mocks.fetchTags).toHaveBeenCalledWith({ HYPERDRIVE: 'test' });
    expect(setHeaders).toHaveBeenCalledWith({
      'cache-control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600'
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tags });
  });
});
