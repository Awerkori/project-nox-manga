-- Migration: 20260911170000_scans_ecosystem_2_0.sql
-- Description: Project Nox Scans Ecosystem 2.0
--              Adds scan_positions, scan_member_positions, scan_recruitment_openings,
--              scan_applications, scan_activity, RLS policies, and management RPCs.

BEGIN;

-- 1. SCANS TABLE ENHANCEMENT: DISPLAY PREPOSITION
ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS display_preposition text NOT NULL DEFAULT 'de'
  CHECK (display_preposition IN ('de', 'da', 'do'));

UPDATE public.scans
SET display_preposition = 'do'
WHERE slug = 'project-nox';

UPDATE public.scans
SET display_preposition = 'da'
WHERE slug != 'project-nox' AND (name ILIKE '%scan%' OR name ILIKE '%toons%' OR name ILIKE '%equipe%');

-- 2. SCAN POSITIONS TABLE (Cargos / Posições da Equipe)
CREATE TABLE IF NOT EXISTS public.scan_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text DEFAULT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scan_positions_scan_name_key UNIQUE (scan_id, name)
);

CREATE INDEX IF NOT EXISTS idx_scan_positions_scan ON public.scan_positions(scan_id, is_active, display_order);

-- 3. SCAN MEMBER POSITIONS TABLE (Membros <-> Cargos)
CREATE TABLE IF NOT EXISTS public.scan_member_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.scan_positions(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scan_member_positions_unique UNIQUE (scan_id, user_id, position_id)
);

