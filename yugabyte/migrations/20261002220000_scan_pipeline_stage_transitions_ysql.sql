-- Authoritative YSQL transitions for the collaborative Scan pipeline.
--
-- These replace PostgREST/auth.uid()-bound RPCs with explicit, server-side
-- actor checks.  Each operation locks its stage row, so a stale browser can
-- never release, rework or override a newer assignment silently.

DO $$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(required_table ORDER BY required_table)
  INTO v_missing
  FROM (VALUES
    ('members'), ('scan_members'), ('scan_workflow_stages'),
    ('scan_chapter_stages'), ('scan_chapter_timeline')
  ) AS required(required_table)
  WHERE to_regclass('public.' || required_table) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'SCAN_PIPELINE_TRANSITIONS_YSQL_PREREQUISITES_MISSING: %',
      array_to_string(v_missing, ', ');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_scan_chapter_stage_ysql(
  p_chapter_stage_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean DEFAULT false,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_stage public.scan_chapter_stages;
  v_workflow_stage public.scan_workflow_stages;
  v_member_role text;
  v_actor_name text := 'Membro';
  v_availability_version integer;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;

  SELECT * INTO v_stage
  FROM public.scan_chapter_stages
  WHERE id = p_chapter_stage_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHAPTER_STAGE_NOT_FOUND'; END IF;

  -- A retry after the first release must not emit a second audit event or
  -- bump the availability version again.
  IF v_stage.status = 'AVAILABLE' OR v_stage.assigned_to IS NULL THEN
    RETURN jsonb_build_object(
      'success', true, 'status', v_stage.status, 'idempotent', true,
      'availability_version', v_stage.availability_version
    );
  END IF;

  SELECT role INTO v_member_role
  FROM public.scan_members
  WHERE scan_id = v_stage.scan_id AND user_id = p_actor_id;
  IF v_member_role IS NULL AND NOT p_is_global_admin THEN
    RAISE EXCEPTION 'SCAN_MEMBERSHIP_REQUIRED';
  END IF;
  IF v_stage.assigned_to IS DISTINCT FROM p_actor_id
     AND v_member_role NOT IN ('OWNER', 'ADMIN')
     AND NOT p_is_global_admin THEN
    RAISE EXCEPTION 'STAGE_RELEASE_FORBIDDEN';
  END IF;

  SELECT * INTO v_workflow_stage
  FROM public.scan_workflow_stages
  WHERE id = v_stage.stage_id AND scan_id = v_stage.scan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'WORKFLOW_STAGE_NOT_FOUND'; END IF;

  v_availability_version := COALESCE(v_stage.availability_version, 1) + 1;
  UPDATE public.scan_chapter_stages
  SET status = 'AVAILABLE',
      previous_assigned_to = assigned_to,
      assigned_to = NULL,
      claimed_at = NULL,
      availability_version = v_availability_version,
      availability_reason = 'returned_to_queue',
      notified_available = false,
      last_activity_at = now(),
      updated_at = now()
  WHERE id = v_stage.id;

  SELECT COALESCE(display_name, username, 'Membro') INTO v_actor_name
  FROM public.members WHERE id = p_actor_id;
  INSERT INTO public.scan_chapter_timeline (
    scan_id, production_chapter_id, stage_id, stage_slug, event_type,
    user_id, user_name, details
  ) VALUES (
    v_stage.scan_id, COALESCE(v_stage.production_chapter_id, v_stage.chapter_id),
    v_stage.stage_id, v_workflow_stage.slug, 'RELEASED', p_actor_id,
    COALESCE(v_actor_name, 'Membro'),
    jsonb_build_object('reason', NULLIF(trim(COALESCE(p_reason, '')), ''),
      'previous_assignee', v_stage.assigned_to,
      'availability_version', v_availability_version)
  );

  RETURN jsonb_build_object(
    'success', true, 'status', 'AVAILABLE',
    'availability_version', v_availability_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.return_scan_chapter_stage_ysql(
  p_source_stage_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean,
  p_target_stage_slug text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_source public.scan_chapter_stages;
  v_target public.scan_chapter_stages;
  v_target_workflow public.scan_workflow_stages;
  v_member_role text;
  v_actor_name text := 'Membro';
  v_availability_version integer;
  v_chapter_id uuid;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF length(trim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'REWORK_REASON_REQUIRED';
  END IF;

  SELECT * INTO v_source
  FROM public.scan_chapter_stages
  WHERE id = p_source_stage_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHAPTER_STAGE_NOT_FOUND'; END IF;

  SELECT role INTO v_member_role
  FROM public.scan_members
  WHERE scan_id = v_source.scan_id AND user_id = p_actor_id;
  IF v_member_role IS NULL AND NOT p_is_global_admin THEN
    RAISE EXCEPTION 'SCAN_MEMBERSHIP_REQUIRED';
  END IF;

  v_chapter_id := COALESCE(v_source.production_chapter_id, v_source.chapter_id);
  SELECT chapter_stage.* INTO v_target
  FROM public.scan_chapter_stages chapter_stage
  JOIN public.scan_workflow_stages workflow_stage ON workflow_stage.id = chapter_stage.stage_id
  WHERE chapter_stage.scan_id = v_source.scan_id
    AND COALESCE(chapter_stage.production_chapter_id, chapter_stage.chapter_id) = v_chapter_id
    AND (workflow_stage.slug = p_target_stage_slug
      OR (p_target_stage_slug = 'clean' AND workflow_stage.slug = 'clean_redraw')
      OR (p_target_stage_slug = 'clean_redraw' AND workflow_stage.slug = 'clean')
      OR (p_target_stage_slug = 'revisao' AND workflow_stage.slug = 'revisor_qc')
      OR (p_target_stage_slug = 'revisor_qc' AND workflow_stage.slug = 'revisao'))
  FOR UPDATE OF chapter_stage;
  IF NOT FOUND THEN RAISE EXCEPTION 'REWORK_TARGET_NOT_FOUND'; END IF;

  SELECT * INTO v_target_workflow
  FROM public.scan_workflow_stages
  WHERE id = v_target.stage_id AND scan_id = v_source.scan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'WORKFLOW_STAGE_NOT_FOUND'; END IF;

  v_availability_version := COALESCE(v_target.availability_version, 1) + 1;
  UPDATE public.scan_chapter_stages
  SET status = 'REWORK',
      rejection_reason = trim(p_reason),
      return_to_stage_id = v_source.id,
      previous_assigned_to = assigned_to,
      assigned_to = NULL,
      claimed_at = NULL,
      availability_version = v_availability_version,
      availability_reason = 'rework',
      notified_available = false,
      last_activity_at = now(),
      updated_at = now()
  WHERE id = v_target.id;

  SELECT COALESCE(display_name, username, 'Membro') INTO v_actor_name
  FROM public.members WHERE id = p_actor_id;
  INSERT INTO public.scan_chapter_timeline (
    scan_id, production_chapter_id, stage_id, stage_slug, event_type,
    user_id, user_name, details
  ) VALUES (
    v_source.scan_id, v_chapter_id, v_target.stage_id, v_target_workflow.slug,
    'REWORK_REQUESTED', p_actor_id, COALESCE(v_actor_name, 'Membro'),
    jsonb_build_object('reason', trim(p_reason), 'source_stage_id', v_source.id,
      'availability_version', v_availability_version)
  );

  PERFORM public.reconcile_scan_chapter_dependencies_ysql(v_chapter_id);
  RETURN jsonb_build_object(
    'success', true, 'status', 'REWORK', 'target_stage_id', v_target.id,
    'availability_version', v_availability_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_override_scan_stage_ysql(
  p_chapter_stage_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean,
  p_action text,
  p_reason text,
  p_target_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_stage public.scan_chapter_stages;
  v_workflow_stage public.scan_workflow_stages;
  v_member_role text;
  v_target_is_member boolean := false;
  v_actor_name text := 'Membro';
  v_chapter_id uuid;
  v_action text := upper(trim(COALESCE(p_action, '')));
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF length(trim(COALESCE(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'OVERRIDE_REASON_REQUIRED'; END IF;
  IF v_action NOT IN ('FORCE_COMPLETE', 'FORCE_SKIP', 'REOPEN', 'RECLAIM', 'TRANSFER') THEN
    RAISE EXCEPTION 'OVERRIDE_ACTION_INVALID';
  END IF;

  SELECT * INTO v_stage
  FROM public.scan_chapter_stages
  WHERE id = p_chapter_stage_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHAPTER_STAGE_NOT_FOUND'; END IF;

  SELECT role INTO v_member_role
  FROM public.scan_members
  WHERE scan_id = v_stage.scan_id AND user_id = p_actor_id;
  IF v_member_role NOT IN ('OWNER', 'ADMIN') AND NOT p_is_global_admin THEN
    RAISE EXCEPTION 'STAGE_OVERRIDE_FORBIDDEN';
  END IF;

  SELECT * INTO v_workflow_stage
  FROM public.scan_workflow_stages
  WHERE id = v_stage.stage_id AND scan_id = v_stage.scan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'WORKFLOW_STAGE_NOT_FOUND'; END IF;

  IF v_action = 'TRANSFER' THEN
    IF p_target_user_id IS NULL THEN RAISE EXCEPTION 'OVERRIDE_TRANSFER_TARGET_REQUIRED'; END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.scan_members
      WHERE scan_id = v_stage.scan_id AND user_id = p_target_user_id
    ) INTO v_target_is_member;
    IF NOT v_target_is_member THEN RAISE EXCEPTION 'OVERRIDE_TRANSFER_TARGET_NOT_MEMBER'; END IF;
  END IF;

  IF v_action = 'FORCE_COMPLETE' THEN
    UPDATE public.scan_chapter_stages
    SET status = 'DONE', completed_at = now(), completed_by = p_actor_id,
        is_override = true, override_action = v_action, override_reason = trim(p_reason),
        override_by = p_actor_id, rejection_reason = NULL,
        last_activity_at = now(), updated_at = now()
    WHERE id = v_stage.id;
  ELSIF v_action = 'FORCE_SKIP' THEN
    UPDATE public.scan_chapter_stages
    SET status = 'SKIPPED', skip_reason = trim(p_reason), skipped_by = p_actor_id,
        is_override = true, override_action = v_action, override_reason = trim(p_reason),
        override_by = p_actor_id, last_activity_at = now(), updated_at = now()
    WHERE id = v_stage.id;
  ELSIF v_action = 'REOPEN' THEN
    UPDATE public.scan_chapter_stages
    SET status = 'AVAILABLE', previous_assigned_to = assigned_to, assigned_to = NULL,
        claimed_at = NULL, completed_at = NULL, completed_by = NULL,
        is_override = true, override_action = v_action, override_reason = trim(p_reason),
        override_by = p_actor_id, availability_version = COALESCE(availability_version, 1) + 1,
        availability_reason = 'admin_reopen', notified_available = false,
        last_activity_at = now(), updated_at = now()
    WHERE id = v_stage.id;
  ELSIF v_action = 'RECLAIM' THEN
    UPDATE public.scan_chapter_stages
    SET status = 'AVAILABLE', previous_assigned_to = assigned_to, assigned_to = NULL,
        claimed_at = NULL, is_override = true, override_action = v_action,
        override_reason = trim(p_reason), override_by = p_actor_id,
        availability_version = COALESCE(availability_version, 1) + 1,
        availability_reason = 'admin_reclaim', notified_available = false,
        last_activity_at = now(), updated_at = now()
    WHERE id = v_stage.id;
  ELSE
    UPDATE public.scan_chapter_stages
    SET status = 'IN_PROGRESS', previous_assigned_to = assigned_to,
        assigned_to = p_target_user_id, claimed_at = now(), is_override = true,
        override_action = v_action, override_reason = trim(p_reason), override_by = p_actor_id,
        last_activity_at = now(), updated_at = now()
    WHERE id = v_stage.id;
  END IF;

  SELECT COALESCE(display_name, username, 'Membro') INTO v_actor_name
  FROM public.members WHERE id = p_actor_id;
  v_chapter_id := COALESCE(v_stage.production_chapter_id, v_stage.chapter_id);
  INSERT INTO public.scan_chapter_timeline (
    scan_id, production_chapter_id, stage_id, stage_slug, event_type,
    user_id, user_name, details
  ) VALUES (
    v_stage.scan_id, v_chapter_id, v_stage.stage_id, v_workflow_stage.slug,
    'ADMIN_OVERRIDE', p_actor_id, COALESCE(v_actor_name, 'Membro'),
    jsonb_build_object('action', v_action, 'reason', trim(p_reason),
      'target_user_id', p_target_user_id)
  );

  PERFORM public.reconcile_scan_chapter_dependencies_ysql(v_chapter_id);
  RETURN jsonb_build_object('success', true, 'action', v_action);
END;
$$;
