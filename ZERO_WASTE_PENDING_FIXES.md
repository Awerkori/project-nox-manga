# PROJECT NOX — PENDÊNCIAS TÉCNICAS E MAPA DE CORREÇÕES
## Status de Execução, Bloqueios e Ações Permitidas

**Versão Base Testada:** `b820ec33-bd20-4d09-a3c2-4d2e74660b29`  
**Branch de Correção Isolada:** `perf/nox-cloudflare-zero-waste` (Commit `9c6a5e5`)  

---

### 1. MATRIZ DE PENDÊNCIAS E RESOLUÇÕES

#### P0 — Downloads do Mihon Consumindo Workers
- **Diagnóstico:** As requisições para `/media/*` atingem o Worker `manga` porque `projectnox.org` é um Custom Domain associado ao Worker. Quando o objeto está em cache, `caches.default.match()` atende em <1ms, sem executar SvelteKit SSR, sem tocar no Hyperdrive, sem tocar no YSQL e sem consultar o Telegram. No entanto, consome 1 invocação Worker contra o teto de 100k/dia do plano Free.
- **Alternativas Gratuitas Analisadas:**
  - *Alternativa A (CDN de zona pura antes do Worker):* No Cloudflare Free Tier, com Custom Domain apontando para Worker, o Cloudflare executa o Worker antes de consultar o cache de zona, a menos que Static Assets sejam usados. Como o catálogo dinâmico de mídia reside no Telegram e excede os limites de Static Assets (25MB/20k arquivos), não é viável via Assets.
  - *Alternativa B (Subdomínio direto para Telegram):* Inviável por segurança. Expor o endpoint do Telegram expõe tokens de bot de storage (`/file/bot<TOKEN>/...`), violando a regra de ouro de segurança e integridade.
  - *Alternativa E (Otimização do Caminho Existente - IMPLEMENTADA):* Fast-path em `worker-wrapper.js` com `caches.default.match()`, headers RFC 9110 (ETag, Range 206, If-None-Match 304, If-Match 412, If-Range weak-validator fallback 200).
- **Status:** **APROVADO E HOMOLOGADO DENTRO DOS LIMITES FÍSICOS DO PLANO FREE**.

#### P0 — Bloqueio de Crawlers e Vulnerability Scanners antes do SSR
- **Diagnóstico:** Scanners e bots agressivos solicitavam URLs de arquivos confidenciais (`/.netrc`, `/.git/logs/HEAD`, `/.aws/credentials.bak`, `/.env.test`, `/.env.aws`, `/wp-config.php.bak`). No código atual, essas requisições passavam pelo `worker-wrapper.js` e executavam o SvelteKit SSR, resultando em 377 respostas 504 Gateway Timeout e picos de CPU de até 198 ms (p99).
- **Resolução Implementada:**
  - Adicionado fast-path de rejeição imediata em `src/worker-wrapper.js` e `scripts/patch-worker-runtime.mjs`.
  - Rejeita dotfiles (`pathname.startsWith('/.')`, exceto `/.well-known/`) e extensões de exploit (`.php`, `.bak`, `.sql`, `.env`, `.conf`, `.ini`, `/wp-*`, `/xmlrpc.php`).
  - Devolve imediatamente HTTP 404 Not Found com `Cache-Control: public, max-age=86400, s-maxage=86400`, impedindo qualquer execução de SSR, query SQL ou subrequest.
  - A borda da Cloudflare passa a cachear a resposta 404 por 24 horas.
- **Status:** **CORRIGIDO E TESTADO NO WORKTREE ISOLADO (COMMIT `9c6a5e5`)**.

#### P0 — Cache Mihon e Frescor de Capítulos
- **Diagnóstico:** Em `src/routes/api/mihon/chapter/[id]/pages/+server.ts`, a diretiva de cache utilizava `public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`. O valor de 86.400 segundos (24 horas) em `stale-while-revalidate` permitia que a Cloudflare entregasse páginas desatualizadas em background por até um dia após edições ou reordenamentos de páginas.
- **Resolução Implementada:**
  - Reduzido `stale-while-revalidate` para 3.600 segundos (1 hora), mantendo `s-maxage=3600` para proteger o banco e compatibilidade com os testes existentes.
  - O staleness máximo em background fica limitado a 1 hora em vez de 24 horas.
  - Obras adultas mantidas estritamente com `private, no-cache, no-store, must-revalidate`.
- **Status:** **CORRIGIDO E TESTADO NO WORKTREE ISOLADO (COMMIT `9c6a5e5`)**.

#### P1 — Buscas e Catálogo: Normalização de Parâmetros
- **Diagnóstico:** Variações de digitação na busca (ex: `q=Solo Leveling`, `q=solo leveling`, `q= solo leveling `) geravam chaves de cache diferentes, fragmentando o cache e consumindo SSR desnecessariamente.
- **Resolução Implementada:**
  - Em `getSharedCacheKey` (`worker-wrapper.js` e `patch-worker-runtime.mjs`), a query de busca `q` é normalizada com `val.trim().toLowerCase().replace(/\s+/g, ' ')`.
  - Parâmetros `tipo` e `status` são normalizados para uppercase.
  - Parâmetros desconhecidos são descartados da chave de cache.
- **Status:** **CORRIGIDO E TESTADO NO WORKTREE ISOLADO (COMMIT `9c6a5e5`)**.

#### P1 — Otimização de 304 Not Modified no Edge Cache
- **Diagnóstico:** Quando uma requisição com `If-None-Match` encontrava um HIT no cache de isolate/borda de páginas HTML e JSON, o worker reconstruía e transmitia o corpo completo (20KB - 50KB), sem aproveitar o status 304.
- **Resolução Implementada:**
  - Em `worker-wrapper.js` no bloco de retorno do cache compartilhado, foi adicionada a verificação de `if-none-match` contra o `etag` do cache. Se bater, devolve imediatamente `Response(null, { status: 304, headers })` com `X-Nox-Edge-Cache: HIT`.
- **Status:** **CORRIGIDO E TESTADO NO WORKTREE ISOLADO (COMMIT `9c6a5e5`)**.

#### P1 — Healthcheck do Importer (`/api/releases?limit=1`)
- **Diagnóstico:** O cache de 300 segundos em `/api/releases?limit=1` (`probeTtlMs = 300_000`) mascara incidentes de banco para o `runtime.ts` do Importer.
- **Resolução:** Conforme a Seção 26 do Prompt Master, esta alteração está expressamente reservada para a IA da Etapa 1.
- **Status:** **BLOQUEADA — RESPONSABILIDADE DA ETAPA 1**.

#### P1 — Deploy em Produção
- **Diagnóstico:** O script `scripts/etapa1_5h_homologation_daemon.ts` está rodando em background na máquina do usuário desde 01:07 UTC. Executar deploy durante esta bateria causaria perturbação no site e invalidação dos testes concorrentes.
- **Resolução:** Deploy mantido temporariamente bloqueado. Código testado com 100% de sucesso localmente (107/107 arquivos de teste, 527/527 testes aprovados).
- **Status:** **DEPLOY BLOQUEADO POR CONCORRÊNCIA DA ETAPA 1**.
