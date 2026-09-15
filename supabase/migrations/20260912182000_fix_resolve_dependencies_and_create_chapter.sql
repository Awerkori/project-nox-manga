-- Migration: Fix resolve_scan_chapter_dependencies and create_scan_production_chapter
-- File: supabase/migrations/20260912182000_fix_resolve_dependencies_and_create_chapter.sql

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
  v_caller_role text;
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
            started_at = COALESCE(started_at, now()),
            availability_version = COALESCE(availability_version, 1),
            availability_reason = 'initial',
            notified_available = true,
            last_activity_at = now(), 
            updated_at = now() 
          WHERE id = v_stage_record.chapter_stage_id;

          PERFORM public.dispatch_pipeline_stage_availability_notification(v_stage_record.chapter_stage_id);
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

          PERFORM public.dispatch_pipeline_stage_availability_notification(v_stage_record.chapter_stage_id);
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$;
