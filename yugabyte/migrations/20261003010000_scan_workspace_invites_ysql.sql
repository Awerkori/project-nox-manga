-- Move Scan invite creation off the retired PostgREST RPC path.
-- The actor is passed explicitly because YSQL is reached through Hyperdrive.
CREATE OR REPLACE FUNCTION public.create_scan_invite_ysql(
  p_scan_id uuid,
  p_actor_id uuid,
  p_role text DEFAULT 'MEMBER',
  p_hours integer DEFAULT 24
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_invite_id uuid;
  v_expires timestamptz;
BEGIN
  IF p_scan_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'INVITE_ARGUMENT_INVALID' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.scan_members
    WHERE scan_id = p_scan_id AND user_id = p_actor_id AND role IN ('OWNER', 'ADMIN')
  ) THEN
    RAISE EXCEPTION 'INVITE_MANAGEMENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF p_role NOT IN ('ADMIN', 'UPLOADER', 'MEMBER') THEN
    RAISE EXCEPTION 'INVITE_ROLE_INVALID' USING ERRCODE = '22023';
  END IF;

  IF p_hours IS NULL OR p_hours < 1 OR p_hours > 720 THEN
    RAISE EXCEPTION 'INVITE_EXPIRY_INVALID' USING ERRCODE = '22023';
  END IF;

  v_code := encode(gen_random_bytes(16), 'hex');
  v_expires := now() + make_interval(hours => p_hours);

  INSERT INTO public.scan_invites (scan_id, code, role, created_by, expires_at)
  VALUES (p_scan_id, v_code, p_role, p_actor_id, v_expires)
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object(
    'id', v_invite_id,
    'code', v_code,
    'role', p_role,
    'expires_at', v_expires
  );
END;
$$;
