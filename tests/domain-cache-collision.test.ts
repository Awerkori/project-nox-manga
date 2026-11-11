import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * PROJECT NOX — TESTE REPRODUZÍVEL DE RISCO DE COLISÃO DE CACHE ENTRE DOMÍNIOS (APEX vs WWW)
 * E PRIVACIDADE DE CACHE PRÉ-WORKER (HTML & APIs JSON)
 *
 * Fundamentação técnica da Cloudflare:
 * 1. Com `cache.enabled = true`, o Cloudflare Workers Cache gera chaves de cache zoneless baseadas em
 *    (entrypoint, pathname, querystring, versão, ctx.props). O HOSTNAME NÃO FAZ PARTE DA CHAVE DE CACHE.
 * 2. `projectnox.org` e `www.projectnox.org` utilizam o mesmo Worker `manga`.
 * 3. Se `www.projectnox.org` responder com 308 e `Cache-Control: public`, a entrada é armazenada sob a chave ('/').
 * 4. Uma requisição subsequente a `projectnox.org/` recebe o HIT 308 apontando para si mesma -> ERR_TOO_MANY_REDIRECTS.
 * 5. A solução definitiva exige `Cache-Control: private, no-cache, no-store, must-revalidate`,
 *    `CDN-Cache-Control: private, no-cache, no-store, must-revalidate` e
 *    `Cloudflare-CDN-Cache-Control: private, no-cache, no-store, must-revalidate`.
 */

