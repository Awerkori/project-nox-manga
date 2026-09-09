# Mapa de relacionamento — V-02, V-03 e V-04

## Objetivo

Este documento conecta as três vulnerabilidades corrigidas no Project Nox e separa o risco comprovado de cenários apenas possíveis. Os achados atingiam os três pilares clássicos de segurança:

```text
V-02 — Confidencialidade: dados privados de membros podiam ser lidos
V-03 — Integridade: denúncias podiam ser criadas ou adulteradas fora das regras
V-04 — Disponibilidade: corpos excessivos podiam consumir recursos da aplicação
```

Nenhum deles, isoladamente ou em conjunto, demonstrou execução arbitrária de SQL, vazamento da `service_role`, tomada direta de contas ou controle completo do PostgreSQL.

## Modelo de ameaça do projeto open source

O código e as migrations são públicos e o cadastro é aberto. Portanto, a análise assume que qualquer pessoa pode:

- ler o schema, as policies, os grants, as RPCs e os endpoints sem engenharia reversa;
- obter legitimamente a URL e a chave `anon`, que são públicas por design;
- criar sua própria conta e receber uma sessão válida do papel `authenticated`;
- chamar a Data API diretamente, sem usar a interface do Project Nox.

Segurança não pode depender de esconder nomes de tabelas, código ou formato das requisições. Ela deve permanecer no PostgreSQL por grants mínimos, RLS, constraints e RPCs que derivem a identidade de `auth.uid()`.

## Visão consolidada do risco

| ID | Ator mínimo | Fronteira vulnerável | Ação possível antes da correção | Impacto principal | Severidade |
| --- | --- | --- | --- | --- | --- |
| V-02 | Visitante anônimo | Grants de coluna e RLS de `members` | Enumerar campos privados de membros pela Data API | Privacidade e coleta para ataques direcionados | Média, CVSS 5.3 |
| V-03 | Qualquer pessoa após cadastro aberto; editor para adulteração | Grants, policies e modelo de escrita de `reports` | Inserir denúncias inválidas/spam; editor alterar campos imutáveis | Integridade e operação da moderação | Média, CVSS 5.4 |
| V-04 | Cliente HTTP sem necessidade de conta em rotas públicas | Leitura de corpos e confiança em `Content-Length` | Forçar parsing e alocação acima do limite lógico | Lentidão, cota e indisponibilidade | Média, CVSS 5.3 |

## Como elas se relacionavam

### V-02 e V-03 — da coleta ao abuso autenticado

A V-02 não fornecia senha, token de sessão ou acesso direto a uma conta. Ela podia, porém, entregar contexto para engenharia social: idade declarada, preferência de conteúdo e identificação de contas internas eram combináveis com perfis e comentários públicos.

Como o cadastro é aberto, o atacante não precisa de phishing nem da V-02 para explorar a inserção indevida da V-03: basta criar a própria conta. Dados da V-02 poderiam facilitar engenharia social contra uma conta editorial e ampliar o dano, mas isso seria um segundo ataque independente. A relação é de **preparação e amplificação**, não de escalada automática:

```text
cadastro público → sessão comum própria → V-03: spam e registros inválidos

V-02: coleta de contexto privado
        ↓ pode ajudar um segundo ataque contra um editor
sessão editorial comprometida
        ↓
V-03: adulteração de campos imutáveis
```

Sem esse segundo ataque, a V-02 continuava limitada à exposição de dados. A parte comum da V-03 já era acessível a qualquer pessoa que concluísse o cadastro público.

### V-03 e V-04 — custo por volume

A V-03 permitia aumentar o número de denúncias contra alvos diferentes. A V-04 permitia aumentar o custo de processamento de cada requisição em endpoints vulneráveis. Ambas exploravam falta de limitação, mas em camadas diferentes:

- V-03 precisava limitar **quantidade de operações de negócio** por usuário e tempo;
- V-04 precisava limitar **bytes e custo técnico** por requisição, além de volume no edge.

Somente limitar o corpo não impediria milhares de denúncias pequenas. Somente limitar denúncias não protegeria login e outros endpoints de corpos excessivos. Por isso as duas correções são complementares.

### V-02 e V-04 — ataque silencioso versus ataque ruidoso

A enumeração da V-02 podia usar requisições pequenas e aparentemente normais, frequentemente com resposta 200. A exploração da V-04 tenderia a produzir 413, aumento de latência, consumo de recursos ou erros.

Um atacante poderia tentar gerar ruído de disponibilidade enquanto realiza enumeração, mas isso não aumenta suas permissões nem torna a extração tecnicamente necessária. É um cenário operacional possível, não uma cadeia de exploração comprovada.

## Storytelling consolidado — a campanha de Rafael

### Etapa 1: descoberta da superfície pública

Rafael começa pelo repositório público. As migrations mostram nomes de tabelas, policies, grants e RPCs; o frontend revela como as chamadas são montadas. Ele também encontra a URL do projeto e a chave `anon`, valores públicos por design. O erro estava nas permissões que aceitavam chamadas além do necessário.

Ele consulta `members` pela Data API e percebe que campos privados são retornados. Pagina os resultados e correlaciona pseudônimos, comentários, idade declarada e preferências. Essa é a V-02: leitura não autorizada, mas ainda sem senha ou sessão de terceiros.

### Etapa 2: criação de uma identidade comum

