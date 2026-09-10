-- Migration: 20260910070000_fix_scan_members_rls_infinite_recursion.sql
-- Description: Fix infinite recursion in scan_members RLS policies, introduce secure SECURITY DEFINER helpers, separate action policies, and ensure clean scan attribution rules.

-- ------------------------------------------------------------------------------
-- 1. SECURE HELPER FUNCTIONS (SECURITY DEFINER to avoid policy recursion)
-- ------------------------------------------------------------------------------

-- Helper 1: Check if user is a member of a scan
CREATE OR REPLACE FUNCTION public.is_scan_member(p_scan_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
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
  );
END;
$$;

-- Helper 2: Check if user can manage members of a scan (owner or admin, or system editor)
CREATE OR REPLACE FUNCTION public.can_manage_scan_members(p_scan_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_editor() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.scan_members
    WHERE scan_id = p_scan_id
      AND user_id = p_user_id
      AND role IN ('OWNER', 'ADMIN')
  );
END;
$$;

-- Helper 3: Check if user can manage works/chapters of a scan (owner, admin, or uploader, or system editor)
CREATE OR REPLACE FUNCTION public.can_manage_scan_works(p_scan_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_editor() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.scan_members
    WHERE scan_id = p_scan_id
      AND user_id = p_user_id
      AND role IN ('OWNER', 'ADMIN', 'UPLOADER')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_scan_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_scan_members(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_scan_works(uuid, uuid) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. POLICIES: public.scans
-- ------------------------------------------------------------------------------
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scans_select ON public.scans;
DROP POLICY IF EXISTS scans_editor_all ON public.scans;
DROP POLICY IF EXISTS scans_insert ON public.scans;
DROP POLICY IF EXISTS scans_update ON public.scans;
DROP POLICY IF EXISTS scans_delete ON public.scans;

CREATE POLICY scans_select ON public.scans FOR SELECT TO anon, authenticated
  USING (
    status = 'ACTIVE'
    OR public.is_editor()
    OR public.is_scan_member(id, auth.uid())
  );

CREATE POLICY scans_insert ON public.scans FOR INSERT TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY scans_update ON public.scans FOR UPDATE TO authenticated
  USING (public.is_editor() OR public.can_manage_scan_members(id, auth.uid()))
  WITH CHECK (public.is_editor() OR public.can_manage_scan_members(id, auth.uid()));

CREATE POLICY scans_delete ON public.scans FOR DELETE TO authenticated
  USING (public.is_editor());

-- ------------------------------------------------------------------------------
-- 3. POLICIES: public.scan_members
-- ------------------------------------------------------------------------------
ALTER TABLE public.scan_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scan_members_select ON public.scan_members;
DROP POLICY IF EXISTS scan_members_manage ON public.scan_members;
DROP POLICY IF EXISTS scan_members_insert ON public.scan_members;
DROP POLICY IF EXISTS scan_members_update ON public.scan_members;
DROP POLICY IF EXISTS scan_members_delete ON public.scan_members;

-- Uncontaminated SELECT for public/authenticated
CREATE POLICY scan_members_select ON public.scan_members FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY scan_members_insert ON public.scan_members FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_scan_members(scan_id, auth.uid()));

CREATE POLICY scan_members_update ON public.scan_members FOR UPDATE TO authenticated
  USING (public.can_manage_scan_members(scan_id, auth.uid()))
  WITH CHECK (public.can_manage_scan_members(scan_id, auth.uid()));

CREATE POLICY scan_members_delete ON public.scan_members FOR DELETE TO authenticated
  USING (
    public.can_manage_scan_members(scan_id, auth.uid())
    OR user_id = auth.uid()
  );

-- ------------------------------------------------------------------------------
-- 4. POLICIES: public.work_scans
-- ------------------------------------------------------------------------------
ALTER TABLE public.work_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_scans_select ON public.work_scans;
DROP POLICY IF EXISTS work_scans_manage ON public.work_scans;
DROP POLICY IF EXISTS work_scans_insert ON public.work_scans;
DROP POLICY IF EXISTS work_scans_update ON public.work_scans;
DROP POLICY IF EXISTS work_scans_delete ON public.work_scans;

CREATE POLICY work_scans_select ON public.work_scans FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY work_scans_insert ON public.work_scans FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_scan_works(scan_id, auth.uid()));

CREATE POLICY work_scans_update ON public.work_scans FOR UPDATE TO authenticated
  USING (public.can_manage_scan_works(scan_id, auth.uid()))
  WITH CHECK (public.can_manage_scan_works(scan_id, auth.uid()));

CREATE POLICY work_scans_delete ON public.work_scans FOR DELETE TO authenticated
  USING (public.can_manage_scan_works(scan_id, auth.uid()));

-- ------------------------------------------------------------------------------
-- 5. POLICIES: public.chapter_scans
-- ------------------------------------------------------------------------------
ALTER TABLE public.chapter_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chapter_scans_select ON public.chapter_scans;
DROP POLICY IF EXISTS chapter_scans_manage ON public.chapter_scans;
DROP POLICY IF EXISTS chapter_scans_insert ON public.chapter_scans;
DROP POLICY IF EXISTS chapter_scans_update ON public.chapter_scans;
DROP POLICY IF EXISTS chapter_scans_delete ON public.chapter_scans;

CREATE POLICY chapter_scans_select ON public.chapter_scans FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY chapter_scans_insert ON public.chapter_scans FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_scan_works(scan_id, auth.uid()));

CREATE POLICY chapter_scans_update ON public.chapter_scans FOR UPDATE TO authenticated
  USING (public.can_manage_scan_works(scan_id, auth.uid()))
  WITH CHECK (public.can_manage_scan_works(scan_id, auth.uid()));

CREATE POLICY chapter_scans_delete ON public.chapter_scans FOR DELETE TO authenticated
  USING (public.can_manage_scan_works(scan_id, auth.uid()));

-- Grants
GRANT SELECT ON public.scans TO anon, authenticated;
GRANT SELECT ON public.scan_members TO anon, authenticated;
GRANT SELECT ON public.work_scans TO anon, authenticated;
GRANT SELECT ON public.chapter_scans TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.scans TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.scan_members TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.work_scans TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.chapter_scans TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. CORRECTIVE CLEANUP: Remove any false blanket Project Nox backfill
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_nox_scan_id uuid;
BEGIN
  SELECT id INTO v_nox_scan_id FROM public.scans WHERE slug = 'project-nox' LIMIT 1;

  IF v_nox_scan_id IS NOT NULL THEN
    -- Remove any chapter_scans assigned to Project Nox whose parent work is NOT legitimately associated to Project Nox
    DELETE FROM public.chapter_scans cs
    WHERE cs.scan_id = v_nox_scan_id
      AND NOT EXISTS (
        SELECT 1 FROM public.chapters c
        JOIN public.work_scans ws ON ws.work_id = c.work_id AND ws.scan_id = v_nox_scan_id
        WHERE c.id = cs.chapter_id
      );
  END IF;
END $$;
