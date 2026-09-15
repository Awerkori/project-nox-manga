-- Migration: Definitive Pipeline Role-Gated Notifications, Availability Generations and Personal Badges
-- File: supabase/migrations/20260912180000_definitive_pipeline_role_notifications_and_personal_badges.sql

-- 1. Extend public.scan_chapter_stages with availability tracking and QC reservation
ALTER TABLE public.scan_chapter_stages
  ADD COLUMN IF NOT EXISTS availability_version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS availability_reason text NOT NULL DEFAULT 'initial',
  ADD COLUMN IF NOT EXISTS qc_assignee_id uuid REFERENCES public.members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scan_chapter_stages_avail 
  ON public.scan_chapter_stages(status, availability_version);

-- 2. Create public.scan_pipeline_stage_seen for personal per-user seen state
CREATE TABLE IF NOT EXISTS public.scan_pipeline_stage_seen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  chapter_stage_id uuid NOT NULL REFERENCES public.scan_chapter_stages(id) ON DELETE CASCADE,
  production_chapter_id uuid NOT NULL REFERENCES public.scan_production_chapters(id) ON DELETE CASCADE,
  stage_slug text NOT NULL,
  availability_version int NOT NULL DEFAULT 1,
  seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_pipeline_stage_seen UNIQUE (user_id, chapter_stage_id, availability_version)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stage_seen_lookup 
  ON public.scan_pipeline_stage_seen(user_id, scan_id, chapter_stage_id, availability_version);

CREATE INDEX IF NOT EXISTS idx_pipeline_stage_seen_user_scan 
  ON public.scan_pipeline_stage_seen(user_id, scan_id);

ALTER TABLE public.scan_pipeline_stage_seen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stage_seen_select ON public.scan_pipeline_stage_seen;
CREATE POLICY stage_seen_select ON public.scan_pipeline_stage_seen
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS stage_seen_insert ON public.scan_pipeline_stage_seen;
CREATE POLICY stage_seen_insert ON public.scan_pipeline_stage_seen
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'scan_pipeline_stage_seen'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_pipeline_stage_seen;
    END IF;
  END IF;
END $$;

