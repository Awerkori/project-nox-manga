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

  ctx.waitUntil(cache.put(req, cacheResponse).catch(err => console.warn('[EDGE_CACHE_PUT_WARN]', err?.message)));
  return clientRes;
};`;
  if (content.includes(rawWorktopT)) {
    content = content.replace(rawWorktopT, sanitizedWorktopT);
  }

  // 2. Shared Edge Cache Segmentation & Private Session Bypass
  const sharedCacheLogic = `const AUTHENTICATED_SESSION_COOKIE = /(?:nox-auth-token|sb-[a-z0-9_-]+-auth-token|supabase[-_]auth[-_]token|sb:token)/i;
const PERSONALIZED_HOME_COOKIE = /(?:^|;\\s*)(?:nox-age-status|nox-blur-nsfw)=/i;

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
    const isAdult = /(?:^|;\\s*)nox-age-status=ADULT/i.test(cookie);
    const isMinor = /(?:^|;\\s*)nox-age-status=MINOR/i.test(cookie);
    const ageSeg = isAdult ? 'ADULT' : (isMinor ? 'MINOR' : 'GUEST');
    const isBlur = isMinor || !/(?:^|;\\s*)nox-blur-nsfw=false/i.test(cookie);
    const seg = ageSeg + '_' + (isBlur ? 'BLUR' : 'NOBLUR');

    const cacheUrl = new URL(req.url);
    if (p === '/catalogo') {
      const allowedParams = ['pagina', 'ordem', 'tipo', 'status', 'tag', 'q'];
      const normalizedParams = new URLSearchParams();
      for (const param of allowedParams) {
        const val = url.searchParams.get(param);
        if (val) {
          if (param === 'pagina') {
            const rawNum = Number(val);
            if (rawNum > 50) {
              normalizedParams.set('pagina', '51');
            } else if (rawNum > 1) {
              normalizedParams.set('pagina', String(Math.floor(rawNum)));
            }
          } else if (param === 'ordem') {
            if (val !== 'recentes') normalizedParams.set('ordem', val);
          } else {
            normalizedParams.set(param, val);
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
      if (rawNum > 50) {
        normalizedParams.set('page', '51');
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
}`;

  content = content.replace(/const AUTHENTICATED_SESSION_COOKIE[\s\S]*?function getSharedCacheKey\(req\)[\s\S]*?\n\}/m, sharedCacheLogic);
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

  if (!content.includes('X-Nox-Edge-Cache')) {
    content = content.replace(
      'if (res) return res;',
      `if (res) {
      res = new Response(res.body, res);
      res.headers.set('X-Nox-Edge-Cache', 'HIT');
      return res;
    }`
    );
  }

  const mediaFastPathSnippet = `    // 3. Media Edge Cache Fast-Path: public pages and covers served in <1ms without SvelteKit SSR
    if (url.pathname.startsWith('/media/') && (req.method === 'GET' || req.method === 'HEAD')) {
      const cache = typeof caches !== 'undefined' && caches.default;
      if (cache && !req.headers.has('authorization') && !shouldBypassSharedCache(req)) {
        const mediaId = url.pathname.slice(7);
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
              const headers = new Headers(cached.headers);
              headers.set('X-Media-Cache', 'EDGE-FAST-HIT');
              headers.set('Access-Control-Allow-Origin', '*');
              headers.set('Accept-Ranges', 'bytes');

              const etag = cached.headers.get('ETag');
              if (etag && req.headers.get('if-none-match') === etag) {
                return new Response(null, { status: 304, headers });
              }

              const rangeHeader = req.headers.get('range');
              if (rangeHeader) {
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
                  const sliced = ab.slice(start, actualEnd + 1);
                  headers.set('Content-Range', \`bytes \${start}-\${actualEnd}/\${total}\`);
                  if (req.method === 'HEAD') {
                    return new Response(null, { status: 206, headers });
                  }
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
