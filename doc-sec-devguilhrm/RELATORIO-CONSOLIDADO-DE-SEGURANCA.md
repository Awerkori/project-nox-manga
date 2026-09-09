# Relatório consolidado de segurança — Project Nox Manga

**Data da revisão:** 9 de setembro de 2026  
**Escopo:** clone local `project-nox-manga`; código SvelteKit, Supabase/PostgreSQL, rotas HTTP, armazenamento e dependências  
**Fora do escopo:** repositório/fork Mihon, infraestrutura em produção e testes ofensivos contra terceiros  
**Estado:** todos os achados de código descritos neste relatório possuem correção no clone analisado

## 1. Sumário executivo

O Project Nox é uma ferramenta open source de leitura. O cadastro é aberto e os usuários podem enviar o conteúdo que desejam ler. Por isso, o modelo de ameaça não considera segredo:

- o código-fonte, o schema, os nomes de tabelas e as RPCs;
- `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_ANON_KEY`, que são públicas por projeto;
- obras e arquivos que foram deliberadamente publicados para leitura pública.

A segurança deve continuar válida mesmo quando um visitante lê todas as migrations, cria uma conta legítima e chama a Data API diretamente. O limite de confiança está nas grants, policies RLS, constraints, RPCs e decisões de autorização executadas no servidor.

A revisão consolidou nove classes de falha. As V-02, V-03 e V-04 já haviam sido corrigidas na branch; esta rodada fechou as V-01 e V-05 a V-09. Nenhuma delas demonstrou vazamento da `service_role`, execução arbitrária de SQL, tomada automática de conta ou controle completo do PostgreSQL.

| ID   | Achado                                        | Ator mínimo antes da correção          | Impacto principal                               | Severidade contextual                                                              | Estado    |
| ---- | --------------------------------------------- | -------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- | --------- |
| V-01 | Regra etária não aplicada na RLS              | Visitante/conta comum                  | Acesso a conteúdo marcado `ADULT_18`            | Média; requisito de produto/compliance                                             | Corrigida |
| V-02 | Colunas privadas de membros expostas          | Visitante anônimo                      | Privacidade e reconhecimento                    | Média, CVSS 5.3                                                                    | Corrigida |
| V-03 | Escrita direta na central de denúncias        | Conta comum; editor para adulteração   | Integridade da moderação                        | Média, CVSS 5.4                                                                    | Corrigida |
| V-04 | Limite de corpo baseado no header             | Cliente HTTP                           | Consumo de memória/CPU e disponibilidade        | Média, CVSS 5.3                                                                    | Corrigida |
| V-05 | Mensagens internas devolvidas ao cliente      | Conta comum ou staff, conforme rota    | Divulgação de detalhes internos                 | Baixa/Média                                                                        | Corrigida |
| V-06 | `sharp` vulnerável e dependências flutuantes  | Cadeia de desenvolvimento/CI           | Risco no processamento de imagem e supply chain | Alerta upstream alto; risco da aplicação contextual                                | Corrigida |
| V-07 | Mídia devolvida do cache antes da autorização | Quem conheceu a URL enquanto pública   | Revogação ineficaz após despublicação/takedown  | Alta se o material precisar ser retirado; baixa para conteúdo que continua público | Corrigida |
| V-08 | Atualização direta da fila editorial          | Editor ou conta editorial comprometida | Falsificação de prioridade, estado e autoria    | Média, CVSS aproximado 4.9                                                         | Corrigida |
| V-09 | XP aceito após salto à página final           | Conta comum                            | Fraude de progressão e ranking                  | Média/Baixa, CVSS aproximado 4.3                                                   | Corrigida |

## 2. Interpretação correta para um projeto open source

Encontrar a URL do Supabase e a chave `anon` no frontend não significa invadir o banco. Esses valores identificam o projeto e atribuem ao cliente o papel limitado `anon`. O que decide se existe uma vulnerabilidade é o que esse papel consegue fazer depois que RLS e grants são aplicados.

Da mesma forma, um arquivo que o usuário decidiu publicar para leitura pública não representa vazamento apenas por ser acessível. O risco nasce quando:

