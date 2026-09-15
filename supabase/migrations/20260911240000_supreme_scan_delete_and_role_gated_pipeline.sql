-- ============================================================================
-- Migration: Supreme Scan Delete & Role-Gated Production Engine
-- Description:
-- 1. Updates global_admin_hard_delete_scan with exact scan name confirmation,
--    cleanly unbinding chapter_scans and work_scans (preserving public works & chapters),
--    and purging private scan workspace data.
-- 2. Adds allowed_position_ids uuid[] to scan_workflow_stages and maps them.
-- 3. Updates claim_scan_task with role-gating (only matching positions or owners/admins).
-- 4. Creates release_scan_task and complete_scan_stage for smooth layperson workflow.
-- ============================================================================

-- 1. Global Admin Supreme Delete Scan
CREATE OR REPLACE FUNCTION public.global_admin_hard_delete_scan(
  p_scan_id uuid,
  p_reason text,
  p_confirmation text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_scan_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas Administradores Globais podem executar exclusão definitiva.';
  END IF;

  SELECT name INTO v_scan_name FROM public.scans WHERE id = p_scan_id;
  IF v_scan_name IS NULL THEN
    RAISE EXCEPTION 'Scan não encontrada.';
  END IF;

  IF trim(p_confirmation) IS NULL OR trim(p_confirmation) <> trim(v_scan_name) THEN
    RAISE EXCEPTION 'Confirmação inválida. Digite exatamente o nome da scan (%) para confirmar a exclusão definitiva.', v_scan_name;
  END IF;

  -- Disassociate public reader junction tables cleanly so public works and chapters remain 100% intact
  DELETE FROM public.chapter_scans WHERE scan_id = p_scan_id;
  DELETE FROM public.work_scans WHERE scan_id = p_scan_id;

  -- Delete all private workspace artifacts, records and tasks
  DELETE FROM public.scan_tasks WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_chapter_qc_issues WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_chapter_stages WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_production_files WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_production_chapters WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_mural_reactions WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_mural_comments WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_mural_posts WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_attachments WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_message_threads WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_messages WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_channel_preferences WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_channels WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_tutorial_reads WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_tutorial_versions WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_academy_tutorials WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_notification_preferences WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_notifications WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_email_outbox WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_member_onboarding WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_onboarding_templates WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_recruitment_questions WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_applications WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_recruitment_openings WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_member_positions WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_positions WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_invites WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_project_requests WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_transfer_requests WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_integrations WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_staff_notes WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_storage_usage WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_activity WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_members WHERE scan_id = p_scan_id;

  -- Insert audit log
  INSERT INTO public.scan_global_audit_log (scan_id, scan_name, admin_id, action, reason)
  VALUES (p_scan_id, v_scan_name, auth.uid(), 'SCAN_HARD_DELETED', p_reason);

  -- Delete the scan itself
  DELETE FROM public.scans WHERE id = p_scan_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_scan_name', v_scan_name
  );
END;
$$;

-- 2. Add allowed_position_ids to scan_workflow_stages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scan_workflow_stages' AND column_name = 'allowed_position_ids'
  ) THEN
    ALTER TABLE public.scan_workflow_stages ADD COLUMN allowed_position_ids uuid[] DEFAULT '{}';
  END IF;
END $$;

-- Populate allowed_position_ids for stages based on existing positions
DO $$
DECLARE
  v_scan RECORD;
