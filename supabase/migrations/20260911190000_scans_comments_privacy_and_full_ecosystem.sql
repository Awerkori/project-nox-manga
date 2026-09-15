-- Migration: 20260911190000_scans_comments_privacy_and_full_ecosystem.sql
-- Description: Adds scan comments (public), scan staff notes (private mural),
--              privacy and moderation controls for profile badges, and associated RPCs.

BEGIN;

-- 1. PRIVACY & MODERATION COLUMNS ON MEMBERS
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS privacy_show_scans boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS privacy_scan_mode text NOT NULL DEFAULT 'PRIMARY'
    CHECK (privacy_scan_mode IN ('PRIMARY', 'ALL', 'NONE')),
  ADD COLUMN IF NOT EXISTS admin_hide_scan_badges boolean NOT NULL DEFAULT false;

-- 2. PRIVACY & MODERATION COLUMNS ON SCAN_MEMBERS
ALTER TABLE public.scan_members
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hidden_by_admin boolean NOT NULL DEFAULT false;

-- 3. PRIVACY & MODERATION COLUMNS ON SCAN_MEMBER_POSITIONS
ALTER TABLE public.scan_member_positions
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hidden_by_admin boolean NOT NULL DEFAULT false;

-- 4. HELPER FUNCTION: IS_SCAN_MEMBER
CREATE OR REPLACE FUNCTION public.is_scan_member(p_scan_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.scan_members
    WHERE scan_id = p_scan_id AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_scan_member(uuid, uuid) TO anon, authenticated;

-- 5. PUBLIC SCAN COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.scan_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.scan_comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  removed boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_comments_scan ON public.scan_comments(scan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_comments_parent ON public.scan_comments(parent_id);

-- 6. PUBLIC SCAN COMMENT LIKES TABLE
CREATE TABLE IF NOT EXISTS public.scan_comment_likes (
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES public.scan_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_scan_comment_likes_comment ON public.scan_comment_likes(comment_id);

-- 7. PUBLIC SCAN COMMENT REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.scan_comment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.scan_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 2 AND 500),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_comment_reports_comment ON public.scan_comment_reports(comment_id, status);

-- 8. PRIVATE SCAN STAFF NOTES (Mural Interno da Staff)
CREATE TABLE IF NOT EXISTS public.scan_staff_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.scan_staff_notes(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_staff_notes_scan ON public.scan_staff_notes(scan_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_staff_notes_parent ON public.scan_staff_notes(parent_id);

-- 9. ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS
ALTER TABLE public.scan_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_comment_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_staff_notes ENABLE ROW LEVEL SECURITY;

-- scan_comments RLS
CREATE POLICY scan_comments_select ON public.scan_comments
  FOR SELECT TO anon, authenticated
  USING (
    removed = false
    OR user_id = auth.uid()
    OR public.can_manage_scan_members(scan_id, auth.uid())
    OR public.is_editor()
  );

CREATE POLICY scan_comments_insert ON public.scan_comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY scan_comments_update ON public.scan_comments
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_manage_scan_members(scan_id, auth.uid())
    OR public.is_editor()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.can_manage_scan_members(scan_id, auth.uid())
    OR public.is_editor()
  );

CREATE POLICY scan_comments_delete ON public.scan_comments
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_manage_scan_members(scan_id, auth.uid())
    OR public.is_editor()
  );

-- scan_comment_likes RLS
CREATE POLICY scan_comment_likes_select ON public.scan_comment_likes
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY scan_comment_likes_insert ON public.scan_comment_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY scan_comment_likes_delete ON public.scan_comment_likes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- scan_comment_reports RLS
CREATE POLICY scan_comment_reports_select ON public.scan_comment_reports
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_editor()
    OR EXISTS (
      SELECT 1 FROM public.scan_comments sc
      WHERE sc.id = comment_id AND public.can_manage_scan_members(sc.scan_id, auth.uid())
    )
  );

CREATE POLICY scan_comment_reports_insert ON public.scan_comment_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- scan_staff_notes RLS (STRICT ISOLATION: ONLY MEMBERS OF THIS SCAN OR GLOBAL ADMIN)
CREATE POLICY scan_staff_notes_select ON public.scan_staff_notes
  FOR SELECT TO authenticated
  USING (
    public.is_scan_member(scan_id, auth.uid())
    OR public.is_editor()
  );

CREATE POLICY scan_staff_notes_insert ON public.scan_staff_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_scan_member(scan_id, auth.uid()) OR public.is_editor())
    AND user_id = auth.uid()
  );

CREATE POLICY scan_staff_notes_update ON public.scan_staff_notes
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_manage_scan_members(scan_id, auth.uid())
    OR public.is_editor()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.can_manage_scan_members(scan_id, auth.uid())
    OR public.is_editor()
  );

