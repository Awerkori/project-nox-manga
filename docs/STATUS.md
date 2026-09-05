# Estado verificável — 2026-09-05

## Criado

- Repositório: https://github.com/Awerkori/project-nox-manga
- Diretório: /home/awerkori/.Projects/project-nox-manga
- Banco público separado: izregkwaqdygwioqzwwo, região São Paulo.
- Central preservada. Nenhuma migration ou dado interno da central foi alterado. Uma função nova `nox-public-bridge` foi publicada no próprio Supabase da central, sem substituir funções existentes, para a integração limitada e autenticada.
- ADMIN definitivo provisionado usando o e-mail já verificado do owner da central. Nenhum segredo ou e-mail foi exposto.
- Importação de uma obra real da central verificada em rascunho. Reimportação não duplica cadastros; nenhum material intermediário foi publicado.

## Validação concluída

- Revisão atual: lint e checagem de tipos passaram sem erros/avisos; auditoria de dependências com zero vulnerabilidades.
- Build Cloudflare passou.
- Onze testes de mídia e autorização da integração passaram.
- PostgreSQL descartável: RLS de todas as tabelas, USER/EDITOR/ADMIN, IDOR, spam, XP temporizado e único, notificação deduplicada, suspensão e proteção do último administrador.
- PostgreSQL descartável: convite exige e-mail exato confirmado, uso único, e-mail de convite privado, reserva de mídia exclusiva do servidor e limite gratuito.
- Navegador: nove páginas públicas em desktop/tablet/mobile, sem erros JavaScript ou overflow após a correção do tablet.
- Navegador com ADMIN real: 11 rotas renderizaram HTTP 200 sem erros JavaScript; importação idempotente pela interface; upload SVG/script com MIME PNG devolveu HTTP 400.
- Visitante acessando /admin recebeu HTTP 403.
- Scanner atual não encontrou secrets configurados em 208 arquivos de fonte/client/Worker; repetir após alterações.
- Corrigida falha de tipos no CI, antes mascarada pela presença de variáveis locais; aguardar novo CI.
- Corrigida conclusão/XP de capítulos curtos; regressão e métricas agregadas validadas em PostgreSQL descartável.
- Integração limitada real: importação idempotente e listagem de staff autenticada funcionaram. Nenhum e-mail ou secret aparece na listagem.
- Auth público atualizado com URL de produção reservada, senha mínima de 10 caracteres e troca segura; TOTP e OTP de 8 caracteres preservados. Templates customizados aguardam SMTP próprio, sem upgrade.

## Pendências concretas

1. Login Supabase renovado pelo dono. Migrations `20260905020000_upload_limits_and_invites.sql` e `20260905030000_reading_and_discovery.sql` aplicadas no banco público e tipos regenerados.
2. Cloudflare autenticada e subdomínio gratuito registrado. O deploy ainda não ocorreu: a revisão automática exige aprovação específica para guardar a service-role do banco NOVO do site como secret de servidor nessa conta Cloudflare. A chave da CENTRAL foi removida da arquitetura de deploy e não será enviada. A URL reservada não é uma entrega funcional.
3. SMTP público ainda não configurado. O SMTP padrão do Supabase só envia para membros da organização. Cadastro, confirmação e recuperação não podem ser declarados prontos para o público.
4. Correção do dono: o acesso editorial é para membros autorizados da staff, não para uma pessoa chamada Stefany. O admin pode consultar os membros ativos da central e registrar convites vinculados ao e-mail confirmado da identidade real, sem expor esse e-mail na listagem. As permissões da central não são alteradas. A concessão segue pelo JWT do admin e pela RPC protegida. Validar o fluxo após a migration pendente.
5. Bot/canal Telegram não configurados. Provider implementado mas ainda não testado com arquivos reais. Não prometer storage ilimitado.
6. Nenhum capítulo final aprovado disponível para publicar; não usar RAW, Clean ou Tradução como substitutos.
7. Concluir testes ponta a ponta de upload aceito, ZIP/reordenação, publicação, reader/progresso, comentários e likes em conteúdo final; testar sessão EDITOR real e login público.
8. Controles administrativos de remoção adicionados com confirmação digitada; validar em ambiente descartável. Finalizar estatísticas/descoberta e SEO por obra.
9. Concluir commit/push, CI, deploy e inspeção da URL pública. Configuração de templates exige SMTP próprio no Free; não contratar upgrade. Templates preparados e mantidos desativados até existir remetente configurado.

## Revisão automática

O teste SQL com fixtures no banco remoto foi rejeitado por risco. Foi substituído por PostgreSQL descartável, onde o mesmo teste passou e comprovou rollback. Não contornar o bloqueio criando as mesmas contas de teste por outro caminho. Depois houve rejeição temporária por limite de uso; a criação do ADMIN definitivo foi posteriormente autorizada e executada.

## Percentual

Último percentual informado ao dono para o site público: aproximadamente 50% validado. A estimativa anterior de 80% referia-se à central da staff, outro projeto. Código escrito não equivale a funcionalidade entregue. A plataforma não está pronta para uso.
