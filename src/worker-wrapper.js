/* eslint-disable @typescript-eslint/no-unused-expressions, @typescript-eslint/no-unused-vars, no-empty */
// src/worker.js
import { Server } from "./../.svelte-kit/output/server/index.js";
import { manifest, prerendered, base_path } from "./../.svelte-kit/cloudflare-tmp/manifest.js";
import { env } from "cloudflare:workers";

// ../../node_modules/.pnpm/worktop@0.8.0-next.18/node_modules/worktop/cache/index.mjs
async function e(e3, t2) {
  let n2 = "string" != typeof t2 && "HEAD" === t2.method;
  n2 && (t2 = new Request(t2, { method: "GET" }));
  let r3 = await e3.match(t2);
  return n2 && r3 && (r3 = new Response(null, r3)), r3;
}
function t(cache, req, res, ctx) {
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
};
var n = /* @__PURE__ */ new Set([200, 203, 204, 300, 301, 404, 405, 410, 414, 501]);
function r(res) {
  if (!n.has(res.status) || res.status >= 400) return false;
  if (res.headers.has("set-cookie")) return false;
  let cc = res.headers.get("Cache-Control") || "";
  if (cc.includes("no-store") || cc.includes("no-cache") || cc.includes("private")) return false;
  let vary = res.headers.get("vary") || "";
  if (vary && vary.toLowerCase() !== "accept-encoding") return false;
  return cc.includes("public");
}
function o(n2) {
  return async function(r3, o2) {
    let a = await e(n2, r3);
    if (a) return a;
    o2.defer(((e3) => {
      t(n2, r3, e3, o2);
    }));
  };
}

// ../../node_modules/.pnpm/worktop@0.8.0-next.18/node_modules/worktop/cfw.cache/index.mjs
var s = caches.default;
var c = t.bind(0, s);
var r2 = e.bind(0, s);
var e2 = o.bind(0, s);

