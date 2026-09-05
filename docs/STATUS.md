# Estado verificável — 2026-09-05

## Criado

- Repositório: https://github.com/Awerkori/project-nox-manga
- Diretório: /home/awerkori/.Projects/project-nox-manga
- Banco público separado: izregkwaqdygwioqzwwo, região São Paulo.
- Central preservada. Nenhuma migration ou dado interno da central foi alterado.
- ADMIN definitivo provisionado usando o e-mail já verificado do owner da central. Nenhum segredo ou e-mail foi exposto.
- Importação de uma obra real da central verificada em rascunho. Reimportação não duplica cadastros; nenhum material intermediário foi publicado.

## Validação concluída

- Revisão atual: lint e checagem de tipos passaram sem erros/avisos; auditoria de dependências com zero vulnerabilidades.
- Build Cloudflare passou.
- Cinco testes de validação de mídia passaram.
- PostgreSQL descartável: RLS de todas as tabelas, USER/EDITOR/ADMIN, IDOR, spam, XP temporizado e único, notificação deduplicada, suspensão e proteção do último administrador.
- PostgreSQL descartável: convite exige e-mail exato confirmado, uso único, e-mail de convite privado, reserva de mídia exclusiva do servidor e limite gratuito.
- Navegador: nove páginas públicas em desktop/tablet/mobile, sem erros JavaScript ou overflow após a correção do tablet.
- Navegador com ADMIN real: 11 rotas renderizaram HTTP 200 sem erros JavaScript; importação idempotente pela interface; upload SVG/script com MIME PNG devolveu HTTP 400.
- Visitante acessando /admin recebeu HTTP 403.
- Scanner atual não encontrou secrets configurados em 198 arquivos de fonte/client/Worker; repetir após alterações.

## Pendências concretas

1. Sessão Supabase Management API/CLI expirou. Migration `20260905020000_upload_limits_and_invites.sql` validada localmente, ainda NÃO aplicada remotamente. O código de reserva de uploads/convites/avatar depende dela.
2. Conta Cloudflare ainda sem login; nenhum site em produção.
3. SMTP público ainda não configurado. O SMTP padrão do Supabase só envia para membros da organização. Cadastro, confirmação e recuperação não podem ser declarados prontos para o público.
4. Identidade da Stefany solicitada ao dono. Não associar editor por nome de exibição. Usar convite protegido por e-mail confirmado.
5. Bot/canal Telegram não configurados. Provider implementado mas ainda não testado com arquivos reais. Não prometer storage ilimitado.
6. Nenhum capítulo final aprovado disponível para publicar; não usar RAW, Clean ou Tradução como substitutos.
7. Concluir testes ponta a ponta de upload aceito, ZIP/reordenação, publicação, reader/progresso, comentários e likes em conteúdo final; testar sessão EDITOR real e login público.
8. Completar controles administrativos de remoção e finalizar estatísticas/descoberta e SEO por obra.
9. Repetir checks finais, commit/push, CI, deploy e inspeção da URL pública.

## Revisão automática

O teste SQL com fixtures no banco remoto foi rejeitado por risco. Foi substituído por PostgreSQL descartável, onde o mesmo teste passou e comprovou rollback. Não contornar o bloqueio criando as mesmas contas de teste por outro caminho. Depois houve rejeição temporária por limite de uso; a criação do ADMIN definitivo foi posteriormente autorizada e executada.

## Percentual

Último percentual informado ao dono: aproximadamente 35% validado. Código escrito não equivale a funcionalidade entregue. A plataforma não está pronta para uso.