- dados privados aparecem junto do conteúdo público;
- um rascunho ou material despublicado continua acessível;
- uma regra anunciada pelo produto, como `ADULT_18`, pode ser contornada;
- uma conta comum consegue escrever em tabelas internas;
- uma conta editorial consegue alterar campos que deveriam ser controlados exclusivamente por RPC.

No caso da V-01, a classificação depende da política do projeto. Se não existir obrigação de restringir conteúdo por idade, ela é uma inconsistência funcional, não uma invasão. O código, entretanto, dizia que obras `ADULT_18` eram “exclusivamente para maiores de 18 anos”; a correção faz o backend cumprir essa promessa. A declaração de idade continua sendo autodeclarada, não uma verificação documental.

## 3. Achados, exploração unitária e correções

### V-01 — autorização etária ausente na fonte de dados

**Condição anterior.** `public_chapter()` e as policies públicas verificavam publicação, mas não `content_rating`. As páginas Svelte bloqueavam somente o valor literal `MINOR` e podiam recorrer a um cookie controlado pelo navegador. A API pública e `/media` permaneciam fora dessa decisão.

**Exploração unitária.** Um pesquisador lia as migrations públicas, encontrava `content_rating`, consultava obras e capítulos pela Data API com a chave `anon` e obtinha os `media_id`. Não era necessário adulterar o banco: bastava usar os caminhos públicos que ignoravam a regra etária.

**Impacto.** Acesso a material marcado como restrito. Não fornece senha, sessão de terceiro nem permissão administrativa.

**Correção.** A migration `20260909120000_security_hardening.sql` criou `member_is_adult()` e `public_work()`, atualizou `public_chapter()` e refez as policies de obras, tags, capítulos, páginas, comentários e likes. A autorização agora ocorre no PostgreSQL. As rotas `/obra` e `/ler` consultam `member_self_profile()` e falham de forma fechada: `UNKNOWN`, ausência de conta e `MINOR` não satisfazem a regra.

**CWE/OWASP:** CWE-862, CWE-863; OWASP A01 — Broken Access Control.

### V-02 — exposição de atributos privados de membros

**Condição anterior.** A combinação de grants de coluna e policy pública em `members` permitia que o papel `anon` consultasse atributos como idade declarada, preferência de blur, indicadores internos e XP.

**Exploração unitária.** Conhecendo a URL e a chave `anon`, um visitante consultava `members` diretamente e paginava perfis. Os dados podiam ser correlacionados com comentários e nomes públicos para reconhecimento ou engenharia social.

**Impacto.** Quebra de privacidade e enriquecimento de perfis. Os dados não continham senha ou token de sessão e não permitiam entrar automaticamente nas contas.

**Correção.** A migration `20260909100000_fix_member_private_columns.sql` revogou grants amplos, concedeu apenas colunas públicas e criou `member_self_profile()` para o próprio usuário e `member_public_ranking()` para ranking sem expor `is_test`.

**CWE/OWASP:** CWE-200; OWASP A01.

### V-03 — central de denúncias com escrita direta

**Condição anterior.** Usuários autenticados conseguiam inserir denúncias fora do endpoint e editores podiam atualizar campos que deveriam ser imutáveis, como autoria, alvo, motivo e timestamps.

**Exploração unitária.** Como o cadastro é aberto, o atacante criava a própria conta e usava o token legítimo para chamar a Data API. Ele criava registros incoerentes ou distribuía spam entre vários alvos. Com uma conta editorial obtida por um ataque independente, poderia reescrever o histórico.

**Impacto.** Poluição da fila, perda de confiabilidade e possível falsificação da trilha de moderação. A falha não promovia a conta comum a editor.

**Correção.** `20260909110000_fix_report_integrity.sql` revogou `INSERT`/`UPDATE` diretos, adicionou constraint de coerência, centralizou submissão e moderação em RPCs, aplicou deduplicação/rate limit e criou `report_audit`.

**CWE/OWASP:** CWE-284, CWE-915; OWASP A01 e A04.

### V-04 — evasão do limite real do corpo HTTP

**Condição anterior.** `Content-Length` era usado como referência antes do parsing. Um cliente podia omitir o header ou usar transferência fragmentada, fazendo a aplicação materializar mais dados do que o limite lógico.

