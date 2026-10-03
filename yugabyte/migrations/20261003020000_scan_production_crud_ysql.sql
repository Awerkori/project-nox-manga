-- Authoritative YSQL CRUD for Scan production chapters.
-- The web server passes the authenticated actor explicitly; no PostgREST/auth.uid()
-- dependency is used.  Each function is one database transaction.

DO $$
DECLARE v_missing text[];
BEGIN
  SELECT array_agg(required_table ORDER BY required_table) INTO v_missing
  FROM (VALUES
    ('members'), ('scans'), ('works'), ('scan_members'),
    ('scan_workflow_stages'), ('scan_chapter_stages'),
    ('scan_production_chapters'), ('scan_chapter_timeline'),
    ('chapters'), ('chapter_scans')
  ) AS required(required_table)
  WHERE to_regclass('public.' || required_table) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'SCAN_PRODUCTION_CRUD_YSQL_PREREQUISITES_MISSING: %', array_to_string(v_missing, ', ');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.scan_pipeline_stage_seen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  chapter_stage_id uuid NOT NULL REFERENCES public.scan_chapter_stages(id) ON DELETE CASCADE,
  production_chapter_id uuid REFERENCES public.scan_production_chapters(id) ON DELETE CASCADE,
  stage_slug text NOT NULL,
  availability_version integer NOT NULL DEFAULT 1,
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_stage_id, availability_version)
);

CREATE INDEX IF NOT EXISTS idx_scan_pipeline_stage_seen_user_scan
  ON public.scan_pipeline_stage_seen(user_id, scan_id);

CREATE TABLE IF NOT EXISTS public.scan_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  context_type text NOT NULL,
  context_id uuid NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  original_filename text NOT NULL,
  safe_filename text NOT NULL,
  mime_type text NOT NULL,
  size bigint NOT NULL,
  checksum text,
  storage_reference text NOT NULL,
  storage_provider text NOT NULL DEFAULT 'PRIVATE_STORAGE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_attachments_ctx ON public.scan_attachments(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_scan_attachments_scan ON public.scan_attachments(scan_id);

