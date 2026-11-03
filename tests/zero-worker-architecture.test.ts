import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const mockRpc = vi.fn();
const mockGetSession = vi.fn();

vi.mock('$lib/supabase', () => ({
  getSupabaseBrowserClient: () => ({
    auth: { getSession: () => mockGetSession() },
    rpc: (...args: any[]) => mockRpc(...args)
  })
}));

describe('Zero-Worker Architecture Verification Suite', () => {
  const root = path.resolve(__dirname, '..');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enforces canonical www to apex 308 redirect in worker runtime patch', () => {
    const patchScript = path.join(root, 'scripts/patch-worker-runtime.mjs');
    expect(fs.existsSync(patchScript)).toBe(true);

    const content = fs.readFileSync(patchScript, 'utf8');
    expect(content).toContain("url.hostname === 'www.projectnox.org'");
    expect(content).toContain("canonicalUrl.hostname = 'projectnox.org'");
    expect(content).toContain('status: 308');
  });

  it('enforces prerender = true on institutional static pages (Camada A)', async () => {
    const sobreTs = path.join(root, 'src/routes/sobre/+page.ts');
    const privacidadeTs = path.join(root, 'src/routes/privacidade/+page.ts');

    expect(fs.existsSync(sobreTs)).toBe(true);
    expect(fs.existsSync(privacidadeTs)).toBe(true);

    const sobreModule = await import('../src/routes/sobre/+page.ts');
    const privacidadeModule = await import('../src/routes/privacidade/+page.ts');

    expect(sobreModule.prerender).toBe(true);
    expect(privacidadeModule.prerender).toBe(true);
  });

  it('enforces static robots.txt without redundant worker route', () => {
    const staticRobots = path.join(root, 'static/robots.txt');
    const workerRoute = path.join(root, 'src/routes/robots.txt/+server.ts');

    expect(fs.existsSync(staticRobots)).toBe(true);
    expect(fs.existsSync(workerRoute)).toBe(false);

    const content = fs.readFileSync(staticRobots, 'utf8');
    expect(content).toContain('Sitemap: https://projectnox.org/sitemap.xml');
  });

  it('enforces cron schedule reduction in wrangler.jsonc (eliminates 264 daily worker pings)', () => {
    const wranglerPath = path.join(root, 'wrangler.jsonc');
    const wranglerConfig = JSON.parse(fs.readFileSync(wranglerPath, 'utf8'));

    expect(wranglerConfig.triggers?.crons).toEqual(['0 * * * *']);
  });

  it('routes member action through Supabase direct RPC when session exists in browser (Camada C)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, liked: true },
      error: null
    });
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'test-user-id' } } }
    });

    vi.stubGlobal('window', {});
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const { action } = await import('../src/lib/actions');
    const result = await action('member', 'like', { work_id: 'test-work' });
    expect(result).toEqual({ ok: true, liked: true });
    expect(mockRpc).toHaveBeenCalledWith('member_action', {
      p_action: 'like',
      p_data: { work_id: 'test-work' }
    });
    expect(mockFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('falls back to /api/action when direct RPC fails or in non-browser environment (Camada C)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, fallback: true })
    });
    vi.stubGlobal('fetch', mockFetch);

    const { action } = await import('../src/lib/actions');
    const result = await action('member', 'like', { work_id: 'test-work' });
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/action',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ scope: 'member', action: 'like', data: { work_id: 'test-work' } })
      })
    );
    vi.unstubAllGlobals();
  });

  it('includes aggressive edge cache headers for prerendered institutional pages in _headers', () => {
    const headersFile = path.join(root, '_headers');
    const content = fs.readFileSync(headersFile, 'utf8');

    expect(content).toContain('/sobre');
    expect(content).toContain('/privacidade');
    expect(content).toContain('max-age=86400');
  });

  it('includes proper edge cache directives on Mihon catalog and chapter endpoints', async () => {
    const mihonCatalogFile = path.join(root, 'src/routes/api/mihon/catalog/+server.ts');
    const mihonChapterFile = path.join(root, 'src/routes/api/mihon/chapter/[id]/pages/+server.ts');
    const mihonWorkFile = path.join(root, 'src/routes/api/mihon/work/[slug]/+server.ts');

    const catContent = fs.readFileSync(mihonCatalogFile, 'utf8');
    const chContent = fs.readFileSync(mihonChapterFile, 'utf8');
    const workContent = fs.readFileSync(mihonWorkFile, 'utf8');

    expect(catContent).toContain('s-maxage=300');
    expect(chContent).toContain('s-maxage=3600');
    expect(workContent).toContain('s-maxage=300');
  });
});
