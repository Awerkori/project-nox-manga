# Estado verificável — 2026-09-05

## Criado

- Repositório: https://github.com/Awerkori/project-nox-manga
- Diretório: /home/awerkori/.Projects/project-nox-manga
- Banco público separado: izregkwaqdygwioqzwwo, região São Paulo.
- Site online em validação: https://project-nox-manga.project-nox-awerkori.workers.dev
- Primeiro deploy: versão Cloudflare `076760b1-af2c-45bb-a04b-c406130ce902`. Credenciais conferidas como `secret_text`; nenhuma chave da central foi enviada.
- Central preservada. Nenhuma migration ou dado interno da central foi alterado. Uma função nova `nox-public-bridge` foi publicada no próprio Supabase da central, sem substituir funções existentes, para a integração limitada e autenticada.
- ADMIN definitivo provisionado usando o e-mail já verificado do owner da central. Nenhum segredo ou e-mail foi exposto.
- Importação de uma obra real da central verificada em rascunho. Reimportação não duplica cadastros; nenhum material intermediário foi publicado.

## Validação concluída

- Revisão atual: lint e checagem de tipos passaram sem erros/avisos; auditoria de dependências com zero vulnerabilidades.
- Build Cloudflare passou.
- Quinze testes de mídia, autorização da integração, organização de comentários e preferências do leitor passaram.
- PostgreSQL descartável: RLS de todas as tabelas, USER/EDITOR/ADMIN, IDOR, spam, XP temporizado e único, notificação deduplicada, suspensão e proteção do último administrador.
- PostgreSQL descartável: convite exige e-mail exato confirmado, uso único, e-mail de convite privado, reserva de mídia exclusiva do servidor e limite gratuito.
- Navegador: nove páginas públicas em desktop/tablet/mobile, sem erros JavaScript ou overflow após a correção do tablet.
- Navegador com ADMIN real: 11 rotas renderizaram HTTP 200 sem erros JavaScript; importação idempotente pela interface; upload SVG/script com MIME PNG devolveu HTTP 400.
- Visitante acessando /admin recebeu HTTP 403.
- Scanner atual não encontrou secrets configurados em 208 arquivos de fonte/client/Worker; repetir após alterações.
- Corrigida falha de tipos no CI, antes mascarada pela presença de variáveis locais. CI do commit `88c5c02` passou (run `33980983629`).
- Corrigida conclusão/XP de capítulos curtos; regressão e métricas agregadas validadas em PostgreSQL descartável.
- Integração limitada real: importação idempotente e listagem de staff autenticada funcionaram. Nenhum e-mail ou secret aparece na listagem.
- Auth público atualizado com URL de produção reservada, senha mínima de 10 caracteres e troca segura; TOTP e OTP de 8 caracteres preservados. Templates customizados aguardam SMTP próprio, sem upgrade.
- Produção: cinco testes de visitante/API/responsividade passaram; 11 rotas do ADMIN real retornaram 200 sem erros JavaScript.
- Produção: nove páginas públicas em três larguras passaram sem overflow/erros; screenshots de home desktop/mobile, catálogo e login mobile revisados.
- Produção: upload de um PNG de 3.076 bytes da própria marca funcionou; download autenticado funcionou; acesso anônimo e tentativa de cache condicional receberam 404. O arquivo continua privado e não representa um capítulo.
- Leitor: só envia progresso após a imagem efetivamente carregar e ficar visível; bloqueios ao localStorage não interrompem leitura; saída da página tenta persistir progresso.

## Pendências concretas

1. Login Supabase renovado pelo dono. Migrations `20260905020000_upload_limits_and_invites.sql` e `20260905030000_reading_and_discovery.sql` aplicadas no banco público e tipos regenerados.
2. O dono autorizou explicitamente guardar exclusivamente a service-role do banco público na Cloudflare. Deploy realizado e validado nas rotas acima; a plataforma completa ainda não está entregue.
3. SMTP público ainda não configurado. O SMTP padrão do Supabase só envia para membros da organização. Cadastro, confirmação e recuperação não podem ser declarados prontos para o público.
4. Correção do dono: o acesso editorial é para membros autorizados da staff, não para uma pessoa chamada Stefany. O admin pode consultar os membros ativos da central e registrar convites vinculados ao e-mail confirmado da identidade real, sem expor esse e-mail na listagem. As permissões da central não são alteradas. A concessão segue pelo JWT do admin e pela RPC protegida. Validar o fluxo após a migration pendente.
5. Bot/canal Telegram não configurados. Provider implementado mas ainda não testado com arquivos reais. Não prometer storage ilimitado.
6. Nova consulta pela integração autenticada retornou zero capítulos finais aprovados. Não usar RAW, Clean ou Tradução como substitutos.
7. Concluir testes ponta a ponta de ZIP/reordenação, publicação, reader/progresso, comentários e likes em conteúdo final; testar sessão EDITOR real e login público. Upload individual aceito já validado em produção.
8. Controles administrativos de remoção adicionados com confirmação digitada; validar em ambiente descartável. Finalizar estatísticas/descoberta e SEO por obra.
9. Concluir commit/push, CI, deploy e inspeção da URL pública. Configuração de templates exige SMTP próprio no Free; não contratar upgrade. Templates preparados e mantidos desativados até existir remetente configurado.

## Revisão automática

O teste SQL com fixtures no banco remoto foi rejeitado por risco. Foi substituído por PostgreSQL descartável, onde o mesmo teste passou e comprovou rollback. Não contornar o bloqueio criando as mesmas contas de teste por outro caminho. Depois houve rejeição temporária por limite de uso; a criação do ADMIN definitivo foi posteriormente autorizada e executada.

## Percentual

Último percentual informado ao dono para o site público: aproximadamente 60% validado. A estimativa anterior de 80% referia-se à central da staff, outro projeto. Código escrito não equivale a funcionalidade entregue. A plataforma não está pronta para uso completo.
