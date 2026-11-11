# PROJECT NOX — CACHE MIHON, ETAG E FRESCOR DE CAPÍTULOS
## Análise Forense de Staleness, Validação Condicional e Invalidação de Cache

**Data:** 2026-11-06  
**Módulos Analisados:**
- `src/routes/api/mihon/chapter/[id]/pages/+server.ts`
- `src/routes/api/mihon/work/[slug]/+server.ts`
- `src/routes/api/mihon/catalog/+server.ts`
- `src/lib/server/mihon.ts`

---

### 1. DIAGNÓSTICO DO FRESCOR E DO ETAG COMPOSTO

#### 1.1. Como os Endpoints Mihon geram e invalidam conteúdo:
- **Páginas de Capítulo (`/api/mihon/chapter/:id/pages`):**
  - O endpoint consulta o banco YSQL (`SELECT c.id, ..., pages`).
  - O ETag é composto por:
    `"${chapter.id}-${pages.length}-${pagesHash}-${metaHash}-${chapterTime}"`
    Onde:
    - `pagesHash`: Hash das posições, media_ids, larguras e alturas de todas as páginas.
    - `metaHash`: Hash do id, número, display_number, título, kind, edição, language, content_rating e work_updated_at.
    - `chapterTime`: Timestamp em milissegundos de `published_at` ou `created_at`.
  - Se qualquer página for adicionada, removida, reordenada ou tiver imagem trocada, o `pagesHash` muda e o ETag muda imediatamente.
  - Se o título, classificação ou obra for atualizada, o `metaHash` muda e o ETag muda imediatamente.

#### 1.2. O Problema da Borda e do Staleness:
- **No deployment `b820ec33`:**
  - O header retornado continha: `public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`.
  - `s-maxage=3600` instrui o CDN da Cloudflare a reter a resposta em cache por 1 hora.
  - `stale-while-revalidate=86400` instrui a Cloudflare que, após expirar 1 hora, ela pode continuar servindo a versão desatualizada por **até 24 horas adicionais** enquanto tenta revalidar de forma assíncrona.
  - Se um scan ou editor alterasse as páginas de um capítulo com defeito, leitores no Mihon poderiam receber a lista antiga de páginas por até 24 horas.
- **Na correção aplicada (commit `9c6a5e5`):**
  - O header foi ajustado para: `public, max-age=300, s-maxage=3600, stale-while-revalidate=3600`.
  - O tempo máximo de defasagem em background da Cloudflare foi reduzido de **24 horas para 1 hora**.
  - A cota do banco continua protegida por 1 hora contra rajadas de milhares de leitores acessando o mesmo capítulo simultaneamente.
  - Quando a Cloudflare revalida com `If-None-Match`, o ETag composto é comparado via `matchesETag`:
    - Se nada mudou -> Devolve `304 Not Modified` instantâneo.
    - Se houve alteração -> Devolve `200 OK` com a nova representação e novo ETag.

---

### 2. ISOLAMENTO DE CONTEÚDO ADULTO (+18)

Conforme auditoria no código:
1. Em `src/routes/api/mihon/chapter/[id]/pages/+server.ts` (L99–104):
   - Se `chapter.content_rating === 'ADULT_18'` e o leitor não estiver autenticado com token maior de idade:
     Retorna HTTP 403 Forbidden.
2. Em `src/routes/api/mihon/chapter/[id]/pages/+server.ts` (L107–109):
   - Se `chapter.content_rating === 'ADULT_18'`:
     Retorna `Cache-Control: private, no-cache, no-store, must-revalidate`.
3. Em `worker-wrapper.js`:
   - A função `r(res)` rejeita expressamente qualquer resposta contendo `no-store`, `no-cache` ou `private`, ou que não contenha `public`.
   - **Garantia matemática:** Conteúdo adulto (+18) NUNCA é armazenado em cache público de borda ou isolate compartilhado.