BEGIN
  FOR v_scan IN SELECT id FROM public.scans LOOP
    -- RAW stage
    UPDATE public.scan_workflow_stages s
    SET allowed_position_ids = ARRAY(
      SELECT p.id FROM public.scan_positions p 
      WHERE p.scan_id = v_scan.id AND p.name ILIKE '%raw%'
    )
    WHERE s.scan_id = v_scan.id AND s.slug = 'raw';

    -- CLEAN / REDRAW stage
    UPDATE public.scan_workflow_stages s
    SET allowed_position_ids = ARRAY(
      SELECT p.id FROM public.scan_positions p 
      WHERE p.scan_id = v_scan.id AND (p.name ILIKE '%clean%' OR p.name ILIKE '%redraw%')
    )
    WHERE s.scan_id = v_scan.id AND s.slug = 'clean_redraw';

    -- TRADUÇÃO stage
    UPDATE public.scan_workflow_stages s
    SET allowed_position_ids = ARRAY(
      SELECT p.id FROM public.scan_positions p 
      WHERE p.scan_id = v_scan.id AND p.name ILIKE '%tradut%'
    )
    WHERE s.scan_id = v_scan.id AND s.slug = 'traducao';

    -- TYPESET stage
    UPDATE public.scan_workflow_stages s
    SET allowed_position_ids = ARRAY(
      SELECT p.id FROM public.scan_positions p 
      WHERE p.scan_id = v_scan.id AND p.name ILIKE '%type%'
    )
    WHERE s.scan_id = v_scan.id AND s.slug = 'typeset';

    -- REVISÃO stage
    UPDATE public.scan_workflow_stages s
    SET allowed_position_ids = ARRAY(
      SELECT p.id FROM public.scan_positions p 
      WHERE p.scan_id = v_scan.id AND p.name ILIKE '%revis%'
    )
    WHERE s.scan_id = v_scan.id AND s.slug = 'revisao';

    -- QC stage
    UPDATE public.scan_workflow_stages s
    SET allowed_position_ids = ARRAY(
      SELECT p.id FROM public.scan_positions p 
      WHERE p.scan_id = v_scan.id AND (p.name ILIKE '%qc%' OR p.name ILIKE '%quality%')
    )
    WHERE s.scan_id = v_scan.id AND s.slug = 'qc';

    -- READY / UPLOAD stage
    UPDATE public.scan_workflow_stages s
    SET allowed_position_ids = ARRAY(
      SELECT p.id FROM public.scan_positions p 
      WHERE p.scan_id = v_scan.id AND p.name ILIKE '%upload%'
    )
    WHERE s.scan_id = v_scan.id AND s.slug IN ('ready', 'preview', 'publicado');
  END LOOP;
END $$;

