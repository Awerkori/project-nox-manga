# Project Nox Manga — execução

## Compromissos

Somente planos gratuitos, sem cartão ou ativação de cobrança. Nenhum reset ou alteração de migration antiga da central. Não publicar material intermediário. Não declarar conclusão antes de testar produção com os quatro papéis.

## Arquitetura

- SvelteKit e Cloudflare Workers Free: SSR, rotas administrativas protegidas no servidor, assets estáticos gratuitos.
- Projeto Supabase separado: Auth, PostgreSQL, RLS, RPCs transacionais. A central privada mantém seus dados e autenticação.
- Provider de mídia privado com identificação opaca; páginas validadas por conteúdo, limites de tamanho e dimensões. Telegram somente por backend, abaixo do limite por página; ZIP processado antes do envio.
- Integração consulta somente obras e artefatos da etapa final aprovada, por origem e identificadores idempotentes. Publicação sempre explícita.

## Dependências humanas a verificar

Sessão Cloudflare; bot/canal Telegram; conta inequívoca da editora; remetente SMTP apto a enviar confirmação e recuperação para usuários públicos. Não são substituídos por mocks.

## Fontes verificadas

- https://core.telegram.org/bots/api#getfile — API padrão baixa até 20 MB por arquivo.
- https://supabase.com/docs/guides/auth/auth-smtp — SMTP padrão envia apenas a membros da organização.
- https://supabase.com/pricing — cotas do plano gratuito.
- https://developers.cloudflare.com/workers/platform/limits/ — Workers Free tem limites diários e de CPU.

## Critérios de entrega

Lint, tipos, testes funcionais e adversariais, build, auditoria de dependências, secrets, inspeção visual desktop/mobile, produção, contas USER/EDITOR/ADMIN, importação final e publicação. Registrar evidências e pendências reais.