CREATE POLICY scan_staff_notes_delete ON public.scan_staff_notes
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_manage_scan_members(scan_id, auth.uid())
    OR public.is_editor()
  );

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_comments TO authenticated;
GRANT SELECT ON public.scan_comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.scan_comment_likes TO authenticated;
GRANT SELECT ON public.scan_comment_likes TO anon;
GRANT SELECT, INSERT ON public.scan_comment_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_staff_notes TO authenticated;

-- 10. RPC: POST PUBLIC SCAN COMMENT
CREATE OR REPLACE FUNCTION public.post_scan_comment(
  p_scan_id uuid,
  p_body text,
  p_parent_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_clean text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  v_clean := trim(p_body);
  IF length(v_clean) < 1 OR length(v_clean) > 2000 THEN
    RAISE EXCEPTION 'Comentário deve ter entre 1 e 2000 caracteres';
  END IF;

  IF p_parent_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.scan_comments WHERE id = p_parent_id AND scan_id = p_scan_id) THEN
      RAISE EXCEPTION 'Comentário pai não encontrado nesta scan';
    END IF;
  END IF;

  INSERT INTO public.scan_comments (scan_id, user_id, parent_id, body)
  VALUES (p_scan_id, v_uid, p_parent_id, v_clean)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'comment_id', v_id);
END;
$$;

-- 11. RPC: LIKE / UNLIKE SCAN COMMENT
CREATE OR REPLACE FUNCTION public.like_scan_comment(p_comment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_liked boolean;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.scan_comment_likes WHERE user_id = v_uid AND comment_id = p_comment_id) THEN
    DELETE FROM public.scan_comment_likes WHERE user_id = v_uid AND comment_id = p_comment_id;
    v_liked := false;
  ELSE
    INSERT INTO public.scan_comment_likes (user_id, comment_id)
    VALUES (v_uid, p_comment_id);
    v_liked := true;
  END IF;

  SELECT count(*)::integer INTO v_count FROM public.scan_comment_likes WHERE comment_id = p_comment_id;

  RETURN jsonb_build_object('success', true, 'liked', v_liked, 'likes_count', v_count);
END;
$$;

