-- Reader chapter identity, phase 1 (additive and reversible at the application level).
--
-- `number` is legacy presentation data. PostgreSQL/YSQL numeric equality makes
-- 12.1 and 12.10 equal, so it cannot identify a chapter.  The new textual key
-- is deliberately independent of source ids and the UUID remains the stable
-- Reader route/page identity.
--
-- This migration does NOT backfill existing rows and does NOT remove the old
-- (work_id, number) constraint.  Run the controlled staging/production
-- backfill, verify it, then apply phase 2 only during an approved cutover.
BEGIN;

ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS canonical_chapter_key text,
  ADD COLUMN IF NOT EXISTS display_number text,
  ADD COLUMN IF NOT EXISTS chapter_order_key text,
  ADD COLUMN IF NOT EXISTS chapter_kind text,
  ADD COLUMN IF NOT EXISTS edition text,
  ADD COLUMN IF NOT EXISTS language text;

COMMENT ON COLUMN public.chapters.canonical_chapter_key IS
  'Stable textual identity: language|edition|kind|source-independent chapter label|special discriminator. Never derive from numeric number.';
COMMENT ON COLUMN public.chapters.display_number IS
  'Reader-facing chapter label. Preserves textual distinctions such as 12.10.';
COMMENT ON COLUMN public.chapters.chapter_order_key IS
  'Precomputed opaque sortable key. Reader orders this then canonical_chapter_key; it never sorts chapter labels as floats.';