Rafael cadastra sua própria conta pelo fluxo oferecido a qualquer visitante. Não invade uma conta e não precisa conhecer a senha de outra pessoa. A conta legítima já lhe fornece tudo que a policy antiga exigia: uma sessão `authenticated` e seu próprio `auth.uid()`.

Rafael passa a chamar diretamente a Data API. Como já leu o código-fonte, sabe exatamente quais colunas e valores a policy antiga aceitava. Ele insere registros em `reports` sem passar pelo endpoint da aplicação e cria denúncias estruturalmente inválidas. Depois distribui denúncias entre muitos alvos para contornar a deduplicação. Essa é a V-03.

### Etapa 3: pressão sobre a aplicação

Em paralelo, Rafael envia corpos fragmentados sem `Content-Length` para rotas públicas. O código antigo considerava o tamanho declarado como zero e materializava o corpo antes de medir os bytes reais. Requisições concorrentes elevam consumo de memória, CPU e cota. Essa é a V-04.

A equipe enxerga lentidão e uma fila de denúncias poluída, enquanto a coleta inicial da V-02 pode ter parecido tráfego legítimo. A combinação compromete confidencialidade, integridade e disponibilidade, mas Rafael ainda não ganhou uma console SQL nem autoridade global no banco.

### Etapa 4: possível amplificação editorial

Se Rafael controlar uma conta de editor por outro ataque, a antiga V-03 permitiria reescrever autoria, motivo, alvo e data de denúncias. Essa amplificação depende do comprometimento independente da conta editorial; nenhuma das três vulnerabilidades fornecia esse acesso diretamente.

## Como as correções fecham a cadeia

| Controle aplicado | V-02 | V-03 | V-04 |
| --- | :---: | :---: | :---: |
| Grants explícitos somente para colunas públicas | ✓ |  |  |
| RPC privada baseada em `auth.uid()` | ✓ | ✓ |  |
| Revogação de escrita direta em tabelas sensíveis |  | ✓ |  |
| Constraint de coerência entre tipo e alvo |  | ✓ |  |
| Rate limit por usuário e janela temporal |  | ✓ | complemento |
| Auditoria de submissão, bloqueio e moderação |  | ✓ |  |
| Contagem dos bytes reais durante streaming |  |  | ✓ |
| Rejeição antecipada de `Content-Length` inválido |  |  | ✓ |
| Testes negativos no PostgreSQL e na aplicação | ✓ | ✓ | ✓ |

### Resultado da V-02

`anon` e usuários comuns recebem somente colunas públicas. Preferências privadas do próprio membro são obtidas por uma RPC que deriva a identidade de `auth.uid()`, e o ranking não precisa expor `is_test` para aplicar seu filtro.

### Resultado da V-03

Clientes não inserem nem atualizam `reports` diretamente. `submit_report()` controla identidade, alvo, validação, deduplicação e limites. `moderate_report()` aceita apenas campos editoriais. Constraints e uma trilha separada impedem inconsistência e adulteração silenciosa.

### Resultado da V-04

O header `Content-Length` serve apenas para rejeição antecipada. A decisão de segurança usa bytes realmente recebidos; o stream é cancelado ao exceder o limite, antes do parsing de JSON, formulário ou binário completo.

## Risco residual

As correções reduzem o risco identificado, mas não substituem controles operacionais:

- rate limiting no edge por IP, ASN e rota;
- proteção contra criação automatizada de muitas contas;
- MFA obrigatório para administradores e editores;
- alertas de enumeração, respostas 403/413/429 e padrões coordenados;
- retenção protegida dos logs de auditoria;
- revisão contínua de grants, RLS e funções `SECURITY DEFINER`;
- testes das migrations contra um clone anonimizado antes de qualquer implantação.

O rate limit da V-03 é por usuário. Um atacante com muitas contas ainda pode distribuir denúncias, portanto um limite complementar por IP ou sinal de risco deve existir na borda. O limitador da V-04 controla o custo máximo de uma requisição, mas várias requisições pequenas ainda exigem proteção de volume.

## Prioridade operacional

1. Aplicar primeiro a V-02 para interromper a exposição anônima já na fonte.
2. Aplicar a V-03 para eliminar escrita direta, validar o histórico existente e proteger a fila.
3. Aplicar a V-04 para limitar custo por requisição em todos os endpoints em escopo.
4. Ativar observabilidade e rate limiting no edge para cobrir ataques distribuídos.

As migrations devem ser executadas na ordem numérica presente no repositório: `20260909100000_fix_member_private_columns.sql` antes de `20260909110000_fix_report_integrity.sql`.

## Critério consolidado de aceite

A consolidação está correta quando:

1. `anon` não consegue selecionar nenhum campo privado de `members`;
2. um usuário autenticado obtém somente o próprio perfil privado pela RPC;
3. `INSERT` e `UPDATE` diretos em `reports` são negados;
4. denúncias inconsistentes falham pela constraint;
5. a sexta denúncia na mesma hora retorna 429 e produz evento de auditoria;
6. um editor não altera autoria, alvo, motivo ou data de criação;
7. corpos acima do limite são interrompidos mesmo sem `Content-Length` ou com valor falso;
8. todos os testes SQL, testes da aplicação, checagem estática e build passam juntos.

## Documentos relacionados

- `V-02-privacidade-de-membros.md`: exposição de colunas privadas e separação do perfil próprio.
- `V-03-integridade-da-central-de-denuncias.md`: escrita direta, rate limit e auditoria da moderação.
- `V-04-limite-real-do-corpo-da-requisicao.md`: evasão de limite por header e contenção por streaming.
