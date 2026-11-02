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
}
var n = /* @__PURE__ */ new Set([200, 203, 204, 300, 301, 404, 405, 410, 414, 501]);
function r(res) {
  if (!n.has(res.status)) return false;
  let cc = res.headers.get("Cache-Control") || "";
  if (cc.includes("no-store") || cc.includes("no-cache")) return false;
  return cc.includes("public") || (cc.includes("private") && (cc.includes("max-age=") || cc.includes("s-maxage=")));
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
const AUTHENTICATED_SESSION_COOKIE = /(?:sb-[a-z0-9_-]+-auth-token|supabase[-_]auth[-_]token|sb:token)/i;

function getSharedCacheKey(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;
  const cookie = req.headers.get('cookie') || '';
  if (AUTHENTICATED_SESSION_COOKIE.test(cookie) || req.headers.has('authorization')) return null;

  try {
    const url = new URL(req.url);
    const p = url.pathname;
    if (p.startsWith('/admin') || p.startsWith('/me') || p.startsWith('/perfil') || 
        p.startsWith('/biblioteca') || p.startsWith('/scan') || p.startsWith('/auth') ||
        p.startsWith('/settings') || p.startsWith('/api/internal')) {
      return null;
    }

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
        const targetUrl = (origin || 'https://manga.project-nox-awerkori.workers.dev') + '/api/internal/email-processor?limit=25';
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
    if (url.pathname.startsWith('/_app/immutable/')) {
      return env2.ASSETS.fetch(req);
    }
    if (!origin) {
      origin = new URL(req.url).origin;
    }
    await initialized;
    let pragma = req.headers.get("cache-control") || "";
    const sharedCacheKey = getSharedCacheKey(req);
    let res = sharedCacheKey && !pragma.includes("no-cache") && await r2(sharedCacheKey);
    if (res) {
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
    return sharedCacheKey && pragma && res.status < 400 ? c(sharedCacheKey, res, ctx) : res;
  }
};
export {
  worker_default as default
};
