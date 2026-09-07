# Estado verificável — 2026-09-07

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
- Sessenta e sete testes de mídia, integração, comentários, leitor, SEO, templates, ZIP, retomada de uploads, paginação e provider Telegram passaram, incluindo workerd real sem rede externa e regressões dos loaders de comentários e áreas pessoais.
- PostgreSQL descartável: RLS de todas as tabelas, USER/EDITOR/ADMIN, IDOR, spam, XP temporizado e único, notificação deduplicada, suspensão e proteção do último administrador.
- PostgreSQL descartável: convite exige e-mail exato confirmado, uso único, e-mail de convite privado, reserva de mídia exclusiva do servidor e limite gratuito.
- Navegador: nove páginas públicas em desktop/tablet/mobile, sem erros JavaScript ou overflow após a correção do tablet.
- Navegador com ADMIN real: 11 rotas renderizaram HTTP 200 sem erros JavaScript; importação idempotente pela interface; upload SVG/script com MIME PNG devolveu HTTP 400.
- Visitante acessando /admin recebeu HTTP 403.
- Scanner não encontrou secrets configurados no código, client ou Worker; repetir após alterações.
- Corrigida falha de tipos no CI, antes mascarada pela presença de variáveis locais. CI do commit `88c5c02` passou (run `33980983629`).
- Corrigida conclusão/XP de capítulos curtos; regressão e métricas agregadas validadas em PostgreSQL descartável.
- Integração limitada real: importação idempotente e listagem de staff autenticada funcionaram. Nenhum e-mail ou secret aparece na listagem.
- Auth público atualizado com URL de produção reservada, senha mínima de 10 caracteres e troca segura; TOTP e OTP de 8 caracteres preservados. Templates customizados publicados após configurar SMTP próprio, sem upgrade.
- Produção: cinco testes de visitante/API/responsividade passaram; 11 rotas do ADMIN real retornaram 200 sem erros JavaScript.
- Produção: nove páginas públicas em três larguras passaram sem overflow/erros; screenshots de home desktop/mobile, catálogo e login mobile revisados.
- Produção: upload de um PNG de 3.076 bytes da própria marca funcionou; download autenticado funcionou; acesso anônimo e tentativa de cache condicional receberam 404. O arquivo continua privado e não representa um capítulo.
- Leitor: só envia progresso após a imagem efetivamente carregar e ficar visível; bloqueios ao localStorage não interrompem leitura; saída da página tenta persistir progresso.
- CI do commit `8fd6c2a` passou, incluindo smoke tests de produção (run `33991859303`).
- SEO por obra: ComicSeries e breadcrumbs com escape de delimitadores HTML, sem avaliações ou titularidade inventadas. API de detalhe inclui gêneros/tags públicos. Formulários de conta e áreas pessoais recebem noindex.
- SMTP Brevo Free configurado no Supabase público pelo navegador autenticado. Remetente Project Nox verificado; chave Standard dedicada com expiração em 05/09/2027, transferida apenas em memória, sem arquivo local, Worker ou Git.
- Brevo registrou entrega do e-mail real de recuperação, incluindo o assunto Project Nox. A senha do dono não foi alterada pelo agente.
- Templates de confirmação e recuperação salvos e reabertos no painel; HTML e links token_hash conferidos. A confirmação completa de cadastro por uma nova conta real continua pendente.
- Limite de e-mails Auth configurado e reaberto: 10/hora, com intervalo mínimo de 60 segundos por usuário. Nenhum upgrade ou cobrança ativado.
- Bot exclusivo criado e conectado ao canal privado SITE MANGÁ. Permissão apenas de publicação confirmada pela API; dois secrets transferidos diretamente à Cloudflare. Nenhum token da staff foi reutilizado.
- Telegram real: upload da marca (3.076 bytes), download com SHA-256 idêntico e bloqueio de acesso anônimo/condicional passaram. Arquivo privado `4f7268dd-17ed-4495-8e37-917d581afff5`, não representa capítulo.
- Corrigida incompatibilidade de redirect no workerd. Commit `9e957e6`, CI `34048576813` passou; deploy `c6dcc24d-f92d-45a3-a4f0-bfff3cc414a3` validado pelo upload real. Consulte STORAGE.md.
- Nova consulta pela integração limitada: três membros ativos; convites EDITOR para dois membros registrados pela interface real do owner, sem erros JavaScript e sem conceder ADMIN. O aceite das próprias pessoas continua pendente.
- O único arquivo marcado como final do capítulo 3 é `icon.png`, um símbolo da marca de 1.254 × 1.254 pixels, conferido visualmente. Não foi publicado como capítulo. O dono foi solicitado a fornecer o ZIP real aprovado.
- Oito testes de navegador com fixtures exclusivamente locais passaram: leitor com progresso independente entre capítulos, upload de ZIP com falha/retomada sem duplicar páginas e reordenação, em 390/768/1366/1440 pixels. Não substituem QA de capítulos reais em produção.
- Scanner ampliado para tokens de bots, Brevo, JWT privado e histórico Git completo, sem imprimir valores. Varredura local passou.
- Commit `2285440`: CI `34064163624` passou; deploy `92882326-8a0f-407b-b4f9-c2d12a1ee416`. WebP real corrigido e validado no Telegram: 2.150 bytes, SHA-256 idêntico e acesso anônimo/condicional negado. Arquivo privado `97a500a1-fe15-4e8a-9316-031181650321`, não representa capítulo.
- QA em produção encontrou overflow no painel administrativo mobile. Corrigido dimensionamento do grid; oito regressões locais passaram com o layout administrativo completo em quatro larguras. Deploy `51d9d80e-7349-4553-a377-7130c4e8006c`, commit `a59980c`: editor real passou em 390/768/1366/1440 pixels, sem overflow ou erros JavaScript; cancelar saída preserva alterações e confirmar permite sair. Screenshots mobile/desktop revisados. Nenhum rascunho de teste foi salvo.
- Exclusão definitiva validada em PostgreSQL descartável: USER e EDITOR bloqueados, ADMIN autorizado; associações de páginas/biblioteca/progresso removidas, mídia preservada e ações auditadas. Nenhum conteúdo real foi excluído.

