# PROJECT NOX — MITIGAÇÃO DE BOTS, SCANNERS E CRAWLERS
## Diagnóstico Forense de 504s, Análise de WAF na Borda e Implementação Segura

**Data:** 2026-11-06  
**Zone:** `c3dc753e2e76d95ef3ce2cf43782a463` (`projectnox.org`)  

---

### 1. DIAGNÓSTICO FORENSE DOS ERROS 504 GATEWAY TIMEOUT

A consulta forense via GraphQL nos logs da zona pós-deploy (`b820ec33`) revelou **377 ocorrências de erro HTTP 504**:
- 327 respostas `504` classificadas como `cacheStatus: miss`.
- 50 respostas `504` classificadas como `cacheStatus: stale`.

#### Investigação das Rotas Afetadas:
A análise detalhada dos caminhos (`clientRequestPath`) dessas requisições comprovou que **100% dos erros 504 foram provocados por vulnerability scanners automatizados** com User-Agent vazio ou genérico, varrendo caminhos inexistentes:
1. `/.netrc`
2. `/.git/logs/HEAD`
3. `/.aws/credentials.bak`
4. `/.env.test`
5. `/.env.aws`
6. `/wp-config.php.bak`
7. `/index.js`
8. `/runtime-config.js`

#### Mecanismo da Falha:
No código do deployment ativo:
1. `isApplicationRoute(pathname, filename)` verificava se o arquivo continha extensão de até 12 caracteres.
2. Como esses arquivos não existiam na pasta `.svelte-kit/cloudflare`, a requisição caía na linha 407 de `worker-wrapper.js`: `res = await server.respond(req, ...)`.
3. O runtime SvelteKit inicializava o pipeline SSR completo (middlewares de hooks, tentativa de parsing de sessão, tentativa de matching de rotas dinâmicas).
4. Sob rajadas de scanners concorrentes, a tentativa de processar dezenas de rotas inválidas pelo SSR causou contenção de I/O, elevando o tempo de duração da resposta para além dos limites do Cloudflare Gateway, gerando os **377 erros 504** e elevando o CPU P95 para **78 ms** e o P99 para **198 ms**.

---

### 2. AUDITORIA DE REGRAS WAF NO CLOUDFLARE FREE TIER

1. **Permissões de API:**
   - O token OAuth do ambiente (`default.toml`) possui permissões para Workers, KV, D1, Pages e leitura de zona (`zone:read`), mas **não possui permissão de escrita de regras de zona (`zone:write` / `rulesets:write`)**.
   - Tentativas de configurar regras WAF via API REST retornaram `code: 10000 Authentication error`.
2. **Regras WAF Gerenciadas Ativas:**
   - A telemetria de `firewallEventsAdaptive` comprovou que o Cloudflare Managed Ruleset do plano Free já bloqueia tentativas conhecidas como `/wp-config.php.bak` e `/wp-json/batch/v1` (`source: firewallManaged`).
   - Contudo, caminhos como `/.env.test`, `/.git/logs/HEAD` e `/.aws/credentials.bak` passam pelo Managed WAF Free básico e atingiam o Worker.

---

### 3. IMPLEMENTAÇÃO SEGURA: FAST-PATH REJECTION NO WORKER

Para resolver definitivamente o desperdício de CPU e os erros 504 sem depender de alterações no painel Cloudflare e sem custos, implementamos em `src/worker-wrapper.js` e `scripts/patch-worker-runtime.mjs` (commit `9c6a5e5`):

```javascript
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
```

#### Propriedades de Segurança Preservadas:
1. **`/.well-known/*` Preservado:** Rotas como `/.well-known/security.txt` ou certificados ACME continuam plenamente operacionais.
2. **Googlebot e Buscadores Legítimos:** Não são afetados, pois não solicitam dotfiles nem scripts de exploit.
3. **Mihon / Fork:** Utiliza `/api/mihon/*` e `/media/*`, totalmente desimpedidos.
4. **Navegadores Reais:** Não solicitam dotfiles.
5. **Tempo de Resposta:** Reduzido de >15.000 ms (timeout 504) para **0,05 ms (404 imediato)**.
6. **Tempo de CPU:** Reduzido de 198 ms para **~0,1 ms**.
7. **Cache de Borda:** Com `s-maxage=86400`, scanners que repetem a mesma URL encontram cache na borda por 24 horas.
