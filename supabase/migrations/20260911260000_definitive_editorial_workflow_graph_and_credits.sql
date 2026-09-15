-- ==========================================================
-- DEFINITIVE EDITORIAL WORKFLOW GRAPH, NON-LINEAR DAG & CREDITS
-- Project Nox Definitive Scan Pipeline Architecture
-- ==========================================================

-- 1. EXTEND CONSTRAINTS AND COLUMNS ON scan_production_chapters
ALTER TABLE public.scan_production_chapters DROP CONSTRAINT IF EXISTS scan_production_chapters_status_check;
ALTER TABLE public.scan_production_chapters ADD CONSTRAINT scan_production_chapters_status_check 
  CHECK (status IN ('DRAFT', 'IN_PRODUCTION', 'PAUSED', 'CANCELLED', 'READY', 'PUBLISHED', 'UNPUBLISHED'));

ALTER TABLE public.scan_production_chapters ADD COLUMN IF NOT EXISTS chapter_label text;
ALTER TABLE public.scan_production_chapters ADD COLUMN IF NOT EXISTS chapter_type text NOT NULL DEFAULT 'NUMBER' 
  CHECK (chapter_type IN ('NUMBER', 'SPECIAL', 'EXTRA', 'PROLOGUE', 'OTHER'));
ALTER TABLE public.scan_production_chapters ADD COLUMN IF NOT EXISTS chapter_sort_key numeric NOT NULL DEFAULT 0;
ALTER TABLE public.scan_production_chapters ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'NORMAL' 
  CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT'));
ALTER TABLE public.scan_production_chapters ADD COLUMN IF NOT EXISTS due_at timestamptz;
ALTER TABLE public.scan_production_chapters ADD COLUMN IF NOT EXISTS publication_version int NOT NULL DEFAULT 1;
ALTER TABLE public.scan_production_chapters ADD COLUMN IF NOT EXISTS published_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.scan_production_chapters ADD COLUMN IF NOT EXISTS pause_reason text;
ALTER TABLE public.scan_production_chapters ADD COLUMN IF NOT EXISTS cancel_reason text;

-- Initialize chapter_sort_key for existing chapters
UPDATE public.scan_production_chapters 
SET chapter_sort_key = chapter_number 
WHERE chapter_sort_key = 0 AND chapter_number IS NOT NULL;

-- 2. EXTEND WORKFLOW STAGES WITH DAG CONTROLS
ALTER TABLE public.scan_workflow_stages ADD COLUMN IF NOT EXISTS requires_output boolean NOT NULL DEFAULT true;
ALTER TABLE public.scan_workflow_stages ADD COLUMN IF NOT EXISTS output_type text NOT NULL DEFAULT 'FILE' 
  CHECK (output_type IN ('FILE', 'TEXT', 'NONE'));
ALTER TABLE public.scan_workflow_stages ADD COLUMN IF NOT EXISTS dependency_operator text NOT NULL DEFAULT 'AND' 
  CHECK (dependency_operator IN ('AND', 'OR'));

-- 3. EXTEND CHAPTER STAGES
ALTER TABLE public.scan_chapter_stages ALTER COLUMN chapter_id DROP NOT NULL;
ALTER TABLE public.scan_chapter_stages ADD COLUMN IF NOT EXISTS production_chapter_id uuid REFERENCES public.scan_production_chapters(id) ON DELETE CASCADE;

ALTER TABLE public.scan_chapter_stages DROP CONSTRAINT IF EXISTS scan_chapter_stages_status_check;
ALTER TABLE public.scan_chapter_stages ADD CONSTRAINT scan_chapter_stages_status_check 
  CHECK (status IN ('BLOCKED', 'AVAILABLE', 'IN_PROGRESS', 'DONE', 'SKIPPED', 'REWORK', 'PAUSED', 'CANCELLED'));

