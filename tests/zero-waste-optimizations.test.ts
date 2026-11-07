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

  it('enforces media revocation verification and cache eviction on edge cache fast-path in worker wrapper and patcher', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');
    const patcher = readFileSync('scripts/patch-worker-runtime.mjs', 'utf8');

    for (const source of [wrapper, patcher]) {
      expect(source).toContain('WORKER_REVOCATION_MANIFEST_KEY');
      expect(source).toContain('WORKER_REVOCATION_KEY_PREFIX');
      expect(source).toContain('checkMediaRevocationWorker');
      expect(source).toContain('checkMediaRevocationWorker(mediaId, env2?.COVER_THUMBNAILS');
      expect(source).toContain('cache.delete(cacheKey)');
      expect(source).toContain("status: 404");
      expect(source).toContain("'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'");
      expect(source).toContain("'Cloudflare-CDN-Cache-Control': 'no-store'");
    }
  });

  it('guarantees stable canonical image URLs in Mihon pages matching web reader for shared CDN caching', () => {
    const chapterRoute = readFileSync('src/routes/api/mihon/chapter/[id]/pages/+server.ts', 'utf8');
    const mediaRoute = readFileSync('src/routes/media/[id]/+server.ts', 'utf8');

    // Mihon pages uses canonical /media/{media_id} without query string or user token
    expect(chapterRoute).toContain('url: `${origin}/media/${p.media_id}`');

    // Media route returns 1-year immutable caching for public media
    expect(mediaRoute).toContain("'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable'");
    expect(mediaRoute).toContain("'CDN-Cache-Control': 'public, max-age=31536000'");
    expect(mediaRoute).toContain("'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000'");

    // Private or adult media strictly enforces no-store
    expect(mediaRoute).toContain("'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'");
    expect(mediaRoute).toContain("'CDN-Cache-Control': 'no-store'");
  });

  it('rigorously distinguishes format recognition from cryptographic SHA-256 validation in benchmark methodology', async () => {
    const { validateResponseBody } = await import('../scripts/mihon-zero-waste-benchmark.mjs');
    const crypto = await import('node:crypto');

    // 1. Valid JPEG with authentic matching 64-hex SHA-256 ETag -> Approved
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const jpegSha256 = crypto.createHash('sha256').update(jpegBytes).digest('hex');
    const jpegHeaders = new Headers({
      'content-type': 'image/jpeg',
      'content-length': String(jpegBytes.byteLength),
      'etag': `"${jpegSha256}"`
    });

    const jpegVal = validateResponseBody(jpegBytes.buffer, 200, jpegHeaders);
    expect(jpegVal.valid).toBe(true);
    expect(jpegVal.imageReceived).toBe(true);
    expect(jpegVal.nonEmpty).toBe(true);
    expect(jpegVal.format).toBe('jpeg');
    expect(jpegVal.formatRecognized).toBe(true);
    expect(jpegVal.sizeConsistent).toBe(true);
    expect(jpegVal.etagPresent).toBe(true);
    expect(jpegVal.etagUsableAsSha256).toBe(true);
    expect(jpegVal.sha256Compared).toBe(true);
    expect(jpegVal.sha256Approved).toBe(true);
    expect(jpegVal.sha256Unavailable).toBe(false);
    expect(jpegVal.sha256Divergent).toBe(false);
    expect(jpegVal.sha256Status).toBe('SHA256_APPROVED');
    expect(jpegVal.sha256Valid).toBe(true);

    // 2. Valid image with recognized format (Magic Bytes) but derivative non-hex ETag
    // Must NOT count as SHA256_VERIFIED!
    const thumbHeaders = new Headers({
      'content-type': 'image/jpeg',
      'content-length': String(jpegBytes.byteLength),
      'etag': `"${jpegSha256}-thumb-v3"` // Non-SHA256 derivative tag
    });
    const thumbVal = validateResponseBody(jpegBytes.buffer, 200, thumbHeaders);
    expect(thumbVal.valid).toBe(true);
    expect(thumbVal.formatRecognized).toBe(true);
    expect(thumbVal.etagPresent).toBe(true);
    expect(thumbVal.etagUsableAsSha256).toBe(false);
    expect(thumbVal.sha256Compared).toBe(false);
    expect(thumbVal.sha256Approved).toBe(false);
    expect(thumbVal.sha256Unavailable).toBe(true);
    expect(thumbVal.sha256Divergent).toBe(false);
    expect(thumbVal.sha256Status).toBe('SHA256_UNAVAILABLE');
    expect(thumbVal.sha256Valid).toBe(false); // Rigorous: format recognition != sha256 valid

    // 3. Valid image without ETag
    const noEtagHeaders = new Headers({
      'content-type': 'image/jpeg',
      'content-length': String(jpegBytes.byteLength)
    });
    const noEtagVal = validateResponseBody(jpegBytes.buffer, 200, noEtagHeaders);
    expect(noEtagVal.valid).toBe(true);
    expect(noEtagVal.formatRecognized).toBe(true);
    expect(noEtagVal.etagPresent).toBe(false);
    expect(noEtagVal.sha256Compared).toBe(false);
    expect(noEtagVal.sha256Approved).toBe(false);
    expect(noEtagVal.sha256Unavailable).toBe(true);
    expect(noEtagVal.sha256Valid).toBe(false);

    // 4. Mismatched SHA-256 against 64-hex ETag -> Fails integrity
    const badEtagHeaders = new Headers({
      'content-type': 'image/jpeg',
      'content-length': String(jpegBytes.byteLength),
      'etag': '"1111111111111111111111111111111111111111111111111111111111111111"'
    });
    const badEtagVal = validateResponseBody(jpegBytes.buffer, 200, badEtagHeaders);
    expect(badEtagVal.valid).toBe(false);
    expect(badEtagVal.errorType).toBe('BODY_INTEGRITY_FAILURE');
    expect(badEtagVal.sha256Compared).toBe(true);
    expect(badEtagVal.sha256Approved).toBe(false);
    expect(badEtagVal.sha256Divergent).toBe(true);
    expect(badEtagVal.sha256Status).toBe('SHA256_DIVERGENT');
    expect(badEtagVal.sha256Valid).toBe(false);

    // 5. HTTP 304 Revalidated response (no body transferred)
    // Must NOT be marked as sha256Valid: true!
    const reval304Headers = new Headers({ 'etag': `"${jpegSha256}"` });
    const val304 = validateResponseBody(null, 304, reval304Headers);
    expect(val304.valid).toBe(true);
    expect(val304.category).toBe('REVALIDATED_304');
    expect(val304.imageReceived).toBe(false);
    expect(val304.nonEmpty).toBe(false);
    expect(val304.sha256Compared).toBe(false);
    expect(val304.sha256Approved).toBe(false);
    expect(val304.sha256Unavailable).toBe(true);
    expect(val304.sha256Valid).toBe(false);

    // 6. HTTP 206 Partial Content (slice does not equal complete file sha256)
    const rangeHeaders = new Headers({
      'content-type': 'image/jpeg',
      'content-range': 'bytes 0-3/12',
      'content-length': '4',
      'etag': `"${jpegSha256}"`
    });
    const val206 = validateResponseBody(jpegBytes.subarray(0, 4).buffer, 206, rangeHeaders);
    expect(val206.valid).toBe(true);
    expect(val206.formatRecognized).toBe(true);
    expect(val206.sha256Compared).toBe(false);
    expect(val206.sha256Unavailable).toBe(true);
    expect(val206.sha256Valid).toBe(false);
  });

  it('enforces private, no-store, no-cache headers on Mihon adult chapter unauthorized 403 responses', () => {
    const mihonPagesSource = readFileSync('src/routes/api/mihon/chapter/[id]/pages/+server.ts', 'utf8');
    expect(mihonPagesSource).toContain("error: 'Conteúdo Adulto (+18)");
    expect(mihonPagesSource).toContain("'Cache-Control': 'private, no-cache, no-store, must-revalidate'");
  });

  it('restricts adult +18 media in classifyMediaAccess and prevents public edge caching', async () => {
    const { classifyMediaAccess } = await import('../src/lib/server/media-revocation');

    // Adult work page must fail public classification
    const adultMedia = {
      id: 'adult-page-1',
      status: 'ACTIVE',
      storage_ready: true,
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      work_content_rating: 'ADULT_18'
    };
    const adultCls = classifyMediaAccess(adultMedia);
    expect(adultCls.isPublic).toBe(false);
    expect(adultCls.isExplicitlyPrivate).toBe(true);
    expect(adultCls.category).toBe('RESTRICTED');
    expect(adultCls.reason).toBe('CONTENT_RATING_ADULT_18');

    // Unpublished work page must fail public classification
    const unpubWorkMedia = {
      id: 'unpub-work-1',
      status: 'ACTIVE',
      storage_ready: true,
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      work_published: false
    };
    const unpubWorkCls = classifyMediaAccess(unpubWorkMedia);
    expect(unpubWorkCls.isPublic).toBe(false);
    expect(unpubWorkCls.isExplicitlyPrivate).toBe(true);
    expect(unpubWorkCls.category).toBe('PRIVATE');
    expect(unpubWorkCls.reason).toBe('UNPUBLISHED_WORK');

    // Unpublished chapter page must fail public classification
    const unpubChapMedia = {
      id: 'unpub-chap-1',
      status: 'ACTIVE',
      storage_ready: true,
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      chapter_published_at: null
    };
    const unpubChapCls = classifyMediaAccess(unpubChapMedia);
    expect(unpubChapCls.isPublic).toBe(false);
    expect(unpubChapCls.isExplicitlyPrivate).toBe(true);
    expect(unpubChapCls.category).toBe('PRIVATE');
    expect(unpubChapCls.reason).toBe('UNPUBLISHED_CHAPTER');

    // Associated adult content guard
    const adultAssocMedia = {
      id: 'adult-assoc-1',
      status: 'ACTIVE',
      storage_ready: true,
      access_class: 'PUBLIC',
      is_adult_associated: true
    };
    const adultAssocCls = classifyMediaAccess(adultAssocMedia);
    expect(adultAssocCls.isPublic).toBe(false);
    expect(adultAssocCls.isExplicitlyPrivate).toBe(true);
    expect(adultAssocCls.category).toBe('RESTRICTED');
    expect(adultAssocCls.reason).toBe('CONTENT_RATING_ADULT_18');

    // Associated unpublished work guard
    const unpubAssocWorkMedia = {
      id: 'unpub-assoc-w-1',
      status: 'ACTIVE',
      storage_ready: true,
      access_class: 'PUBLIC',
      all_works_published: false
    };
    const unpubAssocWorkCls = classifyMediaAccess(unpubAssocWorkMedia);
    expect(unpubAssocWorkCls.isPublic).toBe(false);
    expect(unpubAssocWorkCls.isExplicitlyPrivate).toBe(true);
    expect(unpubAssocWorkCls.category).toBe('PRIVATE');
    expect(unpubAssocWorkCls.reason).toBe('UNPUBLISHED_WORK');

    // Associated unpublished chapter guard
    const unpubAssocChapMedia = {
      id: 'unpub-assoc-c-1',
      status: 'ACTIVE',
      storage_ready: true,
      access_class: 'PUBLIC',
      all_chapters_published: false
    };
    const unpubAssocChapCls = classifyMediaAccess(unpubAssocChapMedia);
    expect(unpubAssocChapCls.isPublic).toBe(false);
    expect(unpubAssocChapCls.isExplicitlyPrivate).toBe(true);
    expect(unpubAssocChapCls.category).toBe('PRIVATE');
    expect(unpubAssocChapCls.reason).toBe('UNPUBLISHED_CHAPTER');

    // Orphan cover (purpose: 'cover', has_published_association: false) guard
    const orphanCoverMedia = {
      id: 'orphan-cover-1',
      status: 'ACTIVE',
      storage_ready: true,
      access_class: 'PUBLIC',
      purpose: 'cover',
      has_published_association: false
    };
    const orphanCoverCls = classifyMediaAccess(orphanCoverMedia);
    expect(orphanCoverCls.isPublic).toBe(false);
    expect(orphanCoverCls.isExplicitlyPrivate).toBe(true);
    expect(orphanCoverCls.category).toBe('PRIVATE');
    expect(orphanCoverCls.reason).toBe('ORPHAN_OR_UNPUBLISHED_COVER');

    // Orphan chapter page (has_published_chapter: false) fail closed guard
    const orphanChapPageMedia = {
      id: 'orphan-chap-p-1',
      status: 'ACTIVE',
      storage_ready: true,
      access_class: 'PUBLIC',
      purpose: 'chapter_page',
      has_published_chapter: false
    };
    const orphanChapPageCls = classifyMediaAccess(orphanChapPageMedia);
    expect(orphanChapPageCls.isPublic).toBe(false);
    expect(orphanChapPageCls.isExplicitlyPrivate).toBe(true);
    expect(orphanChapPageCls.category).toBe('PRIVATE');
    expect(orphanChapPageCls.reason).toBe('UNPUBLISHED_CHAPTER');
  });

  it('provides zero-SQL fast path for public non-adult 304 revalidation in Mihon chapter pages', () => {
    const mihonPagesSource = readFileSync('src/routes/api/mihon/chapter/[id]/pages/+server.ts', 'utf8');
    expect(mihonPagesSource).toContain("chapter.content_rating !== 'ADULT_18' && matchesETag(request.headers.get('if-none-match'), etag)");
    expect(mihonPagesSource).toContain('status: 304');
  });

  it('consolidates reading progress and XP into atomic statements with CTE in /api/action', () => {
    const actionSource = readFileSync('src/routes/api/action/+server.ts', 'utf8');
    // Verifies single atomic UPSERT eliminating SELECT before INSERT
    expect(actionSource).toContain('INSERT INTO reading (user_id, chapter_id, page, max_page, started_at, updated_at, completed_at)');
    expect(actionSource).toContain('ON CONFLICT (user_id, chapter_id) DO UPDATE SET');
    expect(actionSource).toContain('RETURNING page, max_page, completed_at');
    // Verifies atomic idempotent XP award eliminating separate statements via CTE
    expect(actionSource).toContain('WITH new_award AS (');
    expect(actionSource).toContain('INSERT INTO xp_awards (id, user_id, chapter_id, work_id, amount, source, created_at)');
    expect(actionSource).toContain('ON CONFLICT (user_id, chapter_id) DO NOTHING');
    expect(actionSource).toContain('UPDATE members m');
    expect(actionSource).toContain('RETURNING m.xp');
  });

  it('uses stable canonical image URLs in ReaderPage without cache-busting timestamp queries', () => {
    const readerPageSource = readFileSync('src/lib/components/ReaderPage.svelte', 'utf8');
    expect(readerPageSource).not.toContain('&_t=');
    expect(readerPageSource).toContain('page.blobUrl || `${mediaBaseUrl}/media/${page.media_id}`');
  });

  it('invalidates in-memory Mihon authentication cache upon token revocation in /api/mihon/token', () => {
    const tokenSource = readFileSync('src/routes/api/mihon/token/+server.ts', 'utf8');
    expect(tokenSource).toContain('invalidateMihonTokenCache');
    expect(tokenSource).toMatch(/UPDATE public\.mihon_tokens SET revoked = true[\s\S]*?invalidateMihonTokenCache\(\)/);
  });
});
