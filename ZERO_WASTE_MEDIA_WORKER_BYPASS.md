# PROJECT NOX — AUDITORIA FORENSE E ENGENHARIA DE ENTREGA DE MÍDIA
## Análise Técnica da Rota `/media/*`, Consumo de Workers e Limites Físicos no Free Tier

**Data:** 2026-11-06  
**Ambiente:** Cloudflare Workers Free Tier (R$ 0,00)  
**Worker:** `manga` (`projectnox.org`)  

---

### 1. MAPEAMENTO DO FLUXO COMPLETO DE MÍDIA

```
[ Cliente Mihon / Fork / Web ]
             │
             ▼
   [ DNS Cloudflare Edge ]
             │
             ▼
 [ Rota Custom Domain projectnox.org ]
             │
             ▼ (Invocação Worker: 1 request contabilizado)
 [ src/worker-wrapper.js: Media Fast-Path ]
             │
             ├──► [ caches.default.match(canonicalMediaUrl) ]
             │           │
             │           ├──► [ CACHE HIT ]
             │           │        │
             │           │        ├── Se If-None-Match == ETag: Retorna 304 Not Modified (<1ms)
             │           │        ├── Se Range header: Slices ArrayBuffer e retorna 206 Partial (<2ms)
             │           │        ├── Se HEAD: Retorna 200 OK sem corpo (<1ms)
             │           │        └── GET: Retorna 200 OK com Stream (<3ms)
             │           │        [ZERO SvelteKit SSR | ZERO Hyperdrive | ZERO YSQL | ZERO Telegram]
             │           │
             │           └──► [ CACHE MISS ]
             │                    │
             ▼                    ▼
   [ SvelteKit SSR: src/routes/media/[id]/+server.ts ]
             │
             ├──► [ fetchMediaMetadataFromYugabyte ]
             │        │
             │        ├── Memória Isolate LKG (TTL 300s): Se HIT, 0 SQL
             │        └── Se MISS: 1 query Hyperdrive -> YSQL `media` table
             │
             ├──► [ Checagem de Classificação e Segurança ]
             │        ├── Adulto / Privado sem Auth -> 404 / 307 para endpoint privado (No-Cache)
             │        └── Público -> Headers Imutáveis (31.536.000s)
             │
             ├──► [ Download da Origem Telegram ]
             │        ├── Bot Affinity Router (Resolução de Shard)
             │        └── Telegram Bot API (1 subrequest)
             │
             └──► [ Armazenamento Assíncrono no Cache ]
                      ├── ctx.waitUntil(caches.default.put(canonicalUrl, clone))
                      └── Retorna 200 OK ao cliente
```

---

### 2. COMPARAÇÃO RIGOROSA DAS 5 ALTERNATIVAS DA SEÇÃO 6.3

| Alternativa | Mecanismo | Viabilidade no Free Tier | Invocações Workers | Risco de Segurança / Dependência |
| :--- | :--- | :--- | :--- | :--- |
| **A. CDN de Zona antes do Worker** | Cache Rule na Zone para interceptar antes do Custom Domain | **Inviável na arquitetura Cloudflare Custom Domains.** Na Cloudflare, Workers em Custom Domains executam antes do Edge Cache. Apenas Static Assets com `run_worker_first: false` executam antes, mas cobrem apenas arquivos locais do build. | Contabiliza 1 invocação no Worker | Nenhum |
| **B. Subdomínio Público Direto** | Expor subdomínio CNAME para storage | **Inviável.** As imagens residem no Telegram. O Telegram Bot API exige token no path (`/file/bot<TOKEN>/...`). Expor a URL pública vazaria credenciais mestre de storage. | 0 Workers | **RISCO CRÍTICO DE SEGURANÇA** (vazamento de tokens e perda de controle) |
| **C. Static Assets** | Publicar imagens como objetos estáticos | **Inviável.** Static Assets do plano Free suporta no máximo 20.000 arquivos e 25MB por asset, com bundle máximo comprimido de 3MB. O acervo de mangás possui centenas de gigabytes e cresce a cada capítulo publicado. | 0 Workers | Impossibilidade técnica de escala |
| **D. URLs Imutáveis Versionadas** | Identificadores canônicos e hash de SHA-256 | **Implementado e Homologado.** O endpoint utiliza canonicalUrl imutável com ETag `"${sha256}"`, garantindo que uma vez em cache, o objeto nunca mais consulta a origem. | 1 invocação no HIT (<1ms) | Nenhum |
| **E. Otimização do Caminho Existente** | Fast-path no `worker-wrapper.js` com `caches.default` e RFC 9110 | **Implementado e Homologado.** Atendimento instantâneo com zero SSR, zero Hyperdrive, zero YSQL, tratamento RFC 9110 de HEAD, Range 206, Suffix Range, 416, 412 e 304. | 1 invocação no HIT (0.8ms CPU) | Nenhum |

---

### 3. COMPROVAÇÃO EXPERIMENTAL DAS RESPOSTAS DE MÍDIA

Testes executados contra `https://projectnox.org/media/535b7ba1-20e6-4b51-82d3-6f700635196a` em 2026-11-06:

1. **GET (Cache HIT):**
   - Status: `HTTP/2 200 OK`
   - Headers: `cf-cache-status: HIT`, `x-media-cache: EDGE-FAST-HIT`, `age: 34`, `cache-control: public, max-age=31536000, s-maxage=31536000, immutable`.
   - Latência: 31,6 ms (tempo de rede completo cliente-edge).
   - CPU do Worker: ~0,8 ms.

2. **HEAD:**
   - Status: `HTTP/2 200 OK`
   - Corpo: 0 bytes.

3. **GET Range (`Range: bytes=0-100`):**
   - Status: `HTTP/2 206 Partial Content`
   - Headers: `Content-Range: bytes 0-100/24463`, `Content-Length: 101`.

4. **GET Suffix Range (`Range: bytes=-50`):**
   - Status: `HTTP/2 206 Partial Content`
   - Headers: `Content-Range: bytes 24413-24462/24463`, `Content-Length: 50`.

5. **GET Range Insatisfazível (`Range: bytes=99999-99999`):**
   - Status: `HTTP/2 416 Range Not Satisfiable`
   - Headers: `Content-Range: bytes */24463`, `Content-Length: 0`.

6. **GET If-None-Match com ETag idêntico:**
   - Status: `HTTP/2 304 Not Modified`
   - Corpo: 0 bytes transmitidos.

7. **GET If-Range com ETag Fraco (`W/"..."`):**
   - Status: `HTTP/2 200 OK` (Degradação correta conforme RFC 9110 §13.1.5: validadores fracos não podem validar Range).

8. **GET If-Match com ETag divergente:**
   - Status: `HTTP/2 412 Precondition Failed`
   - Corpo: 0 bytes transmitidos.

---

### 4. CONCLUSÃO ARQUITETURAL

Declarar que downloads de mídia são "Zero Workers" em plano Free Tier com Custom Domain é tecnicamente falso perante a arquitetura Cloudflare. 
No entanto, o **Media Fast-Path** garante que um Cache HIT seja atendido com:
- **0 consultas ao Hyperdrive**
- **0 consultas ao YSQL**
- **0 chamadas à API do Telegram**
- **0 ms de execução do SvelteKit SSR**
- **Consumo de CPU inferior a 1 ms por imagem**

Isso protege integralmente o banco de dados e a infraestrutura de backend contra saturação durante downloads intensivos no Mihon.
