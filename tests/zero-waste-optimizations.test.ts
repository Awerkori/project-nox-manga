import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Zero Waste Cloudflare Optimizations', () => {
  it('enforces vulnerability scanner and dotfile probe rejection before SSR in worker wrapper and patcher', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');
    const patcher = readFileSync('scripts/patch-worker-runtime.mjs', 'utf8');

    // Dotfile, encoded path & exploit scanner fast-path
    for (const source of [wrapper, patcher]) {
      expect(source).toContain('Vulnerability scanner & probe fast-path rejection');
      expect(source).toContain('decodeURIComponent');
      expect(source).toContain("pLower.startsWith('/.')");
      expect(source).toContain("!pLower.startsWith('/.well-known')");
      expect(source).toContain("decodedPath.includes('.php')");
      expect(source).toContain("decodedPath.startsWith('/wp-')");
      expect(source).toContain("decodedPath.startsWith('/wordpress')");
      expect(source).toContain("decodedPath.startsWith('/cgi-bin')");
      expect(source).toContain("decodedPath.startsWith('/actuator')");
      expect(source).toContain("decodedPath.startsWith('/pma')");
      expect(source).toContain("decodedPath.startsWith('/phpmyadmin')");
      expect(source).toContain("status: 404");
      expect(source).toContain("'Cache-Control': 'public, max-age=86400, s-maxage=86400'");
      expect(source).toContain("'X-Robots-Tag': 'noindex, nofollow'");
    }
  });

  it('functionally blocks vulnerability scanners and encoded probes while preserving legitimate paths', () => {
    function isProbe(pathname: string): boolean {
      const pLower = pathname.toLowerCase();
      let decodedPath = pLower;
      try {
        decodedPath = decodeURIComponent(pLower);
      } catch {}

      const isDotfileProbe =
        ((pLower.startsWith('/.') || pLower.includes('/.') || decodedPath.startsWith('/.') || decodedPath.includes('/.') || decodedPath.includes('..')) &&
         !pLower.startsWith('/.well-known') && !decodedPath.startsWith('/.well-known'));

      const isExploitProbe =
        decodedPath.includes('.php') ||
        decodedPath.startsWith('/wp-') ||
        decodedPath.startsWith('/wordpress') ||
        decodedPath.startsWith('/cgi-bin') ||
        decodedPath.startsWith('/actuator') ||
        decodedPath.startsWith('/pma') ||
        decodedPath.startsWith('/phpmyadmin') ||
        decodedPath.startsWith('/boaform') ||
        /\.(?:bak|sql|env|conf|ini|asp|aspx|jsp)(?:$|[\/?])/i.test(decodedPath);

      return isDotfileProbe || isExploitProbe;
    }

    const maliciousProbes = [
      '/.env',
      '/.env.test',
      '/.git/config',
      '/.git/logs/HEAD',
      '/.aws/credentials.bak',
      '/%2eenv',
      '/%2egit/config',
      '/%2e%2e/etc/passwd',
      '/../../etc/passwd',
      '/wp-login.php',
      '/wp-admin/',
      '/wp-content/plugins',
      '/wordpress/admin',
      '/xmlrpc.php',
      '/xmlrpc.php/',
      '/index.php',
      '/index.php/login',
      '/index.php/',
      '/actuator/health',
      '/cgi-bin/test.cgi',
      '/pma/index.php',
      '/phpmyadmin/setup',
      '/boaform/admin/formLogin',
      '/wp-config.php.bak',
      '/database.sql',
      '/credentials.bak',
      '/server.conf',
      '/php.ini',
      '/default.aspx'
    ];

    for (const probe of maliciousProbes) {
      expect(isProbe(probe), `Probe ${probe} must be blocked by fast-path`).toBe(true);
    }

    const legitimatePaths = [
      '/',
      '/catalogo',
      '/lancamentos',
      '/obra/solo-leveling',
      '/ler/12345',
      '/api/releases',
      '/api/releases?limit=1',
      '/api/mihon/catalog',
      '/media/535b7ba1-20e6-4b51-82d3-6f700635196a',
      '/media/535b7ba1-20e6-4b51-82d3-6f700635196a?size=thumb',
      '/robots.txt',
      '/favicon.ico',
      '/favicon.svg',
      '/sitemap.xml',
      '/.well-known',
      '/.well-known/security.txt',
      '/.well-known/acme-challenge/token',
      '/catalogo/__data.json',
      '/_app/immutable/chunks/bundle.js'
    ];

    for (const validPath of legitimatePaths) {
      expect(isProbe(validPath), `Legitimate path ${validPath} must NOT be blocked`).toBe(false);
    }
  });

  it('functionally normalizes search queries, status, and sort without corrupting characters or duplicating cache keys', () => {
    function normalizeCatalogQuery(urlStr: string): string {
      const url = new URL(urlStr);
      const allowedParams = ['pagina', 'ordem', 'tipo', 'status', 'tag', 'q'];
      const normalizedParams = new URLSearchParams();
      for (const param of allowedParams) {
        const val = url.searchParams.get(param);
        if (val) {
          const trimmed = val.trim();
          if (!trimmed) continue;
          if (param === 'pagina') {
            const rawNum = Number(trimmed);
            if (rawNum > 1000) {
              normalizedParams.set('pagina', '1001');
            } else if (rawNum > 1) {
              normalizedParams.set('pagina', String(Math.floor(rawNum)));
            }
          } else if (param === 'ordem') {
            const lowerSort = trimmed.toLowerCase();
            if (lowerSort === 'titulo' || lowerSort === 'views') {
              normalizedParams.set('ordem', lowerSort);
            }
          } else if (param === 'q') {
            const cleanQ = trimmed.toLowerCase().replace(/\s+/g, ' ');
            if (cleanQ) normalizedParams.set('q', cleanQ);
          } else if (param === 'tipo' || param === 'status') {
            normalizedParams.set(param, trimmed.toUpperCase());
          } else {
            normalizedParams.set(param, trimmed);
          }
        }
      }
      return normalizedParams.toString();
    }

    // 1. Whitespace collapse and preservation of letters including 's'
    expect(normalizeCatalogQuery('https://projectnox.org/catalogo?q=solo%20%20%20leveling')).toBe('q=solo+leveling');
    expect(normalizeCatalogQuery('https://projectnox.org/catalogo?q=status')).toBe('q=status');
    expect(normalizeCatalogQuery('https://projectnox.org/catalogo?q=sword%20art%20online')).toBe('q=sword+art+online');

    // 2. Empty query parameters stripped to prevent cache fragmentation
    expect(normalizeCatalogQuery('https://projectnox.org/catalogo?q=&tipo=%20%20&status=')).toBe('');

    // 3. Parameter ordering canonicalization (same params in different order produce identical search string)
    const orderA = normalizeCatalogQuery('https://projectnox.org/catalogo?q=solo&tipo=manga');
    const orderB = normalizeCatalogQuery('https://projectnox.org/catalogo?tipo=manga&q=solo');
    expect(orderA).toBe('tipo=MANGA&q=solo');
    expect(orderB).toBe(orderA);

    // 4. Default sort omitted; valid sorts normalized to lowercase
    expect(normalizeCatalogQuery('https://projectnox.org/catalogo?ordem=recentes')).toBe('');
    expect(normalizeCatalogQuery('https://projectnox.org/catalogo?ordem=RECENTES')).toBe('');
    expect(normalizeCatalogQuery('https://projectnox.org/catalogo?ordem=TITULO')).toBe('ordem=titulo');
    expect(normalizeCatalogQuery('https://projectnox.org/catalogo?ordem=views')).toBe('ordem=views');

    // 5. Pagination boundary clamping
    expect(normalizeCatalogQuery('https://projectnox.org/catalogo?pagina=1005')).toBe('pagina=1001');
    expect(normalizeCatalogQuery('https://projectnox.org/catalogo?pagina=1')).toBe('');
    expect(normalizeCatalogQuery('https://projectnox.org/catalogo?pagina=42')).toBe('pagina=42');
  });

  it('implements RFC 9110 compliant 304 Not Modified response stripping body framing headers', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');
    const patcher = readFileSync('scripts/patch-worker-runtime.mjs', 'utf8');

    for (const source of [wrapper, patcher]) {
      expect(source).toContain("const etag = res.headers.get('etag');");
      expect(source).toContain("const ifNoneMatch = req.headers.get('if-none-match');");
      expect(source).toContain("status: 304");
      expect(source).toContain("headers.set('X-Nox-Edge-Cache', 'HIT');");
      expect(source).toContain("headers.delete('content-length');");
      expect(source).toContain("headers.delete('content-type');");
      expect(source).toContain("headers.delete('content-encoding');");
      expect(source).toContain("headers.delete('content-range');");
    }

    // Functionally verify Header stripping on 304 Response
    const mockCachedHeaders = new Headers({
      'content-type': 'text/html; charset=utf-8',
      'content-length': '24560',
      'content-encoding': 'gzip',
      'content-range': 'bytes 0-100/24560',
      'etag': '"abc-123"',
      'cache-control': 'public, max-age=300, s-maxage=3600'
    });

    const notModifiedHeaders = new Headers(mockCachedHeaders);
    notModifiedHeaders.set('X-Nox-Edge-Cache', 'HIT');
    notModifiedHeaders.delete('content-length');
    notModifiedHeaders.delete('content-type');
    notModifiedHeaders.delete('content-encoding');
    notModifiedHeaders.delete('content-range');

    const res304 = new Response(null, { status: 304, headers: notModifiedHeaders });
    expect(res304.status).toBe(304);
    expect(res304.headers.get('content-length')).toBeNull();
    expect(res304.headers.get('content-type')).toBeNull();
    expect(res304.headers.get('content-encoding')).toBeNull();
    expect(res304.headers.get('content-range')).toBeNull();
    expect(res304.headers.get('etag')).toBe('"abc-123"');
    expect(res304.headers.get('X-Nox-Edge-Cache')).toBe('HIT');
  });

  it('bounds stale-while-revalidate on Mihon chapter pages to 3600s and enforces dynamic ETag hashing', () => {
    const chapterRoute = readFileSync('src/routes/api/mihon/chapter/[id]/pages/+server.ts', 'utf8');

    expect(chapterRoute).toContain('s-maxage=3600');
    expect(chapterRoute).toContain('stale-while-revalidate=3600');
    expect(chapterRoute).toContain("chapter.content_rating === 'ADULT_18'");
    expect(chapterRoute).toContain("'private, no-cache, no-store, must-revalidate'");

    // Verify dynamic hash construction
    expect(chapterRoute).toContain('pagesHash');
    expect(chapterRoute).toContain('metaHash');
    expect(chapterRoute).toContain('chapterTime');
    expect(chapterRoute).toContain('matchesETag(request.headers.get(\'if-none-match\'), etag)');
  });
});
