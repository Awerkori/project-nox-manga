-- A pipeline stage is a delivery, not a single file.  Keep the historical
-- rows intact and scope versioning/currentness to an individual deliverable.

ALTER TABLE public.scan_production_files
  ADD COLUMN IF NOT EXISTS delivery_key uuid;

-- Every legacy row becomes its own delivery.  This is deliberately lossless:
-- old one-file stages keep rendering exactly as before, while new replacements
-- can share a delivery_key and receive a per-file version history.
UPDATE public.scan_production_files
SET delivery_key = id
WHERE delivery_key IS NULL;

ALTER TABLE public.scan_production_files
  ALTER COLUMN delivery_key SET DEFAULT gen_random_uuid(),
  ALTER COLUMN delivery_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scan_production_files_delivery_versions
  ON public.scan_production_files (production_chapter_id, stage_id, delivery_key, version DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scan_production_files_delivery_version
  ON public.scan_production_files (production_chapter_id, stage_id, delivery_key, version);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scan_production_files_current_delivery
  ON public.scan_production_files (production_chapter_id, stage_id, delivery_key)
  WHERE is_current = true;

-- A short-lived upload intent prevents a stage from being completed in the
-- middle of a multi-file batch.  The browser owns the UUID, so a failed item
-- can be retried individually without replacing the other files.
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

-- Upload intents are finalized only through the service-role endpoint; there
-- is intentionally no browser-facing policy for this private control table.
ALTER TABLE public.scan_pipeline_upload_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_scan_pipeline_upload_attempts_completion_guard
  ON public.scan_pipeline_upload_attempts (production_chapter_id, stage_id, status, expires_at);

-- Storage is necessarily outside the database transaction, but the point at
-- which an uploaded artifact becomes a delivery is not.  Serialize that
-- transition per stage and validate the current assignment again here, not
-- only in the browser/request preflight.  This makes simultaneous replacement
-- deterministic: one writer wins, the other receives a conflict and no
-- delivery can end up with two current versions.
CREATE OR REPLACE FUNCTION public.finalize_scan_pipeline_file(
  p_upload_id uuid,
  p_replace_file_id uuid,
  p_payload jsonb
)
RETURNS public.scan_production_files
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_attempt public.scan_pipeline_upload_attempts;
  v_stage public.scan_chapter_stages;
  v_replaced public.scan_production_files;
  v_file public.scan_production_files;
  v_delivery_key uuid := (p_payload->>'delivery_key')::uuid;
  v_next_version integer;
  v_actor uuid := (p_payload->>'uploaded_by')::uuid;
  v_is_leadership boolean := COALESCE((p_payload->>'is_leadership')::boolean, false);
BEGIN
  SELECT * INTO v_attempt
  FROM public.scan_pipeline_upload_attempts
  WHERE id = p_upload_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'UPLOAD_ATTEMPT_NOT_FOUND';
  END IF;
  IF v_attempt.user_id <> v_actor
     OR v_attempt.scan_id <> (p_payload->>'scan_id')::uuid
     OR v_attempt.production_chapter_id <> (p_payload->>'production_chapter_id')::uuid
     OR v_attempt.stage_id <> (p_payload->>'stage_id')::uuid THEN
    RAISE EXCEPTION 'UPLOAD_ATTEMPT_DESTINATION_MISMATCH';
  END IF;
  IF v_attempt.status = 'SUCCEEDED' AND v_attempt.file_id IS NOT NULL THEN
    SELECT * INTO v_file FROM public.scan_production_files WHERE id = v_attempt.file_id;
    IF FOUND THEN RETURN v_file; END IF;
  END IF;
  IF v_attempt.status NOT IN ('UPLOADING', 'FAILED') THEN
    RAISE EXCEPTION 'UPLOAD_ATTEMPT_NOT_FINALIZABLE';
  END IF;

  -- This is the same row locked by completion/release/claim operations.
  -- A file which finished after a stage was completed must never become a
  -- valid output of that completed stage.
  SELECT * INTO v_stage
  FROM public.scan_chapter_stages
  WHERE production_chapter_id = v_attempt.production_chapter_id
    AND stage_id = v_attempt.stage_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHAPTER_STAGE_NOT_FOUND'; END IF;
  IF v_stage.status = 'DONE' THEN RAISE EXCEPTION 'STAGE_NO_LONGER_ACCEPTS_UPLOAD'; END IF;
  IF NOT v_is_leadership
     AND (v_stage.assigned_to IS DISTINCT FROM v_actor
       OR v_stage.status NOT IN ('IN_PROGRESS', 'REWORK')) THEN
    RAISE EXCEPTION 'STAGE_ASSIGNMENT_CHANGED';
  END IF;

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

  -- The row lock above protects replacements.  The advisory lock also makes
  -- a direct/new delivery keyed by the same lineage deterministic.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_attempt.production_chapter_id::text || ':' || v_attempt.stage_id::text || ':' || v_delivery_key::text,
    0
  ));

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM public.scan_production_files
  WHERE production_chapter_id = v_attempt.production_chapter_id
    AND stage_id = v_attempt.stage_id
    AND delivery_key = v_delivery_key;

  IF p_replace_file_id IS NOT NULL THEN
    UPDATE public.scan_production_files
    SET is_current = false
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
    v_attempt.scan_id,
    NULLIF(p_payload->>'work_id', '')::uuid,
    v_attempt.production_chapter_id,
    v_attempt.stage_id,
    p_payload->>'stage_slug',
    v_delivery_key,
    p_payload->>'file_name',
    (p_payload->>'byte_size')::bigint,
    NULLIF(p_payload->>'mime_type', ''),
    p_payload->>'file_key',
    NULLIF(p_payload->>'storage_pool_id', '')::uuid,
    NULLIF(p_payload->>'storage_shard_id', '')::uuid,
    NULLIF(p_payload->>'bot_reference', ''),
    NULLIF(p_payload->>'telegram_file_id', ''),
    NULLIF(p_payload->>'sha256', ''),
    p_payload->>'provider',
    v_next_version,
    v_actor,
    true,
    NULLIF(p_payload->>'note', '')
  ) RETURNING * INTO v_file;

  UPDATE public.scan_pipeline_upload_attempts
  SET status = 'SUCCEEDED', file_id = v_file.id, error_code = NULL, updated_at = now()
  WHERE id = p_upload_id;

  UPDATE public.scan_chapter_stages
  SET last_activity_at = now(), updated_at = now()
  WHERE id = v_stage.id;

  RETURN v_file;
