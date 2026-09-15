-- ==============================================================================
-- PROJECT NOX — SCANS ECOSYSTEM 3.0: COMPLETE SEPARATION, RBAC & BACKOFFICE
-- ==============================================================================

-- 0. GLOBAL HELPER FUNCTION FOR GLOBAL ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(public.current_role() = 'ADMIN', false);
$$;

-- 1. EXTEND SCANS TABLE
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS pause_uploads boolean NOT NULL DEFAULT false;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS pause_recruitment boolean NOT NULL DEFAULT false;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS emergency_mode boolean NOT NULL DEFAULT false;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS emergency_reason text;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS status_reason text;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS bio text CHECK (bio IS NULL OR length(bio) <= 500);
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS pinned_items jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.scans DROP CONSTRAINT IF EXISTS scans_status_check;
ALTER TABLE public.scans ADD CONSTRAINT scans_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED', 'CLOSED'));

-- 2. SLUG HISTORY & REDIRECTION
CREATE TABLE IF NOT EXISTS public.scan_slug_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  old_slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_slug_history_old ON public.scan_slug_history(old_slug);
CREATE INDEX IF NOT EXISTS idx_scan_slug_history_scan ON public.scan_slug_history(scan_id);

-- 3. GLOBAL AUDIT LOG
CREATE TABLE IF NOT EXISTS public.scan_global_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid REFERENCES public.scans(id) ON DELETE SET NULL,
  scan_name text,
  admin_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  action text NOT NULL,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_global_audit_scan ON public.scan_global_audit_log(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_global_audit_action ON public.scan_global_audit_log(action);

-- 4. WORK UPLOADER AUTHORIZATION PER OBRA
CREATE TABLE IF NOT EXISTS public.scan_work_uploaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scan_id, work_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_scan_work_uploaders_lookup ON public.scan_work_uploaders(scan_id, work_id, user_id);

-- 5. WORKFLOW STAGES & CHAPTER PIPELINE
CREATE TABLE IF NOT EXISTS public.scan_workflow_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) >= 2),
  slug text NOT NULL,
  description text,
  color text DEFAULT '#6366f1',
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scan_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_scan_workflow_stages ON public.scan_workflow_stages(scan_id, display_order);

CREATE TABLE IF NOT EXISTS public.scan_chapter_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.scan_workflow_stages(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'SKIPPED')),
  assigned_to uuid REFERENCES public.members(id) ON DELETE SET NULL,
  due_at timestamptz,
  notes text,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chapter_id, stage_id)
);
CREATE INDEX IF NOT EXISTS idx_scan_chapter_stages ON public.scan_chapter_stages(scan_id, chapter_id);

