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
  let cc = res.headers.get("Cache-Control") || "";
  if (cc.includes("no-store") || cc.includes("no-cache")) return false;
  return cc.includes("public") || (cc.includes("private") && (cc.includes("max-age=") || cc.includes("s-maxage=")));
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
  cacheHeaders.delete('set-cookie');
  cacheHeaders.delete('vary');
  cacheHeaders.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');

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
}`;
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
    const isAdult = /(?:^|;\s*)nox-age-status=ADULT/i.test(cookie);
    const isBlur = !/(?:^|;\s*)nox-blur-nsfw=false/i.test(cookie);
    const seg = isAdult ? (isBlur ? 'ADULT_BLUR' : 'ADULT_NOBLUR') : (isBlur ? 'SAFE_BLUR' : 'SAFE_NOBLUR');

    const cacheUrl = new URL(req.url);
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
              const etag = cached.headers.get('ETag');
              if (etag && req.headers.get('if-none-match') === etag) {
                const notModified = new Response(null, { status: 304, headers: cached.headers });
                notModified.headers.set('X-Media-Cache', 'EDGE-FAST-HIT');
                return notModified;
              }
              const fastRes = new Response(cached.body, cached);
              fastRes.headers.set('X-Media-Cache', 'EDGE-FAST-HIT');
              return fastRes;
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

  if (!content.includes('pathname.startsWith(\'/_app/immutable/\')')) {
    const fetchStartMarker = 'async fetch(req, env2, ctx) {\n    if (!origin) {';
    const immutableFastPath = `async fetch(req, env2, ctx) {
    const url = new URL(req.url);

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
