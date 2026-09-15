-- Fix resolve_scan_chapter_dependencies dependencies array assignment
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
