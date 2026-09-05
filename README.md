# Project Nox Manga

Plataforma pública da Project Nox: SvelteKit com SSR, Supabase Auth/PostgreSQL e publicação preparada para Cloudflare Workers Free.

## Estado

Em desenvolvimento. Não está entregue nem publicado. Consulte [o registro de validação](docs/STATUS.md) para evidências, limitações e próximos passos.

## Rodar

Node 22 ou posterior. `npm ci`, configure `.env` usando `.env.example` e execute `npm run dev`.

`PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_ANON_KEY` são públicos. `SUPABASE_SERVICE_ROLE_KEY`, `STAFF_SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN` e demais secrets ficam somente no servidor. Nunca versionar `.env`.

## Verificar

```
npm run lint
npm run check
npm test
node scripts/test-database.mjs
npm run build
node scripts/scan-secrets.mjs
git diff --check
```

Os testes de banco usam PostgreSQL descartável em memória. Nenhum fixture é criado no projeto remoto. `scripts/visual.mjs` registra navegação pública; `scripts/verify-owner.mjs` valida a conta administrativa real e importa o catálogo real como rascunho. Este último só deve ser executado pelo dono, com suas credenciais legitimamente disponíveis.

## Publicação

Aplique apenas migrations novas no projeto público. Nunca execute reset na central da staff. Para Workers, use `npm run build` e `wrangler deploy --secrets-file .env` depois de revisar as variáveis, atualizar a URL pública e autenticar a conta gratuita. Não habilite planos pagos. O deploy não está concluído até validar a URL real e os fluxos de Auth, publicação e leitura.

A API futura para Mihon e a fonte de verdade editorial estão documentadas em [docs/API.md](docs/API.md).

## Limites gratuitos

Workers Free e Supabase Free possuem cotas. O código interrompe novos uploads antes de consumir a reserva definida para Supabase Storage; não ativa cobranças. Telegram opera por página abaixo de 19 MB e exige bot/canal configurado exclusivamente no servidor. Um capítulo grande não é enviado ou baixado inteiro pelo leitor.