END;
$$;

-- Browser users never call the finalizer directly: the authenticated endpoint
-- performs role/assignment checks and the service role finalizes the already
-- stored artifact.  Do not leave PostgreSQL's PUBLIC execute default open.
REVOKE ALL ON FUNCTION public.finalize_scan_pipeline_file(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_scan_pipeline_file(uuid, uuid, jsonb) TO service_role;

-- Withdrawal is also serialized with finalization/completion. The artifact is
-- retained privately for audit, but a completed output with no current files
-- is reopened instead of leaving a misleading DONE state downstream.
CREATE OR REPLACE FUNCTION public.withdraw_scan_pipeline_file(
  p_file_id uuid,
  p_actor_id uuid,
  p_actor_name text,
  p_is_leadership boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_file public.scan_production_files;
  v_stage public.scan_chapter_stages;
  v_requires_output boolean;
  v_remaining_files boolean;
BEGIN
  -- Read the destination first, then acquire locks in the same stage -> file
  -- order as finalization and completion to avoid a deadlock.
  SELECT * INTO v_file FROM public.scan_production_files WHERE id = p_file_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FILE_NOT_FOUND'; END IF;

  SELECT * INTO v_stage
  FROM public.scan_chapter_stages
  WHERE production_chapter_id = v_file.production_chapter_id
    AND stage_id = v_file.stage_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHAPTER_STAGE_NOT_FOUND'; END IF;

  SELECT * INTO v_file FROM public.scan_production_files WHERE id = p_file_id FOR UPDATE;
  IF NOT v_file.is_current THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;
  IF NOT p_is_leadership AND v_file.uploaded_by IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'FILE_WITHDRAW_NOT_ALLOWED';
  END IF;

  UPDATE public.scan_production_files SET is_current = false WHERE id = v_file.id;

  SELECT COALESCE(requires_output, true) INTO v_requires_output
  FROM public.scan_workflow_stages WHERE id = v_file.stage_id;
  SELECT EXISTS (
    SELECT 1 FROM public.scan_production_files
    WHERE production_chapter_id = v_file.production_chapter_id
      AND stage_id = v_file.stage_id
      AND is_current = true
  ) INTO v_remaining_files;

  IF v_stage.status = 'DONE' AND v_requires_output AND NOT v_remaining_files THEN
    UPDATE public.scan_chapter_stages
    SET status = 'REWORK',
        rejection_reason = 'O último arquivo atual da entrega foi removido. Envie uma nova versão antes de concluir.',
        completed_at = NULL,
        completed_by = NULL,
        last_activity_at = now(),
        updated_at = now()
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
    'FILE_WITHDRAWN', p_actor_id, COALESCE(p_actor_name, 'Membro'),
    jsonb_build_object('file_id', v_file.id, 'file_name', v_file.file_name, 'delivery_key', v_file.delivery_key)
  );

  PERFORM public.resolve_scan_chapter_dependencies(v_file.production_chapter_id);
  RETURN jsonb_build_object('success', true, 'reopened', v_stage.status = 'DONE' AND v_requires_output AND NOT v_remaining_files);
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_scan_pipeline_file(uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_scan_pipeline_file(uuid, uuid, text, boolean) TO service_role;

-- The last definition of this function captured an array of upstream input
-- files already.  Retain that behavior, then add the upload-intent guard so a
-- partial batch can never be silently marked complete.
CREATE OR REPLACE FUNCTION public.complete_scan_chapter_stage(
  p_chapter_stage_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_stage_row public.scan_chapter_stages;
  v_wf_stage public.scan_workflow_stages;
  v_member_role text;
  v_caller_name text;
  v_has_file boolean;
  v_open_uploads integer;
  v_return_target_stage_id uuid;
  v_upstream_inputs jsonb := '[]'::jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_stage_row FROM public.scan_chapter_stages WHERE id = p_chapter_stage_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa do capítulo não encontrada.';
  END IF;

  IF v_stage_row.status = 'DONE' THEN
    RETURN jsonb_build_object('success', true, 'status', 'DONE', 'idempotent', true);
  END IF;

  SELECT role INTO v_member_role FROM public.scan_members WHERE scan_id = v_stage_row.scan_id AND user_id = v_caller;
  IF v_member_role IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado a esta Scan.';
  END IF;

  IF v_stage_row.assigned_to != v_caller AND v_member_role NOT IN ('OWNER', 'ADMIN') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas o responsável ou administradores podem concluir esta etapa.';
  END IF;

  SELECT * INTO v_wf_stage FROM public.scan_workflow_stages WHERE id = v_stage_row.stage_id;
  SELECT COALESCE(display_name, username) INTO v_caller_name FROM public.members WHERE id = v_caller;

  SELECT count(*) INTO v_open_uploads
  FROM public.scan_pipeline_upload_attempts
  WHERE production_chapter_id = v_stage_row.production_chapter_id
    AND stage_id = v_stage_row.stage_id
    AND status IN ('UPLOADING', 'FAILED')
    AND expires_at > now();

  IF v_open_uploads > 0 THEN
    RAISE EXCEPTION 'Finalize, reenvie ou descarte os uploads pendentes antes de concluir a etapa.';
  END IF;

  IF v_wf_stage.slug != 'revisao' AND COALESCE(v_wf_stage.requires_output, true) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.scan_production_files
      WHERE production_chapter_id = v_stage_row.production_chapter_id
        AND stage_id = v_stage_row.stage_id
        AND is_current = true
    ) INTO v_has_file;
    IF NOT v_has_file THEN
      RAISE EXCEPTION 'Finalize o upload de pelo menos um arquivo obrigatório para concluir esta etapa.';
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'stage_slug', spf.stage_slug,
    'file_id', spf.id,
    'file_name', spf.file_name,
    'delivery_key', spf.delivery_key,
    'version', spf.version
  )), '[]'::jsonb) INTO v_upstream_inputs
  FROM public.scan_production_files spf
  WHERE spf.production_chapter_id = v_stage_row.production_chapter_id
    AND spf.is_current = true
    AND spf.stage_slug = ANY(v_wf_stage.dependencies);

  UPDATE public.scan_production_files
  SET input_files = v_upstream_inputs
  WHERE production_chapter_id = v_stage_row.production_chapter_id
    AND stage_id = v_stage_row.stage_id
    AND is_current = true;

  v_return_target_stage_id := v_stage_row.return_to_stage_id;

  UPDATE public.scan_chapter_stages
  SET status = 'DONE', completed_at = now(), completed_by = v_caller,
      notes = COALESCE(p_notes, notes), rejection_reason = NULL,
      return_to_stage_id = NULL, last_activity_at = now(), updated_at = now()
  WHERE id = p_chapter_stage_id;

  INSERT INTO public.scan_chapter_timeline (
    scan_id, production_chapter_id, stage_id, stage_slug, event_type, user_id, user_name, details
  ) VALUES (
    v_stage_row.scan_id, v_stage_row.production_chapter_id, v_stage_row.stage_id, v_wf_stage.slug,
    'COMPLETED', v_caller, v_caller_name,
    jsonb_build_object('notes', p_notes, 'lineage', v_upstream_inputs)
  );

  IF v_return_target_stage_id IS NOT NULL THEN
    UPDATE public.scan_chapter_stages
    SET status = 'AVAILABLE', last_activity_at = now(), updated_at = now()
    WHERE id = v_return_target_stage_id AND status != 'DONE';
  END IF;

  PERFORM public.resolve_scan_chapter_dependencies(v_stage_row.production_chapter_id);
  RETURN jsonb_build_object('success', true, 'status', 'DONE');
