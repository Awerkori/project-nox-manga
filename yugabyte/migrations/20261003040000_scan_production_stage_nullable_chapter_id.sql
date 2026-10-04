-- Draft Scan productions are authoritative in scan_production_chapters until
-- publication creates the public chapters row.  The legacy table was created
-- with chapter_id NOT NULL, which made the YSQL create-production function
-- fail with a generic 500 before a draft could be created.
-- Keep the public-chapter foreign key for published/legacy rows, but allow the
-- production-only rows to carry their production_chapter_id instead.

DO $$
BEGIN
  IF to_regclass('public.scan_chapter_stages') IS NULL THEN
    RAISE EXCEPTION 'SCAN_PRODUCTION_STAGE_SCHEMA_MISSING';
  END IF;

  ALTER TABLE public.scan_chapter_stages
    ALTER COLUMN chapter_id DROP NOT NULL;
END;
$$;
