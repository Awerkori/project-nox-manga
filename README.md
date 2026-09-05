# Project Nox Manga

Plataforma pública da Project Nox: SvelteKit com SSR, Supabase Auth/PostgreSQL e publicação preparada para Cloudflare Workers Free.

## Estado

Online em validação: https://project-nox-manga.project-nox-awerkori.workers.dev. Ainda não está entregue como plataforma completa. Consulte [o registro de validação](docs/STATUS.md) para evidências, limitações e próximos passos.

## Rodar

Node 22 ou posterior. `npm ci`, configure `.env` usando `.env.example` e execute `npm run dev`.

`PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_ANON_KEY` são públicos. `SUPABASE_SERVICE_ROLE_KEY` pertence exclusivamente ao banco público novo e só pode existir no servidor. A chave administrativa da central **não é necessária no site nem pode ser enviada à Cloudflare**: `STAFF_BRIDGE_URL` aponta para uma função limitada na própria central, que verifica o JWT e o cargo do usuário. Nunca versionar `.env`, arquivos `.dev.vars*` ou tokens Telegram.

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

Aplique apenas migrations novas no projeto público. Nunca execute reset na central da staff. Para Workers, use `npm run build` e um arquivo de secrets dedicado e revisado, limitado às credenciais do site. **Não envie o `.env` inteiro.** A guarda da chave administrativa do banco público na Cloudflare depende da aprovação específica registrada pelo dono. Não habilite planos pagos. O deploy não está concluído até validar a URL real e os fluxos de Auth, publicação e leitura.

A função `supabase/functions/nox-public-bridge` deve ficar no projeto da central, não no projeto público. As únicas configurações adicionais dela são `NOX_PUBLIC_URL` e `NOX_PUBLIC_ANON_KEY` (públicas). A verificação padrão de JWT da gateway é substituída pela validação explícita do JWT no Auth do site e consulta do cargo no banco, por serem projetos distintos. Não há SQL genérico, acesso anônimo ou escrita no banco da central.

A API futura para Mihon e a fonte de verdade editorial estão documentadas em [docs/API.md](docs/API.md).

## Limites gratuitos

Workers Free e Supabase Free possuem cotas. O código interrompe novos uploads antes de consumir a reserva definida para Supabase Storage; não ativa cobranças. Telegram opera por página abaixo de 19 MB e exige bot/canal configurado exclusivamente no servidor. Um capítulo grande não é enviado ou baixado inteiro pelo leitor.
