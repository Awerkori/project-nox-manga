# Project Nox — Cloudflare Rollback Procedure

Este documento formaliza o procedimento de rollback seguro e imediato para a produção do Project Nox na Cloudflare, em estrito cumprimento aos requisitos de governança e homologação Zero Waste.

## 1. Versão Estável de Referência (Baseline Ativo)

- **Worker Name:** `manga`
- **Active Version ID:** `2cd46361-7eb7-4a0a-a84b-6647c8b75efd`
- **Commit Base:** `f494bb9fcbff0e933c3fcdadfda335a255fd4e70`
- **Asset Entrypoint:** `./_app/immutable/entry/start.BkvvmzpF.js`
- **Traffic Allocation:** 100% em `projectnox.org` e `www.projectnox.org`

## 2. Critérios de Disparo de Rollback

O rollback para a versão `2cd46361-7eb7-4a0a-a84b-6647c8b75efd` deve ser executado imediatamente se:
1. Sondas pós-deploy detectarem que `www.projectnox.org` ou `projectnox.org` retornam respostas com headers incorretos ou erro `ERR_TOO_MANY_REDIRECTS`.
2. Taxa de erro HTTP 5xx em produção exceder 0.1% após deploy.
3. Respostas de APIs privadas ou rotas administrativas retornarem `cf-cache-status: HIT`.
4. Falha na invalidação de mídias ou indisponibilidade de banco de dados/Hyperdrive.

## 3. Comandos de Rollback Imediato

### Opção A — Rollback Direto via Wrangler CLI (Tempo de convergência: < 5 segundos)
```bash
npx wrangler rollback 2cd46361-7eb7-4a0a-a84b-6647c8b75efd --name manga --message "Rollback para versão homologada estável 2cd46361"
```

### Opção B — Redirecionamento 100% de Tráfego de Versão (Alternativa oficial Cloudflare)
```bash
npx wrangler versions deploy 2cd46361-7eb7-4a0a-a84b-6647c8b75efd@100% --name manga --message "Tráfego convergido 100% para 2cd46361"
```

## 4. Pós-Rollback: Expurgo Seletivo de Borda

Após qualquer rollback, executar expurgo seletivo do cache de borda para evitar respostas residuais:
```bash
# Expurgo seletivo de tags de mídia e rotas raiz
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"hosts": ["projectnox.org", "www.projectnox.org"], "prefixes": ["projectnox.org/", "www.projectnox.org/"]}'
```

## 5. Verificação de Saúde Pós-Rollback (Smoke Test)
```bash
curl -sI https://projectnox.org/api/health
curl -sI https://www.projectnox.org/
```
Ambas devem responder conforme o baseline estipulado.
