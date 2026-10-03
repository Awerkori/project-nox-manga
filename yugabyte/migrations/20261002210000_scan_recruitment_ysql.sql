-- Scan recruitment, applications and team admission on the authoritative
-- YugabyteDB/YSQL data plane.  Callers provide the already-authenticated
-- actor explicitly; this avoids coupling application authorization to the
-- retired PostgREST auth.uid() context.

DO $$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(required_table ORDER BY required_table)
  INTO v_missing
  FROM (VALUES
    ('scans'), ('members'), ('scan_members'), ('scan_positions'),
    ('scan_recruitment_openings'), ('scan_applications'),
    ('scan_recruitment_questions'), ('scan_application_answers'),
    ('scan_member_positions'), ('scan_activity'), ('scan_comments'),
    ('scan_comment_likes'), ('scan_comment_reports'), ('scan_chapter_stages'),
    ('scan_workflow_stages'), ('scan_chapter_timeline')
  ) AS required(required_table)
  WHERE to_regclass('public.' || required_table) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'SCAN_RECRUITMENT_YSQL_PREREQUISITES_MISSING: %', array_to_string(v_missing, ', ');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_scan_recruitment_ysql(
  p_scan_id uuid,
  p_actor_id uuid,
  p_is_global_editor boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(p_is_global_editor, false) OR EXISTS (
    SELECT 1
    FROM public.scan_members
    WHERE scan_id = p_scan_id
      AND user_id = p_actor_id
      AND role IN ('OWNER', 'ADMIN')
  );
$$;

CREATE OR REPLACE FUNCTION public.apply_for_scan_opening_ysql(
  p_opening_id uuid,
  p_actor_id uuid,
  p_experience text,
  p_availability text,
  p_presentation text,
  p_portfolio_url text DEFAULT NULL,
  p_contact_info text DEFAULT '',
  p_answers jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_opening public.scan_recruitment_openings;
  v_scan_name text;
  v_scan_status text;
  v_position_name text;
  v_application_id uuid;
  v_clean_url text := NULL;
  v_applicant_name text := 'Membro';
  v_leader_ids jsonb := '[]'::jsonb;
  v_missing_required integer := 0;
  v_invalid_answers integer := 0;
  v_answer_count integer := 0;
  v_distinct_answer_count integer := 0;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_opening_id IS NULL THEN RAISE EXCEPTION 'OPENING_REQUIRED'; END IF;
  IF jsonb_typeof(COALESCE(p_answers, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'APPLICATION_ANSWERS_INVALID';
  END IF;

  -- Serializes a candidate's submission for an opening without taking a
  -- coarse scan-wide lock.  The duplicate check below is therefore reliable.
  PERFORM pg_advisory_xact_lock(hashtext(p_opening_id::text || ':' || p_actor_id::text));

  SELECT o.* INTO v_opening
  FROM public.scan_recruitment_openings o
  WHERE o.id = p_opening_id
  FOR UPDATE OF o;

  IF NOT FOUND THEN RAISE EXCEPTION 'OPENING_NOT_FOUND'; END IF;
  SELECT s.name, s.status, p.name
  INTO v_scan_name, v_scan_status, v_position_name
  FROM public.scans s
  JOIN public.scan_positions p ON p.id = v_opening.position_id
  WHERE s.id = v_opening.scan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPENING_RELATION_INVALID'; END IF;
  IF v_scan_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'SCAN_RECRUITMENT_INACTIVE';
  END IF;
  IF v_opening.status <> 'OPEN' THEN RAISE EXCEPTION 'OPENING_NOT_OPEN'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.scan_applications
    WHERE opening_id = p_opening_id
      AND user_id = p_actor_id
      AND status IN ('PENDING', 'UNDER_REVIEW')
  ) THEN RAISE EXCEPTION 'APPLICATION_ALREADY_ACTIVE'; END IF;

  IF (SELECT count(*) FROM public.scan_applications
      WHERE user_id = p_actor_id AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'APPLICATION_RATE_LIMITED';
  END IF;

  IF NULLIF(trim(COALESCE(p_portfolio_url, '')), '') IS NOT NULL THEN
    v_clean_url := trim(p_portfolio_url);
    IF v_clean_url !~* '^https?://[^[:space:]]+$' THEN
      RAISE EXCEPTION 'PORTFOLIO_URL_INVALID';
    END IF;
  END IF;

  SELECT count(*), count(DISTINCT question_id)
  INTO v_answer_count, v_distinct_answer_count
  FROM jsonb_to_recordset(COALESCE(p_answers, '[]'::jsonb)) AS answer(question_id uuid, answer text);
  IF v_answer_count <> v_distinct_answer_count THEN RAISE EXCEPTION 'APPLICATION_ANSWER_DUPLICATE'; END IF;

  SELECT count(*) INTO v_invalid_answers
  FROM jsonb_to_recordset(COALESCE(p_answers, '[]'::jsonb)) AS answer(question_id uuid, answer text)
  LEFT JOIN public.scan_recruitment_questions q
    ON q.id = answer.question_id AND q.opening_id = p_opening_id
  WHERE q.id IS NULL OR NULLIF(trim(answer.answer), '') IS NULL;
  IF v_invalid_answers > 0 THEN RAISE EXCEPTION 'APPLICATION_ANSWER_INVALID'; END IF;

  SELECT count(*) INTO v_missing_required
  FROM public.scan_recruitment_questions q
  WHERE q.opening_id = p_opening_id
    AND q.required
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(COALESCE(p_answers, '[]'::jsonb)) AS answer(question_id uuid, answer text)
      WHERE answer.question_id = q.id AND NULLIF(trim(answer.answer), '') IS NOT NULL
    );
  IF v_missing_required > 0 THEN RAISE EXCEPTION 'APPLICATION_REQUIRED_ANSWER_MISSING'; END IF;

  INSERT INTO public.scan_applications (
    scan_id, opening_id, position_id, user_id, experience, availability,
    presentation, portfolio_url, contact_info, status
  ) VALUES (
    v_opening.scan_id, p_opening_id, v_opening.position_id, p_actor_id,
    COALESCE(trim(p_experience), ''), COALESCE(trim(p_availability), ''),
    COALESCE(trim(p_presentation), ''), v_clean_url, COALESCE(trim(p_contact_info), ''), 'PENDING'
  ) RETURNING id INTO v_application_id;

  INSERT INTO public.scan_application_answers (application_id, question_id, answer)
  SELECT v_application_id, answer.question_id, trim(answer.answer)
  FROM jsonb_to_recordset(COALESCE(p_answers, '[]'::jsonb)) AS answer(question_id uuid, answer text);

  SELECT COALESCE(display_name, username, 'Membro') INTO v_applicant_name
  FROM public.members WHERE id = p_actor_id;
  INSERT INTO public.scan_activity (scan_id, user_id, action, details)
  VALUES (v_opening.scan_id, p_actor_id, 'APPLICATION_RECEIVED', jsonb_build_object(
    'application_id', v_application_id, 'opening_id', p_opening_id,
    'position_name', v_position_name, 'applicant_name', v_applicant_name
  ));

  SELECT COALESCE(jsonb_agg(user_id), '[]'::jsonb) INTO v_leader_ids
  FROM public.scan_members
  WHERE scan_id = v_opening.scan_id AND role IN ('OWNER', 'ADMIN') AND user_id <> p_actor_id;

  RETURN jsonb_build_object(
    'success', true, 'application_id', v_application_id, 'scan_id', v_opening.scan_id,
    'scan_name', v_scan_name, 'opening_title', v_opening.title,
    'position_name', v_position_name, 'leader_ids', v_leader_ids
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.manage_scan_opening_ysql(
  p_scan_id uuid,
  p_actor_id uuid,
  p_is_global_editor boolean,
  p_opening_id uuid,
  p_position_id uuid,
  p_title text DEFAULT '',
  p_description text DEFAULT '',
  p_requirements text DEFAULT '',
  p_language text DEFAULT 'pt-BR',
  p_experience_level text DEFAULT 'QUALQUER',
  p_availability text DEFAULT '',
  p_slots integer DEFAULT NULL,
  p_notes text DEFAULT '',
  p_status text DEFAULT 'OPEN'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_opening_id uuid;
  v_position_name text;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_scan_id IS NULL OR p_position_id IS NULL THEN RAISE EXCEPTION 'OPENING_ARGUMENT_INVALID'; END IF;
  IF NOT public.can_manage_scan_recruitment_ysql(p_scan_id, p_actor_id, p_is_global_editor) THEN
    RAISE EXCEPTION 'RECRUITMENT_MANAGEMENT_FORBIDDEN';
  END IF;
  IF p_status NOT IN ('OPEN', 'PAUSED', 'CLOSED') THEN RAISE EXCEPTION 'OPENING_STATUS_INVALID'; END IF;
  IF p_slots IS NOT NULL AND p_slots < 1 THEN RAISE EXCEPTION 'OPENING_SLOTS_INVALID'; END IF;

  SELECT name INTO v_position_name
  FROM public.scan_positions
  WHERE id = p_position_id AND scan_id = p_scan_id
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPENING_POSITION_NOT_FOUND'; END IF;

  IF p_opening_id IS NULL THEN
    INSERT INTO public.scan_recruitment_openings (
      scan_id, position_id, title, description, requirements, language,
      experience_level, availability, slots, notes, status
    ) VALUES (
      p_scan_id, p_position_id, COALESCE(NULLIF(trim(p_title), ''), v_position_name),
      COALESCE(trim(p_description), ''), COALESCE(trim(p_requirements), ''),
      COALESCE(NULLIF(trim(p_language), ''), 'pt-BR'),
      COALESCE(NULLIF(trim(p_experience_level), ''), 'QUALQUER'),
      COALESCE(trim(p_availability), ''), p_slots, COALESCE(trim(p_notes), ''), p_status
    ) RETURNING id INTO v_opening_id;
    INSERT INTO public.scan_activity (scan_id, user_id, action, details)
    VALUES (p_scan_id, p_actor_id, 'OPENING_CREATED', jsonb_build_object(
      'opening_id', v_opening_id, 'position_name', v_position_name, 'title', p_title
    ));
  ELSE
    UPDATE public.scan_recruitment_openings
    SET position_id = p_position_id,
        title = COALESCE(NULLIF(trim(p_title), ''), v_position_name),
        description = COALESCE(trim(p_description), ''),
        requirements = COALESCE(trim(p_requirements), ''),
        language = COALESCE(NULLIF(trim(p_language), ''), 'pt-BR'),
        experience_level = COALESCE(NULLIF(trim(p_experience_level), ''), 'QUALQUER'),
        availability = COALESCE(trim(p_availability), ''), slots = p_slots,
        notes = COALESCE(trim(p_notes), ''), status = p_status, updated_at = now()
    WHERE id = p_opening_id AND scan_id = p_scan_id
    RETURNING id INTO v_opening_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'OPENING_NOT_FOUND'; END IF;
    INSERT INTO public.scan_activity (scan_id, user_id, action, details)
    VALUES (p_scan_id, p_actor_id, 'OPENING_UPDATED', jsonb_build_object(
      'opening_id', v_opening_id, 'status', p_status
    ));
  END IF;

  RETURN jsonb_build_object('success', true, 'opening_id', v_opening_id, 'status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_scan_application_ysql(
  p_application_id uuid,
  p_actor_id uuid,
  p_is_global_editor boolean,
  p_action text,
  p_notes text DEFAULT NULL,
  p_add_to_team boolean DEFAULT false,
  p_initial_role text DEFAULT 'MEMBER'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_application public.scan_applications;
  v_position_name text;
  v_status text;
  v_applicant_name text := 'Membro';
  v_scan_name text := 'Scan';
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  SELECT a.* INTO v_application
  FROM public.scan_applications a
  WHERE a.id = p_application_id
  FOR UPDATE OF a;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND'; END IF;
  SELECT name INTO v_position_name FROM public.scan_positions WHERE id = v_application.position_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_POSITION_NOT_FOUND'; END IF;
  IF NOT public.can_manage_scan_recruitment_ysql(v_application.scan_id, p_actor_id, p_is_global_editor) THEN
    RAISE EXCEPTION 'APPLICATION_REVIEW_FORBIDDEN';
  END IF;
  IF p_action NOT IN ('APPROVE', 'REJECT', 'UNDER_REVIEW') THEN RAISE EXCEPTION 'APPLICATION_ACTION_INVALID'; END IF;
  IF p_action IN ('APPROVE', 'REJECT') AND v_application.status IN ('APPROVED', 'REJECTED', 'WITHDRAWN') THEN
    RAISE EXCEPTION 'APPLICATION_ALREADY_FINALIZED';
  END IF;
  IF p_initial_role NOT IN ('MEMBER', 'UPLOADER', 'ADMIN') THEN RAISE EXCEPTION 'APPLICATION_MEMBER_ROLE_INVALID'; END IF;

  v_status := CASE p_action WHEN 'APPROVE' THEN 'APPROVED' WHEN 'REJECT' THEN 'REJECTED' ELSE 'UNDER_REVIEW' END;
  UPDATE public.scan_applications
  SET status = v_status, internal_notes = COALESCE(p_notes, internal_notes),
      reviewed_by = p_actor_id, reviewed_at = now(), updated_at = now()
  WHERE id = v_application.id;

  IF v_status = 'APPROVED' AND p_add_to_team THEN
    INSERT INTO public.scan_members (scan_id, user_id, role)
    VALUES (v_application.scan_id, v_application.user_id, p_initial_role)
    ON CONFLICT (scan_id, user_id) DO UPDATE
      SET role = CASE WHEN public.scan_members.role = 'OWNER' THEN 'OWNER' ELSE EXCLUDED.role END;
    INSERT INTO public.scan_member_positions (scan_id, user_id, position_id, is_primary)
    VALUES (v_application.scan_id, v_application.user_id, v_application.position_id, true)
    ON CONFLICT (scan_id, user_id, position_id) DO NOTHING;
  END IF;

  SELECT COALESCE(display_name, username, 'Membro') INTO v_applicant_name
  FROM public.members WHERE id = v_application.user_id;
  SELECT name INTO v_scan_name FROM public.scans WHERE id = v_application.scan_id;
  IF v_status = 'APPROVED' AND p_add_to_team THEN
    INSERT INTO public.scan_activity (scan_id, user_id, action, details)
    VALUES (v_application.scan_id, p_actor_id, 'MEMBER_ADDED', jsonb_build_object(
      'user_id', v_application.user_id, 'user_name', v_applicant_name,
      'role', p_initial_role, 'position_name', v_position_name
    ));
  END IF;
  INSERT INTO public.scan_activity (scan_id, user_id, action, details)
  VALUES (v_application.scan_id, p_actor_id, 'APPLICATION_STATUS', jsonb_build_object(
    'application_id', v_application.id, 'status', v_status,
    'applicant_name', v_applicant_name, 'position_name', v_position_name
  ));

  RETURN jsonb_build_object(
    'success', true, 'status', v_status,
    'added_to_team', v_status = 'APPROVED' AND p_add_to_team,
    'application_id', v_application.id, 'applicant_id', v_application.user_id,
    'scan_id', v_application.scan_id, 'scan_name', v_scan_name,
    'opening_title', (SELECT title FROM public.scan_recruitment_openings WHERE id = v_application.opening_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.post_scan_comment_ysql(
  p_scan_id uuid,
  p_actor_id uuid,
  p_body text,
  p_parent_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_comment_id uuid;
  v_parent_author_id uuid;
  v_clean_body text := trim(COALESCE(p_body, ''));
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF length(v_clean_body) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'COMMENT_BODY_INVALID'; END IF;
  PERFORM 1 FROM public.scans WHERE id = p_scan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SCAN_NOT_FOUND'; END IF;
  IF p_parent_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_author_id
    FROM public.scan_comments
    WHERE id = p_parent_id AND scan_id = p_scan_id
    FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'COMMENT_PARENT_NOT_FOUND'; END IF;
  END IF;
  INSERT INTO public.scan_comments (scan_id, user_id, parent_id, body)
  VALUES (p_scan_id, p_actor_id, p_parent_id, v_clean_body)
  RETURNING id INTO v_comment_id;
  RETURN jsonb_build_object('success', true, 'comment_id', v_comment_id, 'parent_author_id', v_parent_author_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_scan_comment_like_ysql(
  p_comment_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_liked boolean;
  v_likes_count integer;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_comment_id::text || ':' || p_actor_id::text));
  PERFORM 1 FROM public.scan_comments WHERE id = p_comment_id AND removed = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMENT_NOT_FOUND'; END IF;
  IF EXISTS (SELECT 1 FROM public.scan_comment_likes WHERE user_id = p_actor_id AND comment_id = p_comment_id) THEN
    DELETE FROM public.scan_comment_likes WHERE user_id = p_actor_id AND comment_id = p_comment_id;
    v_liked := false;
  ELSE
    INSERT INTO public.scan_comment_likes (user_id, comment_id) VALUES (p_actor_id, p_comment_id);
    v_liked := true;
  END IF;
  SELECT count(*)::integer INTO v_likes_count FROM public.scan_comment_likes WHERE comment_id = p_comment_id;
  RETURN jsonb_build_object('success', true, 'liked', v_liked, 'likes_count', v_likes_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.moderate_scan_comment_ysql(
  p_comment_id uuid,
  p_actor_id uuid,
  p_is_global_editor boolean,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_comment public.scan_comments;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  SELECT * INTO v_comment FROM public.scan_comments WHERE id = p_comment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMENT_NOT_FOUND'; END IF;
  IF NOT public.can_manage_scan_recruitment_ysql(v_comment.scan_id, p_actor_id, p_is_global_editor) THEN
    RAISE EXCEPTION 'COMMENT_MODERATION_FORBIDDEN';
  END IF;
  IF p_action = 'REMOVE' THEN
    UPDATE public.scan_comments SET removed = true, updated_at = now() WHERE id = v_comment.id;
  ELSIF p_action = 'RESTORE' THEN
    UPDATE public.scan_comments SET removed = false, updated_at = now() WHERE id = v_comment.id;
  ELSIF p_action = 'PIN' THEN
    UPDATE public.scan_comments SET pinned = true, updated_at = now() WHERE id = v_comment.id;
  ELSIF p_action = 'UNPIN' THEN
    UPDATE public.scan_comments SET pinned = false, updated_at = now() WHERE id = v_comment.id;
  ELSE
    RAISE EXCEPTION 'COMMENT_MODERATION_ACTION_INVALID';
  END IF;
  RETURN jsonb_build_object('success', true, 'action', p_action);
END;
$$;

CREATE OR REPLACE FUNCTION public.report_scan_comment_ysql(
  p_comment_id uuid,
  p_actor_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_report_id uuid;
  v_clean_reason text := trim(COALESCE(p_reason, ''));
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF length(v_clean_reason) NOT BETWEEN 2 AND 500 THEN RAISE EXCEPTION 'COMMENT_REPORT_REASON_INVALID'; END IF;
  PERFORM 1 FROM public.scan_comments WHERE id = p_comment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMENT_NOT_FOUND'; END IF;
  INSERT INTO public.scan_comment_reports (comment_id, user_id, reason)
  VALUES (p_comment_id, p_actor_id, v_clean_reason)
  RETURNING id INTO v_report_id;
  RETURN jsonb_build_object('success', true, 'report_id', v_report_id);
END;
$$;

-- A stage is locked before permission and availability are evaluated. This
-- makes two simultaneous "assumir" requests deterministic: one receives the
-- claim and the other receives STAGE_ALREADY_CLAIMED without overwriting it.
CREATE OR REPLACE FUNCTION public.claim_scan_chapter_stage_ysql(
  p_chapter_stage_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_stage public.scan_chapter_stages;
  v_workflow_stage public.scan_workflow_stages;
  v_member_role text;
  v_actor_name text := 'Membro';
  v_has_required_position boolean := false;
  v_admin_intervention boolean := false;
  v_rows_updated integer;
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

  UPDATE public.scan_chapter_stages
  SET status = 'IN_PROGRESS', assigned_to = p_actor_id,
      claimed_at = COALESCE(claimed_at, now()), last_activity_at = now(), updated_at = now()
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
    jsonb_build_object('stage_name', v_workflow_stage.name, 'is_admin_intervention', v_admin_intervention,
      'note', CASE WHEN v_admin_intervention AND NOT v_has_required_position THEN 'Intervenção administrativa' ELSE NULL END)
  );
  RETURN jsonb_build_object('success', true, 'status', 'IN_PROGRESS', 'is_admin_intervention', v_admin_intervention);
END;
$$;

-- Keep team-position changes in one transaction.  The former PostgREST RPCs
-- changed primary flags and membership rows in separate requests, which made
-- two simultaneous managers capable of leaving multiple primary positions.
CREATE OR REPLACE FUNCTION public.manage_scan_member_position_ysql(
  p_action text,
  p_scan_id uuid,
  p_actor_id uuid,
  p_is_global_editor boolean,
  p_target_user_id uuid,
  p_position_id uuid,
  p_is_primary boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_target_role text;
  v_position_name text;
  v_was_primary boolean := false;
  v_promoted_position_id uuid;
  v_can_manage boolean := false;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_action NOT IN ('ASSIGN', 'REMOVE', 'SET_PRIMARY') THEN
    RAISE EXCEPTION 'MEMBER_POSITION_ACTION_INVALID';
  END IF;
  IF p_scan_id IS NULL OR p_target_user_id IS NULL OR p_position_id IS NULL THEN
    RAISE EXCEPTION 'MEMBER_POSITION_ARGUMENT_INVALID';
  END IF;

  -- Serialize all position changes for this member without blocking other
  -- members of the same Scan.
  PERFORM pg_advisory_xact_lock(hashtext(p_scan_id::text || ':' || p_target_user_id::text));

  SELECT role INTO v_target_role
  FROM public.scan_members
  WHERE scan_id = p_scan_id AND user_id = p_target_user_id
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_POSITION_TARGET_NOT_MEMBER'; END IF;

  SELECT name INTO v_position_name
  FROM public.scan_positions
  WHERE id = p_position_id AND scan_id = p_scan_id
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_POSITION_NOT_FOUND'; END IF;

  v_can_manage := public.can_manage_scan_recruitment_ysql(p_scan_id, p_actor_id, p_is_global_editor);
  IF NOT v_can_manage AND NOT (p_action = 'SET_PRIMARY' AND p_actor_id = p_target_user_id) THEN
    RAISE EXCEPTION 'MEMBER_POSITION_FORBIDDEN';
  END IF;

  IF p_action = 'ASSIGN' THEN
    IF p_is_primary THEN
      UPDATE public.scan_member_positions
      SET is_primary = false
      WHERE scan_id = p_scan_id AND user_id = p_target_user_id;
    END IF;
    INSERT INTO public.scan_member_positions (scan_id, user_id, position_id, is_primary)
    VALUES (p_scan_id, p_target_user_id, p_position_id, p_is_primary)
    ON CONFLICT (scan_id, user_id, position_id) DO UPDATE
      SET is_primary = CASE WHEN p_is_primary THEN true ELSE public.scan_member_positions.is_primary END;
  ELSIF p_action = 'SET_PRIMARY' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.scan_member_positions
      WHERE scan_id = p_scan_id AND user_id = p_target_user_id AND position_id = p_position_id
    ) THEN RAISE EXCEPTION 'MEMBER_POSITION_NOT_ASSIGNED'; END IF;
    UPDATE public.scan_member_positions
    SET is_primary = false
    WHERE scan_id = p_scan_id AND user_id = p_target_user_id;
    UPDATE public.scan_member_positions
    SET is_primary = true
    WHERE scan_id = p_scan_id AND user_id = p_target_user_id AND position_id = p_position_id;
  ELSE
    SELECT is_primary INTO v_was_primary
    FROM public.scan_member_positions
    WHERE scan_id = p_scan_id AND user_id = p_target_user_id AND position_id = p_position_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_POSITION_NOT_ASSIGNED'; END IF;
    DELETE FROM public.scan_member_positions
    WHERE scan_id = p_scan_id AND user_id = p_target_user_id AND position_id = p_position_id;
    IF v_was_primary THEN
      SELECT position_id INTO v_promoted_position_id
      FROM public.scan_member_positions
      WHERE scan_id = p_scan_id AND user_id = p_target_user_id
      ORDER BY position_id
      LIMIT 1;
      IF v_promoted_position_id IS NOT NULL THEN
        UPDATE public.scan_member_positions
        SET is_primary = true
        WHERE scan_id = p_scan_id AND user_id = p_target_user_id AND position_id = v_promoted_position_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.scan_activity (scan_id, user_id, action, details)
  VALUES (p_scan_id, p_actor_id, 'MEMBER_POSITION_' || p_action, jsonb_build_object(
    'target_user_id', p_target_user_id, 'position_id', p_position_id,
    'position_name', v_position_name, 'is_primary', p_is_primary,
    'promoted_position_id', v_promoted_position_id
  ));
  RETURN jsonb_build_object(
    'success', true, 'action', p_action, 'position_name', v_position_name,
    'promoted_position_id', v_promoted_position_id
  );
END;
$$;