describe('Cross-Domain Cache Collision & Pre-Worker Privacy Verification', () => {
  const workerWrapper = readFileSync('src/worker-wrapper.js', 'utf8');
  const patchScript = readFileSync('scripts/patch-worker-runtime.mjs', 'utf8');
  const hooksServer = readFileSync('src/hooks.server.ts', 'utf8');
  const wranglerConfig = readFileSync('wrangler.jsonc', 'utf8');

  // --- 1. SIMULAÇÃO REPRODUZÍVEL DA COLISÃO DE CACHE (FALHA VS CORREÇÃO) ---
  it('demonstrates reproducible cache poisoning when redirect uses public Cache-Control vs safe no-store', () => {
    // Simulador do Cloudflare Workers Cache (zoneless, chave baseada em path + query)
    type WorkersCacheEntry = {
      status: number;
      headers: Record<string, string>;
    };

    class CloudflareWorkersCacheSimulator {
      private store = new Map<string, WorkersCacheEntry>();

      // Chave oficial Cloudflare Workers Cache: apenas path + query, SEM hostname
      private computeWorkersCacheKey(urlStr: string): string {
        const u = new URL(urlStr);
        return `${u.pathname}?${u.searchParams.toString()}`;
      }

      put(urlStr: string, res: { status: number; headers: Record<string, string> }) {
        const cc = res.headers['cache-control'] || '';
        const cdnCc = res.headers['cdn-cache-control'] || '';
        const cfCdnCc = res.headers['cloudflare-cdn-cache-control'] || '';

        // RFC 9111 & Cloudflare: no-store ou private proíbe armazenamento em cache compartilhado
        const isPrivateOrNoStore =
          /private|no-store/i.test(cc) ||
          /private|no-store/i.test(cdnCc) ||
          /private|no-store/i.test(cfCdnCc);

        if (isPrivateOrNoStore) {
          // Não armazena no Workers Cache
          return;
        }

        if (cc.includes('public')) {
          const key = this.computeWorkersCacheKey(urlStr);
          this.store.set(key, res);
        }
      }

      match(urlStr: string): WorkersCacheEntry | null {
        const key = this.computeWorkersCacheKey(urlStr);
        return this.store.get(key) || null;
      }
    }

    // CENÁRIO A (O BUG): www responde com public Cache-Control
    const buggyCache = new CloudflareWorkersCacheSimulator();
    const buggyWwwResponse = {
      status: 308,
      headers: {
        'location': 'https://projectnox.org/',
        'cache-control': 'public, max-age=86400'
      }
    };

    // 1. Cliente acessa www.projectnox.org/
    buggyCache.put('https://www.projectnox.org/', buggyWwwResponse);

    // 2. Cliente subsequente acessa o domínio principal projectnox.org/
    const apexMatchBuggy = buggyCache.match('https://projectnox.org/');
    expect(apexMatchBuggy).not.toBeNull();
    expect(apexMatchBuggy?.status).toBe(308);
    expect(apexMatchBuggy?.headers['location']).toBe('https://projectnox.org/');
    // CONTAMINAÇÃO COMPROVADA: apex aponta para si mesmo -> loop infinito ERR_TOO_MANY_REDIRECTS!

    // CENÁRIO B (A CORREÇÃO): www responde com private, no-store e Cloudflare-CDN-Cache-Control
    const fixedCache = new CloudflareWorkersCacheSimulator();
    const safeWwwResponse = {
      status: 308,
      headers: {
        'location': 'https://projectnox.org/',
        'cache-control': 'private, no-cache, no-store, must-revalidate',
        'cdn-cache-control': 'private, no-cache, no-store, must-revalidate',
        'cloudflare-cdn-cache-control': 'private, no-cache, no-store, must-revalidate',
        'vary': 'Host'
      }
    };

    // 1. Cliente acessa www.projectnox.org/
    fixedCache.put('https://www.projectnox.org/', safeWwwResponse);

    // 2. Cliente subsequente acessa o domínio principal projectnox.org/
    const apexMatchFixed = fixedCache.match('https://projectnox.org/');
    // IMUNIDADE COMPROVADA: o Workers Cache não armazenou o 308; apex não sofre contaminação
    expect(apexMatchFixed).toBeNull();
  });

  // --- 2. AUDITORIA ESTÁTICA FORENSE DO CÓDIGO FONTE ---
  it('enforces non-cacheable anti-collision headers on www and workers.dev redirects in worker-wrapper.js', () => {
    // Extrai o bloco de redirect de www.projectnox.org
    const wwwBlockMatch = workerWrapper.match(
      /if \(url\.hostname === 'www\.projectnox\.org'\) \{([\s\S]*?)\n {4}\}/
    );
    expect(wwwBlockMatch).not.toBeNull();
    const wwwBlock = wwwBlockMatch![1];

    expect(wwwBlock).toContain("status: 308");
    expect(wwwBlock).toContain("canonicalUrl.hostname = 'projectnox.org'");
    expect(wwwBlock).not.toContain("'cache-control': 'public");
    expect(wwwBlock).toContain("'cache-control': 'private, no-cache, no-store, must-revalidate'");
    expect(wwwBlock).toContain("'cdn-cache-control': 'private, no-cache, no-store, must-revalidate'");
    expect(wwwBlock).toContain("'cloudflare-cdn-cache-control': 'private, no-cache, no-store, must-revalidate'");
    expect(wwwBlock).toContain("'vary': 'Host'");

    // Extrai o bloco de redirect de legacy workers.dev
    const devBlockMatch = workerWrapper.match(
      /if \(url\.hostname\.endsWith\('\.workers\.dev'\)[\s\S]*?\) \{([\s\S]*?)\n {4}\}/
    );
    expect(devBlockMatch).not.toBeNull();
    const devBlock = devBlockMatch![1];

    expect(devBlock).toContain("status: 308");
    expect(devBlock).not.toContain("'cache-control': 'public");
    expect(devBlock).toContain("'cache-control': 'private, no-cache, no-store, must-revalidate'");
    expect(devBlock).toContain("'cdn-cache-control': 'private, no-cache, no-store, must-revalidate'");
    expect(devBlock).toContain("'cloudflare-cdn-cache-control': 'private, no-cache, no-store, must-revalidate'");
  });

  it('enforces identical anti-collision headers in scripts/patch-worker-runtime.mjs', () => {
    expect(patchScript).not.toMatch(/url\.hostname === 'www\.projectnox\.org'[\s\S]*?'cache-control':\s*'public/);
    expect(patchScript).toMatch(/url\.hostname === 'www\.projectnox\.org'[\s\S]*?'cache-control':\s*'private, no-cache, no-store, must-revalidate'/);
    expect(patchScript).toMatch(/url\.hostname === 'www\.projectnox\.org'[\s\S]*?'cdn-cache-control':\s*'private, no-cache, no-store, must-revalidate'/);
    expect(patchScript).toMatch(/url\.hostname === 'www\.projectnox\.org'[\s\S]*?'cloudflare-cdn-cache-control':\s*'private, no-cache, no-store, must-revalidate'/);
  });

  it('protects both HTML and JSON APIs from pre-worker edge caching in src/hooks.server.ts', () => {
    // 1. isApi definida para todas as rotas /api/
    expect(hooksServer).toContain("const isApi = event.url.pathname.startsWith('/api/');");

    // 2. Pre-worker edge cache desabilitado para HTML e APIs com CDN-Cache-Control e Cloudflare-CDN-Cache-Control
    expect(hooksServer).toContain("if (isHtml || isApi)");
    expect(hooksServer).toContain("response.headers.set('CDN-Cache-Control', 'private, no-cache, no-store, must-revalidate');");
    expect(hooksServer).toContain("response.headers.set('Cloudflare-CDN-Cache-Control', 'private, no-cache, no-store, must-revalidate');");

    // 3. Suporte a Authorization header e áreas administrativas na verificação de privacidade
    expect(hooksServer).toContain("Boolean(event.request.headers.get('authorization'))");
    expect(hooksServer).toContain("event.url.pathname.startsWith('/api/admin')");
    expect(hooksServer).toContain("event.url.pathname.startsWith('/api/staff')");
    expect(hooksServer).toContain("event.url.pathname.startsWith('/api/scan')");
    expect(hooksServer).toContain("event.url.pathname.startsWith('/api/internal')");
    expect(hooksServer).toContain("event.url.pathname.startsWith('/api/action')");
    expect(hooksServer).toContain("event.url.pathname.startsWith('/api/auth')");

    // 4. Header Vary inclui Authorization além de Cookie e Accept
    expect(hooksServer).toContain("response.headers.set('Vary', 'Cookie, Authorization, Accept');");
  });

  it('excludes all /api/ endpoints from in-worker getSharedCacheKey in src/worker-wrapper.js', () => {
    // getSharedCacheKey é exclusivo para renderização de HTML com tags de segmentação (__nox_cache_seg)
    expect(workerWrapper).toMatch(/if\s*\(p\.startsWith\('\/api\/'\)/);
    expect(patchScript).toMatch(/if\s*\(p\.startsWith\('\/api\/'\)/);
  });

  it('validates wrangler.jsonc configuration has custom domains and declarative cache enabled', () => {
    expect(wranglerConfig).toContain('"pattern": "projectnox.org"');
    expect(wranglerConfig).toContain('"pattern": "www.projectnox.org"');
    expect(wranglerConfig).toContain('"cache": {');
    expect(wranglerConfig).toContain('"enabled": true');
    expect(wranglerConfig).toContain('"cross_version_cache": true');
  });
});
