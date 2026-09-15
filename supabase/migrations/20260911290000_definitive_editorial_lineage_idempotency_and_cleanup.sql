-- ==============================================================================
-- PROJECT NOX — DEFINITIVE EDITORIAL LINEAGE, IDEMPOTENCY & CLEANUP
-- ==============================================================================

-- 1. UNIQUE ACTIVE PRODUCTION PER SCAN + WORK + CHAPTER
DROP INDEX IF EXISTS public.scan_production_chapters_active_uniq;
CREATE UNIQUE INDEX scan_production_chapters_active_uniq 
  ON public.scan_production_chapters (scan_id, work_id, chapter_number) 
  WHERE status NOT IN ('CANCELLED');

-- 2. FILE LINEAGE & STALE TRACKING
ALTER TABLE public.scan_production_files 
  ADD COLUMN IF NOT EXISTS input_files jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.scan_production_files 
  ADD COLUMN IF NOT EXISTS is_stale boolean NOT NULL DEFAULT false;

ALTER TABLE public.scan_production_files 
  ADD COLUMN IF NOT EXISTS stale_reason text;

-- 3. NOTIFICATION IDEMPOTENCY ON STAGES
ALTER TABLE public.scan_chapter_stages 
  ADD COLUMN IF NOT EXISTS notified_available boolean NOT NULL DEFAULT false;

-- 4. ATOMIC CLAIM RPC WITH IDEMPOTENCY & FRIENDLY CONCURRENCY
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

  SELECT role INTO v_member_role FROM public.scan_members WHERE scan_id = v_stage.scan_id AND user_id = v_caller;
  IF v_member_role IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado a esta Scan.';
  END IF;

  SELECT * INTO v_wf_stage FROM public.scan_workflow_stages WHERE id = v_stage.stage_id;
  SELECT COALESCE(display_name, username) INTO v_caller_name FROM public.members WHERE id = v_caller;

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

  -- Record timeline
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
    jsonb_build_object('stage_name', v_wf_stage.name)
  );

  RETURN jsonb_build_object('success', true, 'status', 'IN_PROGRESS');
END;
$$;

