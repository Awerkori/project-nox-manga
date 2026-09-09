# V-02 — Quando um perfil público conta uma história privada

## A vulnerabilidade trabalhada

O Project Nox precisa mostrar publicamente nome, avatar, biografia e XP. A migration inicial, por isso, concedeu `SELECT` da tabela inteira `public.members` aos papéis `anon` e `authenticated` e criou uma policy pública.

Depois, a mesma tabela recebeu campos que não pertencem ao perfil público:

- `age_status`: informa se a pessoa se declarou menor ou adulta;
- `blur_nsfw`: registra sua preferência sobre capas de conteúdo adulto;
- `is_test`: identifica contas internas de teste;
- `manual_title` e `manual_badge`: revelam estado interno da progressão.

No PostgreSQL, o `GRANT SELECT` sobre a tabela cobre também colunas adicionadas posteriormente. Como a policy de perfis usa `USING (true)`, todas as linhas e os novos campos ficaram consultáveis com a chave anônima normal do Supabase.

## Storytelling ofensivo — como um pentester mal-intencionado encontraria e exploraria

### 1. Ele começa sem credenciais

Rafael se apresenta como pentester, mas não tem autorização. Como o projeto é open source, ele pode ler diretamente as migrations, descobrir a tabela `members` e estudar seus grants e policies. Ao visitar a aplicação, também encontra `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_ANON_KEY` no bundle do frontend.

Nada disso, isoladamente, é falha: o código e a chave `anon` são públicos por design. Rafael sabe que a segurança real de um projeto Supabase open source depende dos grants e da RLS, nunca de esconder o schema.

### 2. Ele identifica a tabela de perfis

Observando as requisições normais do navegador, Rafael vê consultas e relacionamentos com `members`. Ele percebe que comentários exibem `username`, `display_name` e `avatar_id`, então testa se a Data API permite escolher outras colunas.

Em um laboratório autorizado, a tentativa equivalente seria:

```bash
curl 'https://<projeto>.supabase.co/rest/v1/members?select=id,username,age_status,blur_nsfw,is_test,manual_title,manual_badge' \
  -H 'apikey: <anon-key>'
```

Ele espera um `401`, `403` ou erro de coluna sem privilégio. Em vez disso, recebe `200 OK` com linhas de usuários. Nesse momento, confirma duas propriedades:

1. a policy permite que `anon` veja todos os perfis;
2. o grant de tabela permite selecionar também os campos privados.

### 3. Ele transforma uma linha vazada em um conjunto de dados

Rafael pagina a Data API e salva UUID, nome público, idade declarada e preferência NSFW de cada membro. Não precisa descobrir senha, burlar JWT nem explorar SQL injection. Cada requisição é sintaticamente válida e usa somente a chave pública do site.

Depois, correlaciona `members.id` com `comments.user_id` e `likes.user_id`, também presentes em dados públicos. Assim ele associa uma conta marcada como `MINOR` às obras curtidas e aos comentários publicados.

### 4. O dano deixa de ser apenas técnico

Considere Lia, de 16 anos. Seu perfil deveria revelar somente o pseudônimo e sua progressão. A coleta de Rafael, porém, registra que ela se declarou menor e quais interações públicas pertencem ao mesmo UUID.

Rafael pode vender a lista, publicar capturas para constranger usuários ou selecionar menores para assédio direcionado. Também pode identificar contas de teste e usá-las como pistas para mapear processos internos.

O ataque é silencioso: não há falha de login, payload malformado nem resposta 500. Para a plataforma, são leituras legítimas com status 200. Sem telemetria específica da Data API, a enumeração pode parecer tráfego normal.

### 5. Por que o ataque funcionava

O erro não era simplesmente “RLS desligada”. Todas as tabelas tinham RLS. O problema era tentar resolver privacidade de **coluna** apenas com uma regra de **linha**:

```text
profiles_public: USING (true)
         +
GRANT SELECT na tabela inteira
         +
novas colunas privadas
         =
leitura anônima dos campos privados
```