**Exploração unitária.** O atacante enviava diversas requisições chunked acima do limite para rotas que processavam JSON, formulário ou binário. Mesmo que a ação de negócio falhasse, memória, CPU e cota poderiam ser consumidas.

**Impacto.** Degradação e indisponibilidade; não concede leitura ou escrita no banco.

**Correção.** `src/lib/server/request-body.ts` conta os bytes efetivamente recebidos, cancela o stream ao exceder o limite e só então permite parsing. `src/hooks.server.ts` mantém rejeição antecipada para `Content-Length` inválido, sem tratá-lo como fonte única de verdade.

**CWE/OWASP:** CWE-400; OWASP A04/A05.

### V-05 — mensagens internas de banco e integrações

**Condição anterior.** Rotas devolviam `error.message`/`problem.message` de PostgreSQL, Supabase ou bridge diretamente ao cliente.

**Exploração unitária.** Um usuário enviava UUIDs inválidos, ações incompatíveis ou valores que violavam constraints e comparava as respostas. Nomes de função, constraint, coluna e detalhes de integração podiam orientar tentativas posteriores.

**Impacto.** Divulgação auxiliar, sem acesso direto a dados.

**Correção.** As respostas agora usam mensagens estáveis e genéricas. Logs do servidor registram apenas rótulo, operação e código seguro, sem copiar mensagens upstream que possam conter dados sensíveis.

**CWE/OWASP:** CWE-209; OWASP A05 — Security Misconfiguration.

### V-06 — dependências vulneráveis e versões `latest`

**Condição anterior.** `npm audit` apontava três ocorrências altas na cadeia `wrangler` → `miniflare` → `sharp < 0.35.4`. O `package.json` também usava `latest`, permitindo que instalações futuras selecionassem versões não revisadas.

**Exploração unitária.** A exploração dependeria de uma máquina de desenvolvimento ou CI processar uma imagem HEIF maliciosa pelo caminho vulnerável de `sharp`. Não foi demonstrado que uploads da aplicação atingissem esse caminho em produção.

**Impacto.** Risco concentrado na cadeia de build/desenvolvimento, não uma tomada remota confirmada do site.

**Correção.** Override de `sharp` para `0.35.4`, dependências antes marcadas como `latest` fixadas nas versões revisadas e requisito explícito de Node `>=22.12.0`. O lockfile foi atualizado e `npm audit` passou com zero vulnerabilidades.

**CWE/OWASP:** CWE-1104; OWASP A06 — Vulnerable and Outdated Components.

### V-07 — cache de mídia impedia revogação

**Condição anterior.** `/media/[id]` consultava `caches.default` antes de verificar publicação e autorização. Uma resposta pública recebia TTL de um ano e `immutable`.

**Exploração unitária.** O atacante acessava uma página enquanto publicada e guardava a URL UUID da mídia. Após a equipe despublicar, arquivar ou atender um takedown, ele repetia a URL. A borda podia devolver os bytes antigos antes de consultar a situação atual no banco.

**Impacto.** Persistência de material que deveria ter sido retirado. Se o arquivo continua intencionalmente público, não há quebra de confidencialidade; a gravidade aparece no momento da revogação.

**Correção.** O atalho pelo cache foi removido. Toda requisição passa pela autorização atual, e as respostas usam `private, no-store`. O ETag continua disponível, mas um `304` só é emitido depois da revalidação.

**Limite inevitável.** Nenhum sistema consegue apagar cópias que uma pessoa já baixou enquanto o conteúdo era público. A correção garante revogação no serviço, não apagamento do dispositivo do leitor.

**CWE/OWASP:** CWE-524, CWE-613; OWASP A01/A05.

### V-08 — mutação direta de solicitações do importador

**Condição anterior.** `authenticated` possuía `UPDATE` sobre `importer_staff_requests`, e a policy exigia apenas `is_editor()`. Um editor podia ignorar as RPCs e alterar `requested_by`, `work_id`, `priority_boost`, `status` e timestamps.

**Exploração unitária.** Usando a sessão editorial, o atacante enviava um `PATCH` pela Data API em vez de usar `importer_prioritize_work()` ou `importer_cancel_staff_request()`.

**Impacto.** Falsificação de autoria e estado, prioridade abusiva e interferência operacional. Requer editor legítimo ou comprometimento independente dessa conta.