-- 3. Atomic Task Claim with Role Gating
CREATE OR REPLACE FUNCTION public.claim_scan_task(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task public.scan_tasks;
  v_stage public.scan_workflow_stages;
  v_caller uuid := auth.uid();
  v_member_role text;
  v_user_position_ids uuid[];
  v_has_matching_position boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_task FROM public.scan_tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa não encontrada.';
  END IF;

  -- Check scan membership
  SELECT role INTO v_member_role 
  FROM public.scan_members 
  WHERE scan_id = v_task.scan_id AND user_id = v_caller;

  IF v_member_role IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado a esta Scan.';
  END IF;

  IF v_task.status = 'DONE' THEN
    RAISE EXCEPTION 'Esta tarefa já foi concluída.';
  END IF;

  IF v_task.assigned_to IS NOT NULL AND v_task.assigned_to != v_caller THEN
    RAISE EXCEPTION 'Esta tarefa acabou de ser assumida por outro membro da equipe.';
  END IF;

  -- Role-gating check: OWNER, ADMIN or Global Admin can claim anything.
  -- Normal members must possess at least one allowed position for this stage if positions are configured.
  IF v_member_role NOT IN ('OWNER', 'ADMIN') AND NOT public.is_admin() AND v_task.stage_id IS NOT NULL THEN
    SELECT * INTO v_stage FROM public.scan_workflow_stages WHERE id = v_task.stage_id;
    IF FOUND AND v_stage.allowed_position_ids IS NOT NULL AND array_length(v_stage.allowed_position_ids, 1) > 0 THEN
      SELECT array_agg(position_id) INTO v_user_position_ids
      FROM public.scan_member_positions
      WHERE scan_id = v_task.scan_id AND user_id = v_caller;

      IF v_user_position_ids IS NOT NULL THEN
        SELECT (v_user_position_ids && v_stage.allowed_position_ids) INTO v_has_matching_position;
      END IF;

      IF NOT v_has_matching_position THEN
        RAISE EXCEPTION 'Você não possui o cargo necessário para assumir tarefas da etapa "%".', v_stage.name;
      END IF;
    END IF;
  END IF;

  UPDATE public.scan_tasks 
  SET assigned_to = v_caller, status = 'IN_PROGRESS', updated_at = now()
  WHERE id = p_task_id;

  RETURN jsonb_build_object(
    'success', true, 
    'task_id', p_task_id, 
    'assigned_to', v_caller
  );
END;
$$;

-- 4. Release Scan Task (Devolver à Fila)
CREATE OR REPLACE FUNCTION public.release_scan_task(
  p_task_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task public.scan_tasks;
  v_caller uuid := auth.uid();
  v_member_role text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_task FROM public.scan_tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa não encontrada.';
  END IF;

  SELECT role INTO v_member_role 
  FROM public.scan_members 
  WHERE scan_id = v_task.scan_id AND user_id = v_caller;

  IF v_member_role IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado a esta Scan.';
  END IF;

  -- Only current assignee or scan leader can release
  IF v_task.assigned_to != v_caller AND v_member_role NOT IN ('OWNER', 'ADMIN') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas o responsável atual ou líderes podem devolver esta tarefa à fila.';
  END IF;

  IF v_task.status = 'DONE' THEN
    RAISE EXCEPTION 'Tarefas concluídas não podem ser devolvidas à fila.';
  END IF;

  UPDATE public.scan_tasks
  SET assigned_to = NULL,
      status = 'TODO',
      updated_at = now()
  WHERE id = p_task_id;

  -- Insert activity log
  INSERT INTO public.scan_activity (scan_id, user_id, action, target_type, target_id, details)
  VALUES (
    v_task.scan_id,
    v_caller,
    'TASK_RELEASED',
    'scan_task',
    p_task_id,
    jsonb_build_object('title', v_task.title, 'reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'task_id', p_task_id);
END;
$$;

-- 5. Complete Scan Stage and Auto-Advance Next
CREATE OR REPLACE FUNCTION public.complete_scan_stage(
  p_task_id uuid,
  p_note text DEFAULT NULL,
  p_file_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task public.scan_tasks;
  v_caller uuid := auth.uid();
  v_member_role text;
  v_current_stage public.scan_workflow_stages;
  v_next_stage public.scan_workflow_stages;
  v_next_task_id uuid;
  v_target_user RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_task FROM public.scan_tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa não encontrada.';
  END IF;

  SELECT role INTO v_member_role 
  FROM public.scan_members 
  WHERE scan_id = v_task.scan_id AND user_id = v_caller;

  IF v_member_role IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  -- Mark current task as DONE
  UPDATE public.scan_tasks
  SET status = 'DONE',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_task_id;

  -- If task is associated with a stage, resolve next stage
  IF v_task.stage_id IS NOT NULL THEN
    SELECT * INTO v_current_stage FROM public.scan_workflow_stages WHERE id = v_task.stage_id;
    
    IF FOUND THEN
      -- Find next sequential stage in the scan's workflow
      SELECT * INTO v_next_stage
      FROM public.scan_workflow_stages
      WHERE scan_id = v_task.scan_id 
        AND display_order > v_current_stage.display_order
        AND is_active = true
      ORDER BY display_order ASC
      LIMIT 1;

      -- If next stage exists, advance chapter and create/unlock next task
      IF v_next_stage.id IS NOT NULL THEN
        -- Advance scan_production_chapters if linked
        IF v_task.chapter_id IS NOT NULL THEN
          UPDATE public.scan_production_chapters
          SET current_stage_slug = v_next_stage.slug,
              updated_at = now()
          WHERE (id = v_task.chapter_id OR target_chapter_id = v_task.chapter_id)
            AND scan_id = v_task.scan_id;
        END IF;

        -- Check if a task for next stage already exists
        SELECT id INTO v_next_task_id
        FROM public.scan_tasks
        WHERE scan_id = v_task.scan_id
          AND chapter_id IS NOT DISTINCT FROM v_task.chapter_id
          AND work_id IS NOT DISTINCT FROM v_task.work_id
          AND stage_id = v_next_stage.id;

        IF v_next_task_id IS NULL THEN
          INSERT INTO public.scan_tasks (
            scan_id, work_id, chapter_id, stage_id,
            title, description, priority, status, created_by
          ) VALUES (
            v_task.scan_id,
            v_task.work_id,
            v_task.chapter_id,
            v_next_stage.id,
            'Etapa: ' || v_next_stage.name || COALESCE(' - ' || v_task.title, ''),
            'Capítulo liberado da etapa anterior (' || v_current_stage.name || '). Pronto para execução.',
            v_task.priority,
            'TODO',
            v_caller
          ) RETURNING id INTO v_next_task_id;
        ELSE
          UPDATE public.scan_tasks
          SET status = 'TODO', updated_at = now()
          WHERE id = v_next_task_id AND status = 'BLOCKED';
        END IF;

        -- Notify team members who have the allowed positions for the next stage
        IF v_next_stage.allowed_position_ids IS NOT NULL AND array_length(v_next_stage.allowed_position_ids, 1) > 0 THEN
          FOR v_target_user IN
            SELECT DISTINCT smp.user_id
            FROM public.scan_member_positions smp
            WHERE smp.scan_id = v_task.scan_id
              AND smp.position_id = ANY(v_next_stage.allowed_position_ids)
          LOOP
            INSERT INTO public.scan_notifications (
              scan_id, user_id, type, title, body, deep_link
            ) VALUES (
              v_task.scan_id,
              v_target_user.user_id,
              'TASK_AVAILABLE',
              'Nova Etapa Disponível: ' || v_next_stage.name,
              'Uma nova tarefa está pronta na fila de ' || v_next_stage.name || ' para você assumir!',
              '/scan?id=' || v_task.scan_id || '&tab=minha_fila'
            );
          END LOOP;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'task_id', p_task_id,
    'next_stage_slug', v_next_stage.slug,
    'next_stage_name', v_next_stage.name
  );
END;
$$;
