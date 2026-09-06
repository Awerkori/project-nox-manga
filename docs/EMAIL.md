# E-mails de autenticação

O banco público Project Nox Manga usa Supabase Auth com Brevo Free. A configuração da central da staff não foi alterada.

## Configuração operacional

- Remetente Project Nox, com endereço verificado na Brevo.
- SMTP `smtp-relay.brevo.com:587`; intervalo mínimo por usuário de 60 segundos.
- Limite Auth inicial: 10 e-mails/hora, salvo e reaberto no painel. Mantém margem para a cota Free de 300/dia; os demais limites de autenticação foram preservados.
- Chave Standard dedicada, nome `Project Nox Manga`, expiração em 5 de setembro de 2027. A Brevo também informa expiração após 90 dias de inatividade.
- A chave foi transferida em memória entre os formulários autorizados e ficou somente na configuração SMTP do Supabase. Não há cópia no repositório, no Worker, no frontend ou em arquivo local. O cofre local não estava disponível. Não recuperar o valor para logs ou capturas de tela.
- Templates em `supabase/templates/confirmation.html` e `recovery.html`, publicados pelo painel do projeto público. Os links usam `token_hash` e a rota `/auth/confirm`, sem depender do cookie PKCE do navegador que iniciou o pedido.
- A listagem transacional da Brevo confirmou entrega de recuperação, incluindo o assunto personalizado. Isso não substitui o teste completo de cadastro, confirmação e troca de senha por usuários reais.

## Custo e entrega

A conta está no Free, sem cartão, com 300 envios/dia. Não habilitar cobrança, upgrade ou créditos adicionais. Ao atingir a cota, o envio pode ficar indisponível; não prometer volume ilimitado.

O endereço atual é de provedor gratuito. A [Brevo informa](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders) que pode substituir temporariamente esse remetente por um domínio compatível. Entrega observada não garante caixa de entrada ou confiabilidade futura. Não comprar domínio sem nova autorização.

## Manutenção segura

Não executar `supabase config push` indiscriminadamente: uma configuração local desatualizada pode substituir SMTP, templates ou limites ativos. Para alterações pelo CLI, disponibilizar as variáveis de SMTP apenas no processo e nunca registrar a saída bruta do diff, que pode conter credenciais. Preferir alterações pontuais pelo painel do projeto público ou Management API com saída redigida.

Rotacionar a chave antes da expiração: gerar Standard na Brevo, substituir diretamente no SMTP do banco público, comprovar envio e entrega, e só então desativar a antiga. Nunca enviar chaves da central da staff para este projeto.

Referências: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [chaves SMTP Brevo](https://help.brevo.com/hc/pt/articles/7959631848850-Criar-e-gerenciar-suas-chaves-SMTP), [logs transacionais](https://help.brevo.com/hc/en-us/articles/360021533839-Manage-your-transactional-logs-and-email-previews).
