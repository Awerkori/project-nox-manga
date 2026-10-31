import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve('src/worker-wrapper.js');

function patchGeneratedWorker() {
  if (!fs.existsSync(target)) return;

  let content = fs.readFileSync(target, 'utf8');
  const generatedLintDisable = '/* eslint-disable @typescript-eslint/no-unused-expressions, @typescript-eslint/no-unused-vars, no-empty */\n';
  if (!content.startsWith(generatedLintDisable)) content = generatedLintDisable + content;

  // Authenticated and personalized responses must never be served from
  // Cloudflare's shared cache. This is cache exclusion only; SvelteKit still
  // performs all auth and personalization.
  if (!content.includes('PERSONALIZED_HOME_COOKIE')) {
    const workerMarker = 'var worker_default = {';
    const authCacheExclusion = `const AUTHENTICATED_SESSION_COOKIE = /(?:sb-[a-z0-9_-]+-auth-token|supabase[-_]auth[-_]token|sb:token)/i;
const PERSONALIZED_HOME_COOKIE = /(?:^|;\\s*)(?:nox-age-status|nox-blur-nsfw)=/i;

function shouldBypassSharedCache(req) {
  const cookie = req.headers.get('cookie') || '';
  if (AUTHENTICATED_SESSION_COOKIE.test(cookie) || req.headers.has('authorization')) return true;
  try {
    const url = new URL(req.url);
    if (url.pathname === '/' && PERSONALIZED_HOME_COOKIE.test(cookie)) return true;
  } catch {}
  return false;
}

var worker_default = {`;
    content = content.replace(workerMarker, authCacheExclusion);
    content = content.replace(
      'let res = !pragma.includes("no-cache") && await r2(req);',
      'const cacheBypassRequest = shouldBypassSharedCache(req);\n    let res = !cacheBypassRequest && !pragma.includes("no-cache") && await r2(req);'
    );
    content = content.replace(
      'return pragma && res.status < 400 ? c(req, res, ctx) : res;',
      'return !cacheBypassRequest && pragma && res.status < 400 ? c(req, res, ctx) : res;'
    );
  }

  if (!content.includes('pathname.startsWith(\'/_app/immutable/\')')) {
    const fetchStartMarker = 'async fetch(req, env2, ctx) {\n    if (!origin) {';
    const immutableFastPath = `async fetch(req, env2, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/_app/immutable/')) {
      return env2.ASSETS.fetch(req);
    }
    if (!origin) {`;
    content = content.replace(fetchStartMarker, immutableFastPath);
  }

  // Dynamic SvelteKit routes must not fall through to the static asset
  // binding: its 404 is a plain "Not found" and bypasses application routing.
  // Keep asset requests on the fast path while explicitly routing extensionless
  // public/API paths through SvelteKit.
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
        const targetUrl = (origin || 'https://manga.project-nox-awerkori.workers.dev') + '/api/internal/email-processor?limit=25';
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
