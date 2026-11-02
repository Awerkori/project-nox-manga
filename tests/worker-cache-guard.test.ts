import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('shared Worker cache guard', () => {
  it('bypasses shared cache for authenticated and personalized Home requests', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');

    expect(wrapper).toContain('PERSONALIZED_HOME_COOKIE');
    expect(wrapper).toContain('nox-age-status|nox-blur-nsfw');
    expect(wrapper).toContain('shouldBypassSharedCache(req)');
    expect(wrapper).toContain('!cacheBypassRequest && !pragma.includes("no-cache")');
  });

  it('enforces canonical projectnox.org domain and preserves legacy API clients', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');

    // 1. Canonical redirect from www.projectnox.org to projectnox.org
    expect(wrapper).toContain("url.hostname === 'www.projectnox.org'");
    expect(wrapper).toContain("canonicalUrl.hostname = 'projectnox.org'");

    // 2. Legacy workers.dev transition preserving /api/* and /_app/*
    expect(wrapper).toContain("url.hostname.endsWith('.workers.dev')");
    expect(wrapper).toContain("!url.pathname.startsWith('/api')");
    expect(wrapper).toContain("!url.pathname.startsWith('/_app')");

    // 3. Fallback origin set to projectnox.org
    expect(wrapper).toContain("origin = 'https://projectnox.org'");
  });

  it('provides media edge cache fast-path and excludes media from HTML age-segmentation', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');

    // Media edge cache fast-path
    expect(wrapper).toContain('Media Edge Cache Fast-Path');
    expect(wrapper).toContain("url.pathname.startsWith('/media/')");
    expect(wrapper).toContain('EDGE-FAST-HIT');

    // Media and assets excluded from shared HTML segment cache key
    expect(wrapper).toContain("p.startsWith('/media/')");
  });

  it('configures wrangler with run_worker_first false and projectnox.org custom domains', () => {
    const wrangler = readFileSync('wrangler.jsonc', 'utf8');

    expect(wrangler).toContain('"run_worker_first": false');
    expect(wrangler).toContain('"pattern": "projectnox.org"');
    expect(wrangler).toContain('"pattern": "www.projectnox.org"');
    expect(wrangler).toContain('"custom_domain": true');
  });
});