CREATE INDEX IF NOT EXISTS idx_scan_member_positions_user ON public.scan_member_positions(user_id, scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_member_positions_pos ON public.scan_member_positions(position_id);

-- 4. SCAN RECRUITMENT OPENINGS TABLE (Vagas Abertas)
CREATE TABLE IF NOT EXISTS public.scan_recruitment_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.scan_positions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  requirements text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'pt-BR',
  experience_level text NOT NULL DEFAULT 'QUALQUER',
  availability text NOT NULL DEFAULT '',
  slots integer DEFAULT NULL,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PAUSED', 'CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_openings_scan ON public.scan_recruitment_openings(scan_id, status);

-- 5. SCAN APPLICATIONS TABLE (Candidaturas)
CREATE TABLE IF NOT EXISTS public.scan_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  opening_id uuid NOT NULL REFERENCES public.scan_recruitment_openings(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.scan_positions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  experience text NOT NULL DEFAULT '',
  availability text NOT NULL DEFAULT '',
  presentation text NOT NULL DEFAULT '',
  portfolio_url text DEFAULT NULL,
  contact_info text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
  internal_notes text DEFAULT NULL,
  reviewed_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  reviewed_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_applications_scan ON public.scan_applications(scan_id, status);
CREATE INDEX IF NOT EXISTS idx_scan_applications_user ON public.scan_applications(user_id, opening_id);

-- 6. SCAN ACTIVITY TABLE (Auditoria e Linha do Tempo da Scan)
CREATE TABLE IF NOT EXISTS public.scan_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_activity_scan ON public.scan_activity(scan_id, created_at DESC);

-- 7. HELPER FUNCTION: CAN MANAGE RECRUITMENT
CREATE OR REPLACE FUNCTION public.can_manage_scan_recruitment(p_scan_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.scan_members
    WHERE scan_id = p_scan_id
      AND user_id = p_user_id
      AND role IN ('OWNER', 'ADMIN')
  ) OR public.is_editor();
END;
$$;

-- 8. DEFAULT PRESETS SEED FUNCTION
CREATE OR REPLACE FUNCTION public.seed_scan_default_positions(p_scan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_presets text[] := ARRAY[
    'Tradutor',
    'Revisor',
    'Cleaner',
    'Redrawer',
    'Typesetter',
    'Quality Checker',
    'Raw Provider',
    'Uploader',
    'Designer',
    'Social Media'
  ];
  v_pos text;
  v_order integer := 1;
BEGIN
  FOREACH v_pos IN ARRAY v_presets LOOP
    INSERT INTO public.scan_positions (scan_id, name, display_order, is_active)
    VALUES (p_scan_id, v_pos, v_order, true)
    ON CONFLICT (scan_id, name) DO NOTHING;
    v_order := v_order + 1;
  END LOOP;
END;
$$;

-- Seed presets for all existing active scans
DO $$
DECLARE
  v_s record;
BEGIN
  FOR v_s IN SELECT id FROM public.scans LOOP
    PERFORM public.seed_scan_default_positions(v_s.id);
  END LOOP;
END;
$$;

-- 9. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.scan_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_member_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_recruitment_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_activity ENABLE ROW LEVEL SECURITY;

-- scan_positions
DROP POLICY IF EXISTS scan_positions_select ON public.scan_positions;
CREATE POLICY scan_positions_select ON public.scan_positions
  FOR SELECT TO public
  USING (
    is_active = true
    OR public.can_manage_scan_recruitment(scan_id, auth.uid())
  );

DROP POLICY IF EXISTS scan_positions_manage ON public.scan_positions;
CREATE POLICY scan_positions_manage ON public.scan_positions
  FOR ALL TO authenticated
  USING (public.can_manage_scan_recruitment(scan_id, auth.uid()))
  WITH CHECK (public.can_manage_scan_recruitment(scan_id, auth.uid()));

-- scan_member_positions
DROP POLICY IF EXISTS scan_member_positions_select ON public.scan_member_positions;
CREATE POLICY scan_member_positions_select ON public.scan_member_positions
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS scan_member_positions_manage ON public.scan_member_positions;
CREATE POLICY scan_member_positions_manage ON public.scan_member_positions
  FOR ALL TO authenticated
  USING (public.can_manage_scan_members(scan_id, auth.uid()))
  WITH CHECK (public.can_manage_scan_members(scan_id, auth.uid()));

-- scan_recruitment_openings
DROP POLICY IF EXISTS scan_openings_select ON public.scan_recruitment_openings;
CREATE POLICY scan_openings_select ON public.scan_recruitment_openings
  FOR SELECT TO public
  USING (
    status = 'OPEN'
    OR public.can_manage_scan_recruitment(scan_id, auth.uid())
  );

DROP POLICY IF EXISTS scan_openings_manage ON public.scan_recruitment_openings;
CREATE POLICY scan_openings_manage ON public.scan_recruitment_openings
  FOR ALL TO authenticated
  USING (public.can_manage_scan_recruitment(scan_id, auth.uid()))
  WITH CHECK (public.can_manage_scan_recruitment(scan_id, auth.uid()));

-- scan_applications
DROP POLICY IF EXISTS scan_applications_select ON public.scan_applications;
CREATE POLICY scan_applications_select ON public.scan_applications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_manage_scan_recruitment(scan_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.scan_members sm
      WHERE sm.scan_id = scan_applications.scan_id
        AND sm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS scan_applications_insert ON public.scan_applications;
CREATE POLICY scan_applications_insert ON public.scan_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.scan_recruitment_openings o
      JOIN public.scans s ON s.id = o.scan_id
      WHERE o.id = opening_id
        AND o.status = 'OPEN'
        AND s.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS scan_applications_update ON public.scan_applications;
CREATE POLICY scan_applications_update ON public.scan_applications
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'WITHDRAWN')
    OR public.can_manage_scan_recruitment(scan_id, auth.uid())
  )
  WITH CHECK (
    (user_id = auth.uid() AND status = 'WITHDRAWN')
    OR public.can_manage_scan_recruitment(scan_id, auth.uid())
  );

-- scan_activity
DROP POLICY IF EXISTS scan_activity_select ON public.scan_activity;
CREATE POLICY scan_activity_select ON public.scan_activity
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scan_members sm
      WHERE sm.scan_id = scan_activity.scan_id
        AND sm.user_id = auth.uid()
    )
    OR public.is_editor()
  );

DROP POLICY IF EXISTS scan_activity_insert ON public.scan_activity;
CREATE POLICY scan_activity_insert ON public.scan_activity
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.scan_members sm
      WHERE sm.scan_id = scan_activity.scan_id
        AND sm.user_id = auth.uid()
    )
    OR public.is_editor()
  );

