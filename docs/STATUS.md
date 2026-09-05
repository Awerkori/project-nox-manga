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
- Dezoito testes de mídia, autorização da integração, comentários, preferências do leitor e SEO passaram.
- PostgreSQL descartável: RLS de todas as tabelas, USER/EDITOR/ADMIN, IDOR, spam, XP temporizado e único, notificação deduplicada, suspensão e proteção do último administrador.
- PostgreSQL descartável: convite exige e-mail exato confirmado, uso único, e-mail de convite privado, reserva de mídia exclusiva do servidor e limite gratuito.
- Navegador: nove páginas públicas em desktop/tablet/mobile, sem erros JavaScript ou overflow após a correção do tablet.
- Navegador com ADMIN real: 11 rotas renderizaram HTTP 200 sem erros JavaScript; importação idempotente pela interface; upload SVG/script com MIME PNG devolveu HTTP 400.
- Visitante acessando /admin recebeu HTTP 403.
- Scanner atual não encontrou secrets configurados em 215 arquivos de fonte/client/Worker; repetir após alterações.
- Corrigida falha de tipos no CI, antes mascarada pela presença de variáveis locais. CI do commit `88c5c02` passou (run `33980983629`).
- Corrigida conclusão/XP de capítulos curtos; regressão e métricas agregadas validadas em PostgreSQL descartável.
- Integração limitada real: importação idempotente e listagem de staff autenticada funcionaram. Nenhum e-mail ou secret aparece na listagem.
- Auth público atualizado com URL de produção reservada, senha mínima de 10 caracteres e troca segura; TOTP e OTP de 8 caracteres preservados. Templates customizados aguardam SMTP próprio, sem upgrade.
- Produção: cinco testes de visitante/API/responsividade passaram; 11 rotas do ADMIN real retornaram 200 sem erros JavaScript.
- Produção: nove páginas públicas em três larguras passaram sem overflow/erros; screenshots de home desktop/mobile, catálogo e login mobile revisados.
- Produção: upload de um PNG de 3.076 bytes da própria marca funcionou; download autenticado funcionou; acesso anônimo e tentativa de cache condicional receberam 404. O arquivo continua privado e não representa um capítulo.
- Leitor: só envia progresso após a imagem efetivamente carregar e ficar visível; bloqueios ao localStorage não interrompem leitura; saída da página tenta persistir progresso.
- CI do commit `8fd6c2a` passou, incluindo smoke tests de produção (run `33991859303`).
- SEO por obra: ComicSeries e breadcrumbs com escape de delimitadores HTML, sem avaliações ou titularidade inventadas. API de detalhe inclui gêneros/tags públicos. Formulários de conta e áreas pessoais recebem noindex.

## Pendências concretas

1. SMTP público ainda não configurado. O SMTP padrão do Supabase só envia para membros da organização. Cadastro, confirmação e recuperação não podem ser declarados prontos para o público. Solicitada ao dono a criação/confirmação de conta Brevo Free, sem cartão. Testar envio real antes de considerar resolvido; templates preparados permanecem desativados.
2. O acesso editorial é para membros autorizados da staff, não para uma pessoa chamada Stefany. O admin já consulta membros ativos e registra convites vinculados ao e-mail confirmado da identidade real. Validar aceite e sessão EDITOR real quando o SMTP estiver disponível. Migrations de convites e leitura já foram aplicadas; não há migration pendente nesta revisão.
3. Bot/canal Telegram não configurados. Provider implementado mas ainda não testado com arquivos reais. Não prometer storage ilimitado.
4. Última consulta pela integração autenticada retornou zero capítulos finais aprovados. Não usar RAW, Clean ou Tradução como substitutos.
5. Concluir testes ponta a ponta de ZIP/reordenação, publicação, reader/progresso, comentários e likes em conteúdo final; testar sessão EDITOR real e login público. Upload individual aceito já validado em produção.
6. Controles administrativos de remoção adicionados com confirmação digitada; validar em ambiente descartável. Finalizar estatísticas/descoberta e revisão das páginas com conteúdo real.
7. Repetir CI, deploy e inspeção da URL pública a cada entrega. A autorização do dono para guardar exclusivamente a service-role do banco público na Cloudflare já foi atendida; nenhuma nova autorização dessa chave está pendente.

## Revisão automática

O teste SQL com fixtures no banco remoto foi rejeitado por risco. Foi substituído por PostgreSQL descartável, onde o mesmo teste passou e comprovou rollback. Não contornar o bloqueio criando as mesmas contas de teste por outro caminho. Depois houve rejeição temporária por limite de uso; a criação do ADMIN definitivo foi posteriormente autorizada e executada.

## Percentual

Último percentual informado ao dono para o site público: aproximadamente 60% validado. A estimativa anterior de 80% referia-se à central da staff, outro projeto. Código escrito não equivale a funcionalidade entregue. A plataforma não está pronta para uso completo.
