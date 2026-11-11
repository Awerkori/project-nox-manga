# PROJECT NOX — PENDÊNCIAS RESERVADAS PARA A ETAPA 1 YSQL
## Protocolo de Isolamento e Handoff Técnico para a IA de Banco de Dados

**Destinatário:** IA Responsável pelo Prompt Master da Etapa 1 YSQL  
**Emissor:** DeepInvestigator / Cloudflare Zero Waste  
**Data:** 2026-11-06  

---

### 1. DECLARAÇÃO FORMAL DE ISOLAMENTO

A equipe de Cloudflare Zero Waste certifica que:
1. **Zero alterações foram realizadas na camada SQL.**
2. O arquivo `/home/awerkori/nox-site-prod/src/lib/server/yugabyte.ts` continha a alteração não commitada `max: 5` pertencente à IA da Etapa 1. Esse arquivo **NÃO FOI REVERTIDO, NÃO FOI COMMITADO E NÃO FOI SOBRESCRITO**. Permanece intacto na working tree de `nox-site-prod`.
3. Todo o desenvolvimento Cloudflare foi isolado na worktree `/home/awerkori/nox-site-cloudflare` na branch `perf/nox-cloudflare-zero-waste`.
4. Nenhum deploy foi realizado durante a execução do daemon `scripts/etapa1_5h_homologation_daemon.ts`.
5. Nenhuma migração de banco foi executada.
6. Nenhuma query SQL foi modificada.
7. Nenhum benchmark de saturação YSQL foi disparado.

---

### 2. PENDÊNCIAS CATALOGADAS PARA TRATAMENTO PELA ETAPA 1

#### 2.1. O Dilema do Healthcheck do Importer (`/api/releases?limit=1`)
- **Arquivo Envolvido no Site:** `src/routes/api/releases/+server.ts` (L48–57 e L94–98).
- **Arquivo Envolvido no Importer:** `/home/awerkori/.Projects/project-nox-importer/src/lite/runtime.ts` (L3649–3678).
- **Problema Identificado:**
  O importador consulta `https://projectnox.org/api/releases?limit=1` para testar se o site e o banco estão responsivos antes de disparar ingestões pesadas.
  Contudo, o site aplica `probeTtlMs = 300_000` (5 minutos) em cache para `limit=1` para economizar queries de leitores.
  Se o banco YSQL cair, o Cloudflare ou o isolate continuam devolvendo HTTP 200 em cache por até 5 minutos, impedindo o disjuntor do Importer de detectar a queda a tempo.
- **Solução Recomendada para a IA da Etapa 1:**
  1. No SvelteKit, criar uma rota interna dedicada (ex: `/api/health/db-live`) protegida por token ou cabeçalho interno (`x-internal-probe`), que faça `SELECT 1;` com `Cache-Control: no-store` exclusivo para o importador.
  2. No `runtime.ts` do importador, apontar a verificação de saúde direta para esse endpoint sem cache.
- **Status:** **BLOQUEADA PARA CLOUDFLARE — RESPONSABILIDADE EXCLUSIVA DA ETAPA 1**.

#### 2.2. Otimização de Queries de Busca no Catálogo (`ILIKE` vs Índices GIN/Trigram)
- **Problema:**
  A busca pública de catálogo (`q=...`) foi otimizada na borda com normalização de maiúsculas/minúsculas e trim para maximizar HITs de cache.
  Contudo, quando ocorre MISS, a query SQL executa busca textual que consome CPU no cluster YSQL.
- **Recomendação para a IA da Etapa 1:**
  Avaliar criação de índices trigram/GIN em `works.search_text` para mitigar o custo de MISSes residuais.
- **Status:** **BLOQUEADA PARA CLOUDFLARE — RESPONSABILIDADE EXCLUSIVA DA ETAPA 1**.
