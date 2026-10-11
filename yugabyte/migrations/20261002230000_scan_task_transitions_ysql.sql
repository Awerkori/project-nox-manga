-- Authoritative YSQL transitions for legacy Scan tasks.
--
-- The workspace used PostgREST RPCs coupled to auth.uid(). These functions
-- keep the original workflow while making the authenticated server actor
-- explicit and serializing every state transition on Yugabyte/YSQL.

DO $$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(required_table ORDER BY required_table)
  INTO v_missing
  FROM (VALUES
    ('scan_tasks'), ('scan_members'), ('scan_workflow_stages'),
    ('scan_member_positions'), ('scan_activity'), ('scan_notifications'),
    ('scan_production_chapters')
  ) AS required(required_table)
  WHERE to_regclass('public.' || required_table) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'SCAN_TASK_TRANSITIONS_YSQL_PREREQUISITES_MISSING: %',
      array_to_string(v_missing, ', ');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_scan_task_ysql(
  p_task_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_task public.scan_tasks;
  v_stage public.scan_workflow_stages;
  v_member_role text;
  v_has_position boolean := false;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;

  SELECT * INTO v_task FROM public.scan_tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_NOT_FOUND'; END IF;

  SELECT role INTO v_member_role
  FROM public.scan_members
  WHERE scan_id = v_task.scan_id AND user_id = p_actor_id;
  IF v_member_role IS NULL AND NOT COALESCE(p_is_global_admin, false) THEN
    RAISE EXCEPTION 'SCAN_MEMBERSHIP_REQUIRED';
  END IF;

  IF v_task.status IN ('DONE', 'CANCELLED', 'BLOCKED') THEN
    RAISE EXCEPTION 'TASK_NOT_CLAIMABLE';
  END IF;
  IF v_task.assigned_to IS NOT NULL AND v_task.assigned_to <> p_actor_id THEN
    RAISE EXCEPTION 'TASK_ALREADY_CLAIMED';
  END IF;
  IF v_task.assigned_to = p_actor_id AND v_task.status = 'IN_PROGRESS' THEN
    RETURN jsonb_build_object('success', true, 'task_id', v_task.id,
      'assigned_to', p_actor_id, 'idempotent', true);
  END IF;

  IF v_member_role NOT IN ('OWNER', 'ADMIN') AND NOT COALESCE(p_is_global_admin, false)
     AND v_task.stage_id IS NOT NULL THEN
    SELECT * INTO v_stage
    FROM public.scan_workflow_stages
    WHERE id = v_task.stage_id AND scan_id = v_task.scan_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TASK_WORKFLOW_STAGE_NOT_FOUND'; END IF;

    IF COALESCE(array_length(v_stage.allowed_position_ids, 1), 0) > 0 THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.scan_member_positions
        WHERE scan_id = v_task.scan_id
          AND user_id = p_actor_id
          AND position_id = ANY(v_stage.allowed_position_ids)
      ) INTO v_has_position;
      IF NOT v_has_position THEN RAISE EXCEPTION 'TASK_POSITION_REQUIRED'; END IF;
    END IF;
  END IF;

  UPDATE public.scan_tasks
  SET assigned_to = p_actor_id, status = 'IN_PROGRESS', updated_at = now()
  WHERE id = v_task.id;

  INSERT INTO public.scan_activity (scan_id, user_id, action, details)
  VALUES (v_task.scan_id, p_actor_id, 'TASK_CLAIMED', jsonb_build_object(
    'task_id', v_task.id, 'title', v_task.title
  ));

  RETURN jsonb_build_object('success', true, 'task_id', v_task.id,
    'assigned_to', p_actor_id, 'idempotent', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_scan_task_ysql(
  p_task_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean DEFAULT false,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_task public.scan_tasks;
  v_member_role text;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;

  SELECT * INTO v_task FROM public.scan_tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_NOT_FOUND'; END IF;

  SELECT role INTO v_member_role
  FROM public.scan_members
  WHERE scan_id = v_task.scan_id AND user_id = p_actor_id;
  IF v_member_role IS NULL AND NOT COALESCE(p_is_global_admin, false) THEN
    RAISE EXCEPTION 'SCAN_MEMBERSHIP_REQUIRED';
  END IF;
  IF v_task.status IN ('DONE', 'CANCELLED') THEN RAISE EXCEPTION 'TASK_NOT_RELEASABLE'; END IF;
  IF v_task.assigned_to IS NULL AND v_task.status = 'TODO' THEN
    RETURN jsonb_build_object('success', true, 'task_id', v_task.id, 'idempotent', true);
  END IF;
  IF v_task.assigned_to IS DISTINCT FROM p_actor_id
     AND v_member_role NOT IN ('OWNER', 'ADMIN')
     AND NOT COALESCE(p_is_global_admin, false) THEN
    RAISE EXCEPTION 'TASK_RELEASE_FORBIDDEN';
  END IF;

  UPDATE public.scan_tasks
  SET assigned_to = NULL, status = 'TODO', updated_at = now()
  WHERE id = v_task.id;
  INSERT INTO public.scan_activity (scan_id, user_id, action, details)
  VALUES (v_task.scan_id, p_actor_id, 'TASK_RELEASED', jsonb_build_object(
    'task_id', v_task.id, 'title', v_task.title,
    'reason', NULLIF(trim(COALESCE(p_reason, '')), '')
  ));

  RETURN jsonb_build_object('success', true, 'task_id', v_task.id, 'idempotent', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_scan_task_ysql(
  p_task_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean DEFAULT false,
  p_note text DEFAULT NULL,
  p_file_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_task public.scan_tasks;
  v_member_role text;
  v_current_stage public.scan_workflow_stages;
  v_next_stage public.scan_workflow_stages;
  v_next_task public.scan_tasks;
  v_next_task_id uuid;
  v_target_user record;
  v_lock_key text;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;

  SELECT * INTO v_task FROM public.scan_tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_NOT_FOUND'; END IF;
  SELECT role INTO v_member_role
  FROM public.scan_members
  WHERE scan_id = v_task.scan_id AND user_id = p_actor_id;
  IF v_member_role IS NULL AND NOT COALESCE(p_is_global_admin, false) THEN
    RAISE EXCEPTION 'SCAN_MEMBERSHIP_REQUIRED';
  END IF;
  IF v_task.status = 'DONE' THEN
    RETURN jsonb_build_object('success', true, 'task_id', v_task.id, 'idempotent', true);
  END IF;
  IF v_task.status IN ('CANCELLED', 'BLOCKED') THEN RAISE EXCEPTION 'TASK_NOT_COMPLETABLE'; END IF;
  IF v_task.assigned_to IS DISTINCT FROM p_actor_id
     AND v_member_role NOT IN ('OWNER', 'ADMIN')
     AND NOT COALESCE(p_is_global_admin, false) THEN
    RAISE EXCEPTION 'TASK_COMPLETION_FORBIDDEN';
  END IF;

  UPDATE public.scan_tasks
  SET status = 'DONE', completed_at = now(), updated_at = now()
  WHERE id = v_task.id;
  INSERT INTO public.scan_activity (scan_id, user_id, action, details)
  VALUES (v_task.scan_id, p_actor_id, 'TASK_COMPLETED', jsonb_build_object(
    'task_id', v_task.id, 'title', v_task.title,
    'note', NULLIF(trim(COALESCE(p_note, '')), ''), 'file_id', p_file_id
  ));

  IF v_task.stage_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'task_id', v_task.id, 'idempotent', false);
  END IF;

  SELECT * INTO v_current_stage
  FROM public.scan_workflow_stages
  WHERE id = v_task.stage_id AND scan_id = v_task.scan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_WORKFLOW_STAGE_NOT_FOUND'; END IF;
  SELECT * INTO v_next_stage
  FROM public.scan_workflow_stages
  WHERE scan_id = v_task.scan_id
    AND display_order > v_current_stage.display_order
    AND is_active = true
  ORDER BY display_order ASC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'task_id', v_task.id,
      'idempotent', false, 'next_stage_slug', NULL);
  END IF;

  IF v_task.chapter_id IS NOT NULL THEN
    UPDATE public.scan_production_chapters
    SET current_stage_slug = v_next_stage.slug, updated_at = now()
    WHERE scan_id = v_task.scan_id
      AND (id = v_task.chapter_id OR target_chapter_id = v_task.chapter_id);
  END IF;

  -- Multiple upstream tasks may unlock the same downstream task. This
  -- narrow advisory lock gives that context one creator without a scan-wide
  -- bottleneck or a duplicate task race.
  v_lock_key := v_task.scan_id::text || ':' || COALESCE(v_task.chapter_id::text, '-')
    || ':' || COALESCE(v_task.work_id::text, '-') || ':' || v_next_stage.id::text;
  PERFORM pg_advisory_xact_lock(hashtext(v_lock_key));
  SELECT * INTO v_next_task
  FROM public.scan_tasks
  WHERE scan_id = v_task.scan_id
    AND chapter_id IS NOT DISTINCT FROM v_task.chapter_id
    AND work_id IS NOT DISTINCT FROM v_task.work_id
    AND stage_id = v_next_stage.id
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.scan_tasks (
      scan_id, work_id, chapter_id, stage_id, title, description,
      priority, status, created_by
    ) VALUES (
      v_task.scan_id, v_task.work_id, v_task.chapter_id, v_next_stage.id,
      'Etapa: ' || v_next_stage.name || COALESCE(' - ' || v_task.title, ''),
      'Capítulo liberado da etapa anterior (' || v_current_stage.name || '). Pronto para execução.',
      v_task.priority, 'TODO', p_actor_id
    ) RETURNING id INTO v_next_task_id;
  ELSE
    v_next_task_id := v_next_task.id;
    IF v_next_task.status = 'BLOCKED' THEN
      UPDATE public.scan_tasks SET status = 'TODO', updated_at = now()
      WHERE id = v_next_task.id;
    END IF;
  END IF;

  IF COALESCE(array_length(v_next_stage.allowed_position_ids, 1), 0) > 0 THEN
    FOR v_target_user IN
      SELECT DISTINCT user_id
      FROM public.scan_member_positions
      WHERE scan_id = v_task.scan_id
        AND position_id = ANY(v_next_stage.allowed_position_ids)
    LOOP
      INSERT INTO public.scan_notifications (scan_id, user_id, type, title, body, deep_link)
      VALUES (
        v_task.scan_id, v_target_user.user_id, 'STAGE_READY',
        'Nova tarefa disponível: ' || v_next_stage.name,
        'Uma nova tarefa está pronta na fila de ' || v_next_stage.name || '.',
        '/scan?id=' || v_task.scan_id || '&tab=minha_fila&taskId=' || v_next_task_id
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'task_id', v_task.id, 'idempotent', false,
    'next_task_id', v_next_task_id, 'next_stage_slug', v_next_stage.slug,
    'next_stage_name', v_next_stage.name
  );
END;
$$;