**Correção.** A migration de hardening removeu policies de inserção/atualização e revogou esses privilégios de `authenticated`. Editores mantêm leitura, enquanto mutações passam exclusivamente pelas RPCs.

**CWE/OWASP:** CWE-862, CWE-915; OWASP A01.

### V-09 — progressão de leitura não sequencial

**Condição anterior.** `read_page` aceitava página maior ou igual a `next_page`. Após o tempo mínimo, enviar a página final ou a flag `completed` podia produzir XP sem percorrer as páginas intermediárias.

**Exploração unitária.** Uma conta comum iniciava uma sessão, aguardava quinze segundos e chamava a RPC diretamente com a última página. O limite diário reduzia volume, mas não validava a sequência.

**Impacto.** XP, títulos e ranking indevidos. Não altera XP de outros usuários nem fornece privilégios administrativos.

**Correção.** Dois invariantes de banco foram adicionados: `next_page` só pode avançar uma posição por vez, e `xp_awards` só aceita inserção quando a sessão passou sequencialmente por todas as páginas. Isso protege qualquer cliente, não apenas a interface web.

**CWE/OWASP:** CWE-840; OWASP A04 — Insecure Design.

## 4. Relação entre os achados

As vulnerabilidades não formavam uma escalada automática até o controle do banco. Elas podiam, porém, amplificar uma campanha:

```text
repositório público + anon key legítima
                  |
                  +--> V-02: reconhecimento de membros
                  |
                  +--> V-01: enumeração de conteúdo marcado como adulto
                                  |
                                  +--> V-07: retenção da URL após despublicação

cadastro público --> sessão comum própria
                  |
                  +--> V-03: spam/integridade de denúncias
                  +--> V-09: fraude de XP

conta editorial comprometida por outro ataque
                  |
                  +--> V-08: adulteração da fila do importador

requisições volumosas --> V-04: pressão de disponibilidade
erros deliberados     --> V-05: reconhecimento técnico
CI/desenvolvedor      --> V-06: risco na cadeia de ferramentas
```

V-02 e V-05 poderiam melhorar o reconhecimento, mas não entregavam credenciais. V-03 e V-09 já eram exploráveis com uma conta própria porque o cadastro é aberto. V-08 dependia de privilégio editorial prévio. V-04 podia gerar ruído ou indisponibilidade em paralelo, sem aumentar permissões. V-01 e V-07 eram a cadeia mais direta sobre conteúdo: descobrir a mídia enquanto acessível e tentar mantê-la acessível após a revogação.

## 5. Storytelling profissional — campanha de um pentester mal-intencionado

Rafael encontra o repositório público e não perde tempo tentando “esconder” a chave `anon`: sabe que ela foi feita para estar no navegador. Ele estuda as migrations, monta chamadas diretas à Data API e compara o comportamento com o frontend.

Primeiro, antes das correções, enumera `members` e coleta atributos além do perfil público (V-02). Em seguida, consulta obras, capítulos e páginas marcados como `ADULT_18`; percebe que a RLS verifica publicação, mas não idade (V-01). Guarda os UUIDs de mídia e, quando um capítulo é retirado, tenta novamente as URLs. O cache antigo responde sem consultar o banco (V-07).

Rafael cria então sua própria conta pelo cadastro normal. Não roubou uma conta: a superfície autenticada está disponível para qualquer leitor. Ele ignora a interface, insere denúncias diretamente e distribui registros para poluir a moderação (V-03). Também automatiza sessões de leitura, espera o tempo mínimo e pula para a última página para acumular XP (V-09).

Enquanto testa as RPCs, provoca erros e coleta mensagens internas que revelam constraints e nomes de funções (V-05). Para aumentar o custo operacional, envia corpos fragmentados grandes em paralelo (V-04). Se mais tarde obtiver uma sessão editorial por phishing ou reutilização de senha — ataque independente — usa o grant excessivo para reescrever a fila do importador (V-08).

Por fim, ele observa a cadeia de desenvolvimento pública. O advisory de `sharp` não oferece automaticamente entrada no servidor, mas pode interessar caso consiga entregar um HEIF malicioso a um pipeline que use aquela biblioteca (V-06).

