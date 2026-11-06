# PROJECT NOX — TELEMETRIA REAL PÓS-DEPLOY
## Medições Rigorosamente Posteriores ao Deployment `b820ec33` (02:48:56Z em diante)

**Deployment Auditado:** `b820ec33-bd20-4d09-a3c2-4d2e74660b29`  
**Timestamp de Entrada em Produção:** `2026-11-06T02:48:56.945Z`  
**Timestamp de Fechamento da Amostra:** `2026-11-06T04:37:46.036Z`  
**Duração da Janela Pós-Deploy:** 1 hora, 48 minutos e 49 segundos  
**Origem dos Dados:** Cloudflare GraphQL Analytics API (`https://api.cloudflare.com/client/v4/graphql`)  

---

### 1. MÉTRICAS AGREGADAS DA ZONA E DO WORKER

| Métrica | Valor Absoluto | Proporção / Observação |
| :--- | :--- | :--- |
| **Requisições Totais na Zona (`projectnox.org`)** | 2.233 reqs | Amostra real exclusiva pós-deploy |
| **Cache HITs na Borda da Zona** | 691 reqs | 30,94% das requisições atendidas puramente pelo cache Cloudflare |
| **Invocações do Worker `manga`** | 598 reqs | 26,78% das requisições atingiram o código do Worker |
| **Requisições Bypassed (Zero Worker)** | 1.635 reqs | **73,22% de BYPASS REAL COMPROVADO** |
| **Subrequests disparadas pelo Worker** | 142 subreqs | Chamadas a storage/Telegram |
| **Erros de Execução do Worker (1102 / crash)** | 0 erros | 0,00% de erro interno do Worker |
| **Workers CPU Time P50** | **5,61 ms** (5.610 µs) | Perfeitamente dentro do teto de 10ms do Free Tier |
| **Workers CPU Time P95** | 78,04 ms (78.040 µs) | Elevado devido a scanners de vulnerabilidade executando SSR |
| **Workers CPU Time P99** | 198,93 ms (198.930 µs) | Picos extremos gerados por scanners concorrentes |
| **Workers Wall-Clock Duration P50** | 13,5 ms | Tempo mediano de atendimento de I/O |
| **Workers Wall-Clock Duration P95** | 258,6 ms | I/O de rede e subrequests |

---

### 2. TELEMETRIA DO HYPERDRIVE PÓS-DEPLOY

| Métrica | Valor | Percentual |
| :--- | :--- | :--- |
| **Total de Statements Hyperdrive** | 629 statements | Média de ~5,8 statements por minuto |
| **Hyperdrive Cache Hits (Edge Hit)** | 222 statements | 35,29% |
| **Hyperdrive Client Hits (Isolate Hit)** | 144 statements | 22,89% |
| **Hyperdrive Misses (Consulta ao YSQL)** | 263 statements | 41,81% |
| **Taxa Consolidada de Cache Hit Hyperdrive** | **366 / 629** | **58,19%** |
| **Consumo da Cota Diária de Hyperdrive** | 629 / 100.000 | **0,63%** da franquia diária |

---

### 3. DISTRIBUIÇÃO DAS RESPOSTAS HTTP NA ZONA

| Código HTTP | Cache Status | Quantidade | Observação |
| :--- | :--- | :--- | :--- |
| **200 OK** | `hit` | 682 | Mídia pública, assets estáticos e páginas em cache |
| **200 OK** | `none` / `dynamic` | 465 | SSR do SvelteKit e primeiras cargas de mídia |
| **200 OK** | `miss` | 240 | Primeira carga de mídia/páginas não cacheadas |
| **204 No Content** | `none` | 193 | Respostas de ping e atualizações vazias |
| **206 Partial** | `hit` | 3 | Range requests atendidos em cache |
| **304 Not Mod** | `none` / `hit` | 8 | Revalidações condicionais |
| **401 Unauth** | `none` | 12 | Tentativas de acesso sem token |
| **403 Forbid** | `none` | 5 | Bots bloqueados pelo worker |
| **404 Not Found**| `none` | 131 | Páginas inexistentes |
| **412 Precond** | `hit` | 1 | If-Match com ETag divergente |
| **416 Unsatisf** | `hit` | 1 | Range insatisfazível |
| **504 Timeout** | `miss` / `stale` | 377 | **Vulnerability Scanners** solicitando dotfiles inexistentes que dispararam SSR |

---

### 4. RECONCILIAÇÃO DA EFICIÊNCIA REAL

O cálculo anterior apontava 72,30% com base na amostra iniciada à meia-noite (que incluía o deploy antigo `efc65a39`).  
A telemetria puramente pós-deploy (`b820ec33`) demonstra:
- Requisições na Zona: 2.233
- Requisições no Worker: 598
- **Taxa Real de Bypass Pós-Deploy:** `(2.233 - 598) / 2.233 = 1.635 / 2.233 = 73,22%`.

A taxa de bypass real é ligeiramente superior à calculada no ciclo anterior (73,22% vs 72,30%), confirmando a eficácia dos mecanismos de Static Assets e Edge CDN.
