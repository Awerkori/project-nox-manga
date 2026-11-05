-- ============================================================================
-- Migration: 20261105053000_strict_stage_extension_permissions.sql
-- Description: Enforce strict stage extension permissions:
--              1. ONLY the authenticated assignee (assigned_to = p_actor_id)
--                 can extend their stage deadline. Zero exceptions for ADMIN,
--                 OWNER, global admin, or managers.
--              2. Eliminate 4-hour post-deadline grace period. Extension is
--                 available ONLY when due_at > now() and due_at <= now() + 24h.
--              3. Security Definer with explicit search_path.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.extend_scan_chapter_stage_ysql(
  p_chapter_stage_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_stage public.scan_chapter_stages;
  v_workflow_stage public.scan_workflow_stages;
  v_actor_name text := 'Membro';
  v_old_due_at timestamptz;
  v_old_sp_date date;
  v_new_sp_date date;
  v_new_due_at timestamptz;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  -- Lock target stage row for update to prevent concurrent mutations
  SELECT * INTO v_stage
  FROM public.scan_chapter_stages
  WHERE id = p_chapter_stage_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHAPTER_STAGE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_stage.status <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'STAGE_NOT_IN_PROGRESS' USING ERRCODE = '22023';
  END IF;

  -- STRICT PERMISSION CHECK: Only the actual assignee may extend their deadline.
  -- Zero exceptions by role (p_is_global_admin is strictly ignored).
  IF v_stage.assigned_to IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'STAGE_NOT_ASSIGNED_TO_ACTOR' USING ERRCODE = '42501';
  END IF;

  -- Single extension limit (maximum 1 extension of +2 days)
  IF COALESCE(v_stage.extension_count, 0) >= 1 THEN
    RAISE EXCEPTION 'EXTENSION_ALREADY_USED' USING ERRCODE = '22023';
  END IF;

  IF v_stage.due_at IS NULL THEN
    RAISE EXCEPTION 'NO_DEADLINE_REGISTERED' USING ERRCODE = '22023';
  END IF;

  v_old_due_at := v_stage.due_at;

  -- STRICT DEADLINE WINDOW:
  -- 1. If deadline has already passed (even by 1 millisecond), extension is PROHIBITED.
  --    Expired tasks must follow normal devolution to pool.
  IF v_old_due_at <= now() THEN
    RAISE EXCEPTION 'DEADLINE_ALREADY_EXPIRED' USING ERRCODE = '22023';
  END IF;

  -- 2. Must be within the final 24 hours before expiration.
  IF v_old_due_at > now() + interval '24 hours' THEN
    RAISE EXCEPTION 'EXTENSION_ONLY_ALLOWED_WITHIN_24H' USING ERRCODE = '22023';
  END IF;

  v_old_sp_date := (v_old_due_at AT TIME ZONE 'America/Sao_Paulo')::date;
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

-- Provide convenient 2-argument signature as well
CREATE OR REPLACE FUNCTION public.extend_scan_chapter_stage_ysql(
  p_chapter_stage_id uuid,
  p_actor_id uuid
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.extend_scan_chapter_stage_ysql(p_chapter_stage_id, p_actor_id, false);
$$;

-- Grant execution permissions strictly to application roles
GRANT EXECUTE ON FUNCTION public.extend_scan_chapter_stage_ysql(uuid, uuid, boolean) TO postgres, yugabyte;
GRANT EXECUTE ON FUNCTION public.extend_scan_chapter_stage_ysql(uuid, uuid) TO postgres, yugabyte;