Depois do hardening, cada etapa quebra em sua fonte: colunas privadas não têm grant, conteúdo condicionado é filtrado na RLS, mídia é revalidada, denúncias e fila são RPC-only, bytes são limitados durante streaming, XP exige sequência e mensagens upstream não retornam ao navegador.

## 6. Evidência das correções

| Controle                         | Implementação principal                                  | Teste/validação                                   |
| -------------------------------- | -------------------------------------------------------- | ------------------------------------------------- |
| Colunas privadas                 | `20260909100000_fix_member_private_columns.sql`          | `tests/member-privacy.sql`                        |
| Denúncias RPC-only               | `20260909110000_fix_report_integrity.sql`                | `tests/report-integrity.sql`                      |
| Corpo HTTP contado por streaming | `src/lib/server/request-body.ts` e `src/hooks.server.ts` | `tests/request-body-limit.test.ts`                |
| Adulto na RLS                    | `20260909120000_security_hardening.sql`                  | `tests/security-hardening.sql`                    |
| Fila do importador RPC-only      | mesma migration de hardening                             | `tests/security-hardening.sql`                    |
| XP sequencial                    | triggers na migration de hardening                       | `tests/security-hardening.sql`                    |
| Revogação de mídia               | `src/routes/media/[id]/+server.ts`                       | análise estática, type-check e suíte da aplicação |
| Erros sanitizados                | rotas e helpers em `src/lib/server` e `src/routes`       | ESLint dos arquivos alterados e type-check        |
| Dependências                     | `package.json` e `package-lock.json`                     | `npm audit`                                       |

Resultados obtidos no clone:

- banco local descartável: todas as migrations aplicadas e seis grupos de segurança aprovados;
- teste adicional: `PASS: adult RLS, importer integrity and sequential XP invariants`;
- Vitest: 18 arquivos, 113 testes aprovados;
- `svelte-check`: zero erros e zero avisos;
- ESLint dos arquivos de segurança alterados: aprovado;
- `npm audit`: zero vulnerabilidades conhecidas;
- busca de segredos: nenhum valor real de `service_role`, bridge token ou Telegram token encontrado no histórico analisado.

O lint global ainda possui problemas preexistentes de qualidade em componentes fora das correções de segurança, inclusive arquivos da integração Mihon fora do escopo. Eles não foram classificados como vulnerabilidades e não foram modificados nesta revisão.

## 7. Risco residual e critérios para produção

“Todos os achados corrigidos” significa que os nove problemas reproduzidos nesta revisão receberam controle e teste no clone. Não significa garantia de ausência absoluta de vulnerabilidades futuras. Antes de produção, ainda são necessários controles externos ao repositório:

1. aplicar as migrations na ordem numérica em ambiente de homologação;
2. usar Node `>=22.12.0` no CI e no build;
3. exigir MFA para administradores e editores;
4. configurar rate limiting no edge por IP, conta e rota;
5. alertar para respostas 403, 413 e 429, saltos de leitura e mutações editoriais;
6. revisar a política legal/editorial sobre conteúdo `ADULT_18` e deixar claro que a idade é autodeclarada;
7. testar restauração de backup e retenção da trilha de auditoria;
8. repetir revisão de grants, RLS, RPCs `SECURITY DEFINER` e dependências a cada release.

Como este é um clone de testes e não há produção, não existe cache externo atual a purgar. Em uma implantação que já tivesse servido mídia com a versão antiga, seria necessário invalidar o cache da CDN durante o rollout.

## 8. Conclusão

O conjunto anterior permitia exposição de atributos privados, abuso de fluxos autenticados, inconsistências de autorização e pressão operacional, mas não comprovava invasão completa do banco. A branch agora concentra a autorização sensível no PostgreSQL, reduz grants, torna mutações críticas RPC-only, revalida mídia, protege progressão e evita detalhes internos nas respostas.

Dentro do escopo analisado, os achados V-01 a V-09 estão corrigidos no clone e cobertos por validação proporcional ao risco. O principal princípio preservado é compatível com um projeto open source: nada depende de esconder o código, a URL do Supabase ou a chave `anon`; a proteção permanece nas fronteiras de autorização do servidor e do banco.