-- 3. RPC to mark a pipeline stage generation as seen for the authenticated user
CREATE OR REPLACE FUNCTION public.mark_pipeline_stage_seen(p_chapter_stage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_stage public.scan_chapter_stages;
  v_wf public.scan_workflow_stages;
  v_is_member boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  SELECT * INTO v_stage FROM public.scan_chapter_stages WHERE id = p_chapter_stage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Etapa não encontrada');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.scan_members 
    WHERE scan_id = v_stage.scan_id AND user_id = v_caller AND COALESCE(hidden_by_admin, false) = false
  ) INTO v_is_member;

  IF NOT v_is_member AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado a esta Scan' USING errcode = '42501';
  END IF;

  SELECT * INTO v_wf FROM public.scan_workflow_stages WHERE id = v_stage.stage_id;

  INSERT INTO public.scan_pipeline_stage_seen (
    user_id,
    scan_id,
    chapter_stage_id,
    production_chapter_id,
    stage_slug,
    availability_version,
    seen_at
  ) VALUES (
    v_caller,
    v_stage.scan_id,
    v_stage.id,
    v_stage.production_chapter_id,
    COALESCE(v_wf.slug, 'stage'),
    COALESCE(v_stage.availability_version, 1),
    now()
  )
  ON CONFLICT (user_id, chapter_stage_id, availability_version) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'chapter_stage_id', p_chapter_stage_id,
    'availability_version', COALESCE(v_stage.availability_version, 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_pipeline_stage_seen(uuid) TO authenticated;

-- 4. Central Dispatcher Function for Stage Availability Notifications
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
  IF v_stage_slug IN ('revisor_qc', 'qc', 'revisao') AND v_stage.assigned_to IS NOT NULL THEN
    v_reserved_user_id := v_stage.assigned_to;

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
      SET assigned_to = NULL, status = 'AVAILABLE', updated_at = now()
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

  -- E. OPERATIONAL EDITORIAL STAGES (raw, traducao, clean_redraw, typeset, revisor_qc)
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
    v_title := '⚠️ ' || v_stage_name || ' em retrabalho';
    v_body := v_work_title || ' — Capítulo ' || v_prod.chapter_number || ' precisa de ajustes em ' || v_stage_name || '.';
  ELSE
    -- Initial release
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

  -- F. Broadcast strictly to active members of this Scan holding the matching editorial position
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

-- 5. Updated resolve_scan_chapter_dependencies enforcing DAG AND-join and notifications
CREATE OR REPLACE FUNCTION public.resolve_scan_chapter_dependencies(
  p_production_chapter_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prod_chapter public.scan_production_chapters;
  v_stage_record RECORD;
  v_dep_slug text;
  v_dep_stage RECORD;
  v_dep_files_exist boolean;
  v_all_deps_satisfied boolean;
  v_deps_array text[];
  v_upstream_file RECORD;
  v_downstream_file RECORD;
BEGIN
  SELECT * INTO v_prod_chapter FROM public.scan_production_chapters WHERE id = p_production_chapter_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 1. STALE DOWNSTREAM CHECK
  FOR v_upstream_file IN (
    SELECT spf.stage_slug, MAX(spf.version) as current_version
    FROM public.scan_production_files spf
    WHERE spf.production_chapter_id = p_production_chapter_id
      AND spf.is_current = true
    GROUP BY spf.stage_slug
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
        WHERE elem->>'stage_slug' = v_upstream_file.stage_slug
          AND (elem->>'version')::int < v_upstream_file.current_version
      ) THEN
        UPDATE public.scan_production_files
        SET 
          is_stale = true,
          stale_reason = 'Insumo de ' || v_upstream_file.stage_slug || ' atualizado para v' || v_upstream_file.current_version
        WHERE id = v_downstream_file.id;

        UPDATE public.scan_chapter_stages cs
        SET 
          status = 'REWORK',
          rejection_reason = 'Insumo atualizado: Nova versão de ' || v_upstream_file.stage_slug || ' (v' || v_upstream_file.current_version || ') disponível.',
          availability_version = COALESCE(cs.availability_version, 1) + 1,
          availability_reason = 'rework',
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
      cs.assigned_to,
      cs.notified_available,
      cs.availability_version,
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
    IF v_stage_record.status IN ('DONE', 'SKIPPED', 'IN_PROGRESS') THEN
      CONTINUE;
    END IF;

    v_deps_array := v_stage_record.dependencies;

    -- If stage has no dependencies (e.g. Raw Provider)
    IF v_deps_array IS NULL OR array_length(v_deps_array, 1) IS NULL OR array_length(v_deps_array, 1) = 0 THEN
      IF v_stage_record.status = 'BLOCKED' OR (v_stage_record.status = 'AVAILABLE' AND COALESCE(v_stage_record.notified_available, false) = false) THEN
        UPDATE public.scan_chapter_stages 
        SET 
          status = 'AVAILABLE',
          availability_version = COALESCE(availability_version, 1),
          availability_reason = 'initial',
          notified_available = true,
          last_activity_at = now(), 
          updated_at = now() 
        WHERE id = v_stage_record.chapter_stage_id;

        PERFORM public.dispatch_pipeline_stage_availability_notification(v_stage_record.chapter_stage_id);
      END IF;
      CONTINUE;
    END IF;

    -- Check ALL dependencies (AND-join rule)
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
        AND (
          ws.slug = v_dep_slug
          OR (v_dep_slug = 'clean' AND ws.slug = 'clean_redraw')
          OR (v_dep_slug = 'clean_redraw' AND ws.slug = 'clean')
          OR (v_dep_slug = 'revisao' AND ws.slug = 'revisor_qc')
          OR (v_dep_slug = 'revisor_qc' AND ws.slug = 'revisao')
        );

      IF NOT FOUND THEN
        v_all_deps_satisfied := false;
        EXIT;
      END IF;

      IF v_dep_stage.status NOT IN ('DONE', 'SKIPPED') THEN
        v_all_deps_satisfied := false;
        EXIT;
      END IF;

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

    IF v_all_deps_satisfied THEN
      IF v_stage_record.status = 'BLOCKED' THEN
        -- Stage transitions to AVAILABLE (or direct reserved QC if pre-assigned)
        IF v_stage_record.stage_slug IN ('revisor_qc', 'qc', 'revisao') AND v_stage_record.assigned_to IS NOT NULL THEN
          UPDATE public.scan_chapter_stages 
          SET 
            status = 'IN_PROGRESS', 
            availability_version = COALESCE(availability_version, 1),
            availability_reason = 'initial',
            notified_available = true,
            last_activity_at = now(), 
            updated_at = now() 
          WHERE id = v_stage_record.chapter_stage_id;
        ELSE
          UPDATE public.scan_chapter_stages 
          SET 
            status = 'AVAILABLE', 
            availability_version = COALESCE(availability_version, 1),
            availability_reason = 'initial',
            notified_available = true,
            last_activity_at = now(), 
            updated_at = now() 
          WHERE id = v_stage_record.chapter_stage_id;
        END IF;

        PERFORM public.dispatch_pipeline_stage_availability_notification(v_stage_record.chapter_stage_id);
      END IF;
    ELSE
      -- If dependencies are not all satisfied, ensure stage stays BLOCKED
      IF v_stage_record.status = 'AVAILABLE' THEN
        UPDATE public.scan_chapter_stages 
        SET status = 'BLOCKED', notified_available = false, updated_at = now() 
        WHERE id = v_stage_record.chapter_stage_id;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- 6. Updated release_scan_chapter_stage with availability version increment and notification
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

  -- Idempotency check: if already AVAILABLE, do not increment or re-broadcast!
  IF v_stage_row.status = 'AVAILABLE' THEN
    RETURN jsonb_build_object('success', true, 'status', 'AVAILABLE', 'idempotent', true);
  END IF;

  SELECT role INTO v_member_role 
  FROM public.scan_members 
  WHERE scan_id = v_stage_row.scan_id AND user_id = v_caller;

  IF v_member_role IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  SELECT COALESCE(display_name, username) INTO v_caller_name FROM public.members WHERE id = v_caller;

  -- Authority: Assignee OR Owner/Gerente OR platform admin
  IF v_stage_row.assigned_to != v_caller AND v_member_role NOT IN ('OWNER', 'ADMIN') AND NOT public.is_admin() THEN
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
    'status', 'AVAILABLE', 
    'availability_version', v_new_version
  );
END;
$$;

-- 7. Updated return_scan_chapter_stage (Rework) with availability version increment and notification
CREATE OR REPLACE FUNCTION public.return_scan_chapter_stage(
  p_source_stage_id uuid,
  p_target_stage_slug text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_source_stage public.scan_chapter_stages;
  v_target_stage public.scan_chapter_stages;
  v_target_wf public.scan_workflow_stages;
  v_member_role text;
  v_caller_name text;
  v_new_version int;
BEGIN
  IF length(trim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'O motivo do retrabalho/correção é obrigatório (mínimo 3 caracteres).';
  END IF;

  SELECT * INTO v_source_stage 
  FROM public.scan_chapter_stages 
  WHERE id = p_source_stage_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa de origem não encontrada.';
  END IF;

  SELECT role INTO v_member_role 
  FROM public.scan_members 
  WHERE scan_id = v_source_stage.scan_id AND user_id = v_caller;

  IF v_member_role IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  SELECT COALESCE(display_name, username) INTO v_caller_name FROM public.members WHERE id = v_caller;

  -- Find target stage for this chapter
  SELECT cs.* INTO v_target_stage 
  FROM public.scan_chapter_stages cs
  JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
  WHERE cs.production_chapter_id = v_source_stage.production_chapter_id 
    AND (
      ws.slug = p_target_stage_slug
      OR (p_target_stage_slug = 'clean' AND ws.slug = 'clean_redraw')
      OR (p_target_stage_slug = 'clean_redraw' AND ws.slug = 'clean')
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa de destino "%" não encontrada.', p_target_stage_slug;
  END IF;

  SELECT * INTO v_target_wf FROM public.scan_workflow_stages WHERE id = v_target_stage.stage_id;

  v_new_version := COALESCE(v_target_stage.availability_version, 1) + 1;

  -- Set target stage to REWORK / AVAILABLE without assignee
  UPDATE public.scan_chapter_stages 
  SET 
    status = 'REWORK',
    rejection_reason = p_reason,
    return_to_stage_id = v_source_stage.id,
    previous_assigned_to = assigned_to,
    assigned_to = NULL,
    claimed_at = NULL,
    availability_version = v_new_version,
    availability_reason = 'rework',
    notified_available = true,
    last_activity_at = now(),
    updated_at = now()
  WHERE id = v_target_stage.id;

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
    v_source_stage.scan_id,
    v_source_stage.production_chapter_id,
    v_target_stage.stage_id,
    v_target_wf.slug,
    'REWORK_REQUESTED',
    v_caller,
    v_caller_name,
    jsonb_build_object(
      'reason', p_reason,
      'source_stage_id', p_source_stage_id,
      'returned_by', v_caller,
      'returned_by_name', v_caller_name,
      'availability_version', v_new_version
    )
  );

  -- Dispatch notification to the cargo members
  PERFORM public.dispatch_pipeline_stage_availability_notification(v_target_stage.id);

  RETURN jsonb_build_object('success', true, 'status', 'REWORK', 'availability_version', v_new_version);
END;
$$;

-- 8. Enhanced Email Trigger for PIPELINE_STAGE_AVAILABLE
CREATE OR REPLACE FUNCTION public.trg_notification_derive_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_username text;
  v_subject text;
  v_cta_label text := 'Abrir no Project Nox';
  v_url text;
  v_idempotency_key text;
  v_html text;
  v_badge_color text := '#6366f1';
  v_badge_text text := 'NOTIFICAÇÃO';
BEGIN
  -- A. Obter e-mail do usuário no auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RETURN NEW;
  END IF;

  -- B. Obter nome do usuário
  SELECT COALESCE(display_name, username, 'Membro') INTO v_username 
  FROM public.members 
  WHERE id = NEW.user_id;

  -- C. Chave de idempotência estrita
  v_idempotency_key := 'email:notif:' || NEW.id::text;

  -- D. Definir assunto, cor e texto conforme o tipo
  v_subject := '[Project Nox] ' || COALESCE(NEW.title, 'Nova notificação');

  IF NEW.type = 'PIPELINE_STAGE_AVAILABLE' THEN
    IF NEW.title LIKE '%voltou%' THEN
      v_badge_color := '#f59e0b';
      v_badge_text := 'FILA';
    ELSIF NEW.title LIKE '%retrabalho%' THEN
      v_badge_color := '#ef4444';
      v_badge_text := 'RETRABALHO';
    ELSIF NEW.title LIKE '%reservad%' THEN
      v_badge_color := '#8b5cf6';
      v_badge_text := 'QC PREVISTO';
    ELSIF NEW.title LIKE '%aprovação%' THEN
      v_badge_color := '#10b981';
      v_badge_text := 'PRÉ APROVADO';
    ELSE
      v_badge_color := '#6366f1';
      v_badge_text := 'PIPELINE';
    END IF;
    v_subject := COALESCE(NEW.title, 'Etapa disponível no Pipeline') || ' — Project Nox';
    v_cta_label := 'Ver na Pipeline';
  ELSIF NEW.type = 'LEVEL_UP' THEN
    v_badge_color := '#eab308';
    v_badge_text := 'LEVEL UP!';
    v_subject := 'Parabéns! ' || COALESCE(NEW.title, 'Você alcançou um novo nível no Project Nox!');
    v_cta_label := 'Ver meu perfil';
  ELSIF NEW.type = 'ACHIEVEMENT' THEN
    v_badge_color := '#f59e0b';
    v_badge_text := 'CONQUISTA';
    v_subject := 'Nova conquista desbloqueada: ' || COALESCE(NEW.title, 'Conquista Nox');
    v_cta_label := 'Ver conquistas';
  ELSIF NEW.type = 'NEW_CHAPTER' OR NEW.type = 'CHAPTER_PUBLISHED' THEN
    v_badge_color := '#10b981';
    v_badge_text := 'NOVO CAPÍTULO';
    v_subject := 'Novo capítulo disponível: ' || COALESCE(NEW.title, 'Novo capítulo');
    v_cta_label := 'Ler agora';
  ELSIF NEW.type = 'MENTION' OR NEW.type = 'ROLE_MENTION' THEN
    v_badge_color := '#818cf8';
    v_badge_text := CASE WHEN NEW.type = 'ROLE_MENTION' THEN 'MENÇÃO DE CARGO' ELSE 'MENÇÃO DIRETA' END;
    v_subject := 'Você foi mencionado no Project Nox';
    v_cta_label := 'Ver mensagem';
  ELSIF NEW.type = 'REPLY_CHAT' OR NEW.type = 'REPLY_COMMENT' THEN
    v_badge_color := '#38bdf8';
    v_badge_text := 'RESPOSTA';
    v_subject := 'Nova resposta para você no Project Nox';
    v_cta_label := 'Ver resposta';
  ELSIF NEW.type IN ('TASK_ASSIGNED', 'STAGE_READY', 'QC_ISSUE', 'REWORK') THEN
    v_badge_color := CASE WHEN NEW.type IN ('QC_ISSUE', 'REWORK') THEN '#ef4444' ELSE '#6366f1' END;
    v_badge_text := 'PRODUÇÃO';
    v_subject := '[Scan] ' || COALESCE(NEW.title, 'Atualização de Produção');
    v_cta_label := 'Abrir no Pipeline';
  ELSIF NEW.type IN ('APPLICATION', 'APPLICATION_UPDATE') THEN
    v_badge_color := '#ec4899';
    v_badge_text := 'RECRUTAMENTO';
    v_subject := '[Recrutamento] ' || COALESCE(NEW.title, 'Candidatura');
    v_cta_label := 'Ver candidatura';
  END IF;

  v_url := 'https://manga.project-nox-awerkori.workers.dev' || COALESCE(NEW.href, '/notificacoes');

  -- E. Gerar HTML do e-mail
  v_html := '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>'
    || '<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#f4f4f5;">'
    || '<table width="100%" cellspacing="0" cellpadding="0" style="background-color:#09090b;padding:32px 16px;"><tr><td align="center">'
    || '<table width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#141417;border:1px solid #27272a;border-radius:12px;overflow:hidden;">'
    || '<tr><td style="padding:24px 32px;background:linear-gradient(180deg,rgba(99,102,241,0.12) 0%,transparent 100%);border-bottom:1px solid #1f1f23;">'
    || '<table width="100%" cellspacing="0" cellpadding="0"><tr>'
    || '<td><span style="font-size:18px;font-weight:800;letter-spacing:0.05em;color:#f4f4f5;text-transform:uppercase;">PROJECT <span style="color:#6366f1;">NOX</span></span></td>'
    || '<td align="right"><span style="display:inline-block;background-color:' || v_badge_color || ';color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;padding:3px 10px;border-radius:9999px;">' || v_badge_text || '</span></td>'
    || '</tr></table></td></tr>'
    || '<tr><td style="padding:32px;">'
    || '<p style="margin:0 0 16px 0;font-size:15px;color:#a1a1aa;">Olá, <strong style="color:#f4f4f5;">' || public.fn_html_escape(v_username) || '</strong></p>'
    || '<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">' || public.fn_html_escape(COALESCE(NEW.title, 'Notificação')) || '</h1>'
    || CASE WHEN NEW.context IS NOT NULL AND length(trim(NEW.context)) > 0 THEN '<div style="margin:0 0 16px 0;display:inline-block;background:#18181b;border:1px solid #27272a;padding:4px 10px;border-radius:6px;font-size:12px;color:#818cf8;font-weight:600;">' || public.fn_html_escape(NEW.context) || '</div>' ELSE '' END
    || '<div style="background-color:#18181b;border-left:3px solid ' || v_badge_color || ';border-radius:4px;padding:16px;margin:16px 0 24px 0;color:#d4d4d8;font-size:14px;line-height:1.6;">'
    || replace(public.fn_html_escape(NEW.body), E'\n', '<br>') || '</div>'
    || '<table cellspacing="0" cellpadding="0" style="margin:28px 0 8px 0;"><tr><td align="center" style="border-radius:8px;background-color:#4f46e5;">'
    || '<a href="' || v_url || '" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#4f46e5;border:1px solid #6366f1;">'
    || v_cta_label || ' &rarr;</a></td></tr></table>'
    || '</td></tr>'
    || '<tr><td style="padding:20px 32px;background-color:#0d0d10;border-top:1px solid #1f1f23;font-size:12px;color:#71717a;text-align:center;">'
    || '<p style="margin:0 0 4px 0;">Você recebeu este e-mail por ser membro do <strong>Project Nox</strong>.</p>'
    || '</td></tr></table></td></tr></table></body></html>';

  -- F. Inserir na outbox (idempotência absoluta por idempotency_key)
  INSERT INTO public.scan_email_outbox (
    notification_id,
    scan_id,
    recipient_user_id,
    recipient_email,
    subject,
    html_body,
    status,
    delivery_status,
    idempotency_key,
    attempts
  ) VALUES (
    NEW.id,
    NEW.scan_id,
    NEW.user_id,
    v_email,
    v_subject,
    v_html,
    'PENDING',
    'QUEUED',
    v_idempotency_key,
    0
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_derive_email ON public.notifications;
CREATE TRIGGER trg_notifications_derive_email
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notification_derive_email();

-- 9. Update create_scan_production_chapter to initialize availability tracking and auto-claim before DAG resolve
CREATE OR REPLACE FUNCTION public.create_scan_production_chapter(
  p_scan_id uuid,
  p_work_id uuid,
  p_chapter_number numeric,
  p_chapter_label text DEFAULT NULL,
  p_chapter_type text DEFAULT 'NUMBER',
  p_template text DEFAULT 'MANHWA',
  p_priority text DEFAULT 'NORMAL',
  p_auto_claim boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role public.scan_member_role;
  v_caller_name text;
  v_chapter_id uuid;
  v_sort_key numeric;
  v_stage RECORD;
  v_raw_cs_id uuid;
  v_has_raw_role boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING errcode = '42501';
  END IF;

  SELECT role INTO v_caller_role
  FROM public.scan_members
  WHERE scan_id = p_scan_id AND user_id = v_caller AND COALESCE(hidden_by_admin, false) = false;

  IF v_caller_role IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado a esta Scan.' USING errcode = '42501';
  END IF;

  IF v_caller_role = 'MEMBER' AND NOT public.is_admin() THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.scan_member_positions smp
      JOIN public.scan_positions sp ON sp.id = smp.position_id
      WHERE smp.scan_id = p_scan_id
        AND smp.user_id = v_caller
        AND (
          lower(sp.name) LIKE '%raw%'
          OR lower(sp.description) LIKE '%raw%'
        )
    ) INTO v_has_raw_role;

    IF NOT v_has_raw_role THEN
      RAISE EXCEPTION 'Você precisa do cargo Raw Provider para cadastrar novos capítulos.' USING errcode = '42501';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.scan_production_chapters
    WHERE scan_id = p_scan_id 
      AND work_id = p_work_id 
      AND chapter_number = p_chapter_number
      AND status != 'CANCELED'
  ) THEN
    RAISE EXCEPTION 'O capítulo #% já está cadastrado nesta obra.', p_chapter_number;
  END IF;

  SELECT display_name INTO v_caller_name
  FROM public.members WHERE id = v_caller;

  v_sort_key := p_chapter_number * 10000;

  INSERT INTO public.scan_production_chapters (
    scan_id,
    work_id,
    chapter_number,
    chapter_label,
    chapter_type,
    chapter_sort_key,
    template,
    priority,
    status,
    created_by
  ) VALUES (
    p_scan_id,
    p_work_id,
    p_chapter_number,
    p_chapter_label,
    COALESCE(p_chapter_type, 'NUMBER'),
    v_sort_key,
    COALESCE(p_template, 'MANHWA'),
    COALESCE(p_priority, 'NORMAL'),
    'IN_PRODUCTION',
    v_caller
  ) RETURNING id INTO v_chapter_id;

  -- Instantiate chapter stages from scan_workflow_stages
  FOR v_stage IN (
    SELECT * FROM public.scan_workflow_stages 
    WHERE scan_id = p_scan_id AND is_active = true 
    ORDER BY display_order ASC
  ) LOOP
    INSERT INTO public.scan_chapter_stages (
      scan_id,
      production_chapter_id,
      stage_id,
      status,
      availability_version,
      availability_reason,
      notified_available
    ) VALUES (
      p_scan_id,
      v_chapter_id,
      v_stage.id,
      CASE 
        WHEN v_stage.dependencies IS NULL OR array_length(v_stage.dependencies, 1) IS NULL OR array_length(v_stage.dependencies, 1) = 0 THEN 'AVAILABLE'
        ELSE 'BLOCKED'
      END,
      1,
      'initial',
      false
    );
  END LOOP;

  -- Record timeline
  INSERT INTO public.scan_chapter_timeline (
    scan_id,
    production_chapter_id,
    event_type,
    user_id,
    user_name,
    details
  ) VALUES (
    p_scan_id,
    v_chapter_id,
    'CREATED',
    v_caller,
    v_caller_name,
    jsonb_build_object(
      'chapter_number', p_chapter_number,
      'chapter_label', p_chapter_label,
      'chapter_type', p_chapter_type,
      'priority', p_priority
    )
  );

  -- If auto claim requested, claim the raw stage for the caller immediately
  IF p_auto_claim THEN
    SELECT scs.id INTO v_raw_cs_id 
    FROM public.scan_chapter_stages scs
    JOIN public.scan_workflow_stages sws ON sws.id = scs.stage_id
    WHERE scs.production_chapter_id = v_chapter_id 
      AND sws.slug = 'raw'
    LIMIT 1;

    IF v_raw_cs_id IS NOT NULL THEN
      PERFORM public.claim_scan_chapter_stage(v_raw_cs_id);
    END IF;
  END IF;

  -- Resolve initial DAG
  PERFORM public.resolve_scan_chapter_dependencies(v_chapter_id);

  RETURN v_chapter_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_scan_production_chapter(uuid, uuid, numeric, text, text, text, text, boolean) TO authenticated;

