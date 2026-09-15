-- Migration: 20260912183500_fix_qc_reservation_and_release_idempotency.sql
-- Description: Fixes QC reservation check (checks COALESCE(qc_assignee_id, assigned_to)) and release idempotency when assigned_to IS NULL or already AVAILABLE

CREATE OR REPLACE FUNCTION public.dispatch_pipeline_stage_availability_notification(
  p_chapter_stage_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stage public.scan_chapter_stages;
  v_wf public.scan_workflow_stages;
  v_prod public.scan_production_chapters;
  v_work_title text;
  v_target_user record;
  v_title text;
  v_body text;
  v_dedupe_key text;
  v_href text;
  v_context text;
  v_stage_slug text;
  v_stage_name text;
  v_version int;
  v_reason text;
  v_caller uuid := auth.uid();
  v_reserved_user_id uuid;
  v_has_qc_role boolean;
BEGIN
  -- A. Fetch stage row with lock
  SELECT * INTO v_stage FROM public.scan_chapter_stages WHERE id = p_chapter_stage_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_wf FROM public.scan_workflow_stages WHERE id = v_stage.stage_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_prod FROM public.scan_production_chapters WHERE id = v_stage.production_chapter_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Protection: Do not dispatch notifications for chapters that are canceled, published or removed
  IF v_prod.status IN ('CANCELLED', 'PUBLISHED', 'ARCHIVED') THEN
    RETURN;
  END IF;

  v_stage_slug := v_wf.slug;
  v_stage_name := v_wf.name;
  v_version := COALESCE(v_stage.availability_version, 1);
  v_reason := COALESCE(v_stage.availability_reason, 'initial');

  SELECT title INTO v_work_title FROM public.works WHERE id = v_prod.work_id;
  v_work_title := COALESCE(v_work_title, 'Obra');

  v_context := v_work_title || ' — Cap. #' || v_prod.chapter_number;
  v_href := '/scan?id=' || v_prod.scan_id || '&tab=pipeline&stage=' || v_stage_slug;

  -- B. SPECIAL CASE 1: QC PREVISTO / RESERVADO
  IF v_stage_slug IN ('revisor_qc', 'qc', 'revisao') AND COALESCE(v_stage.qc_assignee_id, v_stage.assigned_to) IS NOT NULL THEN
    v_reserved_user_id := COALESCE(v_stage.qc_assignee_id, v_stage.assigned_to);

    -- Validate that reserved user is active in the scan and holds the QC role
    SELECT EXISTS (
      SELECT 1 FROM public.scan_members sm
      JOIN public.scan_member_positions smp ON smp.user_id = sm.user_id AND smp.scan_id = sm.scan_id
      JOIN public.scan_positions sp ON sp.id = smp.position_id
      WHERE sm.scan_id = v_prod.scan_id 
        AND sm.user_id = v_reserved_user_id
        AND COALESCE(sm.hidden_by_admin, false) = false
        AND (lower(sp.name) LIKE '%revis%' OR lower(sp.name) LIKE '%qc%')
    ) INTO v_has_qc_role;

    IF v_has_qc_role THEN
      v_title := '🔎 Revisão reservada para você';
      v_body := '🔎 O capítulo ' || v_prod.chapter_number || ' está pronto para sua revisão.';
      v_dedupe_key := 'pipeline_available:' || v_prod.scan_id || ':' || v_prod.id || ':' || v_stage_slug || ':' || v_version || ':' || v_reserved_user_id;

      INSERT INTO public.notifications (
        user_id,
        actor_user_id,
        kind,
        type,
        title,
        body,
        href,
        dedupe_key,
        priority,
        scan_id,
        context,
        entity_type,
        entity_id
      ) VALUES (
        v_reserved_user_id,
        v_caller,
        'pipeline_stage_available',
        'PIPELINE_STAGE_AVAILABLE',
        v_title,
        v_body,
        v_href,
        v_dedupe_key,
        'URGENT',
        v_prod.scan_id,
        v_context,
        'scan_chapter_stage',
        p_chapter_stage_id
      )
      ON CONFLICT (user_id, dedupe_key) DO NOTHING;

      INSERT INTO public.scan_notifications (
        scan_id,
        user_id,
        type,
        title,
        body,
        deep_link
      ) VALUES (
        v_prod.scan_id,
        v_reserved_user_id,
        'STAGE_READY',
        v_title,
        v_body,
        v_href
      );

      RETURN; -- Sent directly to reserved QC, DO NOT broadcast!
    ELSE
      -- Reserved user invalid or lost role: unassign and proceed to broadcast as AVAILABLE
      UPDATE public.scan_chapter_stages
      SET assigned_to = NULL, qc_assignee_id = NULL, status = 'AVAILABLE', updated_at = now()
      WHERE id = p_chapter_stage_id;
    END IF;
  END IF;

  -- C. Only stages in AVAILABLE or REWORK generate broadcast notifications
  IF v_stage.status NOT IN ('AVAILABLE', 'REWORK') THEN
    RETURN;
  END IF;

  -- D. SPECIAL CASE 2: PRÉ APROVADO (Administrative Stage -> Dono and Gerentes only)
  IF v_stage_slug IN ('pre_aprovado', 'preview', 'ready', 'pronto_pra_upar') THEN
    v_title := '✅ Capítulo aguardando aprovação';
    v_body := v_work_title || ' — Capítulo ' || v_prod.chapter_number || ' está pronto para Pré Aprovado.';

    FOR v_target_user IN (
      SELECT sm.user_id
      FROM public.scan_members sm
      WHERE sm.scan_id = v_prod.scan_id
        AND sm.role IN ('OWNER', 'ADMIN')
        AND COALESCE(sm.hidden_by_admin, false) = false
    ) LOOP
      v_dedupe_key := 'pipeline_available:' || v_prod.scan_id || ':' || v_prod.id || ':' || v_stage_slug || ':' || v_version || ':' || v_target_user.user_id;

      INSERT INTO public.notifications (
        user_id,
        actor_user_id,
        kind,
        type,
        title,
        body,
        href,
        dedupe_key,
        priority,
        scan_id,
        context,
        entity_type,
        entity_id
      ) VALUES (
        v_target_user.user_id,
        v_caller,
        'pipeline_stage_available',
        'PIPELINE_STAGE_AVAILABLE',
        v_title,
        v_body,
        v_href,
        v_dedupe_key,
        'NORMAL',
        v_prod.scan_id,
        v_context,
        'scan_chapter_stage',
        p_chapter_stage_id
      )
      ON CONFLICT (user_id, dedupe_key) DO NOTHING;

      INSERT INTO public.scan_notifications (
        scan_id,
        user_id,
        type,
        title,
        body,
        deep_link
      ) VALUES (
        v_prod.scan_id,
        v_target_user.user_id,
        'STAGE_READY',
        v_title,
        v_body,
        v_href
      );
    END LOOP;
    RETURN;
  END IF;

  -- E. Compose notifications tailored to the availability reason
  IF v_reason = 'returned_to_queue' THEN
    IF v_stage_slug = 'raw' THEN
      v_title := '📦 Raw Provider voltou para a fila';
      v_body := v_work_title || ' — Capítulo ' || v_prod.chapter_number || ' está novamente disponível para Raw Provider.';
    ELSIF v_stage_slug IN ('traducao', 'translation') THEN
      v_title := '🌐 Tradução voltou para a fila';
      v_body := v_work_title || ' — Capítulo ' || v_prod.chapter_number || ' está novamente disponível para Tradução.';
    ELSIF v_stage_slug IN ('clean_redraw', 'clean', 'redraw') THEN
      v_title := '🎨 Clean/Redraw voltou para a fila';
      v_body := v_work_title || ' — Capítulo ' || v_prod.chapter_number || ' está novamente disponível para Clean/Redraw.';
    ELSIF v_stage_slug IN ('typeset', 'typer') THEN
      v_title := '✒️ Typeset voltou para a fila';
      v_body := v_work_title || ' — Capítulo ' || v_prod.chapter_number || ' está novamente disponível para Typeset.';
    ELSIF v_stage_slug IN ('revisor_qc', 'qc', 'revisao') THEN
      v_title := '🔎 Revisão voltou para a fila';
      v_body := v_work_title || ' — Capítulo ' || v_prod.chapter_number || ' está novamente disponível para Revisor (QC).';
    ELSE
      v_title := v_stage_name || ' voltou para a fila';
      v_body := v_work_title || ' — Capítulo ' || v_prod.chapter_number || ' está novamente disponível para ' || v_stage_name || '.';
    END IF;
  ELSIF v_reason = 'rework' THEN
    IF v_stage_slug = 'raw' THEN
      v_title := '⚠️ Raw Provider em retrabalho';
    ELSIF v_stage_slug IN ('traducao', 'translation') THEN
      v_title := '⚠️ Tradução em retrabalho';
    ELSIF v_stage_slug IN ('clean_redraw', 'clean', 'redraw') THEN
      v_title := '⚠️ Clean/Redraw em retrabalho';
    ELSIF v_stage_slug IN ('typeset', 'typer') THEN
      v_title := '⚠️ Typeset em retrabalho';
    ELSIF v_stage_slug IN ('revisor_qc', 'qc', 'revisao') THEN
      v_title := '⚠️ Revisão (QC) em retrabalho';
    ELSE
      v_title := '⚠️ ' || v_stage_name || ' em retrabalho';
    END IF;
    v_body := v_work_title || ' — Capítulo ' || v_prod.chapter_number || ' precisa de ajustes em ' || v_stage_name || '.';
  ELSE
    -- Initial availability
    IF v_stage_slug = 'raw' THEN
      v_title := '📦 Novo RAW disponível';
      v_body := v_work_title || ' — Capítulo ' || v_prod.chapter_number || ' está disponível para Raw Provider.';
    ELSIF v_stage_slug IN ('traducao', 'translation') THEN
      v_title := '🌐 Nova tradução disponível';
      v_body := v_work_title || ' — Capítulo ' || v_prod.chapter_number || ' está disponível para Tradução.';
    ELSIF v_stage_slug IN ('clean_redraw', 'clean', 'redraw') THEN
      v_title := '🎨 Novo Clean/Redraw disponível';
      v_body := v_work_title || ' — Capítulo ' || v_prod.chapter_number || ' está disponível para Clean/Redraw.';
    ELSIF v_stage_slug IN ('typeset', 'typer') THEN
      v_title := '✒️ Novo Typeset disponível';
      v_body := v_work_title || ' — Capítulo ' || v_prod.chapter_number || ' está pronto para Typeset.';
    ELSIF v_stage_slug IN ('revisor_qc', 'qc', 'revisao') THEN
      v_title := '🔎 Nova revisão disponível';
      v_body := v_work_title || ' — Capítulo ' || v_prod.chapter_number || ' está pronto para Revisor (QC).';
    ELSE
      v_title := 'Novo ' || v_stage_name || ' disponível';
      v_body := v_work_title || ' — Capítulo ' || v_prod.chapter_number || ' está disponível para ' || v_stage_name || '.';
    END IF;
  END IF;

  -- F. Broadcast to matching editorial positions
  FOR v_target_user IN (
    SELECT DISTINCT sm.user_id
    FROM public.scan_members sm
    JOIN public.scan_member_positions smp ON smp.user_id = sm.user_id AND smp.scan_id = sm.scan_id
    JOIN public.scan_positions sp ON sp.id = smp.position_id
    WHERE sm.scan_id = v_prod.scan_id
      AND COALESCE(sm.hidden_by_admin, false) = false
      AND (
        (v_stage_slug = 'raw' AND lower(sp.name) LIKE '%raw%')
        OR (v_stage_slug IN ('traducao', 'translation') AND lower(sp.name) LIKE '%trad%')
        OR (v_stage_slug IN ('clean_redraw', 'clean', 'redraw') AND (lower(sp.name) LIKE '%clean%' OR lower(sp.name) LIKE '%redraw%'))
        OR (v_stage_slug IN ('typeset', 'typer') AND lower(sp.name) LIKE '%type%')
        OR (v_stage_slug IN ('revisor_qc', 'qc', 'revisao') AND (lower(sp.name) LIKE '%revis%' OR lower(sp.name) LIKE '%qc%'))
      )
  ) LOOP
    v_dedupe_key := 'pipeline_available:' || v_prod.scan_id || ':' || v_prod.id || ':' || v_stage_slug || ':' || v_version || ':' || v_target_user.user_id;

    INSERT INTO public.notifications (
      user_id,
      actor_user_id,
      kind,
      type,
      title,
      body,
      href,
      dedupe_key,
      priority,
      scan_id,
      context,
      entity_type,
      entity_id
    ) VALUES (
      v_target_user.user_id,
      v_caller,
      'pipeline_stage_available',
      'PIPELINE_STAGE_AVAILABLE',
      v_title,
      v_body,
      v_href,
      v_dedupe_key,
      'NORMAL',
      v_prod.scan_id,
      v_context,
      'scan_chapter_stage',
      p_chapter_stage_id
    )
    ON CONFLICT (user_id, dedupe_key) DO NOTHING;

    INSERT INTO public.scan_notifications (
      scan_id,
      user_id,
      type,
      title,
      body,
      deep_link
    ) VALUES (
      v_prod.scan_id,
      v_target_user.user_id,
      'STAGE_READY',
      v_title,
      v_body,
      v_href
    );
  END LOOP;
END;
$$;

-- Updated release_scan_chapter_stage with full idempotency when unassigned or already AVAILABLE
CREATE OR REPLACE FUNCTION public.release_scan_chapter_stage(
  p_chapter_stage_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_stage_row public.scan_chapter_stages;
  v_wf_stage public.scan_workflow_stages;
  v_member_role text;
  v_caller_name text;
  v_new_version int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING errcode = '42501';
  END IF;

  SELECT * INTO v_stage_row 
  FROM public.scan_chapter_stages 
  WHERE id = p_chapter_stage_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada.';
  END IF;

  -- Idempotency check: if already AVAILABLE or nobody is assigned, do not increment or re-broadcast!
  IF v_stage_row.status = 'AVAILABLE' OR v_stage_row.assigned_to IS NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'status', v_stage_row.status, 
      'idempotent', true,
      'availability_version', v_stage_row.availability_version
    );
  END IF;

  SELECT role INTO v_member_role 
  FROM public.scan_members 
  WHERE scan_id = v_stage_row.scan_id AND user_id = v_caller;

  IF v_member_role IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  SELECT COALESCE(display_name, username) INTO v_caller_name FROM public.members WHERE id = v_caller;

  -- Authority: Assignee OR Owner/Gerente OR platform admin
  IF v_stage_row.assigned_to IS DISTINCT FROM v_caller AND v_member_role NOT IN ('OWNER', 'ADMIN') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Você só pode liberar tarefas atribuídas a você.';
  END IF;

  SELECT * INTO v_wf_stage FROM public.scan_workflow_stages WHERE id = v_stage_row.stage_id;

  v_new_version := COALESCE(v_stage_row.availability_version, 1) + 1;

  -- Update stage: return to AVAILABLE with new version
  UPDATE public.scan_chapter_stages 
  SET 
    status = 'AVAILABLE',
    previous_assigned_to = assigned_to,
    assigned_to = NULL,
    claimed_at = NULL,
    availability_version = v_new_version,
    availability_reason = 'returned_to_queue',
    notified_available = true,
    last_activity_at = now(),
    updated_at = now()
  WHERE id = p_chapter_stage_id;

  -- Audit in timeline
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
    'RELEASED',
    v_caller,
    v_caller_name,
    jsonb_build_object(
      'reason', p_reason,
      'previous_assignee', v_stage_row.assigned_to,
      'released_by', v_caller,
      'released_by_name', v_caller_name,
      'availability_version', v_new_version
    )
  );

  -- Dispatch notification to the cargo members
  PERFORM public.dispatch_pipeline_stage_availability_notification(p_chapter_stage_id);

  RETURN jsonb_build_object(
    'success', true,
    'chapter_stage_id', p_chapter_stage_id,
    'status', 'AVAILABLE',
    'availability_version', v_new_version
  );
END;
$$;
