-- Migration: Definitive Scan Roles, Functions, Pipeline Permissions, and Audited Interventions
-- 20260912160000_definitive_scan_roles_functions_and_pipeline.sql

-- ======================================================================
-- 1. CLEANUP scan_positions: RETAIN STRICTLY THE 5 EDITORIAL ROLES
-- Dono and Gerente are ADMINISTRATIVE FUNCTIONS (stored in scan_members.role),
-- NOT editorial roles.
-- Canonical 5 Editorial Roles:
-- 1: Raw Provider
-- 2: Tradutor
-- 3: Clean/Redraw
-- 4: Typer
-- 5: Revisor (QC)
-- ======================================================================

DO $$
DECLARE
  v_scan RECORD;
BEGIN
  FOR v_scan IN SELECT id FROM public.scans LOOP
    -- Delete any assignments to Dono or Gerente in scan_member_positions
    DELETE FROM public.scan_member_positions
    WHERE scan_id = v_scan.id
      AND position_id IN (
        SELECT id FROM public.scan_positions 
        WHERE scan_id = v_scan.id AND name IN ('Dono', 'Gerente')
      );

    -- Delete Dono and Gerente from scan_positions
    DELETE FROM public.scan_positions
    WHERE scan_id = v_scan.id AND name IN ('Dono', 'Gerente');

    -- Re-order the 5 canonical editorial roles
    UPDATE public.scan_positions SET display_order = 1 WHERE scan_id = v_scan.id AND name = 'Raw Provider';
    UPDATE public.scan_positions SET display_order = 2 WHERE scan_id = v_scan.id AND name = 'Tradutor';
    UPDATE public.scan_positions SET display_order = 3 WHERE scan_id = v_scan.id AND name = 'Clean/Redraw';
    UPDATE public.scan_positions SET display_order = 4 WHERE scan_id = v_scan.id AND name = 'Typer';
    UPDATE public.scan_positions SET display_order = 5 WHERE scan_id = v_scan.id AND name = 'Revisor (QC)';
  END LOOP;
END;
$$;