ALTER TABLE public.scan_chapter_stages ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE public.scan_chapter_stages ADD COLUMN IF NOT EXISTS last_activity_at timestamptz DEFAULT now();
ALTER TABLE public.scan_chapter_stages ADD COLUMN IF NOT EXISTS previous_assigned_to uuid REFERENCES public.members(id) ON DELETE SET NULL;
ALTER TABLE public.scan_chapter_stages ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.scan_chapter_stages ADD COLUMN IF NOT EXISTS return_to_stage_id uuid REFERENCES public.scan_chapter_stages(id) ON DELETE SET NULL;
ALTER TABLE public.scan_chapter_stages ADD COLUMN IF NOT EXISTS is_override boolean NOT NULL DEFAULT false;
ALTER TABLE public.scan_chapter_stages ADD COLUMN IF NOT EXISTS override_reason text;
ALTER TABLE public.scan_chapter_stages ADD COLUMN IF NOT EXISTS override_by uuid REFERENCES public.members(id) ON DELETE SET NULL;
ALTER TABLE public.scan_chapter_stages ADD COLUMN IF NOT EXISTS override_action text;
ALTER TABLE public.scan_chapter_stages ADD COLUMN IF NOT EXISTS skip_reason text;
ALTER TABLE public.scan_chapter_stages ADD COLUMN IF NOT EXISTS skipped_by uuid REFERENCES public.members(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_chapter_stages_prod_stage 
  ON public.scan_chapter_stages(production_chapter_id, stage_id) 
  WHERE production_chapter_id IS NOT NULL;

-- 4. EXTEND PRODUCTION FILES
ALTER TABLE public.scan_production_files ADD COLUMN IF NOT EXISTS stage_slug text;
CREATE INDEX IF NOT EXISTS idx_scan_prod_files_active 
  ON public.scan_production_files(production_chapter_id, stage_id, is_current);

-- 5. WORK WORKFLOW OVERRIDES TABLE
CREATE TABLE IF NOT EXISTS public.scan_work_workflow_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  template text NOT NULL DEFAULT 'MANHWA',
  custom_stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scan_id, work_id)
);
CREATE INDEX IF NOT EXISTS idx_scan_work_workflow_overrides_lookup 
  ON public.scan_work_workflow_overrides(scan_id, work_id);

ALTER TABLE public.scan_work_workflow_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scan_work_workflow_overrides_select ON public.scan_work_workflow_overrides;
CREATE POLICY scan_work_workflow_overrides_select ON public.scan_work_workflow_overrides FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_work_workflow_overrides.scan_id AND user_id = auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS scan_work_workflow_overrides_all ON public.scan_work_workflow_overrides;
CREATE POLICY scan_work_workflow_overrides_all ON public.scan_work_workflow_overrides FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_work_workflow_overrides.scan_id AND user_id = auth.uid() AND role IN ('OWNER', 'ADMIN')) OR public.is_admin());

-- 6. CHAPTER TIMELINE & AUDIT TRAIL TABLE
CREATE TABLE IF NOT EXISTS public.scan_chapter_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  production_chapter_id uuid NOT NULL REFERENCES public.scan_production_chapters(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.scan_workflow_stages(id) ON DELETE SET NULL,
  stage_slug text,
  event_type text NOT NULL, -- CREATED, CLAIMED, RELEASED, FILE_UPLOADED, COMPLETED, RETURNED_REWORK, ADMIN_OVERRIDE, SKIPPED, PAUSED, RESUMED, PUBLISHED, UNPUBLISHED
  user_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  user_name text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_chapter_timeline_lookup 
  ON public.scan_chapter_timeline(production_chapter_id, created_at DESC);

ALTER TABLE public.scan_chapter_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scan_chapter_timeline_select ON public.scan_chapter_timeline;
CREATE POLICY scan_chapter_timeline_select ON public.scan_chapter_timeline FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_chapter_timeline.scan_id AND user_id = auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS scan_chapter_timeline_all ON public.scan_chapter_timeline;
CREATE POLICY scan_chapter_timeline_all ON public.scan_chapter_timeline FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_chapter_timeline.scan_id AND user_id = auth.uid()) OR public.is_admin());

-- 7. IMMUTABLE EDITORIAL CREDIT SNAPSHOTS TABLE
CREATE TABLE IF NOT EXISTS public.chapter_credit_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE,
  production_chapter_id uuid REFERENCES public.scan_production_chapters(id) ON DELETE SET NULL,
  publication_version int NOT NULL DEFAULT 1,
  scan_id uuid REFERENCES public.scans(id) ON DELETE SET NULL,
  scan_name_snapshot text NOT NULL,
  scan_slug_snapshot text NOT NULL,
  stage_name text NOT NULL,
  stage_slug text NOT NULL,
  position_name text,
  user_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  display_name_snapshot text NOT NULL,
  avatar_id_snapshot text,
  role_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chapter_credit_snapshots_lookup 
  ON public.chapter_credit_snapshots(chapter_id, publication_version);

ALTER TABLE public.chapter_credit_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chapter_credit_snapshots_select ON public.chapter_credit_snapshots;
CREATE POLICY chapter_credit_snapshots_select ON public.chapter_credit_snapshots FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS chapter_credit_snapshots_all ON public.chapter_credit_snapshots;
CREATE POLICY chapter_credit_snapshots_all ON public.chapter_credit_snapshots FOR ALL TO authenticated
  USING (
    scan_id IS NULL OR 
    EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = chapter_credit_snapshots.scan_id AND user_id = auth.uid() AND role IN ('OWNER', 'ADMIN')) OR 
    public.is_admin()
  );

