-- ==============================================================================
-- PROJECT NOX — RODADA 23 MIGRATION
-- CALENDÁRIO EDITORIAL, SISTEMA DE PRAZOS, PRORROGAÇÕES AUTOMÁTICAS E AVISOS
-- ETAPAS OBRIGATÓRIAS: Tradução, Clean/Redraw, Typeset, Revisor (QC)
-- ==============================================================================

-- 1. Ensure columns exist on public.scan_chapter_stages
ALTER TABLE public.scan_chapter_stages
  ADD COLUMN IF NOT EXISTS original_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS extension_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extended_at timestamptz,
  ADD COLUMN IF NOT EXISTS due_warning_sent_at timestamptz;

-- 2. Ensure columns exist on public.scan_tasks
ALTER TABLE public.scan_tasks
  ADD COLUMN IF NOT EXISTS original_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS extension_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extended_at timestamptz,
  ADD COLUMN IF NOT EXISTS due_warning_sent_at timestamptz;

-- 3. Enhanced claim_scan_chapter_stage_ysql
CREATE OR REPLACE FUNCTION public.claim_scan_chapter_stage_ysql(
  p_chapter_stage_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean DEFAULT false,
  p_due_at timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_stage public.scan_chapter_stages;
  v_workflow_stage public.scan_workflow_stages;
  v_member_role text;
  v_actor_name text := 'Membro';
  v_has_required_position boolean := false;
  v_admin_intervention boolean := false;
  v_rows_updated integer;
  v_sp_today date;
  v_chosen_sp_date date;
  v_normalized_due_at timestamptz := NULL;
  v_is_deadline_required boolean := false;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  SELECT * INTO v_stage FROM public.scan_chapter_stages WHERE id = p_chapter_stage_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHAPTER_STAGE_NOT_FOUND'; END IF;
  IF v_stage.status = 'IN_PROGRESS' AND v_stage.assigned_to = p_actor_id THEN
    RETURN jsonb_build_object('success', true, 'status', 'IN_PROGRESS', 'idempotent', true);
  END IF;

  SELECT role INTO v_member_role
  FROM public.scan_members
  WHERE scan_id = v_stage.scan_id AND user_id = p_actor_id;
  IF v_member_role IS NULL AND NOT p_is_global_admin THEN RAISE EXCEPTION 'SCAN_MEMBERSHIP_REQUIRED'; END IF;

  SELECT * INTO v_workflow_stage
  FROM public.scan_workflow_stages
  WHERE id = v_stage.stage_id AND scan_id = v_stage.scan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'WORKFLOW_STAGE_NOT_FOUND'; END IF;
  IF v_workflow_stage.slug = 'publicado' THEN RAISE EXCEPTION 'FINAL_STAGE_NOT_CLAIMABLE'; END IF;

  IF v_workflow_stage.slug = 'pre_aprovado' THEN
    IF v_member_role NOT IN ('OWNER', 'ADMIN') AND NOT p_is_global_admin THEN
      RAISE EXCEPTION 'LEADERSHIP_CLAIM_REQUIRED';
    END IF;
    v_admin_intervention := true;
  ELSIF v_workflow_stage.allowed_position_ids IS NOT NULL
      AND array_length(v_workflow_stage.allowed_position_ids, 1) > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.scan_member_positions
      WHERE scan_id = v_stage.scan_id AND user_id = p_actor_id
        AND position_id = ANY(v_workflow_stage.allowed_position_ids)
    ) INTO v_has_required_position;
    IF NOT v_has_required_position THEN
      IF v_member_role IN ('OWNER', 'ADMIN') OR p_is_global_admin THEN
        v_admin_intervention := true;
      ELSE
        RAISE EXCEPTION 'STAGE_POSITION_REQUIRED';
      END IF;
    END IF;
  END IF;

  -- Exact 4 editorial stages requiring mandatory deadline:
  -- 1. Tradução (traducao)
  -- 2. Clean/Redraw (clean_redraw / clean)
  -- 3. Typeset (typeset)
  -- 4. Revisor / QC (revisor_qc / qc / revisao)
  v_is_deadline_required := v_workflow_stage.slug IN (
    'traducao', 'clean_redraw', 'clean', 'typeset', 'revisor_qc', 'qc', 'revisao'
  );

  IF v_is_deadline_required THEN
    IF p_due_at IS NULL THEN
      RAISE EXCEPTION 'DEADLINE_SELECTION_REQUIRED';
    END IF;

    v_sp_today := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
    v_chosen_sp_date := (p_due_at AT TIME ZONE 'America/Sao_Paulo')::date;
    IF v_chosen_sp_date < v_sp_today THEN
      RAISE EXCEPTION 'DEADLINE_CANNOT_BE_IN_PAST';
    END IF;
    IF v_chosen_sp_date > v_sp_today + 3 THEN
      RAISE EXCEPTION 'DEADLINE_EXCEEDS_MAX_THREE_DAYS';
    END IF;
    v_normalized_due_at := ((v_chosen_sp_date + interval '23 hours 59 minutes 59 seconds') AT TIME ZONE 'America/Sao_Paulo');
  ELSE
    -- For RAW Provider, Pre-aprovado, deadline is optional
    IF p_due_at IS NOT NULL THEN
      v_chosen_sp_date := (p_due_at AT TIME ZONE 'America/Sao_Paulo')::date;
      v_normalized_due_at := ((v_chosen_sp_date + interval '23 hours 59 minutes 59 seconds') AT TIME ZONE 'America/Sao_Paulo');
    END IF;
  END IF;

  UPDATE public.scan_chapter_stages
  SET status = 'IN_PROGRESS',
      assigned_to = p_actor_id,
      claimed_at = COALESCE(claimed_at, now()),
      due_at = COALESCE(v_normalized_due_at, due_at),
      original_due_at = COALESCE(v_normalized_due_at, original_due_at, due_at),
      notes = COALESCE(NULLIF(trim(p_notes), ''), notes),
      extension_count = 0,
      extended_at = NULL,
      due_warning_sent_at = NULL,
      last_activity_at = now(),
      updated_at = now()
  WHERE id = v_stage.id
    AND status IN ('AVAILABLE', 'REWORK')
    AND (assigned_to IS NULL OR assigned_to = p_actor_id);
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated = 0 THEN RAISE EXCEPTION 'STAGE_ALREADY_CLAIMED'; END IF;

  SELECT COALESCE(display_name, username, 'Membro') INTO v_actor_name FROM public.members WHERE id = p_actor_id;
  INSERT INTO public.scan_chapter_timeline (
    scan_id, production_chapter_id, stage_id, stage_slug, event_type, user_id, user_name, details
  ) VALUES (
    v_stage.scan_id, COALESCE(v_stage.production_chapter_id, v_stage.chapter_id), v_stage.stage_id,
    v_workflow_stage.slug, 'CLAIMED', p_actor_id, v_actor_name,
    jsonb_build_object(
      'stage_name', v_workflow_stage.name,
      'is_admin_intervention', v_admin_intervention,
      'due_at', v_normalized_due_at,
      'notes', NULLIF(trim(p_notes), ''),
      'note', CASE WHEN v_admin_intervention AND NOT v_has_required_position THEN 'Intervenção administrativa' ELSE NULL END
    )
  );
  RETURN jsonb_build_object(
    'success', true,
    'status', 'IN_PROGRESS',
    'due_at', v_normalized_due_at,
    'is_admin_intervention', v_admin_intervention
  );
