-- Migration: 20260910110000_scans_roles_transfers_and_cosmetics_cleanup.sql
-- Description: Align scan roles, implement 2-step ownership transfer handshake, project status management,
--              cancellation of pending requests, and clean separation of shop cosmetics vs free profile banners.

BEGIN;

-- 1. SCANS STATUS: ADD SUSPENDED, ARCHIVED, CLOSED
ALTER TABLE public.scans DROP CONSTRAINT IF EXISTS scans_status_check;
ALTER TABLE public.scans ADD CONSTRAINT scans_status_check
  CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING', 'REJECTED', 'SUSPENDED', 'ARCHIVED', 'CLOSED'));

-- 2. WORK_SCANS STATUS: ACTIVE, PAUSED, COMPLETED, ABANDONED
ALTER TABLE public.work_scans
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE'
  CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED'));

-- 3. SCAN PROJECT & PARTNER REQUESTS: ALLOW 'CANCELLED' STATUS
ALTER TABLE public.scan_partner_requests DROP CONSTRAINT IF EXISTS scan_partner_requests_status_check;
ALTER TABLE public.scan_partner_requests ADD CONSTRAINT scan_partner_requests_status_check
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'));

ALTER TABLE public.scan_project_requests DROP CONSTRAINT IF EXISTS scan_project_requests_status_check;
ALTER TABLE public.scan_project_requests ADD CONSTRAINT scan_project_requests_status_check
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'));

-- 4. CLEANUP SHOP COSMETICS: PROFILE_BANNER IS NOT A SHOP ITEM (Free user upload)
-- Migrate existing PROFILE_BANNER shop items to COMMENT_BANNER
UPDATE public.shop_items
SET kind = 'COMMENT_BANNER'
WHERE kind = 'PROFILE_BANNER';

-- Ensure shop_items kind check only permits true store cosmetics
ALTER TABLE public.shop_items DROP CONSTRAINT IF EXISTS shop_items_kind_check;
ALTER TABLE public.shop_items ADD CONSTRAINT shop_items_kind_check
  CHECK (kind IN ('AVATAR_FRAME', 'COMMENT_BANNER', 'NAME_COLOR', 'TITLE', 'BADGE'));

-- 5. SCAN OWNERSHIP TRANSFER REQUESTS (2-step handshake: request -> accept/decline)
CREATE TABLE IF NOT EXISTS public.scan_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_scan_transfer_requests_scan ON public.scan_transfer_requests(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_transfer_requests_to_user ON public.scan_transfer_requests(to_user_id);

ALTER TABLE public.scan_transfer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scan_transfer_requests_select ON public.scan_transfer_requests;
CREATE POLICY scan_transfer_requests_select ON public.scan_transfer_requests
  FOR SELECT TO authenticated
  USING (
    from_user_id = auth.uid()
    OR to_user_id = auth.uid()
    OR public.can_manage_scan_members(scan_id, auth.uid())
    OR public.is_editor()
  );

DROP POLICY IF EXISTS scan_transfer_requests_manage ON public.scan_transfer_requests;
CREATE POLICY scan_transfer_requests_manage ON public.scan_transfer_requests
  FOR ALL TO authenticated
  USING (
    from_user_id = auth.uid()
    OR to_user_id = auth.uid()
    OR public.is_editor()
  )
  WITH CHECK (
    from_user_id = auth.uid()
    OR to_user_id = auth.uid()
    OR public.is_editor()
  );

GRANT ALL ON public.scan_transfer_requests TO authenticated;

-- RPC: Request Scan Ownership Transfer (Owner -> Candidate)
CREATE OR REPLACE FUNCTION public.request_scan_ownership_transfer(
  p_scan_id uuid,
  p_target_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_owner boolean;
  v_request_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  IF v_uid = p_target_user_id THEN
    RAISE EXCEPTION 'Você já é o dono desta scan';
  END IF;

  -- Verify current caller is OWNER or platform ADMIN
  SELECT (role = 'OWNER') INTO v_is_owner
  FROM public.scan_members
  WHERE scan_id = p_scan_id AND user_id = v_uid;

  IF NOT coalesce(v_is_owner, false) AND NOT public.is_editor() THEN
    RAISE EXCEPTION 'Apenas o dono atual pode solicitar a transferência de posse' USING errcode = '42501';
  END IF;

  -- Target must already be a member of the scan
  IF NOT EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = p_scan_id AND user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'O novo dono precisa ser membro da scan antes da transferência';
  END IF;

  -- Cancel any previous pending transfer requests for this scan
  UPDATE public.scan_transfer_requests
  SET status = 'CANCELLED', responded_at = now()
  WHERE scan_id = p_scan_id AND status = 'PENDING';

  INSERT INTO public.scan_transfer_requests(scan_id, from_user_id, to_user_id, status)
  VALUES (p_scan_id, v_uid, p_target_user_id, 'PENDING')
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'scan_id', p_scan_id,
    'to_user_id', p_target_user_id
  );
END;
$$;

-- RPC: Respond to Scan Ownership Transfer (Candidate accepts or rejects)
CREATE OR REPLACE FUNCTION public.respond_scan_ownership_transfer(
  p_request_id uuid,
  p_accept boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.scan_transfer_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de transferência não encontrada';
  END IF;

  IF v_req.to_user_id != v_uid THEN
    RAISE EXCEPTION 'Apenas o membro indicado pode responder a esta transferência' USING errcode = '42501';
  END IF;

  IF v_req.status != 'PENDING' THEN
    RAISE EXCEPTION 'Esta solicitação já foi respondida ou cancelada';
  END IF;

  IF p_accept THEN
    -- Demote old owner to ADMIN
    UPDATE public.scan_members
    SET role = 'ADMIN'
    WHERE scan_id = v_req.scan_id AND user_id = v_req.from_user_id;

    -- Promote target to OWNER
    UPDATE public.scan_members
    SET role = 'OWNER'
    WHERE scan_id = v_req.scan_id AND user_id = v_req.to_user_id;

    UPDATE public.scan_transfer_requests
    SET status = 'ACCEPTED', responded_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'ACCEPTED');
  ELSE
    UPDATE public.scan_transfer_requests
    SET status = 'REJECTED', responded_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'REJECTED');
  END IF;
