-- Migration: Ensure chapter identity columns, display_number backfill, and grants in Supabase
-- Fixes HTTP 500 when managing works in /admin/obras/[id]

ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS canonical_chapter_key text,
  ADD COLUMN IF NOT EXISTS display_number text,
  ADD COLUMN IF NOT EXISTS chapter_order_key text,
  ADD COLUMN IF NOT EXISTS chapter_kind text,
  ADD COLUMN IF NOT EXISTS edition text,
  ADD COLUMN IF NOT EXISTS language text;

UPDATE public.chapters
  SET display_number = number::text
  WHERE display_number IS NULL AND number IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapters TO anon, authenticated, service_role;
GRANT SELECT (canonical_chapter_key, display_number, chapter_order_key, chapter_kind, edition, language) ON public.chapters TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
