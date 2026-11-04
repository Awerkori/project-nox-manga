# Project Nox — YugabyteDB (YSQL) & Site Performance Lock (`AGENTS.md`)

These invariants are mandatory for all future changes in `project-nox-manga` and any shared YugabyteDB Aeon schema changes.

## 1. YugabyteDB / YSQL Connection & Session Invariants
- **Request-Scoped Multiplexing**: All SSR and API requests must run inside `withYugabyteReadSession(event.platform?.env, ..., 2)` in `src/hooks.server.ts`.
- **No Cross-Request Session Pollution**: `src/hooks.server.ts` must restore `event.platform.env` in a `finally` block, and `withYugabyteReadSession` must check `!existingSession.isClosed()` and unwrap `YUGABYTE_BASE_ENV_KEY` before reusing any session.
- **No Late Fallback Connections**: If a request-scoped `YugabyteReadSession` is already closed (`activeSession.isClosed()`), `executeYugabyteSql` must throw `YUGABYTE_READ_SESSION_CLOSED` and never open an unpooled fallback connection after an SSR timeout.
- **No Post-Response `waitUntil` YSQL Queries**: Never schedule YugabyteDB queries inside `event.platform.ctx.waitUntil` using a request's `platform.env`, as the request's `YugabyteReadSession` closes when the HTTP response finishes.

## 2. Catalog, Search & Tag Query Plan Invariants
- **Two-Stage Materialized Projection (`WITH matched AS MATERIALIZED`)**:
  - In `fetchCatalogFromYugabyte`, both the Stage-2 alias/accent search fallback (`buildFallbackSql`) and the tag-filtered catalog query (`tag` without `q`) must project only `works.id, works.<sortCol>` in `WITH matched AS MATERIALIZED (...)`, paginate in `paged AS MATERIALIZED (... LIMIT $L OFFSET $O)`, and join `works ON works.id = paged.id` in the outer query so `WORK_SELECT_COLUMNS` (`synopsis`, `description`, etc., `width=760`) are fetched for at most the 21 page rows.
- **Batched Tag Filtering**:
  - When filtering by `tag` without `q`, use `works.id = ANY(ARRAY(SELECT wt.work_id FROM work_tags wt JOIN tags t ON t.id=wt.tag_id WHERE t.slug=$N))` inside `matched` so YugabyteDB executes a single batched `works_pkey` index lookup (~84 ms) instead of an unbatched correlated `EXISTS` nested loop (>5,000 ms timeout).
- **No Stage-2 `search_text` Re-Scan**:
  - Stage 1 (`search_text ILIKE $1`) already probes the `idx_works_search_text_trgm` GIN trigram index. Stage 2 (`buildFallbackSql`) must never deserialize `works.search_text` (2–4 KB per row) across the table; accent-insensitive fallback must normalize `concat_ws(' ', works.title, works.author, works.artist, array_to_string(COALESCE(works.aliases, ARRAY[]::text[]), ' '))`.
- **No High-Write Expression Trigram Indexes on `works`**:
  - Do not add multi-expression GIN trigram indexes on `works` that amplify index writes during Importer updates.

## 3. Eliminating Redundant Round-Trips
- **Reading History Joins (`enrichReadingRowsWithCatalog`)**:
  - Queries against `public.reading` (`src/routes/+page.server.ts`, `src/routes/me/+page.server.ts`, `src/routes/u/[username]/+page.server.ts`, `src/routes/[area=member]/+page.server.ts`) must join `public.chapters c ON c.id = r.chapter_id` and `public.works w ON w.id = c.work_id AND (w.published = true OR w.published IS NULL)` in the primary query (using `c.work_id`, since `public.reading` has no `work_id` column). `enrichReadingRowsWithCatalog` must resolve inline catalog metadata with zero extra SQL queries.
- **Published Work Likes (`/obra/[slug]`)**:
  - Do not run a separate `SELECT COUNT(*)::int AS count FROM likes WHERE work_id = $1` when `work.published === true`; use `metrics?.likes` returned by `public.work_metrics($1)`.
- **Reader Chapter/Work Scans (`/ler/[id]`)**:
  - Fetch `chapter_scans` and fallback `work_scans` in a single CTE (`WITH cs AS (...) SELECT scans FROM cs UNION ALL SELECT ... WHERE NOT EXISTS (SELECT 1 FROM cs)`).
- **Profile Reading Aggregates (`/u/[username]`)**:
  - Compute `chapters_read`, `total_works`, and `completed_works` in a single pass over `public.reading r JOIN public.chapters c ON c.id = r.chapter_id`.

## 4. Storage Hygiene & Importer Compatibility
- **Shared Database Contract**: Never drop or alter `importer_*`, `media`, `pages`, `works`, or `chapters` columns/constraints expected by `project-nox-importer`.
- **Verifiable Backup Before Any Archival**: Any future archival/compaction of terminal `importer_lite_uploads` or legacy `importer_queue` rows must be preceded by an Importer maintenance window and a verifiable backup.

## 5. Frontend Cover & Navigation Responsiveness
- Above-the-fold primary covers (`/obra/[slug]` hero cover, first cards on `/`, `/catalogo`, `/lancamentos`) must use `fetchpriority="high"` / `loading="eager"` and `decoding="async"`, while below-the-fold covers remain `loading="lazy" decoding="async"`.