-- Produces a compatible order key for a legacy numeric row. It is only a
-- fallback for rows created before canonical identity existed; it does not
-- pretend that a lost trailing decimal scale can be recovered.
CREATE OR REPLACE FUNCTION public.chapter_legacy_order_key(p_number numeric, p_title text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  v_value text;
  v_whole text;
  v_fraction text;
  v_title text;
BEGIN
  v_title := lower(regexp_replace(trim(coalesce(p_title, '')), '\\s+', ' ', 'g'));
  IF p_number IS NULL THEN
    RETURN 'z|' || v_title;
  END IF;

  v_value := trim(p_number::text);
  v_whole := coalesce(substring(v_value FROM '^([0-9]+)'), '0');
  v_fraction := coalesce(substring(v_value FROM '^[0-9]+\\.([0-9]+)'), '');
  RETURN 'n|' || lpad(v_whole, 12, '0') || '|' || rpad(left(v_fraction, 12), 12, '0')
    || '|' || v_fraction || '||' || v_title;
END;
$$;

-- Existing editorial paths may continue to create numeric-only chapters
-- during the staged rollout. Assign a stable *legacy* identity instead of
-- leaving a null key. Lite supplies its own canonical values and is never
-- overwritten by this trigger.
CREATE OR REPLACE FUNCTION public.chapter_apply_identity_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_legacy_key text;
BEGIN
  v_legacy_key := 'legacy:' || NEW.id::text;

  IF nullif(btrim(coalesce(NEW.canonical_chapter_key, '')), '') IS NULL THEN
    NEW.canonical_chapter_key := v_legacy_key;
  END IF;
  IF nullif(btrim(coalesce(NEW.display_number, '')), '') IS NULL THEN
    NEW.display_number := coalesce(nullif(trim(NEW.number::text), ''), nullif(trim(NEW.title), ''), 'Especial');
  END IF;
  IF nullif(btrim(coalesce(NEW.chapter_order_key, '')), '') IS NULL THEN
    NEW.chapter_order_key := public.chapter_legacy_order_key(NEW.number, NEW.title);
  END IF;
  NEW.chapter_kind := coalesce(nullif(btrim(NEW.chapter_kind), ''), 'chapter');
  NEW.edition := coalesce(nullif(btrim(NEW.edition), ''), 'default');
  NEW.language := coalesce(nullif(btrim(NEW.language), ''), 'und');

  -- An editor changing an untouched legacy number should get an updated
  -- presentation/order value. Canonical Lite identities remain immutable.
  IF TG_OP = 'UPDATE'
     AND OLD.canonical_chapter_key = 'legacy:' || OLD.id::text
     AND NEW.number IS DISTINCT FROM OLD.number THEN
    IF NEW.display_number IS NOT DISTINCT FROM OLD.display_number THEN
      NEW.display_number := coalesce(nullif(trim(NEW.number::text), ''), nullif(trim(NEW.title), ''), 'Especial');
    END IF;
    IF NEW.chapter_order_key IS NOT DISTINCT FROM OLD.chapter_order_key THEN
      NEW.chapter_order_key := public.chapter_legacy_order_key(NEW.number, NEW.title);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chapters_identity_defaults ON public.chapters;
CREATE TRIGGER chapters_identity_defaults
  BEFORE INSERT OR UPDATE OF number, title, canonical_chapter_key, display_number, chapter_order_key, chapter_kind, edition, language
  ON public.chapters
  FOR EACH ROW EXECUTE FUNCTION public.chapter_apply_identity_defaults();

-- Resume-safe, bounded backfill for rows created before this migration. Call
-- this function repeatedly from the staging/production runbook with a small
-- batch (for example 500). It neither deletes nor merges chapters, pages,
-- media, progress, comments, or old Reader UUID URLs.  A legacy numeric value
-- cannot reveal whether an old source wrote `12.1` or `12.10`, so the only
-- honest identity for a pre-existing row without an external mapping is its
-- immutable chapter UUID. Importer Lite is responsible for supplying a true
-- textual identity for all new imports.
CREATE OR REPLACE FUNCTION public.backfill_reader_canonical_chapter_identity(p_limit integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 5000 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 5000';
  END IF;

  WITH candidates AS (
    SELECT id
    FROM public.chapters
    WHERE canonical_chapter_key IS NULL OR display_number IS NULL
       OR chapter_order_key IS NULL OR chapter_kind IS NULL
       OR edition IS NULL OR language IS NULL
    ORDER BY created_at, id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.chapters c
  SET canonical_chapter_key = coalesce(c.canonical_chapter_key, 'legacy:' || c.id::text),
      display_number = coalesce(nullif(btrim(c.display_number), ''), nullif(trim(c.number::text), ''), nullif(trim(c.title), ''), 'Especial'),
      chapter_order_key = coalesce(nullif(btrim(c.chapter_order_key), ''), public.chapter_legacy_order_key(c.number, c.title)),
      chapter_kind = coalesce(nullif(btrim(c.chapter_kind), ''), 'chapter'),
      edition = coalesce(nullif(btrim(c.edition), ''), 'default'),
      language = coalesce(nullif(btrim(c.language), ''), 'und')
  FROM candidates
  WHERE c.id = candidates.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- Partial uniqueness is additive while old rows are being backfilled. Phase 2
-- verifies there are no NULLs and then makes it the sole work-level identity.
CREATE UNIQUE INDEX IF NOT EXISTS chapters_work_canonical_chapter_key_uq
  ON public.chapters (work_id, canonical_chapter_key)
  WHERE canonical_chapter_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS chapters_reader_canonical_order_idx
  ON public.chapters (work_id, chapter_order_key, canonical_chapter_key, id)
  WHERE published_at IS NOT NULL;

-- The public Reader uses an explicit-column grant, not table-wide SELECT.
GRANT SELECT (canonical_chapter_key, display_number, chapter_order_key, chapter_kind, edition, language)
  ON public.chapters TO anon, authenticated;

-- The existing generic `editor_action('chapter', ...)` only accepts a numeric
-- number.  Keep it for legacy callers, but give the current editorial screen
-- one narrow, atomic write path that carries the canonical identity.  This is
-- intentionally a separate function rather than silently changing an old RPC
-- contract used by installed clients.
CREATE OR REPLACE FUNCTION public.editor_chapter_identity_action(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_work_id uuid;
  v_display_number text;
  v_canonical_key text;
  v_order_key text;
  v_kind text;
  v_edition text;
  v_language text;
  v_number numeric;
BEGIN
  IF NOT public.is_editor() THEN
    RAISE EXCEPTION 'Acesso editorial negado' USING errcode = '42501';
  END IF;

  v_id := coalesce(nullif(p_data->>'id', '')::uuid, gen_random_uuid());
  v_work_id := (p_data->>'work_id')::uuid;
  v_display_number := coalesce(nullif(btrim(p_data->>'display_number'), ''), nullif(btrim(p_data->>'title'), ''));
  v_canonical_key := nullif(btrim(p_data->>'canonical_chapter_key'), '');
  v_order_key := nullif(btrim(p_data->>'chapter_order_key'), '');
  v_kind := coalesce(nullif(lower(btrim(p_data->>'chapter_kind')), ''), 'chapter');
  v_edition := coalesce(nullif(btrim(p_data->>'edition'), ''), 'default');
  v_language := coalesce(nullif(btrim(p_data->>'language'), ''), 'und');

  IF v_display_number IS NULL OR v_canonical_key IS NULL OR v_order_key IS NULL THEN
    RAISE EXCEPTION 'Identidade canônica do capítulo incompleta';
  END IF;
  IF v_kind NOT IN ('chapter', 'special') THEN
    RAISE EXCEPTION 'Tipo de capítulo inválido';
  END IF;
  IF nullif(btrim(p_data->>'number'), '') IS NOT NULL THEN
    IF btrim(p_data->>'number') !~ '^([0-9]+)([.][0-9]+)?$' THEN
      RAISE EXCEPTION 'Número legado inválido';
    END IF;
    v_number := (p_data->>'number')::numeric;
  END IF;

  PERFORM 1 FROM public.chapters WHERE id = v_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.chapters WHERE id = v_id AND published_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Despublique o capítulo antes de editar suas páginas';
  END IF;

  INSERT INTO public.chapters(
    id, work_id, number, display_number, canonical_chapter_key, chapter_order_key,
    chapter_kind, edition, language, title
  ) VALUES (
    v_id, v_work_id, v_number, v_display_number, v_canonical_key, v_order_key,
    v_kind, v_edition, v_language, coalesce(p_data->>'title', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    number = EXCLUDED.number,
    display_number = EXCLUDED.display_number,
    canonical_chapter_key = EXCLUDED.canonical_chapter_key,
    chapter_order_key = EXCLUDED.chapter_order_key,
    chapter_kind = EXCLUDED.chapter_kind,
    edition = EXCLUDED.edition,
    language = EXCLUDED.language,
    title = EXCLUDED.title;

  IF p_data ? 'pages' THEN
    IF jsonb_array_length(p_data->'pages') NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'Selecione de 1 a 500 páginas';
    END IF;
    DELETE FROM public.pages WHERE chapter_id = v_id;
    INSERT INTO public.pages(chapter_id, position, media_id, width, height)
    SELECT v_id, ordinality::integer, m.id, m.width, m.height
    FROM jsonb_array_elements_text(p_data->'pages') WITH ORDINALITY p(value, ordinality)
    JOIN public.media m ON m.id = p.value::uuid;
    IF (SELECT count(*) FROM public.pages WHERE chapter_id = v_id) <> jsonb_array_length(p_data->'pages') THEN
      RAISE EXCEPTION 'Upload incompleto';
    END IF;
  END IF;

  IF p_data ? 'scans' THEN
    DELETE FROM public.chapter_scans WHERE chapter_id = v_id;
    INSERT INTO public.chapter_scans(chapter_id, scan_id)
    SELECT v_id, value::uuid
    FROM jsonb_array_elements_text(p_data->'scans')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.chapter_scans(chapter_id, scan_id)
    SELECT v_id, scan_id FROM public.work_scans WHERE work_id = v_work_id
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.audit_log(actor_id, action, target_id, metadata)
  VALUES (auth.uid(), 'chapter', v_id, p_data);
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.editor_chapter_identity_action(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editor_chapter_identity_action(jsonb) TO authenticated;

COMMIT;
