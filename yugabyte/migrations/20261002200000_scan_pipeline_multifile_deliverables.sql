-- Project Nox authoritative data plane: YugabyteDB Aeon / YSQL.
--
-- A pipeline stage delivers a set of independently-versioned files. Existing
-- single-file rows remain intact: each becomes one delivery lineage.

ALTER TABLE public.scan_production_files
  ADD COLUMN IF NOT EXISTS delivery_key uuid;

ALTER TABLE public.scan_production_files
  ALTER COLUMN delivery_key SET DEFAULT gen_random_uuid();

UPDATE public.scan_production_files
SET delivery_key = id
WHERE delivery_key IS NULL;

-- Do not promote this to NOT NULL while legacy writers may still be live.
-- The default covers new writes and this backfill covers historical rows; the
-- server-side finalizer below rejects an absent delivery_key before insertion.

CREATE INDEX IF NOT EXISTS idx_scan_production_files_delivery_versions
  ON public.scan_production_files (production_chapter_id, stage_id, delivery_key, version DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scan_production_files_delivery_version
  ON public.scan_production_files (production_chapter_id, stage_id, delivery_key, version);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scan_production_files_current_delivery
  ON public.scan_production_files (production_chapter_id, stage_id, delivery_key)
  WHERE is_current = true;

-- The browser supplies a retry-safe UUID. This lets one failed item be retried
-- without changing the successful siblings in the same delivery.
CREATE TABLE IF NOT EXISTS public.scan_pipeline_upload_attempts (
  id uuid PRIMARY KEY,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  production_chapter_id uuid NOT NULL REFERENCES public.scan_production_chapters(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.scan_workflow_stages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  byte_size bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'UPLOADING'
    CHECK (status IN ('UPLOADING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
  file_id uuid REFERENCES public.scan_production_files(id) ON DELETE SET NULL,
  error_code text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_pipeline_upload_attempts_completion_guard
  ON public.scan_pipeline_upload_attempts (production_chapter_id, stage_id, status, expires_at);

-- This runs only through server-side YSQL access. It retains an audit trail of
-- upstream inputs and marks downstream work for rework when a captured file is
-- withdrawn or a newer version supersedes that exact delivery lineage.
CREATE OR REPLACE FUNCTION public.reconcile_scan_chapter_dependencies_ysql(
  p_production_chapter_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_output record;
  v_stage record;
  v_dependency text;
  v_dependencies_satisfied boolean;
  v_dependency_stage record;
  v_dependency_has_output boolean;
BEGIN
  FOR v_output IN
    SELECT id, stage_slug, input_files
    FROM public.scan_production_files
    WHERE production_chapter_id = p_production_chapter_id
      AND is_current = true
      AND jsonb_array_length(COALESCE(input_files, '[]'::jsonb)) > 0
  LOOP
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_output.input_files) AS input_file
      WHERE COALESCE(input_file->>'file_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND NOT EXISTS (
          SELECT 1
          FROM public.scan_production_files captured
          WHERE captured.id = (input_file->>'file_id')::uuid
            AND captured.is_current = true
        )
    ) THEN
      UPDATE public.scan_production_files
      SET is_stale = true,
          stale_reason = 'Um insumo usado nesta entrega foi removido ou atualizado.'
      WHERE id = v_output.id;

      UPDATE public.scan_chapter_stages chapter_stage
      SET status = 'REWORK',
          rejection_reason = 'Um insumo usado nesta entrega foi removido ou atualizado. Revalidação necessária.',
          last_activity_at = now(),
          updated_at = now()
      FROM public.scan_workflow_stages workflow_stage
      WHERE chapter_stage.production_chapter_id = p_production_chapter_id
        AND workflow_stage.id = chapter_stage.stage_id
        AND workflow_stage.slug = v_output.stage_slug
        AND chapter_stage.status IN ('DONE', 'AVAILABLE');
    END IF;
  END LOOP;

  FOR v_stage IN
    SELECT chapter_stage.id, chapter_stage.status, workflow_stage.dependencies,
           workflow_stage.requires_output
    FROM public.scan_chapter_stages chapter_stage
    JOIN public.scan_workflow_stages workflow_stage ON workflow_stage.id = chapter_stage.stage_id
    WHERE chapter_stage.production_chapter_id = p_production_chapter_id
      AND chapter_stage.status IN ('PENDING', 'BLOCKED')
  LOOP
    v_dependencies_satisfied := true;
    FOREACH v_dependency IN ARRAY COALESCE(v_stage.dependencies, ARRAY[]::text[]) LOOP
      SELECT chapter_stage.status, workflow_stage.requires_output, workflow_stage.id
      INTO v_dependency_stage
      FROM public.scan_chapter_stages chapter_stage
      JOIN public.scan_workflow_stages workflow_stage ON workflow_stage.id = chapter_stage.stage_id
      WHERE chapter_stage.production_chapter_id = p_production_chapter_id
        AND workflow_stage.slug = v_dependency
      LIMIT 1;

      IF NOT FOUND OR v_dependency_stage.status NOT IN ('DONE', 'SKIPPED') THEN
        v_dependencies_satisfied := false;
        EXIT;
      END IF;

      IF v_dependency_stage.status = 'DONE' AND COALESCE(v_dependency_stage.requires_output, true) THEN
        SELECT EXISTS (
          SELECT 1
          FROM public.scan_production_files
          WHERE production_chapter_id = p_production_chapter_id
            AND stage_id = v_dependency_stage.id
            AND is_current = true
        ) INTO v_dependency_has_output;
        IF NOT v_dependency_has_output THEN
          v_dependencies_satisfied := false;
          EXIT;
        END IF;
      END IF;
    END LOOP;

    IF v_dependencies_satisfied THEN
      UPDATE public.scan_chapter_stages
      SET status = 'AVAILABLE',
          availability_version = COALESCE(availability_version, 1),
          availability_reason = 'dependencies_satisfied',
          last_activity_at = now(),
          updated_at = now()
      WHERE id = v_stage.id
        AND status IN ('PENDING', 'BLOCKED');
    END IF;
  END LOOP;
END;
$$;

-- The stage row is the common lock for upload, replacement, withdrawal and
-- completion. A second writer sees a deterministic conflict instead of
-- replacing the wrong file or creating two current versions.
CREATE OR REPLACE FUNCTION public.finalize_scan_pipeline_file_ysql(
  p_upload_id uuid,
  p_replace_file_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean,
  p_actor_name text,
  p_payload jsonb
)
RETURNS public.scan_production_files
LANGUAGE plpgsql
AS $$
DECLARE
  v_attempt public.scan_pipeline_upload_attempts;
  v_chapter public.scan_production_chapters;
  v_stage public.scan_chapter_stages;
  v_workflow_stage public.scan_workflow_stages;
  v_replaced public.scan_production_files;
  v_file public.scan_production_files;
  v_member_role text;
  v_delivery_key uuid := NULLIF(p_payload->>'delivery_key', '')::uuid;
  v_next_version integer;
BEGIN
  SELECT * INTO v_attempt
  FROM public.scan_pipeline_upload_attempts
  WHERE id = p_upload_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_ATTEMPT_NOT_FOUND'; END IF;
  IF v_attempt.user_id <> p_actor_id
     OR v_attempt.scan_id <> NULLIF(p_payload->>'scan_id', '')::uuid
     OR v_attempt.production_chapter_id <> NULLIF(p_payload->>'production_chapter_id', '')::uuid
     OR v_attempt.stage_id <> NULLIF(p_payload->>'stage_id', '')::uuid THEN
    RAISE EXCEPTION 'UPLOAD_ATTEMPT_DESTINATION_MISMATCH';
  END IF;
  IF v_attempt.status = 'SUCCEEDED' AND v_attempt.file_id IS NOT NULL THEN
    SELECT * INTO v_file FROM public.scan_production_files WHERE id = v_attempt.file_id;
    IF FOUND THEN RETURN v_file; END IF;
  END IF;
  IF v_attempt.status NOT IN ('UPLOADING', 'FAILED') OR v_attempt.expires_at <= now() THEN
    RAISE EXCEPTION 'UPLOAD_ATTEMPT_NOT_FINALIZABLE';
  END IF;

  SELECT * INTO v_chapter
  FROM public.scan_production_chapters
  WHERE id = v_attempt.production_chapter_id
    AND scan_id = v_attempt.scan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCTION_CHAPTER_NOT_FOUND'; END IF;

  SELECT role INTO v_member_role
  FROM public.scan_members
  WHERE scan_id = v_attempt.scan_id AND user_id = p_actor_id;
  IF v_member_role IS NULL AND NOT p_is_global_admin THEN
    RAISE EXCEPTION 'SCAN_MEMBERSHIP_REQUIRED';
  END IF;

  SELECT * INTO v_stage
  FROM public.scan_chapter_stages
  WHERE scan_id = v_attempt.scan_id
    AND stage_id = v_attempt.stage_id
    AND (production_chapter_id = v_attempt.production_chapter_id OR chapter_id = v_attempt.production_chapter_id)
  ORDER BY CASE WHEN production_chapter_id = v_attempt.production_chapter_id THEN 0 ELSE 1 END
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHAPTER_STAGE_NOT_FOUND'; END IF;
  IF v_stage.status IN ('DONE', 'SKIPPED', 'CANCELLED') THEN
    RAISE EXCEPTION 'STAGE_NO_LONGER_ACCEPTS_UPLOAD';
  END IF;
  IF NOT p_is_global_admin
     AND v_member_role NOT IN ('OWNER', 'ADMIN')
     AND (v_stage.assigned_to IS DISTINCT FROM p_actor_id OR v_stage.status NOT IN ('IN_PROGRESS', 'REWORK')) THEN
    RAISE EXCEPTION 'STAGE_ASSIGNMENT_CHANGED';
  END IF;

  SELECT * INTO v_workflow_stage
  FROM public.scan_workflow_stages
  WHERE id = v_attempt.stage_id AND scan_id = v_attempt.scan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'WORKFLOW_STAGE_NOT_FOUND'; END IF;

  IF p_replace_file_id IS NOT NULL THEN
    SELECT * INTO v_replaced
    FROM public.scan_production_files
    WHERE id = p_replace_file_id
      AND scan_id = v_attempt.scan_id
      AND production_chapter_id = v_attempt.production_chapter_id
      AND stage_id = v_attempt.stage_id
      AND is_current = true
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'REPLACEMENT_NOT_CURRENT'; END IF;
    v_delivery_key := v_replaced.delivery_key;
  END IF;
  IF v_delivery_key IS NULL THEN RAISE EXCEPTION 'DELIVERY_KEY_REQUIRED'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(
    v_attempt.production_chapter_id::text || ':' || v_attempt.stage_id::text || ':' || v_delivery_key::text
  ));

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM public.scan_production_files
  WHERE production_chapter_id = v_attempt.production_chapter_id
    AND stage_id = v_attempt.stage_id
    AND delivery_key = v_delivery_key;

  IF p_replace_file_id IS NOT NULL THEN
    UPDATE public.scan_production_files
    SET is_current = false,
        is_stale = true,
        stale_reason = 'Substituído por uma versão mais recente desta entrega.'
    WHERE production_chapter_id = v_attempt.production_chapter_id
      AND stage_id = v_attempt.stage_id
      AND delivery_key = v_delivery_key
      AND is_current = true;
  END IF;

  INSERT INTO public.scan_production_files (
    scan_id, work_id, production_chapter_id, stage_id, stage_slug, delivery_key,
    file_name, byte_size, mime_type, file_key, storage_pool_id, storage_shard_id,
    bot_reference, telegram_file_id, sha256, provider, version, uploaded_by,
    is_current, note
  ) VALUES (
    v_attempt.scan_id, v_chapter.work_id, v_attempt.production_chapter_id,
    v_attempt.stage_id, v_workflow_stage.slug, v_delivery_key,
    p_payload->>'file_name', NULLIF(p_payload->>'byte_size', '')::bigint,
    NULLIF(p_payload->>'mime_type', ''), p_payload->>'file_key',
    NULLIF(p_payload->>'storage_pool_id', '')::uuid,
    NULLIF(p_payload->>'storage_shard_id', '')::uuid,
    NULLIF(p_payload->>'bot_reference', ''), NULLIF(p_payload->>'telegram_file_id', ''),
    NULLIF(p_payload->>'sha256', ''), COALESCE(NULLIF(p_payload->>'provider', ''), 'TELEGRAM'),
    v_next_version, p_actor_id, true, NULLIF(p_payload->>'note', '')
  ) RETURNING * INTO v_file;

  UPDATE public.scan_pipeline_upload_attempts
  SET status = 'SUCCEEDED', file_id = v_file.id, error_code = NULL, updated_at = now()
  WHERE id = p_upload_id;

  UPDATE public.scan_chapter_stages
  SET last_activity_at = now(), updated_at = now()
  WHERE id = v_stage.id;

  INSERT INTO public.scan_chapter_timeline (
    scan_id, production_chapter_id, stage_id, stage_slug, event_type, user_id, user_name, details
  ) VALUES (
    v_attempt.scan_id, v_attempt.production_chapter_id, v_attempt.stage_id, v_workflow_stage.slug,
    'FILE_UPLOADED', p_actor_id, COALESCE(NULLIF(p_actor_name, ''), 'Membro'),
    jsonb_build_object('file_id', v_file.id, 'file_name', v_file.file_name,
      'delivery_key', v_file.delivery_key, 'version', v_file.version, 'byte_size', v_file.byte_size)
  );

  PERFORM public.reconcile_scan_chapter_dependencies_ysql(v_attempt.production_chapter_id);
  RETURN v_file;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_scan_pipeline_file_ysql(
  p_file_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean,
  p_actor_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_file public.scan_production_files;
  v_stage public.scan_chapter_stages;
  v_workflow_stage public.scan_workflow_stages;
  v_member_role text;
  v_remaining_files boolean;
BEGIN
  SELECT * INTO v_file FROM public.scan_production_files WHERE id = p_file_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FILE_NOT_FOUND'; END IF;

  SELECT role INTO v_member_role
  FROM public.scan_members
  WHERE scan_id = v_file.scan_id AND user_id = p_actor_id;
  IF v_member_role IS NULL AND NOT p_is_global_admin THEN RAISE EXCEPTION 'SCAN_MEMBERSHIP_REQUIRED'; END IF;

  SELECT * INTO v_stage
  FROM public.scan_chapter_stages
  WHERE scan_id = v_file.scan_id
    AND stage_id = v_file.stage_id
    AND (production_chapter_id = v_file.production_chapter_id OR chapter_id = v_file.production_chapter_id)
  ORDER BY CASE WHEN production_chapter_id = v_file.production_chapter_id THEN 0 ELSE 1 END
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHAPTER_STAGE_NOT_FOUND'; END IF;

  SELECT * INTO v_file FROM public.scan_production_files WHERE id = p_file_id FOR UPDATE;
  IF NOT v_file.is_current THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;
  IF NOT p_is_global_admin AND v_member_role NOT IN ('OWNER', 'ADMIN') AND v_file.uploaded_by IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'FILE_WITHDRAW_NOT_ALLOWED';
  END IF;

  UPDATE public.scan_production_files
  SET is_current = false,
      is_stale = true,
      stale_reason = 'Removido da entrega atual.'
  WHERE id = v_file.id;

  SELECT * INTO v_workflow_stage FROM public.scan_workflow_stages WHERE id = v_file.stage_id;
  SELECT EXISTS (
    SELECT 1 FROM public.scan_production_files
    WHERE production_chapter_id = v_file.production_chapter_id
      AND stage_id = v_file.stage_id
      AND is_current = true
  ) INTO v_remaining_files;

  IF v_stage.status = 'DONE' AND COALESCE(v_workflow_stage.requires_output, true) AND NOT v_remaining_files THEN
    UPDATE public.scan_chapter_stages
    SET status = 'REWORK', completed_at = NULL, completed_by = NULL,
        rejection_reason = 'O último arquivo atual da entrega foi removido. Envie uma nova versão antes de concluir.',
        last_activity_at = now(), updated_at = now()
    WHERE id = v_stage.id;
  ELSE
    UPDATE public.scan_chapter_stages
    SET last_activity_at = now(), updated_at = now()
    WHERE id = v_stage.id;
  END IF;

  INSERT INTO public.scan_chapter_timeline (
    scan_id, production_chapter_id, stage_id, stage_slug, event_type, user_id, user_name, details
  ) VALUES (
    v_file.scan_id, v_file.production_chapter_id, v_file.stage_id, v_file.stage_slug,
    'FILE_WITHDRAWN', p_actor_id, COALESCE(NULLIF(p_actor_name, ''), 'Membro'),
    jsonb_build_object('file_id', v_file.id, 'file_name', v_file.file_name, 'delivery_key', v_file.delivery_key)
  );

  PERFORM public.reconcile_scan_chapter_dependencies_ysql(v_file.production_chapter_id);
  RETURN jsonb_build_object('success', true, 'reopened', v_stage.status = 'DONE' AND COALESCE(v_workflow_stage.requires_output, true) AND NOT v_remaining_files);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_scan_chapter_stage_ysql(
  p_chapter_stage_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_stage public.scan_chapter_stages;
  v_workflow_stage public.scan_workflow_stages;
  v_member_role text;
  v_actor_name text;
  v_open_uploads integer;
  v_has_file boolean;
  v_upstream_inputs jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_stage FROM public.scan_chapter_stages WHERE id = p_chapter_stage_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHAPTER_STAGE_NOT_FOUND'; END IF;
  IF v_stage.status = 'DONE' THEN RETURN jsonb_build_object('success', true, 'status', 'DONE', 'idempotent', true); END IF;

  SELECT role INTO v_member_role FROM public.scan_members WHERE scan_id = v_stage.scan_id AND user_id = p_actor_id;
  IF v_member_role IS NULL AND NOT p_is_global_admin THEN RAISE EXCEPTION 'SCAN_MEMBERSHIP_REQUIRED'; END IF;
  IF NOT p_is_global_admin AND v_member_role NOT IN ('OWNER', 'ADMIN') AND v_stage.assigned_to IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'STAGE_COMPLETION_NOT_ALLOWED';
  END IF;

  SELECT * INTO v_workflow_stage FROM public.scan_workflow_stages WHERE id = v_stage.stage_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'WORKFLOW_STAGE_NOT_FOUND'; END IF;

  SELECT count(*) INTO v_open_uploads
  FROM public.scan_pipeline_upload_attempts
  WHERE production_chapter_id = COALESCE(v_stage.production_chapter_id, v_stage.chapter_id)
    AND stage_id = v_stage.stage_id
    AND status IN ('UPLOADING', 'FAILED')
    AND expires_at > now();
  IF v_open_uploads > 0 THEN RAISE EXCEPTION 'UPLOADS_PENDING'; END IF;

  IF COALESCE(v_workflow_stage.requires_output, true) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.scan_production_files
      WHERE production_chapter_id = COALESCE(v_stage.production_chapter_id, v_stage.chapter_id)
        AND stage_id = v_stage.stage_id AND is_current = true
    ) INTO v_has_file;
    IF NOT v_has_file THEN RAISE EXCEPTION 'STAGE_OUTPUT_REQUIRED'; END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'stage_slug', production_file.stage_slug, 'file_id', production_file.id,
    'file_name', production_file.file_name, 'delivery_key', production_file.delivery_key,
    'version', production_file.version
  ) ORDER BY production_file.file_name, production_file.version), '[]'::jsonb)
  INTO v_upstream_inputs
  FROM public.scan_production_files production_file
  WHERE production_file.production_chapter_id = COALESCE(v_stage.production_chapter_id, v_stage.chapter_id)
    AND production_file.is_current = true
    AND production_file.stage_slug = ANY(COALESCE(v_workflow_stage.dependencies, ARRAY[]::text[]));

  UPDATE public.scan_production_files
  SET input_files = v_upstream_inputs,
      is_stale = false,
      stale_reason = NULL
  WHERE production_chapter_id = COALESCE(v_stage.production_chapter_id, v_stage.chapter_id)
    AND stage_id = v_stage.stage_id AND is_current = true;

  UPDATE public.scan_chapter_stages
  SET status = 'DONE', completed_at = now(), completed_by = p_actor_id,
      notes = COALESCE(p_notes, notes), rejection_reason = NULL,
      return_to_stage_id = NULL, last_activity_at = now(), updated_at = now()
  WHERE id = v_stage.id;

  SELECT COALESCE(display_name, username, 'Membro') INTO v_actor_name
  FROM public.members WHERE id = p_actor_id;
  INSERT INTO public.scan_chapter_timeline (
    scan_id, production_chapter_id, stage_id, stage_slug, event_type, user_id, user_name, details
  ) VALUES (
    v_stage.scan_id, COALESCE(v_stage.production_chapter_id, v_stage.chapter_id), v_stage.stage_id,
    v_workflow_stage.slug, 'COMPLETED', p_actor_id, COALESCE(v_actor_name, 'Membro'),
    jsonb_build_object('notes', p_notes, 'lineage', v_upstream_inputs)
  );

  PERFORM public.reconcile_scan_chapter_dependencies_ysql(COALESCE(v_stage.production_chapter_id, v_stage.chapter_id));
  RETURN jsonb_build_object('success', true, 'status', 'DONE', 'input_file_count', jsonb_array_length(v_upstream_inputs));
END;
$$;