-- 12. RPC: MODERATE SCAN COMMENT (Remove, restore, pin, unpin)
CREATE OR REPLACE FUNCTION public.moderate_scan_comment(
  p_comment_id uuid,
  p_action text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_comment record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  SELECT * INTO v_comment FROM public.scan_comments WHERE id = p_comment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comentário não encontrado';
  END IF;

  IF NOT public.can_manage_scan_members(v_comment.scan_id, v_uid) AND NOT public.is_editor() THEN
    RAISE EXCEPTION 'Permissão negada' USING errcode = '42501';
  END IF;

  IF p_action = 'REMOVE' THEN
    UPDATE public.scan_comments SET removed = true, updated_at = now() WHERE id = p_comment_id;
  ELSIF p_action = 'RESTORE' THEN
    UPDATE public.scan_comments SET removed = false, updated_at = now() WHERE id = p_comment_id;
  ELSIF p_action = 'PIN' THEN
    UPDATE public.scan_comments SET pinned = true, updated_at = now() WHERE id = p_comment_id;
  ELSIF p_action = 'UNPIN' THEN
    UPDATE public.scan_comments SET pinned = false, updated_at = now() WHERE id = p_comment_id;
  ELSE
    RAISE EXCEPTION 'Ação inválida. Use REMOVE, RESTORE, PIN ou UNPIN';
  END IF;

  RETURN jsonb_build_object('success', true, 'action', p_action);
END;
$$;

-- 13. RPC: REPORT SCAN COMMENT
CREATE OR REPLACE FUNCTION public.report_scan_comment(
  p_comment_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_clean text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  v_clean := trim(p_reason);
  IF length(v_clean) < 2 OR length(v_clean) > 500 THEN
    RAISE EXCEPTION 'Motivo deve ter entre 2 e 500 caracteres';
  END IF;

  INSERT INTO public.scan_comment_reports (comment_id, user_id, reason)
  VALUES (p_comment_id, v_uid, v_clean)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'report_id', v_id);
END;
$$;

-- 14. RPC: POST SCAN STAFF NOTE (Internal Mural)
CREATE OR REPLACE FUNCTION public.post_scan_staff_note(
  p_scan_id uuid,
  p_body text,
  p_parent_id uuid DEFAULT NULL,
  p_pinned boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_clean text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  IF NOT public.is_scan_member(p_scan_id, v_uid) AND NOT public.is_editor() THEN
    RAISE EXCEPTION 'Acesso negado: apenas membros da equipe podem postar no mural' USING errcode = '42501';
  END IF;

  v_clean := trim(p_body);
  IF length(v_clean) < 1 OR length(v_clean) > 4000 THEN
    RAISE EXCEPTION 'Mensagem deve ter entre 1 e 4000 caracteres';
  END IF;

  IF p_parent_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.scan_staff_notes WHERE id = p_parent_id AND scan_id = p_scan_id) THEN
      RAISE EXCEPTION 'Nota pai não encontrada';
    END IF;
  END IF;

  INSERT INTO public.scan_staff_notes (scan_id, user_id, parent_id, body, is_pinned)
  VALUES (p_scan_id, v_uid, p_parent_id, v_clean, p_pinned)
  RETURNING id INTO v_id;

  INSERT INTO public.scan_activity (scan_id, user_id, action, details)
  VALUES (
    p_scan_id,
    v_uid,
    'STAFF_NOTE_POSTED',
    jsonb_build_object('note_id', v_id, 'is_reply', (p_parent_id IS NOT NULL), 'is_pinned', p_pinned)
  );

  RETURN jsonb_build_object('success', true, 'note_id', v_id);
END;
$$;

-- 15. RPC: DELETE SCAN STAFF NOTE
CREATE OR REPLACE FUNCTION public.delete_scan_staff_note(p_note_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_note record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  SELECT * INTO v_note FROM public.scan_staff_notes WHERE id = p_note_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota não encontrada';
  END IF;

  IF v_note.user_id != v_uid AND NOT public.can_manage_scan_members(v_note.scan_id, v_uid) AND NOT public.is_editor() THEN
    RAISE EXCEPTION 'Permissão negada' USING errcode = '42501';
  END IF;

  DELETE FROM public.scan_staff_notes WHERE id = p_note_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 16. RPC: TOGGLE USER SCAN PRIVACY (Self Control)
CREATE OR REPLACE FUNCTION public.toggle_user_scan_privacy(
  p_show_scans boolean,
  p_mode text DEFAULT 'PRIMARY'
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

  IF p_mode NOT IN ('PRIMARY', 'ALL', 'NONE') THEN
    RAISE EXCEPTION 'Modo de exibição inválido. Use PRIMARY, ALL ou NONE';
  END IF;

  UPDATE public.members
  SET
    privacy_show_scans = p_show_scans,
    privacy_scan_mode = p_mode
  WHERE id = v_uid;

  RETURN jsonb_build_object('success', true, 'privacy_show_scans', p_show_scans, 'privacy_scan_mode', p_mode);
END;
$$;

-- 17. RPC: ADMIN MODERATE USER SCANS (Global Admin Control)
CREATE OR REPLACE FUNCTION public.admin_moderate_user_scans(
  p_target_user_id uuid,
  p_hide_badges boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_editor() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores globais podem moderar perfis' USING errcode = '42501';
  END IF;

  UPDATE public.members
  SET admin_hide_scan_badges = p_hide_badges
  WHERE id = p_target_user_id;

  RETURN jsonb_build_object('success', true, 'admin_hide_scan_badges', p_hide_badges);
END;
$$;

-- 18. RPC: ADMIN MODERATE SCAN MEMBER (Global Admin or Scan Owner/Admin)
CREATE OR REPLACE FUNCTION public.update_scan_member_visibility(
  p_scan_id uuid,
  p_user_id uuid,
  p_is_public boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid != p_user_id AND NOT public.can_manage_scan_members(p_scan_id, v_uid) AND NOT public.is_editor() THEN
    RAISE EXCEPTION 'Permissão negada' USING errcode = '42501';
  END IF;

  UPDATE public.scan_members
  SET is_public = p_is_public
  WHERE scan_id = p_scan_id AND user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'is_public', p_is_public);
END;
$$;

-- 19. RPC: ADMIN FORCE HIDE SCAN MEMBER (Global Admin Only)
CREATE OR REPLACE FUNCTION public.admin_moderate_scan_member(
  p_scan_id uuid,
  p_user_id uuid,
  p_hidden boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_editor() THEN
    RAISE EXCEPTION 'Acesso negado' USING errcode = '42501';
  END IF;

  UPDATE public.scan_members
  SET hidden_by_admin = p_hidden
  WHERE scan_id = p_scan_id AND user_id = p_user_id;

  UPDATE public.scan_member_positions
  SET hidden_by_admin = p_hidden
  WHERE scan_id = p_scan_id AND user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'hidden_by_admin', p_hidden);
END;
$$;

-- Grant execution
GRANT EXECUTE ON FUNCTION public.post_scan_comment(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.like_scan_comment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_scan_comment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_scan_comment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_scan_staff_note(uuid, text, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_scan_staff_note(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_user_scan_privacy(boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_user_scans(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_scan_member_visibility(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_scan_member(uuid, uuid, boolean) TO authenticated;

COMMIT;