CREATE OR REPLACE FUNCTION public.create_scan_production_chapter_ysql(
  p_scan_id uuid, p_work_id uuid, p_chapter_number numeric,
  p_chapter_label text, p_chapter_type text, p_template text,
  p_priority text, p_actor_id uuid, p_is_global_admin boolean DEFAULT false,
  p_auto_claim boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_role text; v_name text; v_id uuid; v_stage record; v_raw uuid; v_inserted_stage uuid;
  v_has_raw boolean := false;
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

  FOR v_stage IN SELECT * FROM public.scan_workflow_stages
    WHERE scan_id = p_scan_id AND is_active = true ORDER BY display_order LOOP
    INSERT INTO public.scan_chapter_stages
      (scan_id, production_chapter_id, chapter_id, stage_id, status, availability_version, availability_reason)
    VALUES (p_scan_id, v_id, NULL, v_stage.id,
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

CREATE OR REPLACE FUNCTION public.bulk_create_scan_production_chapters_ysql(
  p_scan_id uuid, p_work_id uuid, p_from_number numeric, p_to_number numeric,
  p_template text, p_priority text, p_actor_id uuid, p_is_global_admin boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE n numeric; created_count integer := 0; skipped_count integer := 0;
BEGIN
  IF p_to_number < p_from_number OR p_to_number - p_from_number > 200 THEN RAISE EXCEPTION 'BULK_RANGE_INVALID'; END IF;
  FOR n IN SELECT generate_series(p_from_number::int, p_to_number::int) LOOP
    IF EXISTS (SELECT 1 FROM public.scan_production_chapters WHERE scan_id = p_scan_id AND work_id = p_work_id AND chapter_number = n AND status <> 'CANCELLED') THEN
      skipped_count := skipped_count + 1;
    ELSE
      PERFORM public.create_scan_production_chapter_ysql(p_scan_id, p_work_id, n, NULL, 'NUMBER', p_template, p_priority, p_actor_id, p_is_global_admin, false);
      created_count := created_count + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'created', created_count, 'skipped', skipped_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_scan_production_chapter_ysql(
  p_production_chapter_id uuid, p_actor_id uuid, p_is_global_admin boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c public.scan_production_chapters; r text; pub_id uuid; name text; ver integer;
BEGIN
  SELECT * INTO c FROM public.scan_production_chapters WHERE id = p_production_chapter_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCTION_CHAPTER_NOT_FOUND'; END IF;
  IF c.status = 'PUBLISHED' THEN RETURN jsonb_build_object('success', true, 'idempotent', true, 'chapter_id', c.target_chapter_id); END IF;
  SELECT role INTO r FROM public.scan_members WHERE scan_id = c.scan_id AND user_id = p_actor_id;
  IF NOT COALESCE(p_is_global_admin, false) AND r NOT IN ('OWNER','ADMIN','UPLOADER') THEN RAISE EXCEPTION 'PUBLISH_FORBIDDEN'; END IF;
  SELECT COALESCE(display_name, username, 'Membro') INTO name FROM public.members WHERE id = p_actor_id;
  pub_id := c.target_chapter_id;
  IF pub_id IS NULL THEN
    SELECT id INTO pub_id FROM public.chapters WHERE work_id = c.work_id AND number = c.chapter_number LIMIT 1;
    IF pub_id IS NULL THEN
      INSERT INTO public.chapters (work_id, number, title, published_at)
      VALUES (c.work_id, c.chapter_number, COALESCE(c.chapter_label, c.chapter_title, 'Capítulo ' || c.chapter_number), now())
      RETURNING id INTO pub_id;
    ELSE UPDATE public.chapters SET published_at = COALESCE(published_at, now()) WHERE id = pub_id;
    END IF;
  ELSE UPDATE public.chapters SET published_at = COALESCE(published_at, now()) WHERE id = pub_id;
  END IF;
  INSERT INTO public.chapter_scans (chapter_id, scan_id) VALUES (pub_id, c.scan_id) ON CONFLICT (chapter_id, scan_id) DO NOTHING;
  ver := COALESCE(c.publication_version, 1);
  UPDATE public.scan_production_chapters SET status = 'PUBLISHED', target_chapter_id = pub_id,
    publication_version = ver, updated_at = now() WHERE id = c.id;
  INSERT INTO public.scan_chapter_timeline
    (scan_id, production_chapter_id, event_type, user_id, user_name, details)
  VALUES (c.scan_id, c.id, 'CHAPTER_PUBLISHED', p_actor_id, COALESCE(name, 'Membro'),
    jsonb_build_object('chapter_id', pub_id, 'chapter_number', c.chapter_number, 'version', ver));
  RETURN jsonb_build_object('success', true, 'chapter_id', pub_id, 'publication_version', ver);
END;
$$;

CREATE OR REPLACE FUNCTION public.unpublish_scan_production_chapter_ysql(
  p_production_chapter_id uuid, p_actor_id uuid, p_is_global_admin boolean DEFAULT false, p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c public.scan_production_chapters; r text;
BEGIN
  SELECT * INTO c FROM public.scan_production_chapters WHERE id = p_production_chapter_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCTION_CHAPTER_NOT_FOUND'; END IF;
  SELECT role INTO r FROM public.scan_members WHERE scan_id = c.scan_id AND user_id = p_actor_id;
  IF NOT COALESCE(p_is_global_admin, false) AND r NOT IN ('OWNER','ADMIN') THEN RAISE EXCEPTION 'UNPUBLISH_FORBIDDEN'; END IF;
  UPDATE public.scan_production_chapters SET status = 'UNPUBLISHED', updated_at = now() WHERE id = c.id;
  IF c.target_chapter_id IS NOT NULL THEN UPDATE public.chapters SET published_at = NULL WHERE id = c.target_chapter_id; END IF;
  INSERT INTO public.scan_chapter_timeline (scan_id, production_chapter_id, event_type, user_id, details)
  VALUES (c.scan_id, c.id, 'UNPUBLISHED', p_actor_id, jsonb_build_object('reason', p_reason));
  RETURN jsonb_build_object('success', true, 'status', 'UNPUBLISHED');
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_scan_production_chapter_ysql(
  p_production_chapter_id uuid, p_confirmation text, p_reason text, p_actor_id uuid, p_is_global_admin boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c public.scan_production_chapters; r text; expected text;
BEGIN
  SELECT * INTO c FROM public.scan_production_chapters WHERE id = p_production_chapter_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCTION_CHAPTER_NOT_FOUND'; END IF;
  IF c.status = 'PUBLISHED' THEN RAISE EXCEPTION 'PUBLISHED_CHAPTER_DELETE_FORBIDDEN'; END IF;
  SELECT role INTO r FROM public.scan_members WHERE scan_id = c.scan_id AND user_id = p_actor_id;
  IF NOT COALESCE(p_is_global_admin, false) AND r NOT IN ('OWNER','ADMIN') THEN RAISE EXCEPTION 'DELETE_FORBIDDEN'; END IF;
  expected := COALESCE(c.chapter_label, c.chapter_number::text);
  IF trim(COALESCE(p_confirmation, '')) NOT IN (c.chapter_number::text, expected, 'CONFIRMAR', trim(COALESCE(c.chapter_label, ''))) THEN RAISE EXCEPTION 'CONFIRMATION_INVALID'; END IF;
  DELETE FROM public.scan_notifications WHERE scan_id = c.scan_id AND deep_link LIKE '%' || c.id::text || '%';
  DELETE FROM public.scan_production_files WHERE production_chapter_id = c.id;
  DELETE FROM public.scan_chapter_stages WHERE production_chapter_id = c.id;
  DELETE FROM public.scan_chapter_timeline WHERE production_chapter_id = c.id;
  DELETE FROM public.scan_production_chapters WHERE id = c.id;
  RETURN jsonb_build_object('success', true, 'chapter_number', c.chapter_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_pipeline_stage_seen_ysql(
  p_chapter_stage_id uuid, p_actor_id uuid, p_is_global_admin boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE s public.scan_chapter_stages; slug text; member_exists boolean;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  SELECT * INTO s FROM public.scan_chapter_stages WHERE id = p_chapter_stage_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Etapa não encontrada'); END IF;
  SELECT EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = s.scan_id AND user_id = p_actor_id AND COALESCE(hidden_by_admin, false) = false) INTO member_exists;
  IF NOT member_exists AND NOT COALESCE(p_is_global_admin, false) THEN RAISE EXCEPTION 'SCAN_MEMBERSHIP_REQUIRED'; END IF;
  SELECT slug INTO slug FROM public.scan_workflow_stages WHERE id = s.stage_id;
  INSERT INTO public.scan_pipeline_stage_seen
    (user_id, scan_id, chapter_stage_id, production_chapter_id, stage_slug, availability_version)
  VALUES (p_actor_id, s.scan_id, s.id, COALESCE(s.production_chapter_id, s.chapter_id),
    COALESCE(slug, 'stage'), COALESCE(s.availability_version, 1))
  ON CONFLICT (user_id, chapter_stage_id, availability_version) DO NOTHING;
  RETURN jsonb_build_object('success', true, 'chapter_stage_id', s.id, 'availability_version', COALESCE(s.availability_version, 1), 'stage_slug', COALESCE(slug, 'stage'));
END;
$$;