// src/worker.js
var server = new Server(manifest);
var app_path = `/${manifest.appPath}`;
var immutable = `${app_path}/immutable/`;
var version_file = `${app_path}/version.json`;
var origin;
var initialized = server.init({
  // @ts-expect-error env contains environment variables and bindings
  env,
  read: async (file) => {
    const url = `${origin}/${file}`;
    const response = await /** @type {{ ASSETS: { fetch: typeof fetch } }} */
    env.ASSETS.fetch(
      url
    );
    if (!response.ok) {
      throw new Error(
        `read(...) failed: could not fetch ${url} (${response.status} ${response.statusText})`
      );
    }
    return response.body;
  }
});
const AUTHENTICATED_SESSION_COOKIE = /(?:^|[;\s])(?:nox-auth(?:-token)?|sb-[a-z0-9_-]+(?:-auth-token|-access-token|-token)?|supabase[-_]auth[-_]token|sb:token|access[-_]token|session|auth[-_]token)\s*=/i;
const PERSONALIZED_HOME_COOKIE = /(?:^|[;\s])(?:nox-age-status|nox-blur-nsfw)\s*=/i;

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
    const isAdult = /(?:^|[;\s])nox-age-status\s*=\s*ADULT/i.test(cookie);
    const isMinor = /(?:^|[;\s])nox-age-status\s*=\s*MINOR/i.test(cookie);
    const ageSeg = isAdult ? 'ADULT' : (isMinor ? 'MINOR' : 'GUEST');
    const isBlur = isMinor || !/(?:^|[;\s])nox-blur-nsfw\s*=\s*false/i.test(cookie);
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
            if (rawNum > 1000) {
              normalizedParams.set('pagina', '1001');
            } else if (rawNum > 1) {
              normalizedParams.set('pagina', String(Math.floor(rawNum)));
            }
          } else if (param === 'ordem') {
            if (val !== 'recentes') normalizedParams.set('ordem', val);
          } else if (param === 'q') {
            const cleanQ = val.trim().toLowerCase().replace(/\s+/g, ' ');
            if (cleanQ) normalizedParams.set('q', cleanQ);
          } else if (param === 'tipo' || param === 'status') {
            normalizedParams.set(param, val.trim().toUpperCase());
          } else {
            normalizedParams.set(param, val.trim());
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

// APPLICATION_ROUTE_GUARD
function isApplicationRoute(pathname, filename) {
  if (pathname === '/' || pathname === '/api' || pathname.startsWith('/api/')) return true;
  return !/\.[a-z0-9]{1,12}$/i.test(filename);
}

var worker_default = {
  async scheduled(event, env2, ctx) {
    ctx.waitUntil((async () => {
      try {
        await initialized;
        const targetUrl = (origin || 'https://projectnox.org') + '/api/internal/email-processor?limit=25';
        const token = env2?.NOX_STORAGE_BRIDGE_TOKEN || '';
        const req = new Request(targetUrl, {
          method: 'GET',
          headers: { authorization: token ? `Bearer ${token}` : '', 'x-internal-cron': 'true' }
        });
        const res = await server.respond(req, {
          platform: { env: env2, ctx, context: ctx, caches, cf: {} },
          getClientAddress() { return '127.0.0.1'; }
        });
        console.log(`[CRON_EMAIL_PROCESSOR] Status ${res.status}`);
      } catch (err) {
        console.error('[CRON_EMAIL_PROCESSOR_ERROR]', err);
      }
    })());
  },

  /**
   * @param {Request} req
   * @param {{ ASSETS: { fetch: typeof fetch } }} env
   * @param {ExecutionContext} ctx
   * @returns {Promise<Response>}
   */
  async fetch(req, env2, ctx) {
    const url = new URL(req.url);

    // 0. Bot & scanner protection: block non-essential aggressive scrapers and scanner methods
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

    // Vulnerability scanner & probe fast-path rejection: block dotfiles and common PHP/exploit scans before SSR
    const pLower = url.pathname.toLowerCase();
    const isDotfileProbe = (pLower.startsWith('/.') || pLower.includes('/.')) && !pLower.startsWith('/.well-known/');
    const isExploitProbe =
      pLower.startsWith('/wp-') ||
      pLower === '/xmlrpc.php' ||
      pLower.endsWith('.php') ||
      pLower.endsWith('.bak') ||
      pLower.endsWith('.sql') ||
      pLower.endsWith('.env') ||
      pLower.endsWith('.conf') ||
      pLower.endsWith('.ini');

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

    // 3. Media Edge Cache Fast-Path: public pages and covers served in <1ms without SvelteKit SSR
    if (url.pathname.startsWith('/media/') && (req.method === 'GET' || req.method === 'HEAD')) {
      const cache = typeof caches !== 'undefined' && caches.default;
      if (cache && !req.headers.has('authorization') && !shouldBypassSharedCache(req)) {
        const mediaId = url.pathname.slice(7);
        if (/^[0-9a-f-]{36}$/i.test(mediaId)) {
          const sizeParam = url.searchParams.get('size');
          const coverVariant = sizeParam === 'thumb' || sizeParam === 'hero' ? sizeParam : null;
          const canonicalMediaUrl = coverVariant
            ? `${url.origin}/media/${mediaId}?size=${coverVariant}&v=3`
            : `${url.origin}/media/${mediaId}`;
          const cacheKey = new Request(canonicalMediaUrl, { method: 'GET' });
          try {
            const cached = await cache.match(cacheKey);
            if (cached && cached.status === 200) {
              const headers = new Headers(cached.headers);
              headers.set('X-Media-Cache', 'EDGE-FAST-HIT');
              headers.set('Access-Control-Allow-Origin', '*');
              headers.set('Accept-Ranges', 'bytes');

              const etag = cached.headers.get('ETag');
              const ifNoneMatch = req.headers.get('if-none-match');
              if (etag && ifNoneMatch) {
                const cleanEtag = etag.trim().replace(/^W\//, '');
                const isMatch = ifNoneMatch.trim() === '*' ||
                  ifNoneMatch.split(',').some((t) => t.trim().replace(/^W\//, '') === cleanEtag);
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
                const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
                if (match) {
                  let start;
                  let end;
                  if (match[1] === '' && match[2] !== '') {
                    const suffixLen = parseInt(match[2], 10);
                    if (suffixLen === 0 || total === 0) {
                      headers.set('Content-Range', `bytes */${total}`);
                      return new Response(null, { status: 416, headers });
                    }
                    start = Math.max(0, total - suffixLen);
                    end = total - 1;
                  } else {
                    start = match[1] ? parseInt(match[1], 10) : 0;
                    end = match[2] ? parseInt(match[2], 10) : total - 1;
                  }

                  if (start >= total || start > end || total === 0) {
                    headers.set('Content-Range', `bytes */${total}`);
                    return new Response(null, { status: 416, headers });
                  }

                  const actualEnd = Math.min(end, total - 1);
                  const rangeLen = actualEnd - start + 1;
                  headers.set('Content-Range', `bytes ${start}-${actualEnd}/${total}`);
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
    }
    if (!origin) {
      if (url.hostname.includes('preview')) {
        origin = url.origin;
      } else {
        origin = 'https://projectnox.org';
      }
    }
    await initialized;
    let pragma = req.headers.get("cache-control") || "";
    const cacheBypassRequest = shouldBypassSharedCache(req);
    const sharedCacheKey = !cacheBypassRequest ? getSharedCacheKey(req) : null;
    let res = !cacheBypassRequest && !pragma.includes("no-cache") && sharedCacheKey && await r2(sharedCacheKey);
    if (res) {
      const etag = res.headers.get('etag');
      const ifNoneMatch = req.headers.get('if-none-match');
      if (etag && ifNoneMatch) {
        const cleanEtag = etag.trim().replace(/^W\//, '');
        const isMatch = ifNoneMatch.trim() === '*' ||
          ifNoneMatch.split(',').some((t) => t.trim().replace(/^W\//, '') === cleanEtag);
        if (isMatch) {
          const headers = new Headers(res.headers);
          headers.set('X-Nox-Edge-Cache', 'HIT');
          return new Response(null, { status: 304, headers });
        }
      }
      res = new Response(res.body, res);
      res.headers.set('X-Nox-Edge-Cache', 'HIT');
      return res;
    }
    let { pathname, search } = new URL(req.url);
    try {
      pathname = decodeURIComponent(pathname);
    } catch {
    }
    const stripped_pathname = pathname.replace(/\/$/, "");
    let is_static_asset = false;
    const filename = stripped_pathname.slice(base_path.length + 1);
    if (filename) {
      is_static_asset = manifest.assets.has(filename) || manifest.assets.has(filename + "/index.html") || filename in manifest._.server_assets || filename + "/index.html" in manifest._.server_assets;
    }
    let location = pathname.at(-1) === "/" ? stripped_pathname : pathname + "/";
    if (!isApplicationRoute(pathname, filename) && (is_static_asset || prerendered.has(pathname) || pathname === version_file || pathname.startsWith(immutable))) {
      res = await env2.ASSETS.fetch(req);
      if (res.status >= 400) {
        // ASSET_ERROR_NO_STORE
        res = new Response(res.body, res);
        res.headers.set('cache-control', 'no-store');
      }
    } else if (location && prerendered.has(location)) {
      if (search) location += search;
      res = new Response("", {
        status: 308,
        headers: {
          location
        }
      });
    } else {
      res = await server.respond(req, {
        platform: {
          env: env2,
          ctx,
          context: ctx,
          // deprecated in favor of ctx
          // @ts-expect-error webworker types from worktop are not compatible with Cloudflare Workers types
          caches,
          // @ts-expect-error the type is correct but ts is confused because platform.cf uses the type from index.ts while req.cf uses the type from index.d.ts
          cf: req.cf
        },
        getClientAddress() {
          return (
            /** @type {string} */
            req.headers.get("cf-connecting-ip")
          );
        }
      });
    }
    pragma = res.headers.get("cache-control") || "";
    return !cacheBypassRequest && sharedCacheKey && pragma && res.status < 400 ? c(sharedCacheKey, res, ctx) : res;
  }
};
export {
  worker_default as default
};
