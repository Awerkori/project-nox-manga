import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../src/worker-wrapper.js');

function patchGeneratedWorker() {
  if (!fs.existsSync(target)) return;

  let content = fs.readFileSync(target, 'utf8');
  const generatedLintDisable = '/* eslint-disable @typescript-eslint/no-unused-expressions, @typescript-eslint/no-unused-vars, no-empty */\n';
  if (!content.startsWith(generatedLintDisable)) content = generatedLintDisable + content;

  // 1. Sanitize Worktop Cache Functions for Cloudflare Cache API Compliance
  // Cloudflare Workers Cache API strictly rejects any Vary header other than Accept-Encoding,
  // forbids Set-Cookie in cached responses, and requires body teeing to avoid locked stream errors.
  const rawWorktopR = `function r(e3) {
  if (!n.has(e3.status)) return false;
  if (~(e3.headers.get("Vary") || "").indexOf("*")) return false;
  let t2 = e3.headers.get("Cache-Control") || "";
  return !/(private|no-cache|no-store)/i.test(t2);
}`;
  const sanitizedWorktopR = `function r(res) {
  if (!n.has(res.status) || res.status >= 400) return false;
  if (res.headers.has("set-cookie")) return false;
  let cc = res.headers.get("Cache-Control") || "";
  if (cc.includes("no-store") || cc.includes("no-cache") || cc.includes("private")) return false;
  let vary = res.headers.get("vary") || "";
  if (vary && vary.toLowerCase() !== "accept-encoding") return false;
  return cc.includes("public");
}`;
  if (content.includes(rawWorktopR)) {
    content = content.replace(rawWorktopR, sanitizedWorktopR);
  }

  const rawWorktopT = `function t(e3, t2, n2, o2) {
  return ("string" == typeof t2 || "GET" === t2.method) && r(n2) && (n2.headers.has("Set-Cookie") && (n2 = new Response(n2.body, n2)).headers.append("Cache-Control", "private=Set-Cookie"), o2.waitUntil(e3.put(t2, n2.clone()))), n2;
}`;
  const sanitizedWorktopT = `function t(cache, req, res, ctx) {
  if (typeof req !== 'string' && req.method !== "GET" && req.method !== "HEAD") return res;
  if (!r(res)) return res;

  const cacheHeaders = new Headers(res.headers);
  if (!cacheHeaders.has('Vary')) {
    cacheHeaders.set('Vary', 'Accept-Encoding');
  }

  let bodyForCache = null;
  let clientRes = res;
  if (res.body) {
    const [b1, b2] = res.body.tee();
    clientRes = new Response(b1, res);
    bodyForCache = b2;
  }

  const cacheResponse = new Response(bodyForCache, {
    status: res.status,
    statusText: res.statusText,
    headers: cacheHeaders
  });

  const putReq = typeof req === 'string'
    ? req
    : req.method === 'HEAD'
      ? new Request(req.url, { method: 'GET', headers: req.headers })
      : req;
  ctx.waitUntil(cache.put(putReq, cacheResponse).catch(err => console.warn('[EDGE_CACHE_PUT_WARN]', err?.message)));
  return clientRes;
};`;
  if (content.includes(rawWorktopT)) {
    content = content.replace(rawWorktopT, sanitizedWorktopT);
  }

  // 2. Shared Edge Cache Segmentation & Private Session Bypass
  const sharedCacheLogic = `const AUTHENTICATED_SESSION_COOKIE = /(?:^|[;\\s])(?:nox-auth(?:-token)?|sb-[a-z0-9_-]+(?:-auth-token|-access-token|-token)?|supabase[-_]auth[-_]token|sb:token|access[-_]token|session|auth[-_]token)\\s*=/i;
const PERSONALIZED_HOME_COOKIE = /(?:^|[;\\s])(?:nox-age-status|nox-blur-nsfw)\\s*=/i;

function shouldBypassSharedCache(req) {
  const cookie = req.headers.get('cookie') || '';
  return AUTHENTICATED_SESSION_COOKIE.test(cookie) || req.headers.has('authorization');
}

function getSharedCacheKey(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;
  if (shouldBypassSharedCache(req)) return null;

  try {
    const url = new URL(req.url);
    const p = url.pathname;
    if (p.startsWith('/media/') || p.startsWith('/_app/') || p.startsWith('/api') ||
        p.startsWith('/admin') || p.startsWith('/me') || p.startsWith('/perfil') || 
        p.startsWith('/biblioteca') || p.startsWith('/scan') || p.startsWith('/auth') ||
        p.startsWith('/settings')) {
      return null;
    }

    const cookie = req.headers.get('cookie') || '';
    const isAdult = /(?:^|[;\\s])nox-age-status\\s*=\\s*ADULT/i.test(cookie);
    const isMinor = /(?:^|[;\\s])nox-age-status\\s*=\\s*MINOR/i.test(cookie);
    const ageSeg = isAdult ? 'ADULT' : (isMinor ? 'MINOR' : 'GUEST');
    const isBlur = isMinor || !/(?:^|[;\\s])nox-blur-nsfw\\s*=\\s*false/i.test(cookie);
    const seg = ageSeg + '_' + (isBlur ? 'BLUR' : 'NOBLUR');

    const cacheUrl = new URL(req.url);
    if (p === '/catalogo') {
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
            const cleanQ = trimmed.toLowerCase().replace(/\\s+/g, ' ');
            if (cleanQ) normalizedParams.set('q', cleanQ);
          } else if (param === 'tipo' || param === 'status') {
            normalizedParams.set(param, trimmed.toUpperCase());
          } else {
            normalizedParams.set(param, trimmed);
          }
        }
      }
      cacheUrl.search = normalizedParams.toString();
    } else if (p.startsWith('/obra/')) {
      cacheUrl.search = '';
    } else if (p === '/lancamentos') {
      const rawNum = Number(url.searchParams.get('page'));
      const kind = url.searchParams.get('kind');
      const normalizedParams = new URLSearchParams();
      if (rawNum > 1000) {
        normalizedParams.set('page', '1001');
      } else if (rawNum > 1) {
        normalizedParams.set('page', String(Math.floor(rawNum)));
      }
      if (kind && kind.toUpperCase() !== 'ALL') normalizedParams.set('kind', kind.toUpperCase());
      cacheUrl.search = normalizedParams.toString();
    }

    cacheUrl.searchParams.set('__nox_cache_seg', seg);
    return new Request(cacheUrl.toString(), {
      method: 'GET',
      headers: { 'accept-encoding': req.headers.get('accept-encoding') || '' }
    });
  } catch {
    return null;
  }
}

const WORKER_REVOCATION_MANIFEST_KEY = 'media-revocation-manifest:v1';
const WORKER_REVOCATION_KEY_PREFIX = 'revoked:v1:';
const WORKER_REVOCATION_SYNC_INTERVAL_MS = 10000;

let workerRevokedMediaSet = new Set();
let workerManifestRevokedSet = new Set();
let workerLastRevocationSync = 0;
let workerManifestLoaded = false;
let workerManifestKeyPresent = false;
let workerManifestVersion = 0;

async function syncWorkerManifest(kv) {
  workerLastRevocationSync = Date.now();
  try {
    const manifest = await kv.get(WORKER_REVOCATION_MANIFEST_KEY, { type: 'json' });
    if (manifest && Array.isArray(manifest.revokedIds)) {
      const manifestVersion = Number(manifest.version) || 0;
      if (manifestVersion >= workerManifestVersion) {
        workerManifestRevokedSet = new Set(manifest.revokedIds);
        workerManifestVersion = manifestVersion;

        for (const id of workerManifestRevokedSet) {
          workerRevokedMediaSet.add(id);
        }

        const missing = Array.from(workerRevokedMediaSet).filter((id) => !workerManifestRevokedSet.has(id));
        const batch = missing.slice(0, 10);
        await Promise.allSettled(
          batch.map(async (knownId) => {
            try {
              const tombstone = await kv.get(WORKER_REVOCATION_KEY_PREFIX + knownId);
              if (!tombstone) {
                workerRevokedMediaSet.delete(knownId);
              }
            } catch {
              // Fail closed on error
            }
          })
        );
      } else {
        for (const id of manifest.revokedIds) {
          workerRevokedMediaSet.add(id);
          workerManifestRevokedSet.add(id);
        }
      }
      workerManifestLoaded = true;
      workerManifestKeyPresent = true;
      return true;
    } else if (manifest === null || manifest === undefined) {
      workerManifestRevokedSet = new Set();
      workerManifestLoaded = true;
      workerManifestKeyPresent = false;
      return true;
    } else {
      workerManifestLoaded = false;
      workerManifestKeyPresent = false;
      return false;
    }
  } catch {
    workerManifestLoaded = false;
    workerManifestKeyPresent = false;
    return false;
  }
}

async function checkMediaRevocationWorker(mediaId, kv, options) {
  if (!mediaId) return false;

  // 1. Instant in-memory check (only if caller did not explicitly request fresh sync or authoritative tombstone)
  if (!options?.checkTombstone && !options?.forceFresh && workerRevokedMediaSet.has(mediaId)) {
    return true;
  }

  // 2. If KV is absent, check known in-memory revocations first, then fall back to failClosed policy
  if (!kv) {
    if (workerRevokedMediaSet.has(mediaId)) return true;
    return Boolean(options?.failClosed);
  }

  // 3. Periodic manifest sync (request-scoped, throttled by interval)
  const now = Date.now();
  const shouldSync = options?.forceFresh || !workerManifestLoaded || (now - workerLastRevocationSync > WORKER_REVOCATION_SYNC_INTERVAL_MS);
  if (shouldSync) {
    const loaded = await syncWorkerManifest(kv);
    if (!loaded && options?.failClosed && !workerManifestLoaded) {
      return true;
    }
  }

  // 4. Authoritative tombstone check: if explicitly requested, forced fresh, manifest absent, or manifest failed to load
  const shouldCheckTombstone =
    Boolean(options?.forceFresh) ||
    Boolean(options?.checkTombstone) ||
    !workerManifestKeyPresent ||
    !workerManifestLoaded;

  if (shouldCheckTombstone) {
    try {
      const tombstone = await kv.get(WORKER_REVOCATION_KEY_PREFIX + mediaId);
      if (tombstone) {
        workerRevokedMediaSet.add(mediaId);
        return true;
      } else {
        if (workerManifestLoaded && workerManifestKeyPresent && workerManifestRevokedSet.has(mediaId)) {
          workerRevokedMediaSet.add(mediaId);
          return true;
        }
        if (workerManifestLoaded && workerManifestKeyPresent && !workerManifestRevokedSet.has(mediaId)) {
          workerRevokedMediaSet.delete(mediaId);
          return false;
        }
        if (workerManifestLoaded && !workerManifestKeyPresent) {
          workerRevokedMediaSet.delete(mediaId);
          return false;
        }
        if (workerRevokedMediaSet.has(mediaId)) {
          return true;
        }
        if (options?.failClosed) {
          return true;
        }
        return false;
      }
    } catch {
      if (options?.failClosed) return true;
    }
  }

  // 5. In-memory set check after sync
  if (workerRevokedMediaSet.has(mediaId)) return true;

  return false;
}`;

  content = content.replace(/const AUTHENTICATED_SESSION_COOKIE[\s\S]*?async function checkMediaRevocationWorker[\s\S]*?\n\}/m, sharedCacheLogic);
  if (!content.includes('getSharedCacheKey')) {
    content = content.replace('var worker_default = {', `${sharedCacheLogic}\n\nvar worker_default = {`);
  }

  if (!content.includes('!cacheBypassRequest && !pragma.includes("no-cache")')) {
    content = content.replace(
      /(?:const sharedCacheKey = getSharedCacheKey\(req\);\s*)?let res = (?:!cacheBypassRequest && )?!pragma\.includes\("no-cache"\) && await r2\((?:req|sharedCacheKey)\);/g,
      'const cacheBypassRequest = shouldBypassSharedCache(req);\n    const sharedCacheKey = !cacheBypassRequest ? getSharedCacheKey(req) : null;\n    let res = !cacheBypassRequest && !pragma.includes("no-cache") && sharedCacheKey && await r2(sharedCacheKey);'
    );
  }
  if (!content.includes('return !cacheBypassRequest && sharedCacheKey')) {
    content = content.replace(
      /return (?:!cacheBypassRequest && )?(?:sharedCacheKey && )?pragma && res\.status < 400 \? c\((?:req|sharedCacheKey), res, ctx\) : res;/g,
      'return !cacheBypassRequest && sharedCacheKey && pragma && res.status < 400 ? c(sharedCacheKey, res, ctx) : res;'
    );
  }

  const edgeCacheHitBlock = `if (res) {
      const etag = res.headers.get('etag');
      const ifNoneMatch = req.headers.get('if-none-match');
      if (etag && ifNoneMatch) {
        const cleanEtag = etag.trim().replace(/^W\\//, '');
        const isMatch = ifNoneMatch.trim() === '*' ||
          ifNoneMatch.split(',').some((t) => t.trim().replace(/^W\\//, '') === cleanEtag);
        if (isMatch) {
          const headers = new Headers(res.headers);
          headers.set('X-Nox-Edge-Cache', 'HIT');
          headers.delete('content-length');
          headers.delete('content-type');
          headers.delete('content-encoding');
          headers.delete('content-range');
          return new Response(null, { status: 304, headers });
        }
      }
      res = new Response(res.body, res);
      res.headers.set('X-Nox-Edge-Cache', 'HIT');
      return res;
    }`;

  if (!content.includes('X-Nox-Edge-Cache')) {
    content = content.replace('if (res) return res;', edgeCacheHitBlock);
  } else if (!content.includes("headers.delete('content-length');")) {
    content = content.replace(
      /if \(res\) \{\s*const etag = res\.headers\.get\('etag'\);[\s\S]*?return res;\s*\}/m,
      edgeCacheHitBlock
    );
  }

  const mediaFastPathSnippet = `    // 3. Media Edge Cache Fast-Path: public pages and covers served in <1ms without SvelteKit SSR
    if (url.pathname.startsWith('/media/') && (req.method === 'GET' || req.method === 'HEAD')) {
      const cache = typeof caches !== 'undefined' && caches.default;
      if (cache && !req.headers.has('authorization') && !shouldBypassSharedCache(req)) {
        const rawId = url.pathname.slice(7);
        const mediaId = rawId.replace(/\\/+$/, '');
        if (/^[0-9a-f-]{36}$/i.test(mediaId)) {
          const sizeParam = url.searchParams.get('size');
          const coverVariant = sizeParam === 'thumb' || sizeParam === 'hero' ? sizeParam : null;
          const canonicalMediaUrl = coverVariant
            ? \`\${url.origin}/media/\${mediaId}?size=\${coverVariant}&v=3\`
            : \`\${url.origin}/media/\${mediaId}\`;
          const cacheKey = new Request(canonicalMediaUrl, { method: 'GET' });
          try {
            const cached = await cache.match(cacheKey);
            if (cached && cached.status === 200) {
              const isRevoked = await checkMediaRevocationWorker(mediaId, env2?.COVER_THUMBNAILS, { failClosed: true });
              if (isRevoked) {
                try {
                  const deleteTasks = [
                    cache.delete(cacheKey),
                    cache.delete(new Request(req.url, { method: 'GET' })),
                    cache.delete(new Request(\`\${url.origin}/media/\${mediaId}\`, { method: 'GET' })),
                    cache.delete(new Request(\`\${url.origin}/media/\${mediaId}/\`, { method: 'GET' })),
                    cache.delete(new Request(\`\${url.origin}/media/\${mediaId}?size=thumb&v=3\`, { method: 'GET' })),
                    cache.delete(new Request(\`\${url.origin}/media/\${mediaId}?size=hero&v=3\`, { method: 'GET' })),
                    cache.delete(new Request(\`\${url.origin}/media/\${mediaId}?size=thumb&v=2\`, { method: 'GET' })),
                    cache.delete(new Request(\`\${url.origin}/media/\${mediaId}?size=hero&v=2\`, { method: 'GET' })),
                    cache.delete(new Request(\`\${url.origin}/media/\${mediaId}?size=thumb&v=1\`, { method: 'GET' })),
                    cache.delete(new Request(\`\${url.origin}/media/\${mediaId}?size=hero&v=1\`, { method: 'GET' })),
                    cache.delete(new Request(\`\${url.origin}/media/\${mediaId}?size=thumb\`, { method: 'GET' })),
                    cache.delete(new Request(\`\${url.origin}/media/\${mediaId}?size=hero\`, { method: 'GET' })),
                    cache.delete(new Request(\`\${url.origin}/media/\${mediaId}?v=3\`, { method: 'GET' })),
                    cache.delete(new Request(\`\${url.origin}/media/\${mediaId}?v=2\`, { method: 'GET' })),
                    cache.delete(new Request(\`\${url.origin}/media/\${mediaId}?v=1\`, { method: 'GET' }))
                  ];
                  if (ctx?.cache && typeof ctx.cache.purge === 'function') {
                    deleteTasks.push(ctx.cache.purge({ tags: [\`media-\${mediaId}\`], pathPrefixes: [\`/media/\${mediaId}\`] }).catch(() => {}));
                  }
                  if (env2?.COVER_THUMBNAILS && typeof env2.COVER_THUMBNAILS.delete === 'function') {
                    deleteTasks.push(
                      env2.COVER_THUMBNAILS.delete(\`cover-thumb:v1:\${mediaId}\`).catch(() => {}),
                      env2.COVER_THUMBNAILS.delete(\`cover-hero:v1:\${mediaId}\`).catch(() => {}),
                      env2.COVER_THUMBNAILS.delete(\`cover-thumb:v1:\${mediaId}:warm\`).catch(() => {}),
                      env2.COVER_THUMBNAILS.delete(\`cover-hero:v1:\${mediaId}:warm\`).catch(() => {})
                    );
                  }
                  const deletePromise = Promise.allSettled(deleteTasks);
                  if (ctx && typeof ctx.waitUntil === 'function') {
                    ctx.waitUntil(deletePromise);
                  } else {
                    await deletePromise;
                  }
                } catch {}

                return new Response(req.method === 'HEAD' ? null : JSON.stringify({ error: 'Acesso não autorizado' }), {
                  status: 404,
                  headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                    'CDN-Cache-Control': 'no-store',
                    'Cloudflare-CDN-Cache-Control': 'no-store',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                  }
                });
              }

              const headers = new Headers(cached.headers);
              headers.set('X-Media-Cache', 'EDGE-FAST-HIT');
              headers.set('Access-Control-Allow-Origin', '*');
              headers.set('Accept-Ranges', 'bytes');

              const etag = cached.headers.get('ETag');
              const ifNoneMatch = req.headers.get('if-none-match');
              if (etag && ifNoneMatch) {
                const cleanEtag = etag.trim().replace(/^W\\//, '');
                const isMatch = ifNoneMatch.trim() === '*' ||
                  ifNoneMatch.split(',').some((t) => t.trim().replace(/^W\\//, '') === cleanEtag);
                if (isMatch) {
                  return new Response(null, { status: 304, headers });
                }
              }

              const ifMatch = req.headers.get('if-match');
              if (ifMatch && ifMatch !== '*' && etag) {
                const matchEtags = ifMatch.split(',').map((s) => s.trim());
                if (!matchEtags.includes(etag.trim()) || etag.startsWith('W/')) {
                  return new Response(null, { status: 412, headers });
                }
              }

              const rangeHeader = req.headers.get('range');
              const ifRange = req.headers.get('if-range');
              let evaluateRange = Boolean(rangeHeader && req.method === 'GET');
              if (evaluateRange && ifRange) {
                // RFC 9110 §13.1.5: Strong validator comparison only. Weak ETags MUST NOT match.
                if (!etag || ifRange.trim().startsWith('W/') || ifRange.trim() !== etag.trim()) {
                  evaluateRange = false;
                }
              }

              if (evaluateRange) {
                const ab = await cached.arrayBuffer();
                const total = ab.byteLength;
                const match = rangeHeader.match(/bytes=(\\d*)-(\\d*)/);
                if (match) {
                  let start;
                  let end;
                  if (match[1] === '' && match[2] !== '') {
                    const suffixLen = parseInt(match[2], 10);
                    if (suffixLen === 0 || total === 0) {
                      headers.set('Content-Range', \`bytes */\${total}\`);
                      return new Response(null, { status: 416, headers });
                    }
                    start = Math.max(0, total - suffixLen);
                    end = total - 1;
                  } else {
                    start = match[1] ? parseInt(match[1], 10) : 0;
                    end = match[2] ? parseInt(match[2], 10) : total - 1;
                  }

                  if (start >= total || start > end || total === 0) {
                    headers.set('Content-Range', \`bytes */\${total}\`);
                    return new Response(null, { status: 416, headers });
                  }

                  const actualEnd = Math.min(end, total - 1);
                  const rangeLen = actualEnd - start + 1;
                  headers.set('Content-Range', \`bytes \${start}-\${actualEnd}/\${total}\`);
                  headers.set('Content-Length', String(rangeLen));
                  const sliced = ab.slice(start, actualEnd + 1);
                  return new Response(sliced, { status: 206, headers });
                }
              }

              if (req.method === 'HEAD') {
                return new Response(null, { status: 200, headers });
              }

              return new Response(cached.body, { status: 200, headers });
            }
          } catch {
            // Fall through to standard SvelteKit SSR pipeline
          }
        }
      }
    }

    if (url.pathname.startsWith('/_app/immutable/')) {
      return env2.ASSETS.fetch(req);
    }`;

  const fetchBodyReplacement = `// 0. Bot & scanner protection: block non-essential aggressive scrapers and scanner methods
    const ua = (req.headers.get('user-agent') || '').toLowerCase();
    const isAbusiveBot =
      ua.includes('ahrefsbot') ||
      ua.includes('claudebot') ||
      ua.includes('bytespider') ||
      ua.includes('petalbot') ||
      ua.includes('semrushbot') ||
      ua.includes('mj12bot') ||
      ua.includes('dotbot');

    if (isAbusiveBot && url.pathname !== '/robots.txt' && url.pathname !== '/favicon.ico') {
      return new Response('Access forbidden for non-essential automated crawlers.', {
        status: 403,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'X-Robots-Tag': 'noindex, nofollow'
        }
      });
    }

    if (['PUT', 'DELETE', 'PATCH', 'TRACE'].includes(req.method) && (!ua || url.pathname === '/' || url.pathname.startsWith('/catalogo') || url.pathname.startsWith('/lancamentos') || url.pathname.startsWith('/obra/'))) {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: {
          'Allow': 'GET, HEAD',
          'Cache-Control': 'public, max-age=86400',
          'Content-Type': 'text/plain; charset=utf-8'
        }
      });
    }

    // Vulnerability scanner & probe fast-path rejection: block dotfiles, encoded probes, and common PHP/exploit scans before SSR
    const pLower = url.pathname.toLowerCase();
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
      /\\.(?:bak|sql|env|conf|ini|asp|aspx|jsp)(?:$|[\\/?])/i.test(decodedPath);

    if (isDotfileProbe || isExploitProbe) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'X-Robots-Tag': 'noindex, nofollow'
        }
      });
    }

    // 1. Canonical domain enforcement: www.projectnox.org -> projectnox.org
    if (url.hostname === 'www.projectnox.org') {
      const canonicalUrl = new URL(req.url);
      canonicalUrl.hostname = 'projectnox.org';
      canonicalUrl.protocol = 'https:';
      return new Response(null, {
        status: 308,
        headers: {
          'location': canonicalUrl.toString(),
          'cache-control': 'public, max-age=86400'
        }
      });
    }

    // 2. Legacy domain transition: *.workers.dev -> projectnox.org (excluding preview workers)
    if (url.hostname.endsWith('.workers.dev') && !url.hostname.includes('preview') && !url.pathname.startsWith('/api') && !url.pathname.startsWith('/_app')) {
      const canonicalUrl = new URL(req.url);
      canonicalUrl.hostname = 'projectnox.org';
      canonicalUrl.protocol = 'https:';
      return new Response(null, {
        status: 308,
        headers: {
          'location': canonicalUrl.toString(),
          'cache-control': 'public, max-age=86400'
        }
      });
    }

${mediaFastPathSnippet}
    if (!origin) {`;

  const fetchBodyRegex = /\/\/ 0\. Bot & scanner protection[\s\S]*?if \(!origin\) \{/m;
  if (fetchBodyRegex.test(content)) {
    content = content.replace(fetchBodyRegex, fetchBodyReplacement);
  } else if (!content.includes('pathname.startsWith(\'/_app/immutable/\')')) {
    const fetchStartMarker = 'async fetch(req, env2, ctx) {\n    if (!origin) {';
    const immutableFastPath = `async fetch(req, env2, ctx) {\n    const url = new URL(req.url);\n\n    ${fetchBodyReplacement}`;
    content = content.replace(fetchStartMarker, immutableFastPath);
  } else if (!content.includes('Media Edge Cache Fast-Path')) {
    content = content.replace(
      "    if (url.pathname.startsWith('/_app/immutable/')) {\n      return env2.ASSETS.fetch(req);\n    }",
      mediaFastPathSnippet
    );
  }

  content = content.replace(
    /if \(!origin\) \{\s*origin = new URL\(req\.url\)\.origin;\s*\}/g,
    "if (!origin) {\n      if (url.hostname.includes('preview')) {\n        origin = url.origin;\n      } else {\n        origin = 'https://projectnox.org';\n      }\n    }"
  );

  // Dynamic SvelteKit routes must not fall through to the static asset binding
  if (!content.includes('APPLICATION_ROUTE_GUARD')) {
    const routeGuardMarker = 'var worker_default = {';
    const routeGuard = `// APPLICATION_ROUTE_GUARD
function isApplicationRoute(pathname, filename) {
  if (pathname === '/' || pathname === '/api' || pathname.startsWith('/api/')) return true;
  return !/\\.[a-z0-9]{1,12}$/i.test(filename);
}

var worker_default = {`;
    if (!content.includes(routeGuardMarker)) throw new Error('Worker route handler changed; inspect adapter output');
    content = content.replace(routeGuardMarker, routeGuard);
  }

  const assetRouteCondition = 'if (is_static_asset || prerendered.has(pathname) || pathname === version_file || pathname.startsWith(immutable)) {';
  if (!content.includes('!isApplicationRoute(pathname, filename)')) {
    if (!content.includes(assetRouteCondition)) throw new Error('Worker asset route condition changed; inspect adapter output');
    content = content.replace(
      assetRouteCondition,
      'if (!isApplicationRoute(pathname, filename) && (is_static_asset || prerendered.has(pathname) || pathname === version_file || pathname.startsWith(immutable))) {'
    );
  }

  // Missing immutable assets must not get the one-year cache directive.
  const assetFetch = 'res = await env2.ASSETS.fetch(req);';
  if (!content.includes('ASSET_ERROR_NO_STORE')) {
    if (!content.includes(assetFetch)) throw new Error('Worker asset handler changed; inspect adapter output');
    content = content.replace(assetFetch, `${assetFetch}
      if (res.status >= 400) {
        // ASSET_ERROR_NO_STORE
        res = new Response(res.body, res);
        res.headers.set('cache-control', 'no-store');
      }`);
  }

  const scheduledHandler = `  async scheduled(event, env2, ctx) {
    ctx.waitUntil((async () => {
      try {
        await initialized;
        const targetUrl = (origin || 'https://projectnox.org') + '/api/internal/email-processor?limit=25';
        const token = env2?.NOX_STORAGE_BRIDGE_TOKEN || '';
        const req = new Request(targetUrl, {
          method: 'GET',
          headers: { authorization: token ? \`Bearer \${token}\` : '', 'x-internal-cron': 'true' }
        });
        const res = await server.respond(req, {
          platform: { env: env2, ctx, context: ctx, caches, cf: {} },
          getClientAddress() { return '127.0.0.1'; }
        });
        console.log(\`[CRON_EMAIL_PROCESSOR] Status \${res.status}\`);
      } catch (err) {
        console.error('[CRON_EMAIL_PROCESSOR_ERROR]', err);
      }
    })());
  },`;
  if (content.includes('async scheduled(event, env, ctx) {}')) {
    content = content.replace('async scheduled(event, env, ctx) {},', scheduledHandler);
  } else if (!content.includes('async scheduled(')) {
    content = content.replace('var worker_default = {', `var worker_default = {\n${scheduledHandler}\n`);
  }

  fs.writeFileSync(target, content, 'utf8');
}

patchGeneratedWorker();
