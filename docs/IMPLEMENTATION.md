# Project Nox Manga — execução

## Compromissos

Somente planos gratuitos, sem cartão ou ativação de cobrança. Nenhum reset ou alteração de migration antiga da central. Não publicar material intermediário. Não declarar conclusão antes de testar produção com os quatro papéis.

## Arquitetura

- SvelteKit e Cloudflare Workers Free: SSR, rotas administrativas protegidas no servidor, assets estáticos gratuitos.
- Projeto Supabase separado: Auth, PostgreSQL, RLS, RPCs transacionais. A central privada mantém seus dados e autenticação.
- Provider de mídia privado com identificação opaca; páginas validadas por conteúdo, limites de tamanho e dimensões. Telegram somente por backend, abaixo do limite por página; ZIP processado antes do envio.
- Integração limitada hospedada no Supabase da central: valida JWT/cargo no banco público, consulta somente campos editoriais permitidos e arquivos finais aprovados. Gestão da equipe exclusiva do admin, sem exportar e-mails na listagem. Não envia a chave administrativa da central para a Cloudflare. Publicação sempre explícita.

## Dependências humanas a verificar

Cloudflare e Supabase autenticados; a chave administrativa exclusivamente do banco público já foi autorizada e configurada como secret de servidor. Brevo Free conectado ao Auth; entrega de recuperação confirmada nos logs da Brevo. Faltam bot/canal de storage pesado, membros reais da staff autorizados pelo admin, capítulos finais aprovados e QA completo dos fluxos públicos. Não são substituídos por mocks. O acesso editorial é para as contas autorizadas da staff, não para uma pessoa específica. Consulte STATUS.md para o estado verificável e EMAIL.md antes de alterar Auth/SMTP.

## Fontes verificadas

- https://core.telegram.org/bots/api#getfile — API padrão baixa até 20 MB por arquivo.
- https://supabase.com/docs/guides/auth/auth-smtp — SMTP padrão envia apenas a membros da organização.
- https://supabase.com/pricing — cotas do plano gratuito.
- https://developers.cloudflare.com/workers/platform/limits/ — Workers Free tem limites diários e de CPU.

## Critérios de entrega

Lint, tipos, testes funcionais e adversariais, build, auditoria de dependências, secrets, inspeção visual desktop/mobile, produção, contas USER/EDITOR/ADMIN, importação final e publicação. Registrar evidências e pendências reais.