-- Grants
GRANT ALL ON public.scan_positions TO authenticated;
GRANT SELECT ON public.scan_positions TO anon;
GRANT ALL ON public.scan_member_positions TO authenticated;
GRANT SELECT ON public.scan_member_positions TO anon;
GRANT ALL ON public.scan_recruitment_openings TO authenticated;
GRANT SELECT ON public.scan_recruitment_openings TO anon;
GRANT ALL ON public.scan_applications TO authenticated;
GRANT ALL ON public.scan_activity TO authenticated;

-- 10. RPC: APPLY FOR SCAN OPENING
CREATE OR REPLACE FUNCTION public.apply_for_scan_opening(
  p_opening_id uuid,
  p_experience text,
  p_availability text,
  p_presentation text,
  p_portfolio_url text DEFAULT NULL,
  p_contact_info text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_opening record;
  v_app_id uuid;
  v_clean_url text := null;
  v_user_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar conectado para se candidatar' USING errcode = '42501';
  END IF;

  SELECT o.*, s.name as scan_name, s.status as scan_status, p.name as position_name
  INTO v_opening
  FROM public.scan_recruitment_openings o
  JOIN public.scans s ON s.id = o.scan_id
  JOIN public.scan_positions p ON p.id = o.position_id
  WHERE o.id = p_opening_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vaga não encontrada';
  END IF;

  IF v_opening.scan_status != 'ACTIVE' THEN
    RAISE EXCEPTION 'A scan desta vaga não está ativa para recrutamento';
  END IF;

  IF v_opening.status != 'OPEN' THEN
    RAISE EXCEPTION 'Esta vaga não está mais recebendo candidaturas';
  END IF;

  -- Validate duplicate pending application
  IF EXISTS (
    SELECT 1 FROM public.scan_applications
    WHERE opening_id = p_opening_id
      AND user_id = v_uid
      AND status IN ('PENDING', 'UNDER_REVIEW')
  ) THEN
    RAISE EXCEPTION 'Você já possui uma candidatura em análise para esta vaga';
  END IF;

  -- Sanitize URL (must be valid http/https, no javascript:)
  IF p_portfolio_url IS NOT NULL AND trim(p_portfolio_url) != '' THEN
    v_clean_url := trim(p_portfolio_url);
    IF NOT (v_clean_url ~* '^https?://[^\s/$.?#].[^\s]*$') THEN
      RAISE EXCEPTION 'Link de portfólio inválido. Use um link válido iniciando com http:// ou https://';
    END IF;
  END IF;

  -- Rate limit check: max 5 applications per hour
  IF (
    SELECT count(*) FROM public.scan_applications
    WHERE user_id = v_uid
      AND created_at > now() - interval '1 hour'
  ) >= 5 THEN
    RAISE EXCEPTION 'Limite de candidaturas por hora atingido. Aguarde antes de enviar uma nova candidatura';
  END IF;

  INSERT INTO public.scan_applications (
    scan_id,
    opening_id,
    position_id,
    user_id,
    experience,
    availability,
    presentation,
    portfolio_url,
    contact_info,
    status
  ) VALUES (
    v_opening.scan_id,
    p_opening_id,
    v_opening.position_id,
    v_uid,
    coalesce(trim(p_experience), ''),
    coalesce(trim(p_availability), ''),
    coalesce(trim(p_presentation), ''),
    v_clean_url,
    coalesce(trim(p_contact_info), ''),
    'PENDING'
  ) RETURNING id INTO v_app_id;

  SELECT coalesce(display_name, username) INTO v_user_name FROM public.members WHERE id = v_uid;

  INSERT INTO public.scan_activity (scan_id, user_id, action, details)
  VALUES (
    v_opening.scan_id,
    v_uid,
    'APPLICATION_RECEIVED',
    jsonb_build_object(
      'application_id', v_app_id,
      'opening_id', p_opening_id,
      'position_name', v_opening.position_name,
      'applicant_name', v_user_name
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_app_id,
    'scan_name', v_opening.scan_name,
    'position_name', v_opening.position_name
  );
END;
$$;

-- 11. RPC: REVIEW SCAN APPLICATION
CREATE OR REPLACE FUNCTION public.review_scan_application(
  p_application_id uuid,
  p_action text,
  p_notes text DEFAULT NULL,
  p_add_to_team boolean DEFAULT false,
  p_initial_role text DEFAULT 'MEMBER'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_app record;
  v_new_status text;
  v_reviewer_name text;
  v_applicant_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  SELECT a.*, p.name as position_name
  INTO v_app
  FROM public.scan_applications a
  JOIN public.scan_positions p ON p.id = a.position_id
  WHERE a.id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidatura não encontrada';
  END IF;

  IF NOT public.can_manage_scan_recruitment(v_app.scan_id, v_uid) THEN
    RAISE EXCEPTION 'Permissão negada. Apenas Líderes e Administradores da scan podem avaliar candidaturas' USING errcode = '42501';
  END IF;

  IF p_action = 'APPROVE' THEN
    v_new_status := 'APPROVED';
  ELSIF p_action = 'REJECT' THEN
    v_new_status := 'REJECTED';
  ELSIF p_action = 'UNDER_REVIEW' THEN
    v_new_status := 'UNDER_REVIEW';
  ELSE
    RAISE EXCEPTION 'Ação inválida. Use APPROVE, REJECT ou UNDER_REVIEW';
  END IF;

  UPDATE public.scan_applications
  SET
    status = v_new_status,
    internal_notes = coalesce(p_notes, internal_notes),
    reviewed_by = v_uid,
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_application_id;

  SELECT coalesce(display_name, username) INTO v_reviewer_name FROM public.members WHERE id = v_uid;
  SELECT coalesce(display_name, username) INTO v_applicant_name FROM public.members WHERE id = v_app.user_id;

  -- Add to team if approved and requested
  IF v_new_status = 'APPROVED' AND p_add_to_team THEN
    IF p_initial_role NOT IN ('MEMBER', 'UPLOADER', 'ADMIN') THEN
      RAISE EXCEPTION 'Cargo de membro inicial inválido. Use MEMBER, UPLOADER ou ADMIN';
    END IF;

    -- Add or update member role (guaranteed NEVER OWNER)
    INSERT INTO public.scan_members (scan_id, user_id, role)
    VALUES (v_app.scan_id, v_app.user_id, p_initial_role)
    ON CONFLICT (scan_id, user_id) DO UPDATE
      SET role = CASE WHEN public.scan_members.role = 'OWNER' THEN 'OWNER' ELSE excluded.role END;

    -- Assign position to member
    INSERT INTO public.scan_member_positions (scan_id, user_id, position_id, is_primary)
    VALUES (v_app.scan_id, v_app.user_id, v_app.position_id, true)
    ON CONFLICT (scan_id, user_id, position_id) DO NOTHING;

    INSERT INTO public.scan_activity (scan_id, user_id, action, details)
    VALUES (
      v_app.scan_id,
      v_uid,
      'MEMBER_ADDED',
      jsonb_build_object(
        'user_id', v_app.user_id,
        'user_name', v_applicant_name,
        'role', p_initial_role,
        'position_name', v_app.position_name,
        'approved_by', v_reviewer_name
      )
    );
  END IF;

  INSERT INTO public.scan_activity (scan_id, user_id, action, details)
  VALUES (
    v_app.scan_id,
    v_uid,
    'APPLICATION_STATUS',
    jsonb_build_object(
      'application_id', p_application_id,
      'status', v_new_status,
      'applicant_name', v_applicant_name,
      'reviewed_by', v_reviewer_name
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', v_new_status,
    'added_to_team', (v_new_status = 'APPROVED' AND p_add_to_team)
  );
END;
$$;

-- 12. RPC: ASSIGN MEMBER POSITION
CREATE OR REPLACE FUNCTION public.assign_scan_member_position(
  p_scan_id uuid,
  p_user_id uuid,
  p_position_id uuid,
  p_is_primary boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pos_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  IF NOT public.can_manage_scan_members(p_scan_id, v_uid) THEN
    RAISE EXCEPTION 'Permissão negada para gerenciar posições da equipe' USING errcode = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = p_scan_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'O usuário precisa ser membro da scan para receber uma posição';
  END IF;

  SELECT name INTO v_pos_name FROM public.scan_positions WHERE id = p_position_id AND scan_id = p_scan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Posição não encontrada nesta scan';
  END IF;

  IF p_is_primary THEN
    UPDATE public.scan_member_positions
    SET is_primary = false
    WHERE scan_id = p_scan_id AND user_id = p_user_id;
  END IF;

  INSERT INTO public.scan_member_positions (scan_id, user_id, position_id, is_primary)
  VALUES (p_scan_id, p_user_id, p_position_id, p_is_primary)
  ON CONFLICT (scan_id, user_id, position_id) DO UPDATE
    SET is_primary = excluded.is_primary;

  RETURN jsonb_build_object('success', true, 'position_name', v_pos_name);
END;
$$;

-- 13. RPC: REMOVE MEMBER POSITION
CREATE OR REPLACE FUNCTION public.remove_scan_member_position(
  p_scan_id uuid,
  p_user_id uuid,
  p_position_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_was_primary boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  IF NOT public.can_manage_scan_members(p_scan_id, v_uid) THEN
    RAISE EXCEPTION 'Permissão negada' USING errcode = '42501';
  END IF;

  SELECT is_primary INTO v_was_primary
  FROM public.scan_member_positions
  WHERE scan_id = p_scan_id AND user_id = p_user_id AND position_id = p_position_id;

  DELETE FROM public.scan_member_positions
  WHERE scan_id = p_scan_id AND user_id = p_user_id AND position_id = p_position_id;

  -- If was primary, promote another position to primary if one exists
  IF coalesce(v_was_primary, false) THEN
    UPDATE public.scan_member_positions
    SET is_primary = true
    WHERE id = (
      SELECT id FROM public.scan_member_positions
      WHERE scan_id = p_scan_id AND user_id = p_user_id
      ORDER BY created_at ASC
      LIMIT 1
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 14. RPC: SET PRIMARY POSITION
CREATE OR REPLACE FUNCTION public.set_primary_scan_position(
  p_scan_id uuid,
  p_user_id uuid,
  p_position_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  IF v_uid != p_user_id AND NOT public.can_manage_scan_members(p_scan_id, v_uid) THEN
    RAISE EXCEPTION 'Permissão negada' USING errcode = '42501';
  END IF;

  UPDATE public.scan_member_positions
  SET is_primary = false
  WHERE scan_id = p_scan_id AND user_id = p_user_id;

  UPDATE public.scan_member_positions
  SET is_primary = true
  WHERE scan_id = p_scan_id AND user_id = p_user_id AND position_id = p_position_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 15. RPC: MANAGE SCAN POSITION (Create / Edit Position)
CREATE OR REPLACE FUNCTION public.manage_scan_position(
  p_scan_id uuid,
  p_position_id uuid DEFAULT NULL,
  p_name text DEFAULT '',
  p_description text DEFAULT '',
  p_display_order integer DEFAULT 0,
  p_is_active boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clean_name text := trim(p_name);
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  IF NOT public.can_manage_scan_recruitment(p_scan_id, v_uid) THEN
    RAISE EXCEPTION 'Permissão negada' USING errcode = '42501';
  END IF;

  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'O nome do cargo não pode ser vazio';
  END IF;

  -- Block forged site-wide roles
  IF v_clean_name ~* '^(admin|administrador|dono|moderador|staff|suporte)(\s+do\s+site|\s+global)?$' THEN
    RAISE EXCEPTION 'Nome de cargo reservado. Não é permitido criar cargos que simulem administração do site';
  END IF;

  IF p_position_id IS NULL THEN
    INSERT INTO public.scan_positions (scan_id, name, description, display_order, is_active)
    VALUES (p_scan_id, v_clean_name, trim(p_description), p_display_order, p_is_active)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.scan_positions
    SET
      name = v_clean_name,
      description = trim(p_description),
      display_order = p_display_order,
      is_active = p_is_active
    WHERE id = p_position_id AND scan_id = p_scan_id
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'position_id', v_id, 'name', v_clean_name);
END;
$$;

-- 16. RPC: MANAGE SCAN OPENING (Create / Edit Opening)
CREATE OR REPLACE FUNCTION public.manage_scan_opening(
  p_scan_id uuid,
  p_opening_id uuid DEFAULT NULL,
  p_position_id uuid DEFAULT NULL,
  p_title text DEFAULT '',
  p_description text DEFAULT '',
  p_requirements text DEFAULT '',
  p_language text DEFAULT 'pt-BR',
  p_experience_level text DEFAULT 'QUALQUER',
  p_availability text DEFAULT '',
  p_slots integer DEFAULT NULL,
  p_notes text DEFAULT '',
  p_status text DEFAULT 'OPEN'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_pos_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  IF NOT public.can_manage_scan_recruitment(p_scan_id, v_uid) THEN
    RAISE EXCEPTION 'Permissão negada' USING errcode = '42501';
  END IF;

  IF p_status NOT IN ('OPEN', 'PAUSED', 'CLOSED') THEN
    RAISE EXCEPTION 'Status de vaga inválido';
  END IF;

  SELECT name INTO v_pos_name FROM public.scan_positions WHERE id = p_position_id AND scan_id = p_scan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cargo não encontrado nesta scan';
  END IF;

  IF p_opening_id IS NULL THEN
    INSERT INTO public.scan_recruitment_openings (
      scan_id,
      position_id,
      title,
      description,
      requirements,
      language,
      experience_level,
      availability,
      slots,
      notes,
      status
    ) VALUES (
      p_scan_id,
      p_position_id,
      coalesce(nullif(trim(p_title), ''), v_pos_name),
      coalesce(trim(p_description), ''),
      coalesce(trim(p_requirements), ''),
      coalesce(trim(p_language), 'pt-BR'),
      coalesce(trim(p_experience_level), 'QUALQUER'),
      coalesce(trim(p_availability), ''),
      p_slots,
      coalesce(trim(p_notes), ''),
      p_status
    ) RETURNING id INTO v_id;

    INSERT INTO public.scan_activity (scan_id, user_id, action, details)
    VALUES (
      p_scan_id,
      v_uid,
      'OPENING_CREATED',
      jsonb_build_object('opening_id', v_id, 'position_name', v_pos_name, 'title', p_title)
    );
  ELSE
    UPDATE public.scan_recruitment_openings
    SET
      position_id = p_position_id,
      title = coalesce(nullif(trim(p_title), ''), v_pos_name),
      description = coalesce(trim(p_description), ''),
      requirements = coalesce(trim(p_requirements), ''),
      language = coalesce(trim(p_language), 'pt-BR'),
      experience_level = coalesce(trim(p_experience_level), 'QUALQUER'),
      availability = coalesce(trim(p_availability), ''),
      slots = p_slots,
      notes = coalesce(trim(p_notes), ''),
      status = p_status,
      updated_at = now()
    WHERE id = p_opening_id AND scan_id = p_scan_id
    RETURNING id INTO v_id;

    INSERT INTO public.scan_activity (scan_id, user_id, action, details)
    VALUES (
      p_scan_id,
      v_uid,
      'OPENING_UPDATED',
      jsonb_build_object('opening_id', v_id, 'status', p_status)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'opening_id', v_id, 'status', p_status);
END;
$$;

-- Grant execute on new RPCs
GRANT EXECUTE ON FUNCTION public.can_manage_scan_recruitment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_scan_default_positions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_for_scan_opening(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_scan_application(uuid, text, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_scan_member_position(uuid, uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_scan_member_position(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_primary_scan_position(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_scan_position(uuid, uuid, text, text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_scan_opening(uuid, uuid, uuid, text, text, text, text, text, text, integer, text, text) TO authenticated;

COMMIT;