-- 5. RESOLVE DEPENDENCIES WITH IDEMPOTENT NOTIFICATIONS & INPUT INTEGRITY
CREATE OR REPLACE FUNCTION public.resolve_scan_chapter_dependencies(
  p_production_chapter_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prod_chapter public.scan_production_chapters;
  v_stage_record RECORD;
  v_dep_slug text;
  v_dep_stage RECORD;
  v_dep_files_exist boolean;
  v_all_deps_satisfied boolean;
  v_deps_array text[];
  v_has_override boolean;
  v_override_deps text[];
  v_target_user RECORD;
  v_newly_available boolean;
  v_upstream_file RECORD;
  v_downstream_file RECORD;
BEGIN
  SELECT * INTO v_prod_chapter FROM public.scan_production_chapters WHERE id = p_production_chapter_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 1. STALE DOWNSTREAM CHECK: if an upstream stage has a newer version than what downstream used
  FOR v_upstream_file IN (
    SELECT spf.stage_slug, MAX(spf.version) as current_version
    FROM public.scan_production_files spf
    WHERE spf.production_chapter_id = p_production_chapter_id
      AND spf.is_current = true
    GROUP BY spf.stage_slug
  ) LOOP
    -- Check if any current downstream file used an older version of this upstream file
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
        WHERE elem->>'stage_slug' = v_upstream_file.stage_slug
          AND (elem->>'version')::int < v_upstream_file.current_version
      ) THEN
        -- Mark downstream file stale
        UPDATE public.scan_production_files
        SET 
          is_stale = true,
          stale_reason = 'Insumo de ' || v_upstream_file.stage_slug || ' atualizado para v' || v_upstream_file.current_version
        WHERE id = v_downstream_file.id;

        -- Transition downstream stage to REWORK if not already rework/in_progress
        UPDATE public.scan_chapter_stages cs
        SET 
          status = 'REWORK',
          rejection_reason = 'Insumo atualizado: Nova versão de ' || v_upstream_file.stage_slug || ' (v' || v_upstream_file.current_version || ') disponível. Revalidação/Typeset necessário.',
          last_activity_at = now(),
          updated_at = now()
        FROM public.scan_workflow_stages ws
        WHERE ws.id = cs.stage_id
          AND cs.production_chapter_id = p_production_chapter_id
          AND ws.slug = v_downstream_file.stage_slug
          AND cs.status IN ('DONE', 'AVAILABLE');
      END IF;
    END LOOP;
  END LOOP;

  -- 2. EVALUATE STAGES PROGRESSION
  FOR v_stage_record IN (
    SELECT 
      cs.id AS chapter_stage_id,
      cs.status,
      cs.notified_available,
      ws.id AS workflow_stage_id,
      ws.slug AS stage_slug,
      ws.name AS stage_name,
      ws.dependencies,
      ws.requires_output,
      ws.display_order
    FROM public.scan_chapter_stages cs
    JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
    WHERE cs.production_chapter_id = p_production_chapter_id
    ORDER BY ws.display_order ASC
  ) LOOP
    -- Skip if already completed, skipped, or in progress
    IF v_stage_record.status IN ('DONE', 'SKIPPED', 'IN_PROGRESS', 'REWORK') THEN
      CONTINUE;
    END IF;

    v_deps_array := v_stage_record.dependencies;

    -- If no dependencies, stage is ready
    IF v_deps_array IS NULL OR array_length(v_deps_array, 1) IS NULL OR array_length(v_deps_array, 1) = 0 THEN
      IF v_stage_record.status = 'BLOCKED' THEN
        UPDATE public.scan_chapter_stages 
        SET status = 'AVAILABLE', last_activity_at = now(), updated_at = now() 
        WHERE id = v_stage_record.chapter_stage_id;
      END IF;
      CONTINUE;
    END IF;

    -- Evaluate all dependencies
    v_all_deps_satisfied := true;

    FOREACH v_dep_slug IN ARRAY v_deps_array LOOP
      SELECT 
        cs.status,
        ws.requires_output,
        ws.id AS dep_stage_id
      INTO v_dep_stage
      FROM public.scan_chapter_stages cs
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE cs.production_chapter_id = p_production_chapter_id 
        AND ws.slug = v_dep_slug;

      IF NOT FOUND THEN
        v_all_deps_satisfied := false;
        EXIT;
      END IF;

      -- Check status
      IF v_dep_stage.status NOT IN ('DONE', 'SKIPPED') THEN
        v_all_deps_satisfied := false;
        EXIT;
      END IF;

      -- Check file existence if required
      IF v_dep_stage.status = 'DONE' AND COALESCE(v_dep_stage.requires_output, true) THEN
        SELECT EXISTS (
          SELECT 1 FROM public.scan_production_files 
          WHERE production_chapter_id = p_production_chapter_id 
            AND stage_id = v_dep_stage.dep_stage_id 
            AND is_current = true
        ) INTO v_dep_files_exist;

        IF NOT v_dep_files_exist THEN
          v_all_deps_satisfied := false;
          EXIT;
        END IF;
      END IF;
    END LOOP;

    v_newly_available := false;

    IF v_all_deps_satisfied THEN
      IF v_stage_record.status = 'BLOCKED' THEN
        UPDATE public.scan_chapter_stages 
        SET 
          status = 'AVAILABLE', 
          last_activity_at = now(), 
          updated_at = now() 
        WHERE id = v_stage_record.chapter_stage_id;

        v_newly_available := true;
      END IF;

      -- IDEMPOTENT NOTIFICATION: Send ONLY on real transition to AVAILABLE
      IF (v_newly_available OR v_stage_record.status = 'AVAILABLE') AND NOT COALESCE(v_stage_record.notified_available, false) THEN
        -- 1. Timeline event
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
          v_prod_chapter.scan_id,
          p_production_chapter_id,
          v_stage_record.workflow_stage_id,
          v_stage_record.stage_slug,
          'stage_became_available',
          NULL,
          'Sistema Editorial',
          jsonb_build_object(
            'stage_name', v_stage_record.stage_name,
            'stage_slug', v_stage_record.stage_slug,
            'chapter_number', v_prod_chapter.chapter_number
          )
        );

        -- 2. Notify scan members with matching editorial role
        FOR v_target_user IN (
          SELECT DISTINCT sm.user_id
          FROM public.scan_members sm
          JOIN public.scan_member_positions smp ON smp.user_id = sm.user_id AND smp.scan_id = sm.scan_id
          JOIN public.scan_positions sp ON sp.id = smp.position_id
          WHERE sm.scan_id = v_prod_chapter.scan_id
            AND (
              lower(sp.name) = lower(v_stage_record.stage_name)
              OR lower(sp.name) LIKE '%' || lower(v_stage_record.stage_slug) || '%'
              OR (v_stage_record.stage_slug = 'typeset' AND lower(sp.name) LIKE '%type%')
              OR (v_stage_record.stage_slug = 'traducao' AND lower(sp.name) LIKE '%trad%')
              OR (v_stage_record.stage_slug = 'clean_redraw' AND (lower(sp.name) LIKE '%clean%' OR lower(sp.name) LIKE '%redraw%'))
              OR (v_stage_record.stage_slug = 'revisao' AND lower(sp.name) LIKE '%revis%')
              OR (v_stage_record.stage_slug = 'qc' AND lower(sp.name) LIKE '%qc%')
            )
        ) LOOP
          INSERT INTO public.scan_notifications (
            scan_id,
            user_id,
            type,
            title,
            body,
            deep_link
          ) VALUES (
            v_prod_chapter.scan_id,
            v_target_user.user_id,
            'STAGE_READY',
            'Novo capítulo disponível para ' || v_stage_record.stage_name,
            'Capítulo #' || v_prod_chapter.chapter_number || ' agora está pronto e aguardando na fila.',
            '/scan?id=' || v_prod_chapter.scan_id || '&tab=minha_fila&stage=' || v_stage_record.stage_slug
          );
        END LOOP;

        -- Mark as notified so rerunning resolver never duplicates notifications
        UPDATE public.scan_chapter_stages 
        SET notified_available = true 
        WHERE id = v_stage_record.chapter_stage_id;
      END IF;
    ELSE
      IF v_stage_record.status = 'AVAILABLE' THEN
        UPDATE public.scan_chapter_stages 
        SET status = 'BLOCKED', notified_available = false, updated_at = now() 
        WHERE id = v_stage_record.chapter_stage_id;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- 6. ATOMIC COMPLETE WITH INPUT LINEAGE CAPTURE
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
  v_return_target_stage_id uuid;
  v_upstream_inputs jsonb := '[]'::jsonb;
  v_current_file_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_stage_row FROM public.scan_chapter_stages WHERE id = p_chapter_stage_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa do capítulo não encontrada.';
  END IF;

  -- Idempotency check: if already DONE, return success idempotently
  IF v_stage_row.status = 'DONE' THEN
    RETURN jsonb_build_object('success', true, 'status', 'DONE', 'idempotent', true);
  END IF;

  SELECT role INTO v_member_role FROM public.scan_members WHERE scan_id = v_stage_row.scan_id AND user_id = v_caller;
  IF v_member_role IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado a esta Scan.';
  END IF;

  SELECT * INTO v_wf_stage FROM public.scan_workflow_stages WHERE id = v_stage_row.stage_id;
  SELECT COALESCE(display_name, username) INTO v_caller_name FROM public.members WHERE id = v_caller;

  -- UPLOAD GATING: Every stage except 'revisao' requires output
  IF v_wf_stage.slug != 'revisao' AND COALESCE(v_wf_stage.requires_output, true) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.scan_production_files 
      WHERE production_chapter_id = v_stage_row.production_chapter_id 
        AND stage_id = v_stage_row.stage_id 
        AND is_current = true
    ) INTO v_has_file;

    IF NOT v_has_file THEN
      RAISE EXCEPTION 'Finalize o upload do arquivo obrigatório para concluir esta etapa.';
    END IF;
  END IF;

  -- Record input lineage for deliverables produced in this stage
  -- Collect current files of upstream dependencies
  SELECT jsonb_agg(
    jsonb_build_object(
      'stage_slug', spf.stage_slug,
      'file_id', spf.id,
      'file_name', spf.file_name,
      'version', spf.version
    )
  ) INTO v_upstream_inputs
  FROM public.scan_production_files spf
  WHERE spf.production_chapter_id = v_stage_row.production_chapter_id
    AND spf.is_current = true
    AND spf.stage_slug = ANY(v_wf_stage.dependencies);

  IF v_upstream_inputs IS NOT NULL THEN
    UPDATE public.scan_production_files
    SET input_files = v_upstream_inputs
    WHERE production_chapter_id = v_stage_row.production_chapter_id
      AND stage_id = v_stage_row.stage_id
      AND is_current = true;
  END IF;

  v_return_target_stage_id := v_stage_row.return_to_stage_id;

  -- Mark completed
  UPDATE public.scan_chapter_stages 
  SET 
    status = 'DONE',
    completed_at = now(),
    completed_by = v_caller,
    notes = COALESCE(p_notes, notes),
    rejection_reason = NULL,
    return_to_stage_id = NULL,
    last_activity_at = now(),
    updated_at = now()
  WHERE id = p_chapter_stage_id;

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
    v_stage_row.scan_id,
    v_stage_row.production_chapter_id,
    v_stage_row.stage_id,
    v_wf_stage.slug,
    'COMPLETED',
    v_caller,
    v_caller_name,
    jsonb_build_object('notes', p_notes, 'lineage', v_upstream_inputs)
  );

  -- If this was a rework returning to QC/Revisão, advance straight to it
  IF v_return_target_stage_id IS NOT NULL THEN
    UPDATE public.scan_chapter_stages 
    SET status = 'AVAILABLE', last_activity_at = now(), updated_at = now()
    WHERE id = v_return_target_stage_id AND status != 'DONE';
  END IF;

  -- Resolve remaining DAG
  PERFORM public.resolve_scan_chapter_dependencies(v_stage_row.production_chapter_id);

  RETURN jsonb_build_object('success', true, 'status', 'DONE');