-- 6. TASKS & HANDOFFS
CREATE TABLE IF NOT EXISTS public.scan_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  work_id uuid REFERENCES public.works(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.scan_workflow_stages(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(trim(title)) >= 2),
  description text,
  assigned_to uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  priority text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  status text NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_tasks_lookup ON public.scan_tasks(scan_id, status, assigned_to);

CREATE TABLE IF NOT EXISTS public.scan_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.scan_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(trim(content)) >= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_task_comments ON public.scan_task_comments(task_id);

CREATE TABLE IF NOT EXISTS public.scan_task_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.scan_tasks(id) ON DELETE CASCADE,
  from_user_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  to_user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  transferred_by uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. MEMBER AVAILABILITY & INVITE UPGRADES
ALTER TABLE public.scan_members ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'ACTIVE' CHECK (availability_status IN ('ACTIVE', 'BUSY', 'AWAY', 'HIATUS'));
ALTER TABLE public.scan_members ADD COLUMN IF NOT EXISTS availability_message text;
ALTER TABLE public.scan_members ADD COLUMN IF NOT EXISTS availability_updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.scan_invites ADD COLUMN IF NOT EXISTS invited_user_id uuid REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE public.scan_invites ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.scan_positions(id) ON DELETE SET NULL;
ALTER TABLE public.scan_invites ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED'));
ALTER TABLE public.scan_invites ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.scan_invites ADD COLUMN IF NOT EXISTS declined_at timestamptz;

-- 8. CUSTOM RECRUITMENT QUESTIONS & CANDIDATE ANSWERS
CREATE TABLE IF NOT EXISTS public.scan_recruitment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  opening_id uuid NOT NULL REFERENCES public.scan_recruitment_openings(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (length(trim(question)) >= 2),
  question_type text NOT NULL DEFAULT 'TEXT_SHORT' CHECK (question_type IN ('TEXT_SHORT', 'TEXT_LONG', 'SINGLE_CHOICE', 'YES_NO')),
  options jsonb DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_recruitment_questions ON public.scan_recruitment_questions(opening_id, display_order);

CREATE TABLE IF NOT EXISTS public.scan_application_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.scan_applications(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.scan_recruitment_questions(id) ON DELETE CASCADE,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(application_id, question_id)
);

-- 9. SCAN INTEGRATIONS (WEBHOOKS)
CREATE TABLE IF NOT EXISTS public.scan_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('DISCORD', 'FLUXER')),
  webhook_url text NOT NULL CHECK (webhook_url LIKE 'https://%'),
  name text NOT NULL DEFAULT 'Webhook',
  is_active boolean NOT NULL DEFAULT true,
  notify_events jsonb NOT NULL DEFAULT '["new_chapter", "new_application", "new_member"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_integrations_scan ON public.scan_integrations(scan_id);

-- 10. SCAN WIKI
CREATE TABLE IF NOT EXISTS public.scan_wiki_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) >= 2),
  slug text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'Geral',
  is_pinned boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scan_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_scan_wiki_lookup ON public.scan_wiki_pages(scan_id, category);

-- 11. WORK GLOSSARY & REFERENCES
CREATE TABLE IF NOT EXISTS public.work_glossary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  source_term text NOT NULL,
  preferred_translation text NOT NULL,
  category text NOT NULL DEFAULT 'Geral',
  notes text,
  created_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_glossary_lookup ON public.work_glossary_entries(scan_id, work_id);

CREATE TABLE IF NOT EXISTS public.work_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  title text NOT NULL,
  ref_type text NOT NULL DEFAULT 'LINK' CHECK (ref_type IN ('LINK', 'TEXT', 'NOTE')),
  content text NOT NULL,
  created_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_references_lookup ON public.work_references(scan_id, work_id);

-- 12. CHECKLIST CONFIGS & ONBOARDING
CREATE TABLE IF NOT EXISTS public.scan_checklist_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  UNIQUE(scan_id, code)
);

CREATE TABLE IF NOT EXISTS public.scan_onboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  title text NOT NULL,
  position_id uuid REFERENCES public.scan_positions(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scan_member_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  completed_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'DONE')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scan_id, user_id)
);

-- 13. ROW LEVEL SECURITY
ALTER TABLE public.scan_slug_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_global_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_work_uploaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_chapter_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_task_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_recruitment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_application_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_wiki_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_glossary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_checklist_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_member_onboarding ENABLE ROW LEVEL SECURITY;

-- Slug history: anyone can select for redirection
CREATE POLICY scan_slug_history_select ON public.scan_slug_history FOR SELECT TO anon, authenticated USING (true);

-- Global audit log: ONLY global admin
CREATE POLICY scan_global_audit_select ON public.scan_global_audit_log FOR SELECT TO authenticated USING (public.is_admin());

-- Team internal tables: only members of scan or global admin
CREATE POLICY scan_work_uploaders_select ON public.scan_work_uploaders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_work_uploaders.scan_id AND user_id = auth.uid()) OR public.is_admin());

CREATE POLICY scan_workflow_stages_select ON public.scan_workflow_stages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_workflow_stages.scan_id AND user_id = auth.uid()) OR public.is_admin());

CREATE POLICY scan_chapter_stages_select ON public.scan_chapter_stages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_chapter_stages.scan_id AND user_id = auth.uid()) OR public.is_admin());

CREATE POLICY scan_tasks_select ON public.scan_tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_tasks.scan_id AND user_id = auth.uid()) OR public.is_admin());