-- Update seed function to insert only the 5 canonical editorial roles
CREATE OR REPLACE FUNCTION public.seed_scan_default_positions(p_scan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.scan_positions (scan_id, name, description, display_order, is_active)
  VALUES
    (p_scan_id, 'Raw Provider', 'Obtenção e fornecimento dos arquivos originais em alta resolução', 1, true),
    (p_scan_id, 'Tradutor', 'Tradução e localização fiel dos diálogos e narrativas', 2, true),
    (p_scan_id, 'Clean/Redraw', 'Limpeza dos balões e reconstrução das artes e fundos', 3, true),
    (p_scan_id, 'Typer', 'Diagramação das falas, efeitos sonoros e tipografia nos balões', 4, true),
    (p_scan_id, 'Revisor (QC)', 'Revisão textual, coerência e controle rigoroso de qualidade', 5, true)
  ON CONFLICT (scan_id, name) DO UPDATE 
  SET display_order = EXCLUDED.display_order,
      description = EXCLUDED.description,
      is_active = true;
END;
$$;


-- ======================================================================
-- 2. SECURE & AUDITED claim_scan_chapter_stage WITH ROLE GATING & BYPASS
-- ======================================================================

CREATE OR REPLACE FUNCTION public.claim_scan_chapter_stage(
  p_chapter_stage_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_stage public.scan_chapter_stages;
  v_wf_stage public.scan_workflow_stages;
  v_caller_name text;
  v_member_role text;
  v_assigned_user_id uuid;
  v_rows_updated int;
  v_has_required_position boolean := false;
  v_is_admin_override boolean := false;
  v_pos_record RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_stage FROM public.scan_chapter_stages WHERE id = p_chapter_stage_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada.';
  END IF;

  -- Idempotency check: if caller ALREADY holds this stage in progress, return success
  IF v_stage.status = 'IN_PROGRESS' AND v_stage.assigned_to = v_caller THEN
    RETURN jsonb_build_object('success', true, 'status', 'IN_PROGRESS', 'idempotent', true);
  END IF;

  -- Verify caller is active member of the scan
  SELECT role INTO v_member_role FROM public.scan_members WHERE scan_id = v_stage.scan_id AND user_id = v_caller;
  IF v_member_role IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado a esta Scan.';
  END IF;

  SELECT * INTO v_wf_stage FROM public.scan_workflow_stages WHERE id = v_stage.stage_id;
  SELECT COALESCE(display_name, username) INTO v_caller_name FROM public.members WHERE id = v_caller;

  -- FINAL STAGE: Publicado cannot be claimed
  IF v_wf_stage.slug = 'publicado' THEN
    RAISE EXCEPTION 'A etapa Publicado é o encerramento do fluxo editorial e não pode ser assumida.';
  END IF;

  -- PRE APROVADO: Only leadership can claim/act
  IF v_wf_stage.slug = 'pre_aprovado' THEN
    IF v_member_role NOT IN ('OWNER', 'ADMIN') AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Somente Dono ou Gerente pode aprovar esta etapa.';
    END IF;
    v_is_admin_override := true;
  ELSE
    -- Check required editorial role
    IF v_wf_stage.allowed_position_ids IS NOT NULL AND array_length(v_wf_stage.allowed_position_ids, 1) > 0 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.scan_member_positions
        WHERE scan_id = v_stage.scan_id
          AND user_id = v_caller
          AND position_id = ANY(v_wf_stage.allowed_position_ids)
      ) INTO v_has_required_position;

      IF NOT v_has_required_position THEN
        -- Check administrative bypass (Dono or Gerente)
        IF v_member_role IN ('OWNER', 'ADMIN') OR public.is_admin() THEN
          v_is_admin_override := true;
        ELSE
          RAISE EXCEPTION 'Você não possui o cargo necessário para assumir a etapa %.', v_wf_stage.name;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Atomic state guard: only claim if stage is AVAILABLE or REWORK and unassigned
  UPDATE public.scan_chapter_stages 
  SET 
    status = 'IN_PROGRESS',
    assigned_to = v_caller,
    claimed_at = COALESCE(claimed_at, now()),
    last_activity_at = now(),
    updated_at = now()
  WHERE id = p_chapter_stage_id 
    AND status IN ('AVAILABLE', 'REWORK')
    AND (assigned_to IS NULL OR assigned_to = v_caller);

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated = 0 THEN
    -- Check who holds it
    SELECT assigned_to INTO v_assigned_user_id FROM public.scan_chapter_stages WHERE id = p_chapter_stage_id;
    IF v_assigned_user_id IS NOT NULL AND v_assigned_user_id != v_caller THEN
      RAISE EXCEPTION 'Este capítulo acabou de ser pego por outro membro.';
    ELSE
      RAISE EXCEPTION 'Esta etapa não está disponível para ser assumida (status atual: %).', v_stage.status;
    END IF;
  END IF;

  -- Record timeline with administrative intervention flag if applicable
  INSERT INTO public.scan_chapter_timeline (
    scan_id,
    production_chapter_id,
    stage_id,
    stage_slug,
    event_type,
    user_id,
    user_name,
    details
  ) VALUES (
    v_stage.scan_id,
    v_stage.production_chapter_id,
    v_stage.stage_id,
    v_wf_stage.slug,
    'CLAIMED',
    v_caller,
    v_caller_name,
    jsonb_build_object(
      'stage_name', v_wf_stage.name,
      'is_admin_intervention', v_is_admin_override,
      'note', CASE WHEN v_is_admin_override AND NOT v_has_required_position THEN 'Intervenção administrativa' ELSE NULL END
    )
  );

  RETURN jsonb_build_object(
    'success', true, 
    'status', 'IN_PROGRESS',
    'is_admin_intervention', v_is_admin_override
  );
END;
$$;


-- ======================================================================
-- 3. ATOMIC RPC: manage_scan_member
-- Manages administrative function (Staff / Gerente) and editorial positions
-- ======================================================================

CREATE OR REPLACE FUNCTION public.manage_scan_member(
  p_scan_id uuid,
  p_target_user_id uuid,
  p_new_role text DEFAULT NULL,
  p_position_ids uuid[] DEFAULT NULL,
  p_confirm_last_manager boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
  v_target_name text;
  v_scan public.scans;
  v_manager_count int;
  v_pos_id uuid;
  v_active_task_count int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING errcode = '42501';
  END IF;

  SELECT * INTO v_scan FROM public.scans WHERE id = p_scan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scan não encontrada.';
  END IF;

  -- Determine caller role
  SELECT role INTO v_caller_role FROM public.scan_members WHERE scan_id = p_scan_id AND user_id = v_caller;
  IF (v_caller_role NOT IN ('OWNER', 'ADMIN') OR v_caller_role IS NULL) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas Dono ou Gerente podem gerenciar membros.' USING errcode = '42501';
  END IF;

  -- Determine target role
  SELECT role INTO v_target_role FROM public.scan_members WHERE scan_id = p_scan_id AND user_id = p_target_user_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Membro não encontrado nesta Scan.';
  END IF;

  SELECT COALESCE(display_name, username) INTO v_target_name FROM public.members WHERE id = p_target_user_id;

  -- RULE: Owner's role cannot be changed
  IF v_target_role = 'OWNER' AND p_new_role IS NOT NULL AND p_new_role != 'OWNER' THEN
    RAISE EXCEPTION 'O cargo do Dono não pode ser alterado por este fluxo.';
  END IF;

  -- RULE: Gerente cannot change administrative role (only Dono can promote/demote)
  IF p_new_role IS NOT NULL AND p_new_role != v_target_role THEN
    IF v_caller_role != 'OWNER' AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Apenas o Dono da Scan pode alterar a função administrativa (promover ou rebaixar Gerentes).';
    END IF;

    -- RULE: Dono cannot be assigned via normal manager
    IF p_new_role = 'OWNER' THEN
      RAISE EXCEPTION 'A função Dono é única e não pode ser atribuída. Use a transferência de posse.';
    END IF;

    -- Check if demoting the last manager
    IF v_target_role = 'ADMIN' AND p_new_role = 'MEMBER' THEN
      SELECT count(*) INTO v_manager_count 
      FROM public.scan_members 
      WHERE scan_id = p_scan_id AND role = 'ADMIN';

      IF v_manager_count <= 1 AND NOT p_confirm_last_manager THEN
        RETURN jsonb_build_object(
          'success', false,
          'requires_confirmation', true,
          'warning', 'Esta Scan ficará sem Gerentes. Deseja continuar?'
        );
      END IF;
    END IF;

    -- Update administrative role
    UPDATE public.scan_members
    SET role = p_new_role
    WHERE scan_id = p_scan_id AND user_id = p_target_user_id;

    -- Record audit activity
    INSERT INTO public.scan_activity (
      scan_id,
      user_id,
      action,
      details
    ) VALUES (
      p_scan_id,
      v_caller,
      CASE WHEN p_new_role = 'ADMIN' THEN 'MEMBER_PROMOTED_TO_MANAGER' ELSE 'MANAGER_DEMOTED_TO_STAFF' END,
      jsonb_build_object(
        'target_user_id', p_target_user_id,
        'target_name', v_target_name,
        'old_role', v_target_role,
        'new_role', p_new_role
      )
    );
  END IF;

  -- Synchronize editorial positions if array provided
  IF p_position_ids IS NOT NULL THEN
    -- Gerente can manage Staff positions, Owner can manage all
    IF v_caller_role = 'ADMIN' AND v_target_role IN ('OWNER', 'ADMIN') AND v_caller != p_target_user_id THEN
      RAISE EXCEPTION 'Gerentes só podem gerenciar cargos editoriais de membros Staff.';
    END IF;

    -- Check if any removed position affects active tasks
    -- (active tasks are preserved and not cancelled, as per rule #16)

    -- Delete positions not in list
    DELETE FROM public.scan_member_positions
    WHERE scan_id = p_scan_id
      AND user_id = p_target_user_id
      AND position_id != ALL(p_position_ids);

    -- Insert new positions from list
    FOREACH v_pos_id IN ARRAY p_position_ids LOOP
      INSERT INTO public.scan_member_positions (
        scan_id,
        user_id,
        position_id,
        is_primary
      ) VALUES (
        p_scan_id,
        p_target_user_id,
        v_pos_id,
        false
      )
      ON CONFLICT (scan_id, user_id, position_id) DO NOTHING;
    END LOOP;

    -- Log positions update
    INSERT INTO public.scan_activity (
      scan_id,
      user_id,
      action,
      details
    ) VALUES (
      p_scan_id,
      v_caller,
      'MEMBER_POSITIONS_UPDATED',
      jsonb_build_object(
        'target_user_id', p_target_user_id,
        'target_name', v_target_name,
        'position_ids', p_position_ids
      )
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'updated', true);
END;
$$;


-- ======================================================================
-- 4. ATOMIC RPC: remove_scan_member_safe
-- Validates active tasks before removal, prevents orphaned tasks
-- ======================================================================

CREATE OR REPLACE FUNCTION public.remove_scan_member_safe(
  p_scan_id uuid,
  p_target_user_id uuid,
  p_resolution text DEFAULT NULL -- 'RETURN_TO_QUEUE' or 'FORCE'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
  v_target_name text;
  v_active_task_count int;
  v_released_count int := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING errcode = '42501';
  END IF;

  SELECT role INTO v_caller_role FROM public.scan_members WHERE scan_id = p_scan_id AND user_id = v_caller;
  IF (v_caller_role NOT IN ('OWNER', 'ADMIN') OR v_caller_role IS NULL) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas Dono ou Gerente podem remover membros.' USING errcode = '42501';
  END IF;

  SELECT role INTO v_target_role FROM public.scan_members WHERE scan_id = p_scan_id AND user_id = p_target_user_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Membro não encontrado nesta Scan.';
  END IF;

  IF v_target_role = 'OWNER' THEN
    RAISE EXCEPTION 'O Dono da Scan não pode ser removido. Transfira a posse antes de sair.';
  END IF;

  IF v_caller_role = 'ADMIN' AND v_target_role = 'ADMIN' THEN
    RAISE EXCEPTION 'Gerentes não podem remover outros Gerentes.';
  END IF;

  SELECT COALESCE(display_name, username) INTO v_target_name FROM public.members WHERE id = p_target_user_id;

  -- Check active tasks in production chapters
  SELECT count(*) INTO v_active_task_count
  FROM public.scan_chapter_stages
  WHERE scan_id = p_scan_id
    AND assigned_to = p_target_user_id
    AND status IN ('IN_PROGRESS', 'REWORK');

  IF v_active_task_count > 0 AND p_resolution IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'has_active_tasks', true,
      'active_tasks_count', v_active_task_count,
      'message', format('Este membro possui %s tarefas em andamento. Resolva as responsabilidades antes de concluir a remoção.', v_active_task_count)
    );
  END IF;

  -- If resolution is RETURN_TO_QUEUE, release active stages back to AVAILABLE
  IF v_active_task_count > 0 AND p_resolution = 'RETURN_TO_QUEUE' THEN
    UPDATE public.scan_chapter_stages
    SET assigned_to = NULL,
        status = 'AVAILABLE',
        claimed_at = NULL,
        last_activity_at = now(),
        updated_at = now()
    WHERE scan_id = p_scan_id
      AND assigned_to = p_target_user_id
      AND status IN ('IN_PROGRESS', 'REWORK');

    GET DIAGNOSTICS v_released_count = ROW_COUNT;
  END IF;

  -- Remove member positions
  DELETE FROM public.scan_member_positions
  WHERE scan_id = p_scan_id AND user_id = p_target_user_id;

  -- Remove membership link
  DELETE FROM public.scan_members
  WHERE scan_id = p_scan_id AND user_id = p_target_user_id;

  -- Log audit activity
  INSERT INTO public.scan_activity (
    scan_id,
    user_id,
    action,
    details
  ) VALUES (
    p_scan_id,
    v_caller,
    'MEMBER_REMOVED_FROM_SCAN',
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'target_name', v_target_name,
      'tasks_released', v_released_count
    )
  );

  RETURN jsonb_build_object(
    'success', true, 
    'removed', true, 
    'tasks_released', v_released_count
  );
END;
$$;


-- ======================================================================
-- 5. GRANTS FOR AUTHENTICATED USERS
-- ======================================================================

GRANT EXECUTE ON FUNCTION public.claim_scan_chapter_stage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_scan_member(uuid, uuid, text, uuid[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_scan_member_safe(uuid, uuid, text) TO authenticated;