END;
$$;

-- Do not compare unrelated files by their stage-wide version number.  A
-- translation Part 2 at v1 is not stale merely because Part 1 is at v2.
-- Staleness is now scoped to the same delivery_key captured in input_files.
CREATE OR REPLACE FUNCTION public.resolve_scan_chapter_dependencies(p_production_chapter_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stage_record RECORD;
  v_deps_array text[];
  v_dep_slug text;
  v_all_deps_satisfied boolean;
  v_dep_stage RECORD;
  v_dep_files_exist boolean;
  v_upstream_file RECORD;
  v_downstream_file RECORD;
BEGIN
  -- If a captured input was withdrawn, it has no current row any more and
  -- therefore cannot be discovered by the replacement loop below. Mark every
  -- affected downstream output stale before resolving availability.
  FOR v_downstream_file IN (
    SELECT spf.*
    FROM public.scan_production_files spf
    WHERE spf.production_chapter_id = p_production_chapter_id
      AND spf.is_current = true
      AND spf.input_files IS NOT NULL
      AND jsonb_array_length(spf.input_files) > 0
  ) LOOP
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_downstream_file.input_files) elem
      WHERE COALESCE(elem->>'file_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND NOT EXISTS (
          SELECT 1 FROM public.scan_production_files captured
          WHERE captured.id = (elem->>'file_id')::uuid
            AND captured.is_current = true
        )
    ) THEN
      UPDATE public.scan_production_files
      SET is_stale = true,
          stale_reason = 'Um insumo usado nesta entrega foi removido ou atualizado.'
      WHERE id = v_downstream_file.id;

      UPDATE public.scan_chapter_stages cs
      SET status = 'REWORK',
          rejection_reason = 'Um insumo usado nesta entrega foi removido ou atualizado. Revalidação necessária.',
          last_activity_at = now(), updated_at = now()
      FROM public.scan_workflow_stages ws
      WHERE ws.id = cs.stage_id
        AND cs.production_chapter_id = p_production_chapter_id
        AND ws.slug = v_downstream_file.stage_slug
        AND cs.status IN ('DONE', 'AVAILABLE');
    END IF;
  END LOOP;

  FOR v_upstream_file IN (
    SELECT spf.id, spf.stage_slug, spf.delivery_key, spf.version
    FROM public.scan_production_files spf
    WHERE spf.production_chapter_id = p_production_chapter_id
      AND spf.is_current = true
  ) LOOP
    FOR v_downstream_file IN (
      SELECT spf.*
      FROM public.scan_production_files spf
      WHERE spf.production_chapter_id = p_production_chapter_id
        AND spf.is_current = true
        AND spf.stage_slug != v_upstream_file.stage_slug
        AND spf.input_files IS NOT NULL
        AND jsonb_array_length(spf.input_files) > 0
    ) LOOP
      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_downstream_file.input_files) elem
        WHERE elem->>'delivery_key' = v_upstream_file.delivery_key::text
          AND elem->>'file_id' <> v_upstream_file.id::text
      ) THEN
        UPDATE public.scan_production_files
        SET is_stale = true,
            stale_reason = 'Insumo de ' || v_upstream_file.stage_slug || ' atualizado para v' || v_upstream_file.version
        WHERE id = v_downstream_file.id;

        UPDATE public.scan_chapter_stages cs
        SET status = 'REWORK',
            rejection_reason = 'Insumo atualizado: nova versão de ' || v_upstream_file.stage_slug || ' disponível. Revalidação necessária.',
            last_activity_at = now(), updated_at = now()
        FROM public.scan_workflow_stages ws
        WHERE ws.id = cs.stage_id
          AND cs.production_chapter_id = p_production_chapter_id
          AND ws.slug = v_downstream_file.stage_slug
          AND cs.status IN ('DONE', 'AVAILABLE');
      END IF;
    END LOOP;
  END LOOP;

  FOR v_stage_record IN (
    SELECT cs.id AS chapter_stage_id, cs.status, cs.assigned_to, cs.notified_available,
           cs.availability_version, ws.id AS workflow_stage_id, ws.slug AS stage_slug,
           ws.name AS stage_name, ws.dependencies, ws.requires_output, ws.display_order
    FROM public.scan_chapter_stages cs
    JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
    WHERE cs.production_chapter_id = p_production_chapter_id
    ORDER BY ws.display_order ASC
  ) LOOP
    IF v_stage_record.status IN ('DONE', 'SKIPPED', 'IN_PROGRESS') THEN CONTINUE; END IF;
    v_deps_array := v_stage_record.dependencies;

    IF v_deps_array IS NULL OR array_length(v_deps_array, 1) IS NULL OR array_length(v_deps_array, 1) = 0 THEN
      IF v_stage_record.status = 'BLOCKED' OR (v_stage_record.status = 'AVAILABLE' AND COALESCE(v_stage_record.notified_available, false) = false) THEN
        UPDATE public.scan_chapter_stages
        SET status = 'AVAILABLE', availability_version = COALESCE(availability_version, 1),
            availability_reason = 'initial', notified_available = true, last_activity_at = now(), updated_at = now()
        WHERE id = v_stage_record.chapter_stage_id;
        PERFORM public.dispatch_pipeline_stage_availability_notification(v_stage_record.chapter_stage_id);
      END IF;
      CONTINUE;
    END IF;

    v_all_deps_satisfied := true;
    FOREACH v_dep_slug IN ARRAY v_deps_array LOOP
      SELECT cs.status, ws.requires_output, ws.id AS dep_stage_id
      INTO v_dep_stage
      FROM public.scan_chapter_stages cs
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE cs.production_chapter_id = p_production_chapter_id
        AND (ws.slug = v_dep_slug
          OR (v_dep_slug = 'clean' AND ws.slug = 'clean_redraw')
          OR (v_dep_slug = 'clean_redraw' AND ws.slug = 'clean')
          OR (v_dep_slug = 'revisao' AND ws.slug = 'revisor_qc')
          OR (v_dep_slug = 'revisor_qc' AND ws.slug = 'revisao'));
      IF NOT FOUND OR v_dep_stage.status NOT IN ('DONE', 'SKIPPED') THEN
        v_all_deps_satisfied := false; EXIT;
      END IF;
      IF v_dep_stage.status = 'DONE' AND COALESCE(v_dep_stage.requires_output, true) THEN
        SELECT EXISTS (
          SELECT 1 FROM public.scan_production_files
          WHERE production_chapter_id = p_production_chapter_id
            AND stage_id = v_dep_stage.dep_stage_id AND is_current = true
        ) INTO v_dep_files_exist;
        IF NOT v_dep_files_exist THEN v_all_deps_satisfied := false; EXIT; END IF;
      END IF;
    END LOOP;

    IF v_all_deps_satisfied AND v_stage_record.status = 'BLOCKED' THEN
      IF v_stage_record.stage_slug IN ('revisor_qc', 'qc', 'revisao') AND v_stage_record.assigned_to IS NOT NULL THEN
        UPDATE public.scan_chapter_stages
        SET status = 'IN_PROGRESS', started_at = COALESCE(started_at, now()),
            availability_version = COALESCE(availability_version, 1), availability_reason = 'initial',
            notified_available = true, last_activity_at = now(), updated_at = now()
        WHERE id = v_stage_record.chapter_stage_id;
      ELSE
        UPDATE public.scan_chapter_stages
        SET status = 'AVAILABLE', availability_version = COALESCE(availability_version, 1),
            availability_reason = 'initial', notified_available = true, last_activity_at = now(), updated_at = now()
        WHERE id = v_stage_record.chapter_stage_id;
      END IF;
      PERFORM public.dispatch_pipeline_stage_availability_notification(v_stage_record.chapter_stage_id);
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_scan_chapter_stage(uuid, text) TO authenticated;