CREATE POLICY scan_task_comments_select ON public.scan_task_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scan_tasks st JOIN public.scan_members sm ON sm.scan_id = st.scan_id WHERE st.id = scan_task_comments.task_id AND sm.user_id = auth.uid()) OR public.is_admin());

CREATE POLICY scan_wiki_pages_select ON public.scan_wiki_pages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_wiki_pages.scan_id AND user_id = auth.uid()) OR public.is_admin());

CREATE POLICY work_glossary_entries_select ON public.work_glossary_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = work_glossary_entries.scan_id AND user_id = auth.uid()) OR public.is_admin());

CREATE POLICY work_references_select ON public.work_references FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = work_references.scan_id AND user_id = auth.uid()) OR public.is_admin());

-- Recruitment questions: readable by all so candidates can answer
CREATE POLICY scan_recruitment_questions_select ON public.scan_recruitment_questions FOR SELECT TO anon, authenticated USING (true);

-- Application answers: readable by applicant and scan managers
CREATE POLICY scan_application_answers_select ON public.scan_application_answers FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.scan_applications sa WHERE sa.id = scan_application_answers.application_id AND sa.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.scan_applications sa JOIN public.scan_members sm ON sm.scan_id = sa.scan_id WHERE sa.id = scan_application_answers.application_id AND sm.user_id = auth.uid() AND sm.role IN ('OWNER', 'ADMIN'))
    OR public.is_admin()
  );

CREATE POLICY scan_application_answers_insert ON public.scan_application_answers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.scan_applications sa WHERE sa.id = application_id AND sa.user_id = auth.uid())
  );

-- Integrations (Webhooks): ONLY OWNER and global ADMIN
CREATE POLICY scan_integrations_select ON public.scan_integrations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_integrations.scan_id AND user_id = auth.uid() AND role = 'OWNER')
    OR public.is_admin()
  );

-- 14. SOLE OWNER PROTECTION TRIGGER
CREATE OR REPLACE FUNCTION public.guard_last_scan_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_other_owners int;
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'OWNER') OR (TG_OP = 'UPDATE' AND OLD.role = 'OWNER' AND NEW.role != 'OWNER') THEN
    SELECT count(*) INTO v_other_owners
    FROM public.scan_members
    WHERE scan_id = OLD.scan_id AND role = 'OWNER' AND id != OLD.id;

    IF v_other_owners = 0 THEN
      RAISE EXCEPTION 'A scan não pode ficar sem dono. Transfira a propriedade antes de sair ou remover o cargo.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_last_scan_owner ON public.scan_members;
CREATE TRIGGER trg_guard_last_scan_owner
BEFORE UPDATE OR DELETE ON public.scan_members
FOR EACH ROW
EXECUTE FUNCTION public.guard_last_scan_owner();

-- 15. FUNCTIONS & RPCs

-- Transfer Scan Ownership
CREATE OR REPLACE FUNCTION public.transfer_scan_ownership(
  p_scan_id uuid,
  p_new_owner_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_is_global_admin boolean;
BEGIN
  v_is_global_admin := public.is_admin();

  IF NOT v_is_global_admin THEN
    SELECT role INTO v_caller_role FROM public.scan_members WHERE scan_id = p_scan_id AND user_id = v_caller;
    IF v_caller_role != 'OWNER' THEN
      RAISE EXCEPTION 'Apenas o Dono da Scan ou um Administrador Global pode transferir a propriedade.';
    END IF;
  END IF;

  -- Verify target member
  IF NOT EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = p_scan_id AND user_id = p_new_owner_id) THEN
    RAISE EXCEPTION 'O novo dono deve ser um membro ativo da equipe.';
  END IF;

  -- Update new owner
  UPDATE public.scan_members SET role = 'OWNER' WHERE scan_id = p_scan_id AND user_id = p_new_owner_id;

  -- Demote old owner if caller was owner
  IF v_caller != p_new_owner_id AND NOT v_is_global_admin THEN
    UPDATE public.scan_members SET role = 'ADMIN' WHERE scan_id = p_scan_id AND user_id = v_caller;
  END IF;

  INSERT INTO public.scan_activity (scan_id, user_id, type, details)
  VALUES (p_scan_id, v_caller, 'OWNERSHIP_TRANSFERRED', jsonb_build_object('new_owner_id', p_new_owner_id));

  INSERT INTO public.scan_global_audit_log (scan_id, admin_id, action, metadata)
  VALUES (p_scan_id, v_caller, 'OWNERSHIP_TRANSFERRED', jsonb_build_object('new_owner_id', p_new_owner_id));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Global Admin Recover Ownership