-- ==========================================================
-- 8. CORE RPC FUNCTIONS: DAG RESOLVER & EDITORIAL STATE ENGINE
-- ==========================================================

-- DAG Dependency Resolver for a Production Chapter
CREATE OR REPLACE FUNCTION public.resolve_scan_chapter_dependencies(p_production_chapter_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_chapter public.scan_production_chapters;
  v_stage_row RECORD;
  v_dep_slug text;
  v_dep_stage RECORD;
  v_dep_satisfied boolean;
  v_all_satisfied boolean;
  v_has_file boolean;
  v_active_stage_found boolean := false;
  v_all_stages_done boolean := true;
BEGIN
  SELECT * INTO v_chapter 
  FROM public.scan_production_chapters 
  WHERE id = p_production_chapter_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Iterate through all chapter stages ordered by display_order
  FOR v_stage_row IN (
    SELECT 
      cs.id AS chapter_stage_id,
      cs.status AS stage_status,
      cs.stage_id,
      ws.slug,
      ws.name,
      ws.display_order,
      ws.dependencies,
      ws.dependency_operator,
      ws.requires_output
    FROM public.scan_chapter_stages cs
    JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
    WHERE cs.production_chapter_id = p_production_chapter_id
    ORDER BY ws.display_order ASC
  ) LOOP

    -- If stage is already DONE or SKIPPED, it contributes to dependency satisfaction
    IF v_stage_row.stage_status IN ('DONE', 'SKIPPED') THEN
      CONTINUE;
    END IF;

    v_all_stages_done := false;

    -- If stage is currently IN_PROGRESS or REWORK or PAUSED, keep status
    IF v_stage_row.stage_status IN ('IN_PROGRESS', 'REWORK', 'PAUSED') THEN
      IF NOT v_active_stage_found THEN
        UPDATE public.scan_production_chapters 
        SET current_stage_slug = v_stage_row.slug, updated_at = now()
        WHERE id = p_production_chapter_id;
        v_active_stage_found := true;
      END IF;
      CONTINUE;
    END IF;

    -- For BLOCKED or AVAILABLE, evaluate dependencies
    IF v_stage_row.dependencies IS NULL OR array_length(v_stage_row.dependencies, 1) IS NULL OR array_length(v_stage_row.dependencies, 1) = 0 THEN
      -- Entry point stage (e.g. RAW) has no dependencies -> always AVAILABLE
      IF v_stage_row.stage_status != 'AVAILABLE' THEN
        UPDATE public.scan_chapter_stages 
        SET status = 'AVAILABLE', updated_at = now()
        WHERE id = v_stage_row.chapter_stage_id;
      END IF;

      IF NOT v_active_stage_found THEN
        UPDATE public.scan_production_chapters 
        SET current_stage_slug = v_stage_row.slug, updated_at = now()
        WHERE id = p_production_chapter_id;
        v_active_stage_found := true;
      END IF;
    ELSE
      -- Evaluate dependencies with AND/OR operator
      IF COALESCE(v_stage_row.dependency_operator, 'AND') = 'OR' THEN
        v_all_satisfied := false;
      ELSE
        v_all_satisfied := true;
      END IF;

      FOREACH v_dep_slug IN ARRAY v_stage_row.dependencies LOOP
        -- Check status of the dependent stage for this chapter
        SELECT 
          dcs.status,
          dws.requires_output,
          dcs.stage_id
        INTO v_dep_stage
        FROM public.scan_chapter_stages dcs
        JOIN public.scan_workflow_stages dws ON dws.id = dcs.stage_id
        WHERE dcs.production_chapter_id = p_production_chapter_id
          AND dws.slug = v_dep_slug;

        v_dep_satisfied := false;
        IF FOUND THEN
          IF v_dep_stage.status = 'SKIPPED' THEN
            v_dep_satisfied := true;
          ELSIF v_dep_stage.status = 'DONE' THEN
            -- Check if required output exists
            IF COALESCE(v_dep_stage.requires_output, true) THEN
              SELECT EXISTS(
                SELECT 1 FROM public.scan_production_files 
                WHERE production_chapter_id = p_production_chapter_id 
                  AND stage_id = v_dep_stage.stage_id 
                  AND is_current = true
              ) INTO v_has_file;
              v_dep_satisfied := v_has_file;
            ELSE
              v_dep_satisfied := true;
            END IF;
          END IF;
        END IF;

        IF COALESCE(v_stage_row.dependency_operator, 'AND') = 'OR' THEN
          IF v_dep_satisfied THEN
            v_all_satisfied := true;
          END IF;
        ELSE
          IF NOT v_dep_satisfied THEN
            v_all_satisfied := false;
          END IF;
        END IF;
      END LOOP;

      IF v_all_satisfied THEN
        IF v_stage_row.stage_status != 'AVAILABLE' THEN
          UPDATE public.scan_chapter_stages 
          SET status = 'AVAILABLE', updated_at = now()
          WHERE id = v_stage_row.chapter_stage_id;
        END IF;
        IF NOT v_active_stage_found THEN
          UPDATE public.scan_production_chapters 
          SET current_stage_slug = v_stage_row.slug, updated_at = now()
          WHERE id = p_production_chapter_id;
          v_active_stage_found := true;
        END IF;
      ELSE
        IF v_stage_row.stage_status != 'BLOCKED' THEN
          UPDATE public.scan_chapter_stages 
          SET status = 'BLOCKED', updated_at = now()
          WHERE id = v_stage_row.chapter_stage_id;
        END IF;
      END IF;
    END IF;

  END LOOP;

  -- If all stages are done and chapter is IN_PRODUCTION, transition chapter to READY
  IF v_all_stages_done AND v_chapter.status = 'IN_PRODUCTION' THEN
    UPDATE public.scan_production_chapters 
    SET status = 'READY', current_stage_slug = 'ready', updated_at = now()
    WHERE id = p_production_chapter_id;
  END IF;
END;
$$;

-- Create Single Production Chapter
CREATE OR REPLACE FUNCTION public.create_scan_production_chapter(
  p_scan_id uuid,
  p_work_id uuid,
  p_chapter_number numeric,
  p_chapter_label text DEFAULT NULL,
  p_chapter_type text DEFAULT 'NUMBER',
  p_template text DEFAULT 'MANHWA',
  p_priority text DEFAULT 'NORMAL'
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
BEGIN
  -- Check permission
  SELECT role INTO v_member_role FROM public.scan_members WHERE scan_id = p_scan_id AND user_id = v_caller;
  IF v_member_role IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado a esta Scan.';
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

  RETURN v_chapter_id;
END;
$$;

-- Bulk Create Production Chapters
CREATE OR REPLACE FUNCTION public.bulk_create_scan_production_chapters(
  p_scan_id uuid,
  p_work_id uuid,
  p_from_number numeric,
  p_to_number numeric,
  p_template text DEFAULT 'MANHWA',
  p_priority text DEFAULT 'NORMAL'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_num numeric;
  v_created_count int := 0;
  v_skipped_count int := 0;
  v_cur_id uuid;
BEGIN
  IF p_to_number < p_from_number THEN
    RAISE EXCEPTION 'O número final não pode ser menor que o inicial.';
  END IF;

  IF (p_to_number - p_from_number) > 200 THEN
    RAISE EXCEPTION 'Limite máximo de 200 capítulos por criação em lote.';
  END IF;

  FOR v_num IN SELECT generate_series(p_from_number::int, p_to_number::int) LOOP
    IF EXISTS (
      SELECT 1 FROM public.scan_production_chapters 
      WHERE scan_id = p_scan_id AND work_id = p_work_id AND chapter_number = v_num
    ) THEN
      v_skipped_count := v_skipped_count + 1;
    ELSE
      v_cur_id := public.create_scan_production_chapter(
        p_scan_id,
        p_work_id,
        v_num,
        NULL,
        'NUMBER',
        p_template,
        p_priority
      );
      v_created_count := v_created_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'created', v_created_count,
    'skipped', v_skipped_count
  );
END;
$$;

-- Claim Chapter Stage
CREATE OR REPLACE FUNCTION public.claim_scan_chapter_stage(
  p_chapter_stage_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_stage_row public.scan_chapter_stages;
  v_wf_stage public.scan_workflow_stages;
  v_chapter public.scan_production_chapters;
  v_member_role text;
  v_caller_name text;
  v_user_position_ids uuid[];
  v_has_position boolean := false;
BEGIN
  SELECT * INTO v_stage_row 
  FROM public.scan_chapter_stages 
  WHERE id = p_chapter_stage_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada.';
  END IF;

  -- Verify scan membership
  SELECT role INTO v_member_role 
  FROM public.scan_members 
  WHERE scan_id = v_stage_row.scan_id AND user_id = v_caller;

  IF v_member_role IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado a esta Scan.';
  END IF;

  SELECT COALESCE(display_name, username) INTO v_caller_name FROM public.members WHERE id = v_caller;

  -- Verify availability
  IF v_stage_row.status NOT IN ('AVAILABLE', 'REWORK') THEN
    IF v_stage_row.assigned_to IS NOT NULL AND v_stage_row.assigned_to != v_caller THEN
      RAISE EXCEPTION 'Esta etapa já foi assumida por outro membro da equipe.';
    ELSIF v_stage_row.status = 'BLOCKED' THEN
      RAISE EXCEPTION 'Esta etapa está bloqueada por pré-requisitos pendentes.';
    ELSIF v_stage_row.status = 'DONE' THEN
      RAISE EXCEPTION 'Esta etapa já está concluída.';
    END IF;
  END IF;

  SELECT * INTO v_wf_stage FROM public.scan_workflow_stages WHERE id = v_stage_row.stage_id;
  SELECT * INTO v_chapter FROM public.scan_production_chapters WHERE id = v_stage_row.production_chapter_id;

  -- Role-gating check: OWNER, ADMIN or Global Admin can claim anything.
  -- Normal members must possess at least one allowed position if configured.
  IF v_member_role NOT IN ('OWNER', 'ADMIN') AND NOT public.is_admin() AND v_wf_stage.allowed_position_ids IS NOT NULL AND array_length(v_wf_stage.allowed_position_ids, 1) > 0 THEN
    SELECT array_agg(position_id) INTO v_user_position_ids
    FROM public.scan_member_positions
    WHERE scan_id = v_stage_row.scan_id AND user_id = v_caller;

    IF v_user_position_ids IS NOT NULL THEN
      SELECT (v_user_position_ids && v_wf_stage.allowed_position_ids) INTO v_has_position;
    END IF;

    IF NOT v_has_position THEN
      RAISE EXCEPTION 'Você não possui o cargo necessário para assumir a etapa "%".', v_wf_stage.name;
    END IF;
  END IF;

  -- Assign and update
  UPDATE public.scan_chapter_stages 
  SET 
    status = 'IN_PROGRESS',
    assigned_to = v_caller,
    claimed_at = now(),
    last_activity_at = now(),
    updated_at = now()
  WHERE id = p_chapter_stage_id;

  -- Update chapter current stage
  UPDATE public.scan_production_chapters 
  SET current_stage_slug = v_wf_stage.slug, updated_at = now()
  WHERE id = v_stage_row.production_chapter_id;

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
    v_stage_row.scan_id,
    v_stage_row.production_chapter_id,
    v_stage_row.stage_id,
    v_wf_stage.slug,
    'CLAIMED',
    v_caller,
    v_caller_name,
    jsonb_build_object('stage_name', v_wf_stage.name)
  );

  RETURN jsonb_build_object(
    'success', true,
    'stage_id', p_chapter_stage_id,
    'status', 'IN_PROGRESS'
  );
END;
$$;

-- Release Chapter Stage (back to AVAILABLE)
CREATE OR REPLACE FUNCTION public.release_scan_chapter_stage(
  p_chapter_stage_id uuid,
  p_reason text DEFAULT NULL
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
BEGIN
  SELECT * INTO v_stage_row 
  FROM public.scan_chapter_stages 
  WHERE id = p_chapter_stage_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada.';
  END IF;

  SELECT role INTO v_member_role 
  FROM public.scan_members 
  WHERE scan_id = v_stage_row.scan_id AND user_id = v_caller;

  IF v_member_role IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  SELECT COALESCE(display_name, username) INTO v_caller_name FROM public.members WHERE id = v_caller;

  IF v_stage_row.assigned_to != v_caller AND v_member_role NOT IN ('OWNER', 'ADMIN') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Você só pode liberar tarefas atribuídas a você.';
  END IF;

  SELECT * INTO v_wf_stage FROM public.scan_workflow_stages WHERE id = v_stage_row.stage_id;

  UPDATE public.scan_chapter_stages 
  SET 
    status = 'AVAILABLE',
    previous_assigned_to = assigned_to,
    assigned_to = NULL,
    claimed_at = NULL,
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
    'RELEASED',
    v_caller,
    v_caller_name,
    jsonb_build_object('reason', p_reason)
  );

  PERFORM public.resolve_scan_chapter_dependencies(v_stage_row.production_chapter_id);

  RETURN jsonb_build_object('success', true, 'status', 'AVAILABLE');
END;
$$;

-- Complete Chapter Stage
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
  v_has_file boolean := false;
  v_return_target_stage_id uuid;
BEGIN
  SELECT * INTO v_stage_row 
  FROM public.scan_chapter_stages 
  WHERE id = p_chapter_stage_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada.';
  END IF;

  SELECT role INTO v_member_role 
  FROM public.scan_members 
  WHERE scan_id = v_stage_row.scan_id AND user_id = v_caller;

  IF v_member_role IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  IF v_stage_row.assigned_to != v_caller AND v_member_role NOT IN ('OWNER', 'ADMIN') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas o responsável ou administradores podem concluir esta etapa.';
  END IF;

  SELECT * INTO v_wf_stage FROM public.scan_workflow_stages WHERE id = v_stage_row.stage_id;
  SELECT COALESCE(display_name, username) INTO v_caller_name FROM public.members WHERE id = v_caller;

  -- Enforce deliverable requirement
  IF COALESCE(v_wf_stage.requires_output, true) THEN
    SELECT EXISTS(
      SELECT 1 FROM public.scan_production_files 
      WHERE production_chapter_id = v_stage_row.production_chapter_id 
        AND stage_id = v_stage_row.stage_id 
        AND is_current = true
    ) INTO v_has_file;

    IF NOT v_has_file THEN
      RAISE EXCEPTION 'Esta etapa exige o envio de pelo menos um arquivo comprobatório antes de ser concluída.';
    END IF;
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
    jsonb_build_object('notes', p_notes)
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

-- Return Chapter Stage for REWORK (from QC or Revisão)
CREATE OR REPLACE FUNCTION public.return_scan_chapter_stage(
  p_source_stage_id uuid,
  p_target_stage_slug text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_source_stage public.scan_chapter_stages;
  v_target_stage public.scan_chapter_stages;
  v_target_wf public.scan_workflow_stages;
  v_member_role text;
  v_caller_name text;
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
    AND ws.slug = p_target_stage_slug
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa de destino "%" não encontrada.', p_target_stage_slug;
  END IF;

  SELECT * INTO v_target_wf FROM public.scan_workflow_stages WHERE id = v_target_stage.stage_id;

  -- Set target stage to REWORK
  UPDATE public.scan_chapter_stages 
  SET 
    status = 'REWORK',
    rejection_reason = p_reason,
    return_to_stage_id = v_source_stage.id,
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
    'RETURNED_REWORK',
    v_caller,
    v_caller_name,
    jsonb_build_object(
      'target_stage', v_target_wf.name,
      'reason', p_reason,
      'returned_by_stage', p_source_stage_id
    )
  );

  -- Resolve dependencies (downstream stages will be blocked until rework completes)
  PERFORM public.resolve_scan_chapter_dependencies(v_source_stage.production_chapter_id);

  RETURN jsonb_build_object('success', true, 'status', 'REWORK', 'target', v_target_wf.name);
END;
$$;

-- Administrative Override on Stage
CREATE OR REPLACE FUNCTION public.admin_override_scan_stage(
  p_chapter_stage_id uuid,
  p_action text, -- 'FORCE_COMPLETE', 'FORCE_SKIP', 'REOPEN', 'RECLAIM', 'TRANSFER'
  p_reason text,
  p_target_user_id uuid DEFAULT NULL
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
BEGIN
  IF length(trim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'A justificativa do override administrativo é obrigatória (mínimo 3 caracteres).';
  END IF;

  SELECT * INTO v_stage_row 
  FROM public.scan_chapter_stages 
  WHERE id = p_chapter_stage_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada.';
  END IF;

  SELECT role INTO v_member_role 
  FROM public.scan_members 
  WHERE scan_id = v_stage_row.scan_id AND user_id = v_caller;

  IF (v_member_role NOT IN ('OWNER', 'ADMIN') OR v_member_role IS NULL) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas proprietários e administradores da scan podem executar overrides.';
  END IF;

  SELECT * INTO v_wf_stage FROM public.scan_workflow_stages WHERE id = v_stage_row.stage_id;
  SELECT COALESCE(display_name, username) INTO v_caller_name FROM public.members WHERE id = v_caller;

  IF p_action = 'FORCE_COMPLETE' THEN
    UPDATE public.scan_chapter_stages 
    SET 
      status = 'DONE',
      completed_at = now(),
      completed_by = v_caller,
      is_override = true,
      override_action = 'FORCE_COMPLETE',
      override_reason = p_reason,
      override_by = v_caller,
      last_activity_at = now(),
      updated_at = now()
    WHERE id = p_chapter_stage_id;

  ELSIF p_action = 'FORCE_SKIP' THEN
    UPDATE public.scan_chapter_stages 
    SET 
      status = 'SKIPPED',
      skip_reason = p_reason,
      skipped_by = v_caller,
      is_override = true,
      override_action = 'FORCE_SKIP',
      override_reason = p_reason,
      override_by = v_caller,
      last_activity_at = now(),
      updated_at = now()
    WHERE id = p_chapter_stage_id;

  ELSIF p_action = 'REOPEN' THEN
    UPDATE public.scan_chapter_stages 
    SET 
      status = 'AVAILABLE',
      assigned_to = NULL,
      claimed_at = NULL,
      completed_at = NULL,
      completed_by = NULL,
      is_override = true,
      override_action = 'REOPEN',
      override_reason = p_reason,
      override_by = v_caller,
      last_activity_at = now(),
      updated_at = now()
    WHERE id = p_chapter_stage_id;

  ELSIF p_action = 'RECLAIM' THEN
    UPDATE public.scan_chapter_stages 
    SET 
      status = 'AVAILABLE',
      previous_assigned_to = assigned_to,
      assigned_to = NULL,
      claimed_at = NULL,
      is_override = true,
      override_action = 'RECLAIM',
      override_reason = p_reason,
      override_by = v_caller,
      last_activity_at = now(),
      updated_at = now()
    WHERE id = p_chapter_stage_id;

  ELSIF p_action = 'TRANSFER' THEN
    IF p_target_user_id IS NULL THEN
      RAISE EXCEPTION 'Membro de destino é obrigatório para transferência.';
    END IF;
    UPDATE public.scan_chapter_stages 
    SET 
      status = 'IN_PROGRESS',
      previous_assigned_to = assigned_to,
      assigned_to = p_target_user_id,
      claimed_at = now(),
      is_override = true,
      override_action = 'TRANSFER',
      override_reason = p_reason,
      override_by = v_caller,
      last_activity_at = now(),
      updated_at = now()
    WHERE id = p_chapter_stage_id;
  ELSE
    RAISE EXCEPTION 'Ação de override desconhecida: %', p_action;
  END IF;

  -- Timeline
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
    'ADMIN_OVERRIDE',
    v_caller,
    v_caller_name,
    jsonb_build_object(
      'action', p_action,
      'reason', p_reason,
      'target_user_id', p_target_user_id
    )
  );

  PERFORM public.resolve_scan_chapter_dependencies(v_stage_row.production_chapter_id);

  RETURN jsonb_build_object('success', true, 'action', p_action);
END;
$$;

-- Publish Chapter & Freeze Immutable Credit Snapshots
CREATE OR REPLACE FUNCTION public.publish_scan_production_chapter(
  p_production_chapter_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_chapter public.scan_production_chapters;
  v_scan public.scans;
  v_member_role text;
  v_caller_name text;
  v_pub_chapter_id uuid;
  v_stage RECORD;
  v_user_snapshot RECORD;
  v_snapshot_version int;
BEGIN
  SELECT * INTO v_chapter 
  FROM public.scan_production_chapters 
  WHERE id = p_production_chapter_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Capítulo em produção não encontrado.';
  END IF;

  SELECT * INTO v_scan FROM public.scans WHERE id = v_chapter.scan_id;
  SELECT role INTO v_member_role FROM public.scan_members WHERE scan_id = v_chapter.scan_id AND user_id = v_caller;

  IF (v_member_role NOT IN ('OWNER', 'ADMIN', 'UPLOADER') OR v_member_role IS NULL) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores ou uploaders da Scan podem publicar.';
  END IF;

  SELECT COALESCE(display_name, username) INTO v_caller_name FROM public.members WHERE id = v_caller;

  -- Check or create public chapter
  IF v_chapter.target_chapter_id IS NOT NULL THEN
    v_pub_chapter_id := v_chapter.target_chapter_id;
  ELSE
    SELECT id INTO v_pub_chapter_id 
    FROM public.chapters 
    WHERE work_id = v_chapter.work_id AND chapter_number = v_chapter.chapter_number;

    IF NOT FOUND THEN
      INSERT INTO public.chapters (
        work_id,
        chapter_number,
        title
      ) VALUES (
        v_chapter.work_id,
        v_chapter.chapter_number,
        v_chapter.chapter_title
      ) RETURNING id INTO v_pub_chapter_id;
    END IF;

    UPDATE public.scan_production_chapters 
    SET target_chapter_id = v_pub_chapter_id 
    WHERE id = p_production_chapter_id;
  END IF;

  v_snapshot_version := COALESCE(v_chapter.publication_version, 1);

  -- Freeze Credit Snapshots from completed/assigned stages
  FOR v_stage IN (
    SELECT 
      cs.*,
      ws.name AS stage_name,
      ws.slug AS stage_slug,
      ws.display_order
    FROM public.scan_chapter_stages cs
    JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
    WHERE cs.production_chapter_id = p_production_chapter_id
      AND (cs.completed_by IS NOT NULL OR cs.assigned_to IS NOT NULL)
    ORDER BY ws.display_order ASC
  ) LOOP
    SELECT 
      m.id,
      COALESCE(m.display_name, m.username, 'Membro Staff') AS display_name,
      m.avatar_id
    INTO v_user_snapshot
    FROM public.members m 
    WHERE m.id = COALESCE(v_stage.completed_by, v_stage.assigned_to);

    IF FOUND THEN
      INSERT INTO public.chapter_credit_snapshots (
        chapter_id,
        production_chapter_id,
        publication_version,
        scan_id,
        scan_name_snapshot,
        scan_slug_snapshot,
        stage_name,
        stage_slug,
        user_id,
        display_name_snapshot,
        avatar_id_snapshot,
        role_order
      ) VALUES (
        v_pub_chapter_id,
        p_production_chapter_id,
        v_snapshot_version,
        v_scan.id,
        v_scan.name,
        v_scan.slug,
        v_stage.stage_name,
        v_stage.stage_slug,
        v_user_snapshot.id,
        v_user_snapshot.display_name,
        v_user_snapshot.avatar_id,
        v_stage.display_order
      );
    END IF;
  END LOOP;

  -- Mark chapter PUBLISHED
  UPDATE public.scan_production_chapters 
  SET 
    status = 'PUBLISHED',
    publication_version = v_snapshot_version + 1,
    published_snapshot = jsonb_build_object(
      'published_at', now(),
      'published_by', v_caller,
      'publisher_name', v_caller_name,
      'chapter_id', v_pub_chapter_id,
      'version', v_snapshot_version
    ),
    updated_at = now()
  WHERE id = p_production_chapter_id;

  -- Timeline
  INSERT INTO public.scan_chapter_timeline (
    scan_id,
    production_chapter_id,
    event_type,
    user_id,
    user_name,
    details
  ) VALUES (
    v_scan.id,
    p_production_chapter_id,
    'PUBLISHED',
    v_caller,
    v_caller_name,
    jsonb_build_object(
      'target_chapter_id', v_pub_chapter_id,
      'publication_version', v_snapshot_version
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'chapter_id', v_pub_chapter_id,
    'publication_version', v_snapshot_version
  );
END;
$$;

-- Unpublish Chapter
CREATE OR REPLACE FUNCTION public.unpublish_scan_production_chapter(
  p_production_chapter_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_chapter public.scan_production_chapters;
  v_member_role text;
  v_caller_name text;
BEGIN
  SELECT * INTO v_chapter 
  FROM public.scan_production_chapters 
  WHERE id = p_production_chapter_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Capítulo em produção não encontrado.';
  END IF;

  SELECT role INTO v_member_role FROM public.scan_members WHERE scan_id = v_chapter.scan_id AND user_id = v_caller;

  IF (v_member_role NOT IN ('OWNER', 'ADMIN') OR v_member_role IS NULL) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas proprietários e administradores podem despublicar capítulos.';
  END IF;

  SELECT COALESCE(display_name, username) INTO v_caller_name FROM public.members WHERE id = v_caller;

  UPDATE public.scan_production_chapters 
  SET 
    status = 'UNPUBLISHED',
    updated_at = now()
  WHERE id = p_production_chapter_id;

  INSERT INTO public.scan_chapter_timeline (
    scan_id,
    production_chapter_id,
    event_type,
    user_id,
    user_name,
    details
  ) VALUES (
    v_chapter.scan_id,
    p_production_chapter_id,
    'UNPUBLISHED',
    v_caller,
    v_caller_name,
    jsonb_build_object('reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'status', 'UNPUBLISHED');
END;
$$;

-- GRANTS FOR RPC FUNCTIONS
GRANT EXECUTE ON FUNCTION public.resolve_scan_chapter_dependencies(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_scan_production_chapter(uuid, uuid, numeric, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_create_scan_production_chapters(uuid, uuid, numeric, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_scan_chapter_stage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_scan_chapter_stage(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_scan_chapter_stage(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_scan_chapter_stage(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_override_scan_stage(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_scan_production_chapter(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_scan_production_chapter(uuid, text) TO authenticated;