## Pendências concretas

Atualização de escopo: o dono determinou que o teste do capítulo 64 fosse feito exclusivamente no Manga, sem acessar ou alterar a Central da Staff. O ZIP foi enviado diretamente pelo editor do site. Consulte [QA-CHAPTER-64.md](QA-CHAPTER-64.md).

Último deploy funcional: `1b8a330`, versão `ad5359dd-4b87-418b-9dbf-ff46fcb91624`. Sete testes de produção passaram, incluindo o capítulo real. CI desta revisão: `34150596686`, concluído com sucesso (verificação e smoke de produção).

Revisão das áreas pessoais: biblioteca, favoritos, histórico e notificações agora têm paginação de 20 itens, totais exatos, ordenação estável e filtros preservados; perfil consulta contagens sem carregar coleções inteiras. Dezessete testes de dados e quatro novos testes de navegador passaram (12 testes de navegador no total), com mais de 100 registros exclusivamente em fixtures locais. No site real, as cinco áreas passaram com ADMIN em 390/768/1366/1440 pixels; filtros e redirecionamentos de páginas inválidas funcionaram. A notificação real de conquista foi marcada como lida pela interface, permaneceu salva após recarregar e continua disponível em Todas. Sem erros JavaScript/HTTP 5xx ou requisições à staff. Screenshots do perfil real mobile/desktop revisados. Script reproduzível: `scripts/verify-member-pages.mjs`; alteração de leitura exige opt-in explícito.

1. SMTP resolvido: entrega real confirmada na Brevo. Ainda validar cadastro, confirmação e troca de senha ponta a ponta com identidades reais. Consultar EMAIL.md antes de mudar SMTP ou executar config push; não sobrescrever o SMTP remoto com a configuração local de desenvolvimento.
2. Convites da staff real registrados. Consulta somente de contagens no banco próprio do Manga confirmou um ADMIN ativo e dois convites pendentes, sem EDITOR ativo. Validar aceite e sessão EDITOR das próprias pessoas. Migrations de convites e leitura já foram aplicadas; não há migration pendente nesta revisão.
3. Bot/canal Telegram configurados; capítulo real com oito páginas validado pelo upload local, publicação, API e leitor. Ainda testar cargas de centenas de MB; não prometer storage ilimitado.
4. Bloqueio do capítulo resolvido: Distant Sky 64 está publicado a partir do ZIP fornecido pelo dono, sem usar o ícone nem a central como origem.
5. Favoritos, biblioteca, curtidas, comentários (incluindo edição/remoção e HTML literal), histórico, continuar lendo, conquista e leitura completa com XP único passaram na conta real do dono. Validar demais notificações; testar sessão EDITOR real e login público.
6. Controles administrativos de remoção adicionados com confirmação digitada; backend validado em ambiente descartável. Finalizar estatísticas/descoberta e revisão das páginas com conteúdo real.
7. Repetir CI, deploy e inspeção da URL pública a cada entrega. A autorização do dono para guardar exclusivamente a service-role do banco público na Cloudflare já foi atendida; nenhuma nova autorização dessa chave está pendente.

## Revisão automática

O teste SQL com fixtures no banco remoto foi rejeitado por risco. Foi substituído por PostgreSQL descartável, onde o mesmo teste passou e comprovou rollback. Não contornar o bloqueio criando as mesmas contas de teste por outro caminho. Depois houve rejeição temporária por limite de uso; a criação do ADMIN definitivo foi posteriormente autorizada e executada.

## Percentual

Estimativa após publicação e leitura reais do capítulo 64: aproximadamente 72%. A etapa anterior estava em 68%; os antigos 80% referiam-se à central da staff, outro projeto. Código escrito não equivale a funcionalidade entregue. A plataforma não está pronta para uso completo.