CREATE OR REPLACE FUNCTION public.global_admin_recover_scan_ownership(
  p_scan_id uuid,
  p_new_owner_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas Administradores Globais podem recuperar ownership.';
  END IF;

  -- If user is already in scan, make them owner
  IF EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = p_scan_id AND user_id = p_new_owner_id) THEN
    UPDATE public.scan_members SET role = 'OWNER' WHERE scan_id = p_scan_id AND user_id = p_new_owner_id;
  ELSE
    INSERT INTO public.scan_members (scan_id, user_id, role, is_public)
    VALUES (p_scan_id, p_new_owner_id, 'OWNER', true);
  END IF;

  INSERT INTO public.scan_global_audit_log (scan_id, admin_id, action, reason, metadata)
  VALUES (p_scan_id, auth.uid(), 'OWNER_RECOVERED', p_reason, jsonb_build_object('new_owner_id', p_new_owner_id));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Global Admin Set Scan Status (ACTIVE, SUSPENDED, ARCHIVED, CLOSED)
CREATE OR REPLACE FUNCTION public.global_admin_set_scan_status(
  p_scan_id uuid,
  p_status text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_scan_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas Administradores Globais podem alterar o status do ciclo de vida da Scan.';
  END IF;

  IF p_status NOT IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED', 'CLOSED') THEN
    RAISE EXCEPTION 'Status inválido.';
  END IF;

  SELECT name INTO v_scan_name FROM public.scans WHERE id = p_scan_id;

  UPDATE public.scans
  SET status = p_status,
      status_reason = p_reason,
      updated_at = now()
  WHERE id = p_scan_id;

  -- When CLOSED, update current project links in work_scans, but NEVER touch chapter_scans (historic credits remain forever)!
  IF p_status = 'CLOSED' THEN
    UPDATE public.work_scans
    SET status = 'DROPPED'
    WHERE scan_id = p_scan_id AND status = 'ACTIVE';
  END IF;

  INSERT INTO public.scan_global_audit_log (scan_id, scan_name, admin_id, action, reason, metadata)
  VALUES (p_scan_id, v_scan_name, auth.uid(), 'SCAN_STATUS_CHANGED', p_reason, jsonb_build_object('status', p_status));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Global Admin Hard Delete Scan (ONLY if completely empty of content)
CREATE OR REPLACE FUNCTION public.global_admin_hard_delete_scan(
  p_scan_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_chapters_count int;
  v_works_count int;
  v_scan_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas Administradores Globais podem executar exclusão definitiva.';
  END IF;

  -- 1. Check chapter_scans
  SELECT count(*) INTO v_chapters_count FROM public.chapter_scans WHERE scan_id = p_scan_id;
  IF v_chapters_count > 0 THEN
    RAISE EXCEPTION 'Exclusão definitiva proibida: a scan possui capítulos e créditos históricos vinculados (%). Utilize Suspender, Arquivar ou Encerrar Scan.', v_chapters_count;
  END IF;

  -- 2. Check work_scans
  SELECT count(*) INTO v_works_count FROM public.work_scans WHERE scan_id = p_scan_id;
  IF v_works_count > 0 THEN
    RAISE EXCEPTION 'Exclusão definitiva proibida: a scan possui obras vinculadas (%). Desvincule antes ou utilize Encerrar Scan.', v_works_count;
  END IF;

  SELECT name INTO v_scan_name FROM public.scans WHERE id = p_scan_id;

  DELETE FROM public.scans WHERE id = p_scan_id;

  INSERT INTO public.scan_global_audit_log (scan_id, scan_name, admin_id, action, reason)
  VALUES (p_scan_id, v_scan_name, auth.uid(), 'SCAN_HARD_DELETED', p_reason);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Check if user can upload to scan work
CREATE OR REPLACE FUNCTION public.can_upload_to_scan_work(
  p_scan_id uuid,
  p_work_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_status text;
  v_pause boolean;
  v_emergency boolean;
  v_role text;
BEGIN
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  SELECT status, pause_uploads, emergency_mode INTO v_status, v_pause, v_emergency
  FROM public.scans WHERE id = p_scan_id;

  IF v_status != 'ACTIVE' OR v_pause = true OR v_emergency = true THEN
    RETURN false;
  END IF;

  SELECT role INTO v_role FROM public.scan_members WHERE scan_id = p_scan_id AND user_id = p_user_id;

  IF v_role IN ('OWNER', 'ADMIN') THEN
    RETURN true;
  END IF;

  IF v_role = 'UPLOADER' THEN
    -- Check specific authorization for this work
    IF EXISTS (SELECT 1 FROM public.scan_work_uploaders WHERE scan_id = p_scan_id AND work_id = p_work_id AND user_id = p_user_id) THEN
      RETURN true;
    END IF;
    -- If no work_uploaders restrictions configured for this work, allowed
    IF NOT EXISTS (SELECT 1 FROM public.scan_work_uploaders WHERE scan_id = p_scan_id AND work_id = p_work_id) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

-- Member Leaves Scan
CREATE OR REPLACE FUNCTION public.leave_scan(
  p_scan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  DELETE FROM public.scan_members WHERE scan_id = p_scan_id AND user_id = v_caller;
  INSERT INTO public.scan_activity (scan_id, user_id, type, details)
  VALUES (p_scan_id, v_caller, 'MEMBER_LEFT', jsonb_build_object('user_id', v_caller));
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Change Scan Slug with History Preservation
CREATE OR REPLACE FUNCTION public.change_scan_slug(
  p_scan_id uuid,
  p_new_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_slug text;
  v_caller uuid := auth.uid();
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.scan_members WHERE scan_id = p_scan_id AND user_id = v_caller;
  IF v_role != 'OWNER' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas o Dono da Scan ou um Administrador Global pode alterar o slug.';
  END IF;

  SELECT slug INTO v_old_slug FROM public.scans WHERE id = p_scan_id;
  IF v_old_slug = p_new_slug THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  IF EXISTS (SELECT 1 FROM public.scans WHERE slug = p_new_slug AND id != p_scan_id) THEN
    RAISE EXCEPTION 'Este slug já está em uso.';
  END IF;

  -- Record old slug in history
  INSERT INTO public.scan_slug_history (scan_id, old_slug)
  VALUES (p_scan_id, v_old_slug)
  ON CONFLICT (old_slug) DO NOTHING;

  UPDATE public.scans SET slug = p_new_slug, updated_at = now() WHERE id = p_scan_id;

  INSERT INTO public.scan_activity (scan_id, user_id, type, details)
  VALUES (p_scan_id, v_caller, 'SLUG_CHANGED', jsonb_build_object('old_slug', v_old_slug, 'new_slug', p_new_slug));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Default Workflow Stages Seeder
CREATE OR REPLACE FUNCTION public.seed_scan_default_stages(p_scan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.scan_workflow_stages (scan_id, name, slug, color, display_order, required)
  VALUES
    (p_scan_id, 'Tradução', 'traducao', '#3b82f6', 1, true),
    (p_scan_id, 'Revisão', 'revisao', '#8b5cf6', 2, true),
    (p_scan_id, 'Cleaner', 'cleaner', '#ec4899', 3, false),
    (p_scan_id, 'Redraw', 'redraw', '#f59e0b', 4, false),
    (p_scan_id, 'Typeset', 'typeset', '#10b981', 5, true),
    (p_scan_id, 'Quality Check', 'qc', '#eab308', 6, true),
    (p_scan_id, 'Pronto para Publicar', 'pronto', '#06b6d4', 7, true)
  ON CONFLICT (scan_id, slug) DO NOTHING;
END;
$$;

-- Seed default stages for existing scans
DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN SELECT id FROM public.scans LOOP
    PERFORM public.seed_scan_default_stages(s.id);
  END LOOP;
END;
$$;

