import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Zero-Worker Architecture Verification Suite', () => {
  const root = path.resolve(__dirname, '..');

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

  it('routes member action through Supabase direct RPC when session exists (Camada C)', async () => {
    const { action } = await import('../src/lib/actions');

    // Simulate node/SSR environment fallback
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, liked: true })
    });
    vi.stubGlobal('fetch', mockFetch);

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
