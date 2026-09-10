-- Migration: 20260910090000_media_purposes_privacy_and_scan_ecosystem.sql
-- Description: Expand media purposes, remove arbitrary avatar/banner limits, add profile privacy fields,
--              grant member update RLS, and implement full Scans partner requests, invites, project requests.

BEGIN;

-- 1. EXPAND MEDIA CONSTRAINTS AND PURPOSES
ALTER TABLE public.media DROP CONSTRAINT IF EXISTS media_purpose_check;
ALTER TABLE public.media ADD CONSTRAINT media_purpose_check CHECK (
  purpose IN ('editorial', 'avatar', 'banner', 'profile_banner', 'comment_banner', 'scan_logo', 'scan_banner', 'cosmetic')
);

ALTER TABLE public.media DROP CONSTRAINT IF EXISTS media_bytes_check;
ALTER TABLE public.media ADD CONSTRAINT media_bytes_check CHECK (
  bytes BETWEEN 1 AND 52428800
);

ALTER TABLE public.media DROP CONSTRAINT IF EXISTS media_height_check;
ALTER TABLE public.media ADD CONSTRAINT media_height_check CHECK (
  height BETWEEN 1 AND 60000
);

UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'nox-media';

-- 2. REPLACE reserve_media TO REMOVE 300KB/512x512 LIMITS AND AUTHORIZE UPLOADS PROPERLY
CREATE OR REPLACE FUNCTION public.reserve_media(
  p_id uuid,
  p_user uuid,
  p_provider text,
  p_mime text,
  p_width integer,
  p_height integer,
  p_bytes integer,
  p_sha256 text,
  p_purpose text DEFAULT 'editorial'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(547291046);

  -- Verification of authorization
  IF NOT EXISTS (
    SELECT 1 FROM public.access_roles a
    JOIN auth.users u ON u.id = a.user_id
    WHERE a.user_id = p_user
      AND NOT a.suspended
      AND u.email_confirmed_at IS NOT NULL
      AND (
        a.role IN ('EDITOR', 'ADMIN')
        OR p_purpose IN ('avatar', 'banner', 'profile_banner', 'comment_banner')
        OR (
          p_purpose IN ('scan_logo', 'scan_banner')
          AND EXISTS (
            SELECT 1 FROM public.scan_members sm
            WHERE sm.user_id = p_user
              AND sm.role IN ('OWNER', 'ADMIN', 'UPLOADER')
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Upload não autorizado' USING errcode = '42501';
  END IF;

  -- Hourly rate limit
  IF (
    SELECT count(*) FROM public.media
    WHERE created_by = p_user
      AND created_at > now() - interval '1 hour'
  ) >= (
    CASE
      WHEN p_purpose IN ('avatar', 'banner', 'profile_banner', 'comment_banner') THEN 60
      WHEN EXISTS (SELECT 1 FROM public.access_roles WHERE user_id = p_user AND role = 'ADMIN') THEN 20000
      ELSE 3000
    END
  ) THEN
    RAISE EXCEPTION 'Limite de uploads por hora atingido';
  END IF;

  -- Free storage cap for supabase provider (2 GB pool limit)
  IF p_provider = 'supabase' AND (
    SELECT coalesce(sum(bytes), 0) FROM public.media WHERE provider = 'supabase'
  ) + p_bytes > 2000000000 THEN
    RAISE EXCEPTION 'A reserva de armazenamento gratuito foi atingida';
  END IF;

  INSERT INTO public.media(
    id, provider, provider_key, mime, width, height, bytes, sha256, created_by, storage_ready, purpose
  ) VALUES (
    p_id, p_provider, p_id::text, p_mime, p_width, p_height, p_bytes, p_sha256, p_user, false, p_purpose
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_media(uuid,uuid,text,text,integer,integer,integer,text,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_media(uuid,uuid,text,text,integer,integer,integer,text,text) TO service_role;

-- 3. MEMBERS TABLE ENHANCEMENTS: PRIVACY FIELDS, RLS POLICY, UPDATE GRANTS
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS privacy_show_favorites boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS privacy_show_reading_history boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS members_update_self ON public.members;
CREATE POLICY members_update_self ON public.members
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

GRANT UPDATE (
  display_name,
  bio,
  blur_nsfw,
  privacy_show_achievements,
  privacy_show_cosmetics,
  privacy_show_favorites,
  privacy_show_reading_history,
  avatar_id,
  banner_id,
  banner_position
) ON public.members TO authenticated;

GRANT SELECT (privacy_show_favorites, privacy_show_reading_history) ON public.members TO anon, authenticated;

-- 4. SCAN INVITES TABLE & FUNCTIONS
CREATE TABLE IF NOT EXISTS public.scan_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('ADMIN', 'UPLOADER', 'MEMBER')),
  created_by uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz DEFAULT NULL,
  used_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_invites_scan ON public.scan_invites(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_invites_code ON public.scan_invites(code);

ALTER TABLE public.scan_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scan_invites_select ON public.scan_invites;
CREATE POLICY scan_invites_select ON public.scan_invites
  FOR SELECT TO authenticated
  USING (
    public.can_manage_scan_members(scan_id, auth.uid())
    OR used_by = auth.uid()
    OR (NOT revoked AND expires_at > now() AND used_at IS NULL)
  );

DROP POLICY IF EXISTS scan_invites_manage ON public.scan_invites;
CREATE POLICY scan_invites_manage ON public.scan_invites
  FOR ALL TO authenticated
  USING (public.can_manage_scan_members(scan_id, auth.uid()))
  WITH CHECK (public.can_manage_scan_members(scan_id, auth.uid()));

GRANT ALL ON public.scan_invites TO authenticated;

-- RPC: Create single-use invite
CREATE OR REPLACE FUNCTION public.create_scan_invite(
  p_scan_id uuid,
  p_role text DEFAULT 'MEMBER',
  p_hours integer DEFAULT 24
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_invite_id uuid;
  v_expires timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  IF NOT public.can_manage_scan_members(p_scan_id, v_uid) THEN
    RAISE EXCEPTION 'Permissão negada para gerar convites desta scan' USING errcode = '42501';
  END IF;

  IF p_role NOT IN ('ADMIN', 'UPLOADER', 'MEMBER') THEN
    RAISE EXCEPTION 'Cargo de convite inválido';
  END IF;

  v_code := encode(gen_random_bytes(16), 'hex');
  v_expires := now() + (p_hours || ' hours')::interval;

  INSERT INTO public.scan_invites(scan_id, code, role, created_by, expires_at)
  VALUES (p_scan_id, v_code, p_role, v_uid, v_expires)
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object(
    'id', v_invite_id,
    'code', v_code,
    'role', p_role,
    'expires_at', v_expires
  );
END;
$$;

-- RPC: Claim single-use invite
CREATE OR REPLACE FUNCTION public.claim_scan_invite(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv record;
  v_scan record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar conectado para aceitar um convite' USING errcode = '42501';
  END IF;

  -- Lock invite row to strictly avoid race conditions
  SELECT * INTO v_inv
  FROM public.scan_invites
  WHERE code = trim(p_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido ou não encontrado';
  END IF;

  IF v_inv.revoked THEN
    RAISE EXCEPTION 'Este convite foi revogado pela scan';
  END IF;

  IF v_inv.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este convite já foi utilizado';
  END IF;

  IF v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'Este convite expirou';
  END IF;

  SELECT * INTO v_scan FROM public.scans WHERE id = v_inv.scan_id;
  IF NOT FOUND OR v_scan.status != 'ACTIVE' THEN
    RAISE EXCEPTION 'A scan associada não está ativa';
  END IF;

  -- Check if user is already a member
  IF EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = v_inv.scan_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'Você já é membro desta scan';
  END IF;

  -- Insert member
  INSERT INTO public.scan_members (scan_id, user_id, role)
  VALUES (v_inv.scan_id, v_uid, v_inv.role);

  -- Mark invite as used
  UPDATE public.scan_invites
  SET used_at = now(), used_by = v_uid
  WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'success', true,
    'scan_id', v_inv.scan_id,
    'scan_name', v_scan.name,
    'role', v_inv.role
  );
END;
$$;

-- RPC: Transfer ownership
CREATE OR REPLACE FUNCTION public.transfer_scan_ownership(p_scan_id uuid, p_new_owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_owner boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  -- Verify current caller is OWNER or platform ADMIN
  SELECT (role = 'OWNER') INTO v_is_owner
  FROM public.scan_members
  WHERE scan_id = p_scan_id AND user_id = v_uid;

  IF NOT coalesce(v_is_owner, false) AND NOT public.is_editor() THEN
    RAISE EXCEPTION 'Apenas o líder atual ou um administrador do site pode transferir a propriedade da scan';
  END IF;

  -- Verify target user is an existing member
  IF NOT EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = p_scan_id AND user_id = p_new_owner_id) THEN
    RAISE EXCEPTION 'O novo líder deve ser membro atual da scan';
  END IF;

  -- Demote current owner to ADMIN
  UPDATE public.scan_members
  SET role = 'ADMIN'
  WHERE scan_id = p_scan_id AND role = 'OWNER';

  -- Promote new owner
  UPDATE public.scan_members
  SET role = 'OWNER'
  WHERE scan_id = p_scan_id AND user_id = p_new_owner_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. SCAN PARTNER REQUESTS & PROJECT REQUESTS
CREATE TABLE IF NOT EXISTS public.scan_partner_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  scan_name text NOT NULL,
  scan_slug text NOT NULL,
  description text DEFAULT '',
  discord text DEFAULT '',
  fluxer text DEFAULT '',
  website text DEFAULT '',
  sample_links text DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  reviewed_at timestamptz DEFAULT NULL,
  rejection_reason text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scan_project_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  message text DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  reviewed_at timestamptz DEFAULT NULL,
  rejection_reason text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scan_partner_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_project_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY scan_partner_requests_user ON public.scan_partner_requests
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_editor())
  WITH CHECK (user_id = auth.uid() OR public.is_editor());

CREATE POLICY scan_project_requests_scan ON public.scan_project_requests
  FOR ALL TO authenticated
  USING (public.can_manage_scan_works(scan_id, auth.uid()) OR public.is_editor())
  WITH CHECK (public.can_manage_scan_works(scan_id, auth.uid()) OR public.is_editor());

GRANT ALL ON public.scan_partner_requests TO authenticated;
GRANT ALL ON public.scan_project_requests TO authenticated;

-- RPC: Review Scan Partner Request
CREATE OR REPLACE FUNCTION public.review_scan_partner_request(
  p_request_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req record;
  v_scan_id uuid;
BEGIN
  IF NOT public.is_editor() THEN
    RAISE EXCEPTION 'Permissão negada. Apenas a administração do site pode avaliar pedidos de parceria' USING errcode = '42501';
  END IF;

  SELECT * INTO v_req FROM public.scan_partner_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF v_req.status != 'PENDING' THEN
    RAISE EXCEPTION 'Esta solicitação já foi analisada';
  END IF;

  IF p_action = 'APPROVE' THEN
    INSERT INTO public.scans (name, slug, description, discord, fluxer, website, status, is_official)
    VALUES (v_req.scan_name, v_req.scan_slug, v_req.description, v_req.discord, v_req.fluxer, v_req.website, 'ACTIVE', false)
    ON CONFLICT (slug) DO UPDATE
      SET status = 'ACTIVE', description = excluded.description
    RETURNING id INTO v_scan_id;

    -- Assign requester as OWNER
    INSERT INTO public.scan_members (scan_id, user_id, role)
    VALUES (v_scan_id, v_req.user_id, 'OWNER')
    ON CONFLICT (scan_id, user_id) DO UPDATE SET role = 'OWNER';

    UPDATE public.scan_partner_requests
    SET status = 'APPROVED', reviewed_by = v_uid, reviewed_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'APPROVED', 'scan_id', v_scan_id);
  ELSIF p_action = 'REJECT' THEN
    UPDATE public.scan_partner_requests
    SET status = 'REJECTED', reviewed_by = v_uid, reviewed_at = now(), rejection_reason = p_reason
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'REJECTED');
  ELSE
    RAISE EXCEPTION 'Ação inválida. Use APPROVE ou REJECT.';
  END IF;
END;
$$;

-- RPC: Review Scan Project Request
CREATE OR REPLACE FUNCTION public.review_scan_project_request(
  p_request_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req record;
BEGIN
  IF NOT public.is_editor() THEN
    RAISE EXCEPTION 'Permissão negada. Apenas a administração do site pode avaliar pedidos de projeto' USING errcode = '42501';
  END IF;

  SELECT * INTO v_req FROM public.scan_project_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de projeto não encontrada';
  END IF;

  IF v_req.status != 'PENDING' THEN
    RAISE EXCEPTION 'Esta solicitação já foi analisada';
  END IF;

  IF p_action = 'APPROVE' THEN
    INSERT INTO public.work_scans (work_id, scan_id, is_primary)
    VALUES (v_req.work_id, v_req.scan_id, false)
    ON CONFLICT (work_id, scan_id) DO NOTHING;

    UPDATE public.scan_project_requests
    SET status = 'APPROVED', reviewed_by = v_uid, reviewed_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'APPROVED');
  ELSIF p_action = 'REJECT' THEN
    UPDATE public.scan_project_requests
    SET status = 'REJECTED', reviewed_by = v_uid, reviewed_at = now(), rejection_reason = p_reason
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'REJECTED');
  ELSE
    RAISE EXCEPTION 'Ação inválida. Use APPROVE ou REJECT.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_scan_invite(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_scan_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_scan_ownership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_scan_partner_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_scan_project_request(uuid, text, text) TO authenticated;

COMMIT;
