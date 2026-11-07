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

  const putReq = typeof req === 'string'
    ? req
    : req.method === 'HEAD'
      ? new Request(req.url, { method: 'GET', headers: req.headers })
      : req;
  ctx.waitUntil(cache.put(putReq, cacheResponse).catch(err => console.warn('[EDGE_CACHE_PUT_WARN]', err?.message)));
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
let workerLastRevocationSync = 0;
let workerManifestLoaded = false;

async function syncWorkerManifest(kv) {
  workerLastRevocationSync = Date.now();
  try {
    const manifest = await kv.get(WORKER_REVOCATION_MANIFEST_KEY, { type: 'json' });
    if (manifest && Array.isArray(manifest.revokedIds)) {
      workerManifestLoaded = true;
      const newSet = new Set(manifest.revokedIds);
      for (const knownId of workerRevokedMediaSet) {
        if (!newSet.has(knownId)) {
          try {
            const tombstone = await kv.get(WORKER_REVOCATION_KEY_PREFIX + knownId);
            if (tombstone) {
              newSet.add(knownId);
            }
          } catch {
            // Fail closed on KV error: preserve known revocation
            newSet.add(knownId);
          }
        }
      }
      workerRevokedMediaSet = newSet;
      return true;
    } else {
      workerManifestLoaded = false;
      return false;
    }
  } catch {
    workerManifestLoaded = false;
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

  // 3. Authoritative tombstone check: if explicitly requested
  if (options?.checkTombstone) {
    try {
      const tombstone = await kv.get(WORKER_REVOCATION_KEY_PREFIX + mediaId);
      if (tombstone) {
        workerRevokedMediaSet.add(mediaId);
        return true;
      } else {
        if (workerRevokedMediaSet.has(mediaId)) {
          return true;
        }
        return false;
      }
    } catch {
      if (options?.failClosed) return true;
    }
  }

  // 4. Periodic manifest sync (request-scoped, throttled by interval)
  const now = Date.now();
  const shouldSync = options?.forceFresh || !workerManifestLoaded || (now - workerLastRevocationSync > WORKER_REVOCATION_SYNC_INTERVAL_MS);
  if (shouldSync) {
    await syncWorkerManifest(kv);
  }

  // 5. In-memory set check after sync
  if (workerRevokedMediaSet.has(mediaId)) return true;

  // 6. Fallback tombstone check if manifest failed to load reliably from KV
  if (!workerManifestLoaded) {
    try {
      const tombstone = await kv.get(WORKER_REVOCATION_KEY_PREFIX + mediaId);
      if (tombstone) {
        workerRevokedMediaSet.add(mediaId);
        return true;
      }
    } catch {
      if (options?.failClosed) return true;
    }
  }

  return false;
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
      /\.(?:bak|sql|env|conf|ini|asp|aspx|jsp)(?:$|[\/?])/i.test(decodedPath);

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
        const rawId = url.pathname.slice(7);
        const mediaId = rawId.replace(/\/+$/, '');
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
              const isRevoked = await checkMediaRevocationWorker(mediaId, env2?.COVER_THUMBNAILS, { failClosed: true });
              if (isRevoked) {
                try {
                  const deleteTasks = [
                    cache.delete(cacheKey),
                    cache.delete(new Request(req.url, { method: 'GET' })),
                    cache.delete(new Request(`${url.origin}/media/${mediaId}`, { method: 'GET' })),
                    cache.delete(new Request(`${url.origin}/media/${mediaId}/`, { method: 'GET' })),
                    cache.delete(new Request(`${url.origin}/media/${mediaId}?size=thumb&v=3`, { method: 'GET' })),
                    cache.delete(new Request(`${url.origin}/media/${mediaId}?size=hero&v=3`, { method: 'GET' })),
                    cache.delete(new Request(`${url.origin}/media/${mediaId}?size=thumb&v=2`, { method: 'GET' })),
                    cache.delete(new Request(`${url.origin}/media/${mediaId}?size=hero&v=2`, { method: 'GET' })),
                    cache.delete(new Request(`${url.origin}/media/${mediaId}?size=thumb&v=1`, { method: 'GET' })),
                    cache.delete(new Request(`${url.origin}/media/${mediaId}?size=hero&v=1`, { method: 'GET' })),
                    cache.delete(new Request(`${url.origin}/media/${mediaId}?size=thumb`, { method: 'GET' })),
                    cache.delete(new Request(`${url.origin}/media/${mediaId}?size=hero`, { method: 'GET' })),
                    cache.delete(new Request(`${url.origin}/media/${mediaId}?v=3`, { method: 'GET' })),
                    cache.delete(new Request(`${url.origin}/media/${mediaId}?v=2`, { method: 'GET' })),
                    cache.delete(new Request(`${url.origin}/media/${mediaId}?v=1`, { method: 'GET' }))
                  ];
                  if (ctx?.cache && typeof ctx.cache.purge === 'function') {
                    deleteTasks.push(ctx.cache.purge({ tags: [`media-${mediaId}`], pathPrefixes: [`/media/${mediaId}`] }).catch(() => {}));
                  }
                  if (env2?.COVER_THUMBNAILS && typeof env2.COVER_THUMBNAILS.delete === 'function') {
                    deleteTasks.push(
                      env2.COVER_THUMBNAILS.delete(`cover-thumb:v1:${mediaId}`).catch(() => {}),
                      env2.COVER_THUMBNAILS.delete(`cover-hero:v1:${mediaId}`).catch(() => {}),
                      env2.COVER_THUMBNAILS.delete(`cover-thumb:v1:${mediaId}:warm`).catch(() => {}),
                      env2.COVER_THUMBNAILS.delete(`cover-hero:v1:${mediaId}:warm`).catch(() => {})
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
