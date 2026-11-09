# Project Nox — Cloudflare Rollback Procedure

Este documento formaliza o procedimento de rollback seguro e imediato para a produção do Project Nox na Cloudflare, em estrito cumprimento aos requisitos de governança e homologação Zero Waste.

## 1. Versões e Topologia de Produção

- **Worker Name:** `manga`
- **Active Production Version (Post-deploy):** `398d1735-ef8d-4c0c-9831-cc2b82752bcf`
- **Immediate Rollback Target Version:** `fcd51c68-3fa5-4d63-b867-d7d557554652`
- **Secondary Rollback Baseline:** `fafe6ae8-cd04-4f93-8125-bc7a02774619`
- **Traffic Allocation:** 100% em `projectnox.org` e `www.projectnox.org`

## 2. Critérios de Disparo de Rollback

O rollback para a versão `fcd51c68-3fa5-4d63-b867-d7d557554652` (ou secundariamente `fafe6ae8-cd04-4f93-8125-bc7a02774619`) deve ser executado imediatamente se:
1. Sondas pós-deploy detectarem que `www.projectnox.org` ou `projectnox.org` retornam respostas com headers incorretos ou erro `ERR_TOO_MANY_REDIRECTS`.
2. Taxa de erro HTTP 5xx em produção exceder 0.1% após deploy.
3. Respostas de APIs privadas ou rotas administrativas retornarem `cf-cache-status: HIT`.
4. Falha na invalidação de mídias ou indisponibilidade de banco de dados/Hyperdrive.

## 3. Comandos de Rollback Imediato

### Opção A — Rollback Direto via Wrangler CLI (Tempo de convergência: < 5 segundos)
```bash
# Rollback imediato para a versão pré-deploy confirmada:
npx wrangler rollback fcd51c68-3fa5-4d63-b867-d7d557554652 --name manga --message "Rollback para versao homologada estavel fcd51c68"

# Fallback secundário (se necessário):
npx wrangler rollback fafe6ae8-cd04-4f93-8125-bc7a02774619 --name manga --message "Rollback para baseline secundario fafe6ae8"
```

### Opção B — Redirecionamento 100% de Tráfego de Versão (Alternativa oficial Cloudflare)
```bash
npx wrangler versions deploy fcd51c68-3fa5-4d63-b867-d7d557554652@100% --name manga --message "Trafego convergido 100% para fcd51c68"
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
