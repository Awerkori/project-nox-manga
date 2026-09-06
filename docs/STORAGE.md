# Armazenamento de páginas

## Configuração validada em 6 de setembro de 2026

O conteúdo editorial usa um bot exclusivo do Project Nox Manga no canal privado SITE MANGÁ. O bot da central da staff não foi reutilizado nem alterado. A API confirmou que o bot do site pode publicar, mas não pode promover administradores, alterar o canal, moderar usuários, editar/excluir mensagens de outros ou gerenciar stories.

`TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` ficam exclusivamente como secrets do Worker público. A transferência foi feita em memória, sem arquivo local de credenciais, Git ou frontend. O token pode ser revogado no BotFather e substituído diretamente no secret do servidor. Nunca reutilizar o token da staff.

Foi testado um PNG real da marca, de 3.076 bytes: upload no Telegram, registro `storage_ready`, download autenticado com SHA-256 idêntico, acesso anônimo negado e tentativa condicional por ETag também negada. Isso não equivale a validar um capítulo completo ou um ZIP de centenas de MB.

## Limites e privacidade

- A API padrão do Telegram permite download de até 20 MB por arquivo. O site aceita no máximo 19 MB por página, mesmo se o capítulo completo for maior.
- ZIP: até 300 MB de entrada, 400 MB descompactados e 500 páginas. O navegador separa e normaliza as imagens antes de enviar páginas individualmente. O reader não baixa o ZIP inteiro.
- Supabase continua disponível para avatares e mídia já armazenada, com reserva total limitada a 750 MB. O banco mantém `provider` e `provider_key` privados.
- O site não entrega URLs do bot ao navegador. Cada pedido verifica publicação ou acesso editorial antes de baixar a página; o cache do navegador é privado e deve revalidar.
- O runtime Cloudflare aceita `redirect: 'manual'`, não `error`. Respostas de redirecionamento são rejeitadas, sem encaminhar credenciais. Há regressão executada no próprio workerd.
- Falhas de rede e de streaming são sanitizadas. O log usa somente rótulos fixos e status HTTP, nunca mensagens brutas do provider, URLs ou tokens.
- Telegram e Workers têm limites de uso, latência e disponibilidade. Não há promessa de storage ilimitado ou SLA. Não ativar paid broadcasts, upgrade, cartão ou cobrança.

## Validação e manutenção

`tests/telegram.test.ts` verifica redirecionamentos, formato/tamanho do arquivo, streaming, integridade de tamanho e erros sem credenciais. `tests/telegram-runtime.test.ts` usa workerd real sem conexão externa; precisa de permissão para abrir uma porta local.

`scripts/verify-private-upload.mjs` é uma verificação manual que cria um arquivo privado real da marca. Não executá-la repetidamente sem necessidade. `EXPECTED_MEDIA_PROVIDER=telegram` exige que o arquivo esteja no provider correto; o script compara o hash dos bytes recebidos com o registro salvo.

Referências: [Telegram getFile](https://core.telegram.org/bots/api#getfile), [limites dos bots](https://core.telegram.org/bots/faq), [limites Workers](https://developers.cloudflare.com/workers/platform/limits/).