END;
$$;

-- 7. SAFE CLEANUP RPC FOR NON-PUBLISHED PRODUCTION CHAPTERS
CREATE OR REPLACE FUNCTION public.delete_scan_production_chapter(
  p_production_chapter_id uuid,
  p_confirmation text,
  p_reason text DEFAULT 'Produção de teste/QA removida'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_prod public.scan_production_chapters;
  v_member_role text;
  v_work_title text;
  v_expected_conf text;
  v_tasks_removed int := 0;
  v_files_removed int := 0;
  v_stages_removed int := 0;
  v_timeline_removed int := 0;
  v_notifs_removed int := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_prod FROM public.scan_production_chapters WHERE id = p_production_chapter_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Capítulo em produção não encontrado.';
  END IF;

  -- PROTECTION: Published chapters cannot be deleted via operational cleanup
  IF v_prod.status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Capítulos já publicados não podem ser excluídos por este fluxo. Utilize a opção "Retirar do Público" para despublicar.';
  END IF;

  SELECT role INTO v_member_role FROM public.scan_members WHERE scan_id = v_prod.scan_id AND user_id = v_caller;
  IF (v_member_role NOT IN ('OWNER', 'ADMIN') OR v_member_role IS NULL) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas Administradores ou Donos da Scan podem excluir produções.';
  END IF;

  SELECT title INTO v_work_title FROM public.works WHERE id = v_prod.work_id;

  -- Confirmation check: must match chapter number (e.g. '87' or 'QA-87') or label
  v_expected_conf := COALESCE(v_prod.chapter_label, v_prod.chapter_number::text);
  IF trim(p_confirmation) NOT IN (v_prod.chapter_number::text, v_expected_conf, 'CONFIRMAR', trim(v_prod.chapter_label)) THEN
    RAISE EXCEPTION 'Confirmação inválida. Digite "%" para confirmar a exclusão.', v_prod.chapter_number;
  END IF;

  -- Clean pending notifications for this chapter
  WITH del_notifs AS (
    DELETE FROM public.scan_notifications
    WHERE scan_id = v_prod.scan_id
      AND deep_link LIKE '%' || p_production_chapter_id::text || '%'
    RETURNING id
  )
  SELECT count(*) INTO v_notifs_removed FROM del_notifs;

  -- Clean private staged files
  WITH del_files AS (
    DELETE FROM public.scan_production_files
    WHERE production_chapter_id = p_production_chapter_id
    RETURNING id
  )
  SELECT count(*) INTO v_files_removed FROM del_files;

  -- Clean chapter stages
  WITH del_stages AS (
    DELETE FROM public.scan_chapter_stages
    WHERE production_chapter_id = p_production_chapter_id
    RETURNING id
  )
  SELECT count(*) INTO v_stages_removed FROM del_stages;

  -- Clean timeline
  WITH del_timeline AS (
    DELETE FROM public.scan_chapter_timeline
    WHERE production_chapter_id = p_production_chapter_id
    RETURNING id
  )
  SELECT count(*) INTO v_timeline_removed FROM del_timeline;

  -- Clean production chapter itself
  DELETE FROM public.scan_production_chapters WHERE id = p_production_chapter_id;

  -- Retain minimal audit log
  INSERT INTO public.scan_global_audit_log (
    scan_id,
    scan_name,
    admin_id,
    action,
    reason
  ) VALUES (
    v_prod.scan_id,
    COALESCE(v_work_title, 'Obra') || ' #' || v_prod.chapter_number,
    v_caller,
    'PRODUCTION_CHAPTER_DELETED',
    p_reason || ' (Removidos: ' || v_stages_removed || ' etapas, ' || v_files_removed || ' arquivos, ' || v_timeline_removed || ' eventos)'
  );

  RETURN jsonb_build_object(
    'success', true,
    'chapter_number', v_prod.chapter_number,
    'stages_removed', v_stages_removed,
    'files_removed', v_files_removed,
    'notifications_removed', v_notifs_removed,
    'timeline_removed', v_timeline_removed,
    'audit_retained', true
  );
END;
$$;

-- 8. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.delete_scan_production_chapter(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_scan_chapter_stage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_scan_chapter_stage(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_scan_chapter_dependencies(uuid) TO authenticated;

