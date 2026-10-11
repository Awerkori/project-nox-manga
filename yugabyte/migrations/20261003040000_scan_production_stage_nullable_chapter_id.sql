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

  BEGIN
    ALTER TABLE public.scan_chapter_stages
      ALTER COLUMN chapter_id DROP NOT NULL;
  EXCEPTION WHEN insufficient_privilege THEN
    -- Some installations still have this legacy table owned by the original
    -- deployment role. The function below keeps drafts compatible there by
    -- attaching stages to an unpublished public chapter until ownership can
    -- be corrected by the table owner.
    RAISE NOTICE 'scan_chapter_stages.chapter_id remains NOT NULL; using draft chapter compatibility path';
  END;
END;
$$;

-- The least-privilege migrator may not own the legacy table. In that case a
-- draft still needs a valid chapter_id for the old NOT NULL constraint. Create
-- an unpublished chapter row only for that compatibility path; all public
-- readers already require published_at IS NOT NULL, and publication reuses
-- this row and sets published_at.
CREATE OR REPLACE FUNCTION public.create_scan_production_chapter_ysql(
  p_scan_id uuid, p_work_id uuid, p_chapter_number numeric,
  p_chapter_label text, p_chapter_type text, p_template text,
  p_priority text, p_actor_id uuid, p_is_global_admin boolean DEFAULT false,
  p_auto_claim boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_role text; v_name text; v_id uuid; v_stage record; v_raw uuid;
  v_inserted_stage uuid; v_has_raw boolean := false;
  v_public_chapter_id uuid; v_chapter_nullable boolean := true;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  SELECT role INTO v_role FROM public.scan_members
   WHERE scan_id = p_scan_id AND user_id = p_actor_id AND COALESCE(hidden_by_admin, false) = false;
  IF v_role IS NULL AND NOT COALESCE(p_is_global_admin, false) THEN RAISE EXCEPTION 'SCAN_MEMBERSHIP_REQUIRED'; END IF;
  IF v_role = 'MEMBER' AND NOT COALESCE(p_is_global_admin, false) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.scan_member_positions smp JOIN public.scan_positions sp ON sp.id = smp.position_id
      WHERE smp.scan_id = p_scan_id AND smp.user_id = p_actor_id
        AND (lower(sp.name) LIKE '%raw%' OR lower(COALESCE(sp.description, '')) LIKE '%raw%')
    ) INTO v_has_raw;
    IF NOT v_has_raw THEN RAISE EXCEPTION 'RAW_PROVIDER_REQUIRED'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.scan_production_chapters
    WHERE scan_id = p_scan_id AND work_id = p_work_id AND chapter_number = p_chapter_number
      AND status <> 'CANCELLED') THEN RAISE EXCEPTION 'CHAPTER_ALREADY_EXISTS'; END IF;

  SELECT COALESCE(display_name, username, 'Membro') INTO v_name FROM public.members WHERE id = p_actor_id;
  INSERT INTO public.scan_production_chapters
    (scan_id, work_id, chapter_number, chapter_label, chapter_type, chapter_sort_key,
     template, priority, status, created_by)
  VALUES (p_scan_id, p_work_id, p_chapter_number, p_chapter_label,
    COALESCE(p_chapter_type, 'NUMBER'), p_chapter_number * 10000,
    COALESCE(p_template, 'MANHWA'), COALESCE(p_priority, 'NORMAL'), 'IN_PRODUCTION', p_actor_id)
  RETURNING id INTO v_id;

  SELECT NOT attnotnull INTO v_chapter_nullable
  FROM pg_attribute
  WHERE attrelid = 'public.scan_chapter_stages'::regclass AND attname = 'chapter_id' AND NOT attisdropped;
  IF NOT COALESCE(v_chapter_nullable, true) THEN
    SELECT id INTO v_public_chapter_id FROM public.chapters
    WHERE work_id = p_work_id AND number = p_chapter_number LIMIT 1;
    IF v_public_chapter_id IS NULL THEN
      INSERT INTO public.chapters (work_id, number, title, published_at)
      VALUES (p_work_id, p_chapter_number, COALESCE(p_chapter_label, 'Capítulo ' || p_chapter_number), NULL)
      RETURNING id INTO v_public_chapter_id;
    END IF;
  END IF;

  FOR v_stage IN SELECT * FROM public.scan_workflow_stages
    WHERE scan_id = p_scan_id AND is_active = true ORDER BY display_order LOOP
    INSERT INTO public.scan_chapter_stages
      (scan_id, production_chapter_id, chapter_id, stage_id, status, availability_version, availability_reason)
    VALUES (p_scan_id, v_id, v_public_chapter_id, v_stage.id,
      CASE WHEN COALESCE(array_length(v_stage.dependencies, 1), 0) = 0 THEN 'AVAILABLE' ELSE 'BLOCKED' END,
      1, 'initial')
    RETURNING id INTO v_inserted_stage;
    IF v_stage.slug = 'raw' THEN v_raw := v_inserted_stage; END IF;
  END LOOP;

  INSERT INTO public.scan_chapter_timeline
    (scan_id, production_chapter_id, event_type, user_id, user_name, details)
  VALUES (p_scan_id, v_id, 'CREATED', p_actor_id, COALESCE(v_name, 'Membro'),
    jsonb_build_object('chapter_number', p_chapter_number, 'chapter_label', p_chapter_label,
      'chapter_type', p_chapter_type, 'priority', p_priority));
  IF p_auto_claim AND v_raw IS NOT NULL THEN
    PERFORM public.claim_scan_chapter_stage_ysql(v_raw, p_actor_id, p_is_global_admin);
  END IF;
  RETURN v_id;
END;
$$;
