-- Migration: 20260912170000_staff_raw_provider_permissions_and_autoclaim.sql
-- Enables Staff + Raw Provider editorial role to create and initiate RAW chapters
-- Enforces backend role gating: Staff without Raw Provider is rejected.

DROP FUNCTION IF EXISTS public.create_scan_production_chapter(uuid, uuid, numeric, text, text, text, text);

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
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_member_role text;
  v_caller_name text;
  v_chapter_id uuid;
  v_sort_key numeric;
  v_stage RECORD;
  v_raw_cs_id uuid;
  v_has_raw_role boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Verify caller is active member of the scan
  SELECT role INTO v_member_role FROM public.scan_members WHERE scan_id = p_scan_id AND user_id = v_caller;
  IF v_member_role IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado a esta Scan.';
  END IF;

  -- Role-gating: Dono and Gerente have leadership bypass. Staff MUST have Raw Provider editorial position.
  IF v_member_role NOT IN ('OWNER', 'ADMIN') AND NOT public.is_admin() THEN
    SELECT EXISTS (
      SELECT 1 FROM public.scan_member_positions smp
      JOIN public.scan_positions sp ON sp.id = smp.position_id
      WHERE smp.scan_id = p_scan_id
        AND smp.user_id = v_caller
        AND (sp.name ILIKE '%raw%' OR sp.id IN (
          SELECT unnest(allowed_position_ids) FROM public.scan_workflow_stages WHERE scan_id = p_scan_id AND slug = 'raw'
        ))
    ) INTO v_has_raw_role;

    IF NOT v_has_raw_role THEN
      RAISE EXCEPTION 'Você precisa do cargo Raw Provider para cadastrar novos capítulos ou iniciar a produção de RAW.';
    END IF;
  END IF;

  -- Fetch caller display name
  SELECT COALESCE(display_name, username) INTO v_caller_name FROM public.members WHERE id = v_caller;

  -- Check duplicate
  IF EXISTS (
    SELECT 1 FROM public.scan_production_chapters 
    WHERE scan_id = p_scan_id 
      AND work_id = p_work_id 
      AND chapter_number = p_chapter_number
  ) THEN
    RAISE EXCEPTION 'Capítulo % já existe em produção para esta obra nesta Scan.', p_chapter_number;
  END IF;

  -- Compute sort key
  v_sort_key := COALESCE(p_chapter_number, 0);

  -- Insert production chapter
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
      status
    ) VALUES (
      p_scan_id,
      v_chapter_id,
      v_stage.id,
      CASE 
        WHEN v_stage.dependencies IS NULL OR array_length(v_stage.dependencies, 1) IS NULL OR array_length(v_stage.dependencies, 1) = 0 THEN 'AVAILABLE'
        ELSE 'BLOCKED'
      END
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

  -- Resolve initial DAG
  PERFORM public.resolve_scan_chapter_dependencies(v_chapter_id);

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

  RETURN v_chapter_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_scan_production_chapter(uuid, uuid, numeric, text, text, text, text, boolean) TO authenticated;
