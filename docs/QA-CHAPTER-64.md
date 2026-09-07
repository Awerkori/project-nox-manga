# Validação real — Distant Sky 64

## Escopo

Teste realizado exclusivamente no Project Nox Manga em 7 de setembro de 2026, com o ZIP fornecido e autorizado pelo dono. Nenhum arquivo do capítulo foi obtido da Central da Staff. Nenhuma alteração em dados ou código da central foi realizada nesta tentativa.

- Obra no Manga: `c08a2531-7bf3-4324-979a-f7de0e66a62d`.
- Capítulo novo: `7627dfc4-f684-4e3a-9f89-28ac32d62f22`, número 64, `source_id` nulo.
- [Leitor público](https://project-nox-manga.project-nox-awerkori.workers.dev/ler/7627dfc4-f684-4e3a-9f89-28ac32d62f22).
- [Página da obra](https://project-nox-manga.project-nox-awerkori.workers.dev/obra/distant-sky).
- Capa e nomes dos autores conferidos na [página oficial da obra](https://www.webtoons.com/en/horror/distant-sky/list?title_no=75). O ZIP do usuário é a única origem das páginas do capítulo.

## Evidências concluídas

- Upload pelo formulário real de ADMIN do Manga: oito arquivos na ordem `0.png`, `bloco_00.png` até `bloco_06.png`. Rascunho salvo pela interface, sem duplicar capítulo.
- 49.165.246 bytes de imagens originais; 9.320.850 bytes após normalização WebP. Dimensões preservadas. As oito mídias foram confirmadas como prontas no provider Telegram exclusivo do Manga.
- Antes da publicação: leitor e página do rascunho retornaram 404 ao visitante; prévia autenticada decodificou as oito imagens.
- Publicação realizada pelo botão do editor com confirmação do material final. API pública retornou oito páginas com URLs do Manga, sem URLs de bot ou referência privada à staff.
- Leitor público mobile: imagens carregadas, sem overflow; não requisitou o capítulo inteiro na abertura. Página da obra passou a listar o capítulo 64.
- Conta real do dono: favorito, alternância Quero ler/Lendo, curtida única, progresso sequencial das oito páginas, conclusão com 25 XP e restauração da página 8 ao recarregar, sem novo crédito de XP.
- Nenhuma consulta à staff ocorreu no fluxo local. A consulta opcional passou a exigir ação explícita, protegida por regressão de navegador.
- Após a correção em produção: comentário real exibido como texto literal (sem executar HTML), editado, curtido e removido pela interface. Apenas esse comentário temporário foi retirado da área pública; seu registro continua recuperável na moderação.
- A conquista do primeiro capítulo foi entregue nas notificações reais. Histórico e continuar lendo mostraram o capítulo; capa mobile corrigida e conferida visualmente.

## Falhas encontradas e corrigidas

- Capa mobile respeitava altura HTML fixa e cortava o título. Altura automática e encaixe da imagem foram adicionados.
- O comentário era salvo, mas o PostgREST identificava dois caminhos entre comentários e membros. A consulta agora especifica `comments_user_id_fkey` e não oculta erros como uma lista vazia.
- Páginas públicas agora filtram comentários removidos mesmo para ADMIN; a visão de moderação mantém seu acesso. Duas regressões de loader reproduziram a falha e passaram após a correção.

## Limites desta validação

Não equivale a validar cadastro/recuperação de uma nova conta, sessão real EDITOR, capítulos de centenas de MB ou toda a plataforma. Não houve simulação de identidade da staff nem mudança artificial de XP, relógios ou progresso no banco remoto.

## Revisão técnica

Deploy da correção: `1b83a284-ba1c-4cbc-862d-1d3b2764e2d4`, commit `aa128de`; CI `34149236234` concluído com sucesso. Verificação posterior: 50 testes unitários, segurança em PostgreSQL descartável e sete testes de produção passaram, incluindo conteúdo real em 390/768/1366/1440 pixels. Lint, tipos, build e scanner de secrets passaram.
