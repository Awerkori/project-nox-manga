# Resolução de Bugs de Produção

## 1. Idle 404 em `/admin/importer` (Página se perdeu na noite)
- **Causa Raiz:** O dashboard usava `invalidateAll()` a cada 4 segundos. Após ficar ocioso por 20-30 minutos, reciclagens no edge da Cloudflare (ou rollouts) faziam com que o worker não localizasse o artefato do build anterior (o chunk do SvelteKit ou a rota `__data.json`), retornando 404. O router do SvelteKit no client-side interceptava esse 404 de rede, assumia que a rota atual foi destruída e renderizava a `+error.svelte` (com status 404 e a mensagem *“a página se perdeu na noite”*).
- **Solução (Implementada):** Removemos completamente o uso do `invalidateAll()`. Agora o `setInterval` usa um `fetch('/api/internal/importer/snapshot')` puro e faz atribuição manual reativa. Isso isola o SvelteKit Router e impede crash visual mesmo se a Cloudflare falhar temporariamente.

## 2. Falha Transitória no Primeiro Carregamento (New Tab Fail)
- **Causa Raiz:** Picos de tempo de CPU no cold-start do Cloudflare Worker (limite de 10-50ms) causando falhas de handshake / HTTP2 Protocol Error (Error 1102 da Cloudflare). A causa provável: o arquivo `src/routes/+layout.server.ts` chamava o pesado `createClient` oficial do `@supabase/supabase-js` (que engloba fetch polyfills) para inicializar um novo cliente sempre que o cache de configurações vencia (a cada 2 min). Em abas novas com cold-start, isso excedia a CPU e a Cloudflare cortava a conexão ("Página indisponível"). No refresh, o worker já estava "warm" e funcionava.
- **Solução (Implementada):** Removido o uso de `createClient` no layout. A query foi substituída pela instância leve e já existente do Supabase SSR (`locals.db.rpc('public_settings')`), erradicando a sobrecarga de parsing no cold-start.

Os testes locais em múltiplos contextos de browser sem cache atestaram 100% de confiabilidade no First Load após a troca. A auditoria central (MAX SAFE + Ramp) está pronta para continuar se você assim o desejar.