END;
$function$;

-- 4. Automatic 2-Day Extension Function (No approval needed, no justification required)
CREATE OR REPLACE FUNCTION public.extend_scan_chapter_stage_ysql(
  p_chapter_stage_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql AS $function$
DECLARE
  v_stage public.scan_chapter_stages;
  v_workflow_stage public.scan_workflow_stages;
  v_member_role text;
  v_actor_name text := 'Membro';
  v_old_due_at timestamptz;
  v_old_sp_date date;
  v_sp_today date;
  v_new_sp_date date;
  v_new_due_at timestamptz;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;

  SELECT * INTO v_stage FROM public.scan_chapter_stages WHERE id = p_chapter_stage_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHAPTER_STAGE_NOT_FOUND'; END IF;

  IF v_stage.status <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'STAGE_NOT_IN_PROGRESS';
  END IF;

  IF v_stage.assigned_to IS DISTINCT FROM p_actor_id AND NOT p_is_global_admin THEN
    RAISE EXCEPTION 'STAGE_NOT_ASSIGNED_TO_ACTOR';
  END IF;

  IF COALESCE(v_stage.extension_count, 0) >= 1 THEN
    RAISE EXCEPTION 'EXTENSION_ALREADY_USED';
  END IF;

  IF v_stage.due_at IS NULL THEN
    RAISE EXCEPTION 'NO_DEADLINE_REGISTERED';
  END IF;

  v_old_due_at := v_stage.due_at;
  v_old_sp_date := (v_old_due_at AT TIME ZONE 'America/Sao_Paulo')::date;
  v_sp_today := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  -- Allow extension within 24h of due date (or if due_at was chosen as today)
  IF NOT (v_old_sp_date = v_sp_today OR (v_old_due_at - now() <= interval '24 hours')) THEN
    RAISE EXCEPTION 'EXTENSION_ONLY_ALLOWED_WITHIN_24H';
  END IF;

  -- Cannot extend if already past reasonable grace period (over 4 hours expired)
  IF v_stage.due_at < now() - interval '4 hours' THEN
    RAISE EXCEPTION 'DEADLINE_ALREADY_EXPIRED';
  END IF;

  v_new_sp_date := v_old_sp_date + 2; -- Exactly +2 calendar days
  v_new_due_at := ((v_new_sp_date + interval '23 hours 59 minutes 59 seconds') AT TIME ZONE 'America/Sao_Paulo');

  UPDATE public.scan_chapter_stages
  SET due_at = v_new_due_at,
      extension_count = COALESCE(extension_count, 0) + 1,
      extended_at = now(),
      due_warning_sent_at = NULL,
      last_activity_at = now(),
      updated_at = now()
  WHERE id = v_stage.id;

  SELECT * INTO v_workflow_stage FROM public.scan_workflow_stages WHERE id = v_stage.stage_id;
  SELECT COALESCE(display_name, username, 'Membro') INTO v_actor_name FROM public.members WHERE id = p_actor_id;

  INSERT INTO public.scan_chapter_timeline (
    scan_id, production_chapter_id, stage_id, stage_slug, event_type, user_id, user_name, details
  ) VALUES (
    v_stage.scan_id, COALESCE(v_stage.production_chapter_id, v_stage.chapter_id),
    v_stage.stage_id, COALESCE(v_workflow_stage.slug, 'etapa'),
    'EXTENDED', p_actor_id, v_actor_name,
    jsonb_build_object(
      'previous_due_at', v_old_due_at,
      'new_due_at', v_new_due_at,
      'extension_days', 2,
      'stage_name', COALESCE(v_workflow_stage.name, 'Etapa')
    )
  );

  -- Send informational notification to the member
  INSERT INTO public.notifications (
    user_id, scan_id, title, body, href, type, kind, priority, dedupe_key, created_at
  ) VALUES (
    p_actor_id, v_stage.scan_id,
    'Prazo prorrogado com sucesso',
    'Seu prazo para a etapa ' || COALESCE(v_workflow_stage.name, 'editorial') || ' foi estendido por +2 dias (novo vencimento: ' || to_char(v_new_due_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') || ').',
    '/scan?tab=calendario',
    'DEADLINE_EXTENDED', 'deadline_extended', 'NORMAL',
    'deadline_extended:' || v_stage.id || ':' || p_actor_id || ':' || extract(epoch from now())::bigint,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_due_at', v_new_due_at,
    'previous_due_at', v_old_due_at,
    'extension_count', 1
  );
END;
$function$;

-- 5. Notes & Observations Update Function
CREATE OR REPLACE FUNCTION public.update_scan_chapter_stage_notes_ysql(
  p_chapter_stage_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean,
  p_notes text
) RETURNS jsonb LANGUAGE plpgsql AS $function$
DECLARE
  v_stage public.scan_chapter_stages;
  v_member_role text;
  v_actor_name text := 'Membro';
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;

  SELECT * INTO v_stage FROM public.scan_chapter_stages WHERE id = p_chapter_stage_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHAPTER_STAGE_NOT_FOUND'; END IF;

  SELECT role INTO v_member_role FROM public.scan_members WHERE scan_id = v_stage.scan_id AND user_id = p_actor_id;
  IF v_member_role IS NULL AND NOT p_is_global_admin THEN
    RAISE EXCEPTION 'SCAN_MEMBERSHIP_REQUIRED';
  END IF;

  IF v_stage.assigned_to IS DISTINCT FROM p_actor_id AND v_member_role NOT IN ('OWNER', 'ADMIN') AND NOT p_is_global_admin THEN
    RAISE EXCEPTION 'NOTE_UPDATE_FORBIDDEN';
  END IF;

  UPDATE public.scan_chapter_stages
  SET notes = trim(COALESCE(p_notes, '')),
      last_activity_at = now(),
      updated_at = now()
  WHERE id = v_stage.id;

  SELECT COALESCE(display_name, username, 'Membro') INTO v_actor_name FROM public.members WHERE id = p_actor_id;

  INSERT INTO public.scan_chapter_timeline (
    scan_id, production_chapter_id, stage_id, stage_slug, event_type, user_id, user_name, details
  ) VALUES (
    v_stage.scan_id, COALESCE(v_stage.production_chapter_id, v_stage.chapter_id),
    v_stage.stage_id, NULL, 'NOTE_UPDATED', p_actor_id, v_actor_name,
    jsonb_build_object('notes', trim(COALESCE(p_notes, '')))
  );

  RETURN jsonb_build_object('success', true, 'notes', trim(COALESCE(p_notes, '')));
END;
$function$;

-- 6. Check and Send Deadline Warnings (Idempotent 24h warning)
CREATE OR REPLACE FUNCTION public.check_and_send_deadline_warnings_ysql(p_scan_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql AS $function$
DECLARE
  r RECORD;
  v_count integer := 0;
  v_sp_due text;
BEGIN
  FOR r IN
    SELECT 
      cs.id as stage_id,
      cs.scan_id,
      cs.assigned_to,
      cs.due_at,
      ws.name as stage_name,
      pc.chapter_number,
      w.title as work_title
    FROM public.scan_chapter_stages cs
    JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
    JOIN public.scan_production_chapters pc ON pc.id = COALESCE(cs.production_chapter_id, cs.chapter_id)
    JOIN public.works w ON w.id = pc.work_id
    WHERE cs.status = 'IN_PROGRESS'
      AND cs.assigned_to IS NOT NULL
      AND cs.due_at IS NOT NULL
      AND cs.due_at > now()
      AND cs.due_at - now() <= interval '24 hours'
      AND (cs.due_warning_sent_at IS NULL OR (cs.extended_at IS NOT NULL AND cs.due_warning_sent_at < cs.extended_at))
      AND (p_scan_id IS NULL OR cs.scan_id = p_scan_id)
    LIMIT 100
  LOOP
    v_sp_due := to_char(r.due_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY às 23:59');

    INSERT INTO public.notifications (
      user_id, scan_id, title, body, href, type, kind, priority, dedupe_key, created_at
    ) VALUES (
      r.assigned_to, r.scan_id,
      'Seu prazo está chegando ao fim!',
      'Você tem uma entrega próxima: ' || r.work_title || ', capítulo #' || r.chapter_number || ', etapa ' || r.stage_name || '. Prazo até ' || v_sp_due || '. Se precisar, você pode prorrogar por mais dois dias.',
      '/scan?tab=calendario',
      'DEADLINE_WARNING', 'deadline_warning', 'HIGH',
      'deadline_warning:' || r.stage_id || ':' || r.assigned_to || ':' || to_char(r.due_at, 'YYYY-MM-DD-HH24'),
      now()
    );

    UPDATE public.scan_chapter_stages
    SET due_warning_sent_at = now()
    WHERE id = r.stage_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;
