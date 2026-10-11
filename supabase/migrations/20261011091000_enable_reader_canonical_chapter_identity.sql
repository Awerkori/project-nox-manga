-- Reader chapter identity, phase 2 (CUTOVER ONLY).
--
-- Apply only after phase 1, the controlled backfill, Reader code rollout in
-- staging, and the explicit production cutover approval. This is intentionally
-- separate because it replaces the legacy numeric uniqueness rule.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.chapters
    WHERE canonical_chapter_key IS NULL OR display_number IS NULL OR chapter_order_key IS NULL
       OR chapter_kind IS NULL OR edition IS NULL OR language IS NULL
  ) THEN
    RAISE EXCEPTION 'reader canonical identity backfill is incomplete; do not run phase 2';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.chapters
    GROUP BY work_id, canonical_chapter_key
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate canonical chapter keys detected; manual editorial resolution required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'chapters_work_canonical_chapter_key_uq'
  ) THEN
    RAISE EXCEPTION 'canonical uniqueness index is missing';
  END IF;

  -- PostgreSQL generally represents UNIQUE(work_id,number) as a constraint;
  -- Yugabyte YSQL deployments may expose the same protection as a unique LSM
  -- index.  Accept only those two *verified equivalent* forms, never an
  -- arbitrary similarly named object.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.chapters'::regclass
      AND conname = 'chapters_work_id_number_key'
      AND contype = 'u'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.chapters'::regclass
      AND i.indexrelid = to_regclass('public.chapters_work_id_number_key')
      AND i.indisunique
      AND ARRAY(
        SELECT a.attname::text
        FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
        ORDER BY k.ordinality
      ) = ARRAY['work_id', 'number']
  ) THEN
    RAISE EXCEPTION 'expected legacy numeric unique protection is absent or differs; refusing an unknown schema change';
  END IF;
END;
$$;

-- Title-only specials are legitimate identities. The old numeric field remains
-- populated for legacy compatibility when available, but is no longer required.
ALTER TABLE public.chapters ALTER COLUMN number DROP NOT NULL;

-- This is the only non-additive DDL in the plan. It is safe only because the
-- canonical unique index has already been validated above. Do not combine this
-- migration with unrelated schema changes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.chapters'::regclass
      AND conname = 'chapters_work_id_number_key' AND contype = 'u'
  ) THEN
    ALTER TABLE public.chapters DROP CONSTRAINT chapters_work_id_number_key;
  ELSIF EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.chapters'::regclass
      AND i.indexrelid = to_regclass('public.chapters_work_id_number_key')
      AND i.indisunique
      AND ARRAY(
        SELECT a.attname::text
        FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
        ORDER BY k.ordinality
      ) = ARRAY['work_id', 'number']
  ) THEN
    DROP INDEX public.chapters_work_id_number_key;
  ELSE
    RAISE EXCEPTION 'legacy numeric unique protection changed during phase 2; refusing to proceed';
  END IF;
END;
$$;

ALTER TABLE public.chapters
  ALTER COLUMN canonical_chapter_key SET NOT NULL,
  ALTER COLUMN display_number SET NOT NULL,
  ALTER COLUMN chapter_order_key SET NOT NULL,
  ALTER COLUMN chapter_kind SET NOT NULL,
  ALTER COLUMN edition SET NOT NULL,
  ALTER COLUMN language SET NOT NULL;

COMMIT;