END;
$$;

-- RPC: Cancel Scan Ownership Transfer (Owner cancels pending request)
CREATE OR REPLACE FUNCTION public.cancel_scan_transfer_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.scan_transfer_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de transferência não encontrada';
  END IF;

  IF v_req.from_user_id != v_uid AND NOT public.is_editor() THEN
    RAISE EXCEPTION 'Permissão negada para cancelar esta transferência' USING errcode = '42501';
  END IF;

  IF v_req.status != 'PENDING' THEN
    RAISE EXCEPTION 'Esta solicitação não está mais pendente';
  END IF;

  UPDATE public.scan_transfer_requests
  SET status = 'CANCELLED', responded_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'status', 'CANCELLED');
END;
$$;

-- RPC: Cancel Scan Project Request (Applicant or Scan Manager can cancel without admin)
CREATE OR REPLACE FUNCTION public.cancel_scan_project_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.scan_project_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de projeto não encontrada';
  END IF;

  IF v_req.user_id != v_uid AND NOT public.can_manage_scan_works(v_req.scan_id, v_uid) AND NOT public.is_editor() THEN
    RAISE EXCEPTION 'Permissão negada para cancelar esta solicitação' USING errcode = '42501';
  END IF;

  IF v_req.status != 'PENDING' THEN
    RAISE EXCEPTION 'Apenas solicitações pendentes podem ser canceladas';
  END IF;

  UPDATE public.scan_project_requests
  SET status = 'CANCELLED', reviewed_at = now(), rejection_reason = 'Cancelado pela própria scan'
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'status', 'CANCELLED');
END;
$$;

-- RPC: Cancel Scan Partner Request (Applicant cancels pending application)
CREATE OR REPLACE FUNCTION public.cancel_scan_partner_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.scan_partner_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de parceria não encontrada';
  END IF;

  IF v_req.user_id != v_uid AND NOT public.is_editor() THEN
    RAISE EXCEPTION 'Permissão negada para cancelar esta solicitação' USING errcode = '42501';
  END IF;

  IF v_req.status != 'PENDING' THEN
    RAISE EXCEPTION 'Apenas pedidos pendentes podem ser cancelados';
  END IF;

  UPDATE public.scan_partner_requests
  SET status = 'CANCELLED', reviewed_at = now(), rejection_reason = 'Cancelado pelo solicitante'
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'status', 'CANCELLED');
END;
$$;

-- RPC: Update Work Scan Project Status (Scan Leader/Admin manages project state)
CREATE OR REPLACE FUNCTION public.update_work_scan_status(
  p_scan_id uuid,
  p_work_id uuid,
  p_status text
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

  IF NOT public.can_manage_scan_works(p_scan_id, v_uid) AND NOT public.is_editor() THEN
    RAISE EXCEPTION 'Permissão negada para alterar o status deste projeto' USING errcode = '42501';
  END IF;

  IF p_status NOT IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED') THEN
    RAISE EXCEPTION 'Status de projeto inválido';
  END IF;

  UPDATE public.work_scans
  SET status = p_status
  WHERE scan_id = p_scan_id AND work_id = p_work_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado nesta scan';
  END IF;

  RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;

-- Grants for authenticated users on new RPCs
GRANT EXECUTE ON FUNCTION public.request_scan_ownership_transfer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_scan_ownership_transfer(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_scan_transfer_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_scan_project_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_scan_partner_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_work_scan_status(uuid, uuid, text) TO authenticated;

COMMIT;
