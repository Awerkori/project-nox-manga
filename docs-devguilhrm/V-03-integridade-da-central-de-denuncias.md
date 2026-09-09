# V-03 — A denúncia que reescrevia a própria história

## Vulnerabilidade exposta

A central de denúncias armazenava dados importantes para moderação e auditoria, mas concedia `INSERT` e `UPDATE` diretamente sobre `public.reports` ao papel `authenticated`.

A policy de inserção confirmava apenas que o `reporter_id` correspondia a `auth.uid()`, que o status inicial era `NOVO` e que os campos editoriais estavam vazios. Ela não exigia que o tipo da denúncia possuísse exatamente o identificador correspondente. Assim, uma denúncia do tipo `WORK` podia ser criada sem `work_id` ou com identificadores incompatíveis.

Para editores, a policy autorizava a atualização da linha inteira. Um editor legítimo — ou uma conta editorial comprometida — podia alterar autoria, alvo, motivo e data de criação, embora esses campos devessem ser imutáveis.

O endpoint da aplicação reduzia parte do risco, mas não era uma fronteira suficiente: um cliente podia chamar diretamente a Data API do Supabase usando sua própria sessão válida. Também não existia limite temporal; a verificação de duplicidade não impedia spam contra alvos diferentes.

**Classificação:** Média — CVSS 3.1 aproximado 5.4 (`AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:L`)
**Mapeamento:** OWASP A01 Broken Access Control; OWASP A04 Insecure Design; CWE-20, CWE-285 e CWE-400.

## Storytelling ofensivo — como um pentester mal-intencionado abusaria da falha

### 1. Reconhecimento

Bruno lê o repositório open source e encontra diretamente o schema de `reports`, seus grants, suas policies e o endpoint `/api/report`. No bundle também estão a URL pública do Supabase e a chave `anon`, o que é normal em aplicações Supabase.

Como o cadastro é aberto, Bruno cria sua própria conta e obtém legitimamente uma sessão autenticada. Ele não precisa invadir a conta de outra pessoa. O código público mostra que essa sessão pode ser usada diretamente na Data API e que nem todas as operações precisam passar pelo servidor SvelteKit.

### 2. Descoberta da escrita direta

Em um laboratório autorizado, Bruno reproduz a operação usando uma sessão descartável. Ele envia um `INSERT` diretamente para `reports`, declarando seu próprio UUID como `reporter_id`, status `NOVO`, mas escolhendo `target_type='WORK'` sem fornecer `work_id`.

O banco aceita. Isso demonstra que a aplicação conferia melhor os dados do que a fronteira definitiva — o PostgreSQL — e que era possível contornar o endpoint oficial.

Bruno não obteve acesso administrativo ao banco e não executou SQL arbitrário. Mesmo assim, conseguiu fazer uma escrita que o produto considerava inválida, usando somente permissões concedidas a qualquer usuário autenticado.

### 3. Poluição da fila

O antispam antigo procurava apenas uma denúncia aberta contra o mesmo alvo. Bruno automatiza denúncias contra obras, capítulos, comentários e usuários diferentes. Cada chamada é individualmente válida para a policy, mas o conjunto cresce sem limite temporal.

A equipe editorial passa a lidar com uma fila artificial. Denúncias legítimas ficam soterradas, consultas ficam mais caras e o trabalho de moderação perde confiabilidade. O ataque afeta integridade e disponibilidade operacional, ainda que não derrube diretamente o PostgreSQL.

### 4. A conta editorial comprometida

Bruno consegue depois controlar uma conta de editor por um incidente independente, como phishing. A V-03 não causou esse comprometimento, mas amplia o dano produzido por ele.

Como o grant de `UPDATE` cobria todas as colunas, Bruno altera uma denúncia existente: troca `reporter_id`, muda o motivo e reescreve `created_at`. Uma investigação posterior encontra uma linha aparentemente legítima, mas sua autoria e cronologia já não são confiáveis.

Sem uma trilha separada e imutável, não existe registro de quem realizou a transição nem do estado anterior. O atacante não “tomou o banco inteiro”; ele destruiu o valor probatório de uma área sensível usando permissões excessivas.

### 5. Por que o ataque funcionava

```text
sessão comum válida
        +
INSERT direto concedido à tabela
        +
policy sem coerência entre tipo e alvo
        +
ausência de rate limit
        =
spam e registros estruturalmente inválidos
```

Para uma conta editorial, `UPDATE` irrestrito permitia adulterar campos que nunca deveriam mudar. Confiar apenas no formulário e no endpoint da aplicação não resolvia o problema, pois a Data API chegava diretamente às policies e aos grants do PostgreSQL.

## Correção aplicada

### Constraint de coerência

A migration `20260909110000_fix_report_integrity.sql` adiciona `reports_target_matches_type`. Ela exige exatamente uma referência de alvo:

