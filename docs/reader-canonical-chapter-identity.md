# Reader: identidade canônica de capítulos

## Problema confirmado

`chapters.number` é `numeric`, e o schema atual mantém a restrição única
`(work_id, number)`. Portanto `12.1` e `12.10` são o mesmo valor para o banco.
O Reader também usava `number` para ordenação, listagem e alguns caminhos de
preview. Isso não é uma identidade suficiente para capítulos especiais,
traduções ou edições distintas.

URLs públicas não são parte do problema: o Reader já usa `/ler/<chapter UUID>`.
O UUID, páginas, progresso, comentários, mídia e os URLs antigos permanecem
inalterados.

## Contrato novo

Cada linha de `chapters` passa a ter:

- `canonical_chapter_key`: identidade textual, estável e única por obra.
- `display_number`: rótulo exibido sem conversão numérica (`12.10` permanece
  `12.10`; especiais podem usar `Prólogo`).
- `chapter_order_key`: chave opaca precomputada para ordenação.
- `chapter_kind`, `edition`, `language`: discriminadores explícitos.

O Lite envia esses campos no insert. A unicidade e a idempotência de novos
capítulos são `(work_id, canonical_chapter_key)`, enquanto o UUID continua a
ser a identidade de rota e de todas as relações já publicadas.

## Migração em duas fases

1. `20261011090000_add_reader_canonical_chapter_identity.sql` é aditiva:
   adiciona colunas, trigger para novos caminhos editoriais, índice parcial e
   a função de backfill em lotes. Ela não remove constraint e não reescreve
   dados existentes automaticamente.
2. Em staging, execute repetidamente
   `select public.backfill_reader_canonical_chapter_identity(500);` até
   retornar `0`, depois valide as consultas abaixo. Faça o mesmo somente após
   aprovação em produção.
3. Faça deploy do Reader que lê os novos campos antes de aplicar a fase 2.
4. `20261011091000_enable_reader_canonical_chapter_identity.sql` só deve ser
   aplicado durante um cutover aprovado. Ele recusa backfill incompleto ou
   chaves duplicadas antes de remover `chapters_work_id_number_key` e permitir
   `number` nulo para especiais sem número.

Fase 2 é deliberadamente a única alteração não aditiva. Não a execute junto a
outras migrations, não a aplique por rollback automático e não a inicie sem um
snapshot verificável, um lock/leadership único do importador e a aprovação
explícita para o cutover.

O editor atual usa `editor_chapter_identity_action(jsonb)`, criado na fase 1,
para gravar `display_number`, chave canônica, ordem, tipo, edição e idioma na
mesma transação que as páginas. Por isso, o deploy do Reader que contém essa
tela/RPC deve ocorrer depois da fase 1. Antes da fase 2, uma tentativa de criar
dois rótulos que colidem como `numeric` continuará falhando de forma explícita;
isso é intencional e evita uma duplicação silenciosa durante a janela de
transição.

## Pré-validação somente leitura

Depois do backfill e antes da fase 2:

```sql
SELECT count(*) AS incomplete
FROM public.chapters
WHERE canonical_chapter_key IS NULL OR display_number IS NULL
   OR chapter_order_key IS NULL OR chapter_kind IS NULL
   OR edition IS NULL OR language IS NULL;

SELECT work_id, canonical_chapter_key, count(*)
FROM public.chapters
GROUP BY work_id, canonical_chapter_key
HAVING count(*) > 1;

SELECT count(*) AS old_urls_that_would_change
FROM public.chapters
WHERE id IS NULL;
```

All three results must be zero rows/zero before phase 2. The final query is a
guardrail: `id` is a primary key, so it establishes explicitly that the Reader
route identifier is not being changed.

## Compatibility details

- Old API consumers still receive `chapter_number`; new consumers also receive
  `chapter_display_number`, canonical identity and ordering fields.
- Web, Mihon and v1 chapter lists/order use the textual ordering fields.
- Cached Reader payloads are keyed by UUID. A version of the Reader after the
  migration treats a cached payload as a snapshot; its 60-second TTL means no
  key collision can occur.
- Offline records remain keyed by `chapterId`; their displayed `number` now
  accepts text so a fresh offline save preserves `12.10`.
- Scan-production tooling remains numeric-only and does not select a published
  Reader chapter by numeric equality any longer. It must set
  `target_chapter_id` for an exact published target.

## Required staging tests

Insert one work with distinct UUID rows for `12.1`, `12.10`, `Prólogo` and
`12.1` in another `edition`/`language`. Confirm:

1. `canonical_chapter_key` is unique per row and the UUID URLs resolve.
2. Work page, reader drawer, previous/next, releases, `/api/v1`, Mihon and
   `/api/chapters/:id/pages` preserve their labels.
3. Pages, media references, reader progress and legacy `/ler/<uuid>` URLs are
   unchanged for a pre-existing chapter.
4. Repeating the Lite task for the same canonical key returns the same UUID;
   a different key never reuses it.