Uma segunda policy `id = auth.uid()` não resolveria. Policies permissivas são combinadas com `OR`; a policy pública continuaria autorizando todas as linhas.

## A correção aplicada

A migration `supabase/migrations/20260909100000_fix_member_private_columns.sql` substitui a permissão ampla por uma lista explícita de campos públicos:

```text
id, username, display_name, bio, avatar_id, xp, created_at,
equipped_title_id, equipped_badge_id
```

Os campos privados perdem privilégio de leitura para `anon` e `authenticated`. As permissões diretas de atualização das flags internas de equipamento também são removidas; essas alterações continuam passando por `member_action()`, que aplica as regras do produto.

### Perfil privado do próprio usuário

O próprio membro ainda precisa carregar `age_status` e `blur_nsfw`. Para isso foi criada `member_self_profile()`, uma RPC que:

- só pode ser executada por `authenticated`;
- deriva o usuário de `auth.uid()`, sem aceitar ID fornecido pelo cliente;
- retorna exclusivamente a linha do chamador;
- lista as colunas de saída explicitamente;
- usa `SECURITY DEFINER` com `search_path` vazio;
- não devolve `is_test`, `manual_title` ou `manual_badge`.

A carga do layout passou a usar essa RPC em vez de `select('*')`.

### Ranking sem expor `is_test`

O ranking precisava filtrar `is_test=false`. Conceder essa coluna ao visitante apenas para permitir o filtro recriaria o vazamento. A consulta foi encapsulada em `member_public_ranking()`: ela usa a flag internamente, limita o resultado a 50 membros e retorna apenas campos públicos.

## Como a correção interrompe o atacante

Se Rafael repetir a seleção das colunas privadas, o PostgreSQL rejeita a consulta por falta de privilégio antes de retornar qualquer linha. Ele ainda consegue consultar o perfil público — comportamento necessário para a aplicação — mas `age_status`, `blur_nsfw`, `is_test`, `manual_title` e `manual_badge` não fazem parte dessa superfície.

Mesmo com um JWT válido de usuário comum, Rafael não pode fornecer o UUID de Lia para a RPC privada: `member_self_profile()` ignora IDs externos e usa somente `auth.uid()`. Ele recebe apenas o próprio perfil.

## Testes de regressão

`tests/member-privacy.sql` valida o schema completo e prova que:

1. `anon` não possui privilégio sobre `age_status`, `blur_nsfw` ou `is_test`;
2. consultas diretas a essas colunas falham;
3. campos públicos continuam legíveis;
4. `authenticated` recebe apenas o próprio perfil privado pela RPC;
5. o ranking exclui contas de teste sem expor `is_test`;
6. toda a massa de teste é descartada por rollback.

O teste foi incluído em `scripts/test-database.mjs` para impedir que uma migration futura reabra o vazamento.

## Verificação manual segura

Em um banco local ou projeto descartável autorizado:

```sql
select
  has_column_privilege('anon', 'public.members', 'age_status', 'SELECT'),
  has_column_privilege('anon', 'public.members', 'blur_nsfw', 'SELECT'),
  has_column_privilege('anon', 'public.members', 'is_test', 'SELECT');
```

Os três valores devem ser `false`.

Uma chamada anônima à Data API pedindo qualquer campo privado deve ser negada. Com o JWT de um usuário A, `member_self_profile()` deve retornar uma única linha cujo `id` seja A; nunca deve retornar o usuário B.

## Detecção e resposta

Se houver logs de um ambiente que já recebeu tráfego, procurar consultas à Data API de `members` contendo os campos privados, principalmente requisições sem JWT de usuário e paginação sequencial. Uma ocorrência não prova abuso, mas exige avaliar volume, origem e período.

Após a correção, monitorar:

- respostas 401/403 repetidas para seleção de colunas privadas;
- enumeração de grande volume de perfis pelo mesmo IP;
- volume anormal de chamadas a `member_self_profile()`;
- migrations que voltem a executar `GRANT SELECT ON public.members` sem lista de colunas.

O sinal mais importante é preventivo: a CI deve falhar se `has_column_privilege` voltar a ser verdadeiro para qualquer campo privado.