| Tipo | Campo obrigatório | Campos que devem permanecer nulos |
| --- | --- | --- |
| `WORK` | `work_id` | `chapter_id`, `comment_id`, `target_user_id` |
| `CHAPTER` | `chapter_id` | `work_id`, `comment_id`, `target_user_id` |
| `COMMENT` | `comment_id` | `work_id`, `chapter_id`, `target_user_id` |
| `USER` | `target_user_id` | `work_id`, `chapter_id`, `comment_id` |

A constraint protege todos os caminhos de escrita, inclusive funções internas e futuras alterações no aplicativo.

### Escrita somente por RPC

Os privilégios diretos de `INSERT` e `UPDATE` de `authenticated` foram revogados e as policies correspondentes removidas.

`submit_report(...)` tornou-se o único caminho de envio. A função:

- obtém o autor exclusivamente de `auth.uid()`;
- exige conta confirmada e ativa;
- normaliza e valida motivo e detalhes;
- verifica se o alvo existe e está publicamente disponível;
- converte o tipo em exatamente uma coluna de destino;
- deduplica denúncias abertas contra o mesmo alvo;
- serializa envios concorrentes por usuário com advisory lock;
- limita cada usuário a 5 denúncias por hora e 20 em 24 horas;
- registra envios e bloqueios no log de auditoria.

Quando o limite é alcançado, a RPC retorna um resultado controlado para que o endpoint responda HTTP 429. O bloqueio é registrado sem armazenar o corpo da solicitação.

### Moderação com campos limitados

`moderate_report(...)` substitui o `UPDATE` direto. A função verifica o papel editorial e só modifica:

- `status`;
- `assigned_to`;
- `resolution_notes`;
- `updated_at`.

Ela não aceita autoria, alvo, motivo ou data de criação como parâmetros. Portanto, mesmo uma chamada direta à RPC não oferece uma forma de adulterar esses campos.

### Auditoria separada

`report_audit` registra o ator, estado anterior, novo estado e horário de cada criação ou moderação. Usuários comuns não podem consultá-la, e nem editores recebem privilégios de inserção, atualização ou exclusão. A aplicação a trata como append-only.

## Como a correção interrompe Bruno

A tentativa de inserir diretamente em `reports` falha por falta de privilégio. Se algum código privilegiado tentar criar uma denúncia `WORK` sem `work_id`, a constraint rejeita a linha.

Ao chamar `submit_report`, Bruno não controla `reporter_id` nem as colunas internas. O sexto alvo diferente dentro de uma hora não gera nova denúncia; a função retorna `rate_limited` e grava o evento de segurança.

Se Bruno controlar uma conta editorial, o `UPDATE` direto também será negado. `moderate_report` permite executar o trabalho legítimo de moderação, mas não oferece parâmetros capazes de reescrever autoria, motivo, alvo ou data. Cada transição deixa uma trilha separada.

## Testes de regressão

`tests/report-integrity.sql` executa em PostgreSQL local e dentro de uma transação descartada. Ele comprova que:

1. usuário autenticado não realiza `INSERT` direto;
2. a RPC cria uma denúncia válida com exatamente um alvo;
3. uma repetição contra o mesmo alvo é idempotente;
4. alvo privado ou inexistente é rejeitado;
5. a sexta denúncia em uma hora é bloqueada e auditada;
6. a constraint rejeita registro incompatível mesmo em contexto privilegiado;
7. editor não executa `UPDATE` direto em campos imutáveis;
8. a RPC editorial altera apenas campos controlados;
9. criação e moderação geram eventos em `report_audit`;
10. editor não consegue adulterar a trilha de auditoria;
11. usuário anônimo não executa a RPC.

O teste foi incluído em `scripts/test-database.mjs`, que também confirma que todos os dados de teste foram removidos pelo rollback.

## Detecção e resposta

Monitorar sem registrar conteúdo sensível:

- eventos `report_rate_limited` por usuário e período;
- crescimento anormal de denúncias por conta, IP ou alvo;
- respostas 403 em tentativas diretas de escrita em `reports`;
- chamadas repetidas à RPC com alvos inexistentes;
- volume e sequência das transições em `report_audit`;
- alterações de grants, policies, constraints ou funções relacionadas a `reports`.

O SIEM deve alertar quando uma conta atingir repetidamente o limite, quando muitas contas de uma mesma origem criarem denúncias coordenadas ou quando uma identidade editorial realizar volume incomum de transições.

## Resultado esperado

Após a correção, o PostgreSQL — e não apenas a interface — garante a coerência das denúncias. Clientes autenticados não escrevem diretamente na tabela; usuários enviam dados por uma função limitada e editores moderam por outra função com campos explicitamente controlados. A V-03 deixa de permitir poluição estrutural da fila e adulteração silenciosa dos registros.
