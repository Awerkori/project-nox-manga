import { describe, expect, it, vi } from 'vitest';
import { load as catalogLoad } from '../src/routes/catalogo/+page.server';
import { load as lancamentosLoad } from '../src/routes/lancamentos/+page.server';
import { GET as releasesGet } from '../src/routes/api/releases/+server';

describe('Cloudflare Ultra Omega Optimization Contracts', () => {
  it('catalog out-of-bounds normalizes to canonical page 1001 with 1h public cache', async () => {
    const setHeaders = vi.fn();
    const result = await catalogLoad({
      locals: {},
      url: new URL('https://projectnox.org/catalogo?pagina=1500'),
      setHeaders,
      platform: {}
    });

    expect(result.page).toBe(1001);
    expect(result.works).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(setHeaders).toHaveBeenCalledWith({
      'cache-control': 'public, max-age=3600, s-maxage=3600'
    });
  });

  it('lancamentos out-of-bounds normalizes to canonical page 1001 with 1h public cache without querying DB', async () => {
    const setHeaders = vi.fn();
    const result = await lancamentosLoad({
      url: new URL('https://projectnox.org/lancamentos?page=1500'),
      platform: {},
      setHeaders
    });

    expect(result.currentPage).toBe(1001);
    expect(result.releases).toEqual([]);
    expect(result.totalPages).toBe(761);
    expect(result.loadError).toBe(false);
    expect(setHeaders).toHaveBeenCalledWith({
      'cache-control': 'public, max-age=3600, s-maxage=3600'
    });
  });

  it('importer releases health probe uses 300s TTL and edge directives', async () => {
    const setHeaders = vi.fn();
    const res = await releasesGet({
      url: new URL('https://projectnox.org/api/releases?limit=1'),
      platform: {},
      setHeaders
    });

    expect(res.status).toBe(200);
    expect(setHeaders).toHaveBeenCalledWith({
      'cache-control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600'
    });
  });
});
