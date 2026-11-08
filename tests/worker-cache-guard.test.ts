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

  it('enforces canonical projectnox.org domain and preserves legacy API clients with strict anti-collision headers', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');

    // 1. Canonical redirect from www.projectnox.org to projectnox.org
    expect(wrapper).toContain("url.hostname === 'www.projectnox.org'");
    expect(wrapper).toContain("canonicalUrl.hostname = 'projectnox.org'");
    // Cloudflare Workers Cache omits hostname from cache key: www redirect MUST NOT be public
    expect(wrapper).not.toMatch(/url\.hostname === 'www\.projectnox\.org'[\s\S]*?'cache-control':\s*'public/);
    expect(wrapper).toMatch(/url\.hostname === 'www\.projectnox\.org'[\s\S]*?'cache-control':\s*'private, no-cache, no-store, must-revalidate'/);
    expect(wrapper).toMatch(/url\.hostname === 'www\.projectnox\.org'[\s\S]*?'cdn-cache-control':\s*'private, no-cache, no-store, must-revalidate'/);
    expect(wrapper).toMatch(/url\.hostname === 'www\.projectnox\.org'[\s\S]*?'cloudflare-cdn-cache-control':\s*'private, no-cache, no-store, must-revalidate'/);

    // 2. Legacy workers.dev transition preserving /api/* and /_app/*
    expect(wrapper).toContain("url.hostname.endsWith('.workers.dev')");
    expect(wrapper).toContain("!url.pathname.startsWith('/api')");
    expect(wrapper).toContain("!url.pathname.startsWith('/_app')");
    expect(wrapper).not.toMatch(/url\.hostname\.endsWith\('\.workers\.dev'\)[\s\S]*?'cache-control':\s*'public/);
    expect(wrapper).toMatch(/url\.hostname\.endsWith\('\.workers\.dev'\)[\s\S]*?'cache-control':\s*'private, no-cache, no-store, must-revalidate'/);

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

  it('exempts /robots.txt and /favicon.ico from bot blocking and guards against scanner methods', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');

    expect(wrapper).toContain("url.pathname !== '/robots.txt'");
    expect(wrapper).toContain("url.pathname !== '/favicon.ico'");
    expect(wrapper).toContain("['PUT', 'DELETE', 'PATCH', 'TRACE'].includes(req.method)");
    expect(wrapper).toContain('Method Not Allowed');
  });

  it('isolates out-of-bounds catalog and lancamentos pagination to prevent cache pollution of valid pages', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');

    expect(wrapper).toContain("rawNum > 1000");
    expect(wrapper).toContain("normalizedParams.set('pagina', '1001')");
    expect(wrapper).toContain("normalizedParams.set('page', '1001')");
  });

  it('implements RFC 9110 compliant range handling for media edge fast-path (GET only, HEAD ignores Range, If-Range & If-Match supported)', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');

    expect(wrapper).toContain("rangeHeader && req.method === 'GET'");
    expect(wrapper).toContain("req.headers.get('if-match')");
    expect(wrapper).toContain("req.headers.get('if-range')");
    expect(wrapper).toContain("status: 412");
    expect(wrapper).toContain("status: 416");
    expect(wrapper).toContain("bytes */");
    expect(wrapper).toContain("status: 206");
    expect(wrapper).toContain("headers.set('Content-Length', String(rangeLen))");
    expect(wrapper).toContain("if (req.method === 'HEAD') {\n                return new Response(null, { status: 200, headers });\n              }");
  });

  it('strictly isolates MINOR age status from GUEST and ADULT in cache key segmentation', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');

    expect(wrapper).toContain("nox-age-status\\s*=\\s*MINOR");
    expect(wrapper).toContain("nox-age-status\\s*=\\s*ADULT");
    expect(wrapper).toContain("ageSeg = isAdult ? 'ADULT' : (isMinor ? 'MINOR' : 'GUEST')");
  });

  it('detects all authenticated session cookie variations including nox-auth and sb-access-token', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');
    const cookieRegexMatch = wrapper.match(/const AUTHENTICATED_SESSION_COOKIE = (\/.*?\/[a-z]*);/);
    expect(cookieRegexMatch).not.toBeNull();
    const regex = new RegExp(cookieRegexMatch![1].slice(1, cookieRegexMatch![1].lastIndexOf('/')), 'i');

    expect(regex.test('nox-auth=some_token')).toBe(true);
    expect(regex.test('nox-auth-token=some_token')).toBe(true);
    expect(regex.test('sb-access-token=some_token')).toBe(true);
    expect(regex.test('sb-izregkwaqdygwioqzwwo-auth-token=some_token')).toBe(true);
    expect(regex.test('cookie1=val; nox-auth=xyz')).toBe(true);
    expect(regex.test('cookie1=val;nox-auth=xyz')).toBe(true);
    expect(regex.test('cookie1=val ; nox-auth = xyz')).toBe(true);
    expect(regex.test('access_token=token123')).toBe(true);
    expect(regex.test('nox-auth-token.0=chunked_part_0')).toBe(true);
    expect(regex.test('sb-izregkwaqdygwioqzwwo-auth-token.1=chunked_part_1')).toBe(true);
    expect(regex.test('nox-age-status=ADULT; nox-blur-nsfw=false')).toBe(false);
  });

  it('strictly forbids caching responses with Set-Cookie, private Cache-Control, or invalid Vary', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');

    expect(wrapper).toContain('if (res.headers.has("set-cookie")) return false;');
    expect(wrapper).toContain('cc.includes("private")');
    expect(wrapper).toContain('vary.toLowerCase() !== "accept-encoding"');
    expect(wrapper).toContain('return cc.includes("public");');
  });
});


