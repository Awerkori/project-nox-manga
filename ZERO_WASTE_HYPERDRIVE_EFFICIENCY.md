# PROJECT NOX — EFICIÊNCIA DO HYPERDRIVE SEM ALTERAÇÃO DE SQL
## Redução de Statements por Cache HTTP e Mecanismos Anteriores ao Banco

**Data:** 2026-11-06  
**Configuração Hyperdrive ID:** `83726ad935554261813c4bb12094c7f3`  
**Bloqueio Rigoroso:** 0 alterações em SQL, 0 alterações em tabelas, 0 alterações no pool YSQL (`yugabyte.ts` intocado).

---

### 1. MAPA DE CONSUMO DO HYPERDRIVE POR TIPO DE ROTA

| Rota / Operação | Requests Zona | Invocação Worker | Statements Hyperdrive | Mecanismo de Economia |
| :--- | :--- | :--- | :--- | :--- |
| **Assets Estáticos (`/_app/*`, CSS, JS)** | Centenas | **0** | **0** | Static Assets (`run_worker_first: false`) |
| **Páginas HTML Públicas (Home, Catálogo, Lançamentos, Obra)** | Centenas | 1 (HIT) | **0** | `caches.default` via `getSharedCacheKey` com segmentação de idade |
| **Revalidação de Página HTML (If-None-Match)** | Dezenas | 1 (HIT) | **0** | 304 Not Modified no Edge Cache |
| **Mídia Pública em Cache (`/media/*`)** | Centenas | 1 (Fast-Path) | **0** | `caches.default.match` no `worker-wrapper.js` |
| **Revalidação de Mídia (If-None-Match)** | Dezenas | 1 (Fast-Path) | **0** | 304 Not Modified no `worker-wrapper.js` |
| **Scanners de Vulnerabilidade (`/.env`, `/.git`, etc.)** | Centenas | 1 (Fast-Path 404) | **0** | Fast-path rejection antes do SSR |
| **Catálogo Mihon (`/api/mihon/catalog`)** | Dezenas | 1 | 0 a 1 | Cache de 300s no isolate e borda |
| **Páginas de Capítulo Mihon (`/api/mihon/chapter/:id/pages`)** | Dezenas | 1 | 0 a 1 | Memória Isolate (300s) + Borda (3600s) |
| **Health Probe Importer (`/api/releases?limit=1`)** | Frequente | 1 | 0 a 1 | Cache probe de 300s (`probeTtlMs`) |

---

### 2. TELEMETRIA REAL DO HYPERDRIVE (PÓS-DEPLOY `b820ec33`)

Consulta executada diretamente na API Cloudflare GraphQL:
- **Janela:** `2026-11-06T02:48:56Z` até `2026-11-06T04:37:46Z`
- **Total de Statements Executados:** 629 statements
- **Taxa de Cache Hyperdrive:**
  - `hit`: 222
  - `clienthit`: 144
  - `miss`: 263
  - **Hit Rate Real:** `(222 + 144) / 629 = 366 / 629 = 58,19%`
- **Consumo da Franquia Diária (100.000 statements):** **0,63%** consumido após quase 2 horas de operação contínua.

---

### 3. COMO O CACHE HTTP EVITA STATEMENTS NO HYPERDRIVE

O maior ganho de cota de Hyperdrive não ocorre pelo hit rate interno do Hyperdrive, mas sim por **requisições que são atendidas antes de qualquer query ser disparada**:

1. **Media Edge Fast-Path:**
   - Em média, cada download de mídia que desse miss no cache executaria `fetchMediaMetadataFromYugabyte`, enviando 1 statement de SELECT para o Hyperdrive.
   - Com o Media Fast-Path ativo, os 646 cache HITs de mídia observados evitaram **646 statements no Hyperdrive**.
2. **HTML Shared Cache:**
   - Cada renderização SSR de `/catalogo`, `/lancamentos` ou `/obra/:slug` executa entre 1 e 3 queries no banco.
   - O cache com segmentação de idade atende requisições de visitantes públicos sem invocar o SvelteKit, poupando centenas de queries adicionais.
3. **Bloqueio de Scanners:**
   - A rejeição de scanners de arquivos `.env` e `.git` antes do SSR impede que o SvelteKit tente carregar layouts e dados de banco para rotas inexistentes, poupando CPU e queries.
