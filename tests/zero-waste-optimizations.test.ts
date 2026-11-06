import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Zero Waste Cloudflare Optimizations', () => {
  it('enforces vulnerability scanner and dotfile probe rejection before SSR in worker wrapper', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');

    // Dotfile & exploit scanner fast-path
    expect(wrapper).toContain('Vulnerability scanner & probe fast-path rejection');
    expect(wrapper).toContain("pLower.startsWith('/.')");
    expect(wrapper).toContain("!pLower.startsWith('/.well-known/')");
    expect(wrapper).toContain("pLower.startsWith('/wp-')");
    expect(wrapper).toContain("pLower === '/xmlrpc.php'");
    expect(wrapper).toContain("pLower.endsWith('.php')");
    expect(wrapper).toContain("pLower.endsWith('.bak')");
    expect(wrapper).toContain("pLower.endsWith('.sql')");
    expect(wrapper).toContain("pLower.endsWith('.env')");
    expect(wrapper).toContain("pLower.endsWith('.conf')");
    expect(wrapper).toContain("pLower.endsWith('.ini')");

    // Returns immediate 404 with 24h edge cache
    expect(wrapper).toContain("status: 404");
    expect(wrapper).toContain("'Cache-Control': 'public, max-age=86400, s-maxage=86400'");
  });

  it('normalizes search queries, status, and types in shared catalog cache key', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');

    // Query normalization
    expect(wrapper).toContain("param === 'q'");
    expect(wrapper).toContain("val.trim().toLowerCase().replace(/\\s+/g, ' ')");
    expect(wrapper).toContain("param === 'tipo' || param === 'status'");
    expect(wrapper).toContain("normalizedParams.set(param, val.trim().toUpperCase())");
  });

  it('implements 304 Not Modified fast-return for shared edge cache HITs matching If-None-Match', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');

    expect(wrapper).toContain("const etag = res.headers.get('etag');");
    expect(wrapper).toContain("const ifNoneMatch = req.headers.get('if-none-match');");
    expect(wrapper).toContain("status: 304");
    expect(wrapper).toContain("headers.set('X-Nox-Edge-Cache', 'HIT');");
  });

  it('bounds stale-while-revalidate on Mihon chapter pages to 3600s', () => {
    const chapterRoute = readFileSync('src/routes/api/mihon/chapter/[id]/pages/+server.ts', 'utf8');

    expect(chapterRoute).toContain('s-maxage=3600');
    expect(chapterRoute).toContain('stale-while-revalidate=3600');
    expect(chapterRoute).toContain("chapter.content_rating === 'ADULT_18'");
    expect(chapterRoute).toContain("'private, no-cache, no-store, must-revalidate'");
  });

  it('preserves durable patching in scripts/patch-worker-runtime.mjs', () => {
    const patcher = readFileSync('scripts/patch-worker-runtime.mjs', 'utf8');

    expect(patcher).toContain('Vulnerability scanner & probe fast-path rejection');
    expect(patcher).toContain("val.trim().toLowerCase().replace(/\\s+/g, ' ')");
    expect(patcher).toContain("const etag = res.headers.get('etag');");
    expect(patcher).toContain("const ifNoneMatch = req.headers.get('if-none-match');");
  });
});
