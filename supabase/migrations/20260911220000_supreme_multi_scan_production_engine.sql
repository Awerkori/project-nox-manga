-- ==============================================================================
-- PROJECT NOX — SUPREME MULTI-SCAN ECOSYSTEM & PRODUCTION CENTRAL ENGINE
-- ==============================================================================

-- 1. ENHANCE WORKFLOW STAGES WITH DEPENDENCIES & POSITION BINDINGS
ALTER TABLE public.scan_workflow_stages 
  ADD COLUMN IF NOT EXISTS dependencies text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.scan_positions(id) ON DELETE SET NULL;

-- 2. PIPELINE TEMPLATES
CREATE TABLE IF NOT EXISTS public.scan_pipeline_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  stages jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.scan_pipeline_templates (name, code, description, stages)
VALUES 
(
  'Manhwa / Webtoon Padrão',
  'MANHWA',
  'Fluxo paralelo com Clean/Redraw e Tradução pós-Raw, convergindo em Typeset, Revisão, QC e Publicação.',
  '[
    {"name": "Raw", "slug": "raw", "color": "#64748b", "dependencies": [], "required": true},
    {"name": "Clean / Redraw", "slug": "clean_redraw", "color": "#ec4899", "dependencies": ["raw"], "required": false},
    {"name": "Tradução", "slug": "traducao", "color": "#3b82f6", "dependencies": ["raw"], "required": true},
    {"name": "Typeset", "slug": "typeset", "color": "#eab308", "dependencies": ["clean_redraw", "traducao"], "required": true},
    {"name": "Revisão", "slug": "revisao", "color": "#8b5cf6", "dependencies": ["typeset"], "required": true},
    {"name": "Quality Control (QC)", "slug": "qc", "color": "#06b6d4", "dependencies": ["revisao"], "required": true},
    {"name": "Pronto para Upar", "slug": "ready", "color": "#10b981", "dependencies": ["qc"], "required": true}
  ]'::jsonb
),
(
  'Mangá Clássico P&B',
  'MANGA',
  'Fluxo tradicional de mangá em páginas duplas, limpeza de retículas, tradução, lettering e revisão final.',
  '[
    {"name": "Raw", "slug": "raw", "color": "#64748b", "dependencies": [], "required": true},
    {"name": "Tradução", "slug": "traducao", "color": "#3b82f6", "dependencies": ["raw"], "required": true},
    {"name": "Edição & Redraw", "slug": "clean_redraw", "color": "#ec4899", "dependencies": ["raw"], "required": true},
    {"name": "Lettering", "slug": "typeset", "color": "#eab308", "dependencies": ["clean_redraw", "traducao"], "required": true},
    {"name": "Revisão Final", "slug": "revisao", "color": "#8b5cf6", "dependencies": ["typeset"], "required": true},
    {"name": "Pronto para Upar", "slug": "ready", "color": "#10b981", "dependencies": ["revisao"], "required": true}
  ]'::jsonb
),
(
  'Webtoon Rápido',
  'WEBTOON',
  'Fluxo ágil e simplificado: Raw -> Tradução -> Type -> Revisão -> Pronto.',
  '[
    {"name": "Raw", "slug": "raw", "color": "#64748b", "dependencies": [], "required": true},
    {"name": "Tradução", "slug": "traducao", "color": "#3b82f6", "dependencies": ["raw"], "required": true},
    {"name": "Typeset", "slug": "typeset", "color": "#eab308", "dependencies": ["traducao"], "required": true},
    {"name": "Revisão", "slug": "revisao", "color": "#8b5cf6", "dependencies": ["typeset"], "required": true},
    {"name": "Pronto para Upar", "slug": "ready", "color": "#10b981", "dependencies": ["revisao"], "required": true}
  ]'::jsonb
),
(
  'Light Novel / Webnovel',
  'NOVEL',
  'Fluxo editorial para literatura: Tradução de texto corrido -> Revisão ortográfica -> Diagramação.',
  '[
    {"name": "Texto Base / Raw", "slug": "raw", "color": "#64748b", "dependencies": [], "required": true},
    {"name": "Tradução Textual", "slug": "traducao", "color": "#3b82f6", "dependencies": ["raw"], "required": true},
    {"name": "Revisão e Copidesque", "slug": "revisao", "color": "#8b5cf6", "dependencies": ["traducao"], "required": true},
    {"name": "Diagramação / EPUB", "slug": "typeset", "color": "#eab308", "dependencies": ["revisao"], "required": true},
    {"name": "Pronto para Upar", "slug": "ready", "color": "#10b981", "dependencies": ["typeset"], "required": true}
  ]'::jsonb
)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  stages = EXCLUDED.stages;

-- 3. IN-PRODUCTION CHAPTER WORKSPACE
CREATE TABLE IF NOT EXISTS public.scan_production_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  chapter_number numeric NOT NULL,
  chapter_title text,
  target_chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_PRODUCTION', 'READY', 'PUBLISHED')),
  template text NOT NULL DEFAULT 'MANHWA' CHECK (template IN ('MANHWA', 'MANGA', 'WEBTOON', 'NOVEL', 'CUSTOM')),
  checklist_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_stage_slug text,
  created_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scan_id, work_id, chapter_number)
);
CREATE INDEX IF NOT EXISTS idx_scan_prod_chapters_lookup ON public.scan_production_chapters(scan_id, work_id, status);

-- 4. PRODUCTION STAGING FILES (RAW / PSD / CLEAN / DRAFTS)
CREATE TABLE IF NOT EXISTS public.scan_production_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  work_id uuid REFERENCES public.works(id) ON DELETE CASCADE,
  production_chapter_id uuid REFERENCES public.scan_production_chapters(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.scan_workflow_stages(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  byte_size bigint NOT NULL DEFAULT 0,
  mime_type text,
  file_key text NOT NULL,
  provider text NOT NULL DEFAULT 'TELEGRAM' CHECK (provider IN ('TELEGRAM', 'STORAGE', 'BRIDGE')),
  version int NOT NULL DEFAULT 1,
  uploaded_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  is_current boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_prod_files_lookup ON public.scan_production_files(scan_id, production_chapter_id);

-- 5. QUALITY CONTROL (QC) BY PAGE
CREATE TABLE IF NOT EXISTS public.scan_chapter_qc_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  production_chapter_id uuid REFERENCES public.scan_production_chapters(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  page_number int NOT NULL CHECK (page_number >= 1),
  issue_type text NOT NULL CHECK (issue_type IN ('TYPE', 'CLEAN', 'TRANSLATION', 'REDRAW', 'MISSING', 'OTHER')),
  description text NOT NULL CHECK (length(trim(description)) >= 2),
  assigned_to uuid REFERENCES public.members(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX')),
  resolved_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_qc_issues_lookup ON public.scan_chapter_qc_issues(scan_id, production_chapter_id, status);

CREATE TABLE IF NOT EXISTS public.scan_qc_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.scan_chapter_qc_issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(trim(content)) >= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_qc_comments ON public.scan_qc_comments(issue_id);

-- 6. CHAT, CHANNELS, MESSAGES, THREADS & REACTIONS
CREATE TABLE IF NOT EXISTS public.scan_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) >= 2),
  slug text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'GERAL',
  type text NOT NULL DEFAULT 'CHAT' CHECK (type IN ('CHAT', 'ANNOUNCEMENT')),
  display_order int NOT NULL DEFAULT 0,
  is_private boolean NOT NULL DEFAULT false,
  allowed_roles text[] NOT NULL DEFAULT '{"OWNER", "ADMIN", "UPLOADER", "MEMBER"}'::text[],
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scan_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_scan_channels_lookup ON public.scan_channels(scan_id, display_order);

CREATE TABLE IF NOT EXISTS public.scan_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.scan_channels(id) ON DELETE CASCADE,
  production_chapter_id uuid REFERENCES public.scan_production_chapters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(trim(content)) >= 1),
  mentions jsonb NOT NULL DEFAULT '[]'::jsonb,
  pinned boolean NOT NULL DEFAULT false,
  reply_to_id uuid REFERENCES public.scan_messages(id) ON DELETE SET NULL,
  thread_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_messages_channel ON public.scan_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_messages_chapter ON public.scan_messages(production_chapter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.scan_message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  parent_message_id uuid NOT NULL REFERENCES public.scan_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(trim(content)) >= 1),
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_msg_threads_lookup ON public.scan_message_threads(parent_message_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.scan_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.scan_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_scan_reactions_msg ON public.scan_message_reactions(message_id);

CREATE TABLE IF NOT EXISTS public.scan_channel_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.scan_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  preference text NOT NULL DEFAULT 'ALL' CHECK (preference IN ('ALL', 'MENTIONS', 'MUTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- 7. NOTIFICATIONS & EMAIL OUTBOX
CREATE TABLE IF NOT EXISTS public.scan_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('MENTION', 'ROLE_MENTION', 'TASK_ASSIGNED', 'STAGE_READY', 'QC_ISSUE', 'APPLICATION', 'SYSTEM')),
  title text NOT NULL,
  body text NOT NULL,
  deep_link text,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_notifications_user ON public.scan_notifications(user_id, scan_id, is_read);

CREATE TABLE IF NOT EXISTS public.scan_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  direct_mentions boolean NOT NULL DEFAULT true,
  role_mentions boolean NOT NULL DEFAULT true,
  tasks boolean NOT NULL DEFAULT true,
  chapters_waiting boolean NOT NULL DEFAULT true,
  comments boolean NOT NULL DEFAULT false,
  general_activity boolean NOT NULL DEFAULT false,
  email_enabled boolean NOT NULL DEFAULT false,
  email_frequency text NOT NULL DEFAULT 'IMMEDIATE' CHECK (email_frequency IN ('IMMEDIATE', 'DIGEST', 'OFF')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scan_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.scan_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  idempotency_key text UNIQUE,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_email_outbox_status ON public.scan_email_outbox(status, scheduled_at);

-- 8. ACADEMIA (TUTORIALS) & WIKI VERSIONING
CREATE TABLE IF NOT EXISTS public.scan_academy_tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) >= 2),
  slug text NOT NULL,
  category text NOT NULL DEFAULT 'Geral' CHECK (category IN ('Tradução', 'Revisão', 'Clean / Redraw', 'Typeset', 'QC', 'Upload', 'Ferramentas', 'Regras', 'Geral')),
  content text NOT NULL,
  is_published boolean NOT NULL DEFAULT true,
  target_position_id uuid REFERENCES public.scan_positions(id) ON DELETE SET NULL,
  display_order int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scan_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_scan_academy_lookup ON public.scan_academy_tutorials(scan_id, category);

CREATE TABLE IF NOT EXISTS public.scan_wiki_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.scan_wiki_pages(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  version_number int NOT NULL DEFAULT 1,
  author_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  change_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_wiki_versions_page ON public.scan_wiki_versions(page_id, version_number DESC);

-- 9. ROW LEVEL SECURITY ON NEW TABLES
ALTER TABLE public.scan_pipeline_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_production_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_production_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_chapter_qc_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_qc_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_channel_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_email_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_academy_tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_wiki_versions ENABLE ROW LEVEL SECURITY;

-- Templates: readable by all authenticated users
CREATE POLICY scan_pipeline_templates_select ON public.scan_pipeline_templates FOR SELECT TO authenticated USING (true);

-- Production Chapters
CREATE POLICY scan_prod_chapters_select ON public.scan_production_chapters FOR SELECT TO authenticated
  USING (public.is_scan_member(scan_id));
CREATE POLICY scan_prod_chapters_all ON public.scan_production_chapters FOR ALL TO authenticated
  USING (public.is_scan_member(scan_id))
  WITH CHECK (public.is_scan_member(scan_id));

-- Production Files
CREATE POLICY scan_prod_files_select ON public.scan_production_files FOR SELECT TO authenticated
  USING (public.is_scan_member(scan_id));
CREATE POLICY scan_prod_files_all ON public.scan_production_files FOR ALL TO authenticated
  USING (public.is_scan_member(scan_id))
  WITH CHECK (public.is_scan_member(scan_id));

-- QC Issues
CREATE POLICY scan_qc_issues_select ON public.scan_chapter_qc_issues FOR SELECT TO authenticated
  USING (public.is_scan_member(scan_id));
CREATE POLICY scan_qc_issues_all ON public.scan_chapter_qc_issues FOR ALL TO authenticated
  USING (public.is_scan_member(scan_id))
  WITH CHECK (public.is_scan_member(scan_id));

CREATE POLICY scan_qc_comments_select ON public.scan_qc_comments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.scan_chapter_qc_issues i
    JOIN public.scan_members sm ON sm.scan_id = i.scan_id
    WHERE i.id = scan_qc_comments.issue_id AND sm.user_id = auth.uid()
  ) OR public.is_admin());
CREATE POLICY scan_qc_comments_insert ON public.scan_qc_comments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.scan_chapter_qc_issues i
    JOIN public.scan_members sm ON sm.scan_id = i.scan_id
    WHERE i.id = issue_id AND sm.user_id = auth.uid()
  ) OR public.is_admin());

-- Channels
CREATE POLICY scan_channels_select ON public.scan_channels FOR SELECT TO authenticated
  USING (public.is_scan_member(scan_id));
CREATE POLICY scan_channels_all ON public.scan_channels FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_channels.scan_id AND user_id = auth.uid() AND role IN ('OWNER', 'ADMIN'))
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_channels.scan_id AND user_id = auth.uid() AND role IN ('OWNER', 'ADMIN'))
    OR public.is_admin()
  );

-- Messages
CREATE POLICY scan_messages_select ON public.scan_messages FOR SELECT TO authenticated
  USING (public.is_scan_member(scan_id));
CREATE POLICY scan_messages_insert ON public.scan_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_scan_member(scan_id));
CREATE POLICY scan_messages_update ON public.scan_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_messages.scan_id AND user_id = auth.uid() AND role IN ('OWNER', 'ADMIN')) OR public.is_admin());
CREATE POLICY scan_messages_delete ON public.scan_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_messages.scan_id AND user_id = auth.uid() AND role IN ('OWNER', 'ADMIN')) OR public.is_admin());

-- Threads
CREATE POLICY scan_threads_select ON public.scan_message_threads FOR SELECT TO authenticated
  USING (public.is_scan_member(scan_id));
CREATE POLICY scan_threads_insert ON public.scan_message_threads FOR INSERT TO authenticated
  WITH CHECK (public.is_scan_member(scan_id));

-- Reactions
CREATE POLICY scan_reactions_select ON public.scan_message_reactions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.scan_messages m
    JOIN public.scan_members sm ON sm.scan_id = m.scan_id
    WHERE m.id = scan_message_reactions.message_id AND sm.user_id = auth.uid()
  ) OR public.is_admin());
CREATE POLICY scan_reactions_all ON public.scan_message_reactions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Channel Preferences
CREATE POLICY scan_chan_prefs_select ON public.scan_channel_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY scan_chan_prefs_all ON public.scan_channel_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Notifications
CREATE POLICY scan_notifs_select ON public.scan_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY scan_notifs_update ON public.scan_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY scan_notifs_insert ON public.scan_notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_scan_member(scan_id));

-- Notification Preferences
CREATE POLICY scan_notif_prefs_select ON public.scan_notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY scan_notif_prefs_all ON public.scan_notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Email Outbox: Restricted to service_role or scan managers
CREATE POLICY scan_outbox_select ON public.scan_email_outbox FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_email_outbox.scan_id AND user_id = auth.uid() AND role IN ('OWNER', 'ADMIN'))
    OR public.is_admin()
  );

-- Academy Tutorials
CREATE POLICY scan_academy_select ON public.scan_academy_tutorials FOR SELECT TO authenticated
  USING (public.is_scan_member(scan_id));
CREATE POLICY scan_academy_all ON public.scan_academy_tutorials FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_academy_tutorials.scan_id AND user_id = auth.uid() AND role IN ('OWNER', 'ADMIN'))
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_academy_tutorials.scan_id AND user_id = auth.uid() AND role IN ('OWNER', 'ADMIN'))
    OR public.is_admin()
  );

-- Wiki Versions
CREATE POLICY scan_wiki_versions_select ON public.scan_wiki_versions FOR SELECT TO authenticated
  USING (public.is_scan_member(scan_id));
CREATE POLICY scan_wiki_versions_insert ON public.scan_wiki_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_scan_member(scan_id));

-- 10. RPCs & STORED PROCEDURES

-- Atomic Task Claim with Concurrency Lock
CREATE OR REPLACE FUNCTION public.claim_scan_task(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_task public.scan_tasks;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_task FROM public.scan_tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa não encontrada.';
  END IF;

  IF NOT public.is_scan_member(v_task.scan_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado a esta Scan.';
  END IF;

  IF v_task.status = 'DONE' THEN
    RAISE EXCEPTION 'Esta tarefa já foi concluída.';
  END IF;

  IF v_task.assigned_to IS NOT NULL AND v_task.assigned_to != v_caller THEN
    RAISE EXCEPTION 'Esta tarefa acabou de ser assumida por outro membro da equipe.';
  END IF;

  UPDATE public.scan_tasks 
  SET assigned_to = v_caller, status = 'IN_PROGRESS', updated_at = now()
  WHERE id = p_task_id;

  RETURN jsonb_build_object('success', true, 'task_id', p_task_id, 'assigned_to', v_caller);
END;
$$;

-- Atomic Task Handoff with Reason
CREATE OR REPLACE FUNCTION public.handoff_scan_task(
  p_task_id uuid,
  p_to_user_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_task public.scan_tasks;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_task FROM public.scan_tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa não encontrada.';
  END IF;

  IF NOT public.is_scan_member(v_task.scan_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = v_task.scan_id AND user_id = p_to_user_id) THEN
    RAISE EXCEPTION 'O membro destinatário não pertence a esta Scan.';
  END IF;

  INSERT INTO public.scan_task_handoffs (task_id, from_user_id, to_user_id, transferred_by, reason)
  VALUES (p_task_id, v_task.assigned_to, p_to_user_id, v_caller, p_reason);

  UPDATE public.scan_tasks 
  SET assigned_to = p_to_user_id, status = 'IN_PROGRESS', updated_at = now()
  WHERE id = p_task_id;

  -- Create Notification for the new assignee
  INSERT INTO public.scan_notifications (scan_id, user_id, type, title, body, deep_link)
  VALUES (
    v_task.scan_id,
    p_to_user_id,
    'TASK_ASSIGNED',
    'Tarefa Repassada',
    'Uma tarefa foi repassada para você: ' || v_task.title || (CASE WHEN p_reason IS NOT NULL AND length(p_reason) > 0 THEN ' (Motivo: ' || p_reason || ')' ELSE '' END),
    '/scan?id=' || v_task.scan_id || '&tab=tasks&taskId=' || p_task_id
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Resolve Scan Mentions Helper
CREATE OR REPLACE FUNCTION public.resolve_scan_mentions(
  p_scan_id uuid,
  p_text text
)
RETURNS TABLE (
  target_user_id uuid,
  mention_type text,
  mention_label text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- 1. Direct username mentions: @username
  RETURN QUERY
  SELECT DISTINCT sm.user_id, 'USER'::text, m.username
  FROM public.scan_members sm
  JOIN public.members m ON m.id = sm.user_id
  WHERE sm.scan_id = p_scan_id
    AND p_text ~* ('(^|[^a-zA-Z0-9_])@' || regexp_replace(m.username, '([.*+?^${}()|[\]\/\\])', '\\\1', 'g') || '([^a-zA-Z0-9_]|$)');

  -- 2. Role / Position mentions: @PositionName (e.g. @Revisor, @Tradutor)
  RETURN QUERY
  SELECT DISTINCT smp.user_id, 'POSITION'::text, sp.name
  FROM public.scan_positions sp
  JOIN public.scan_member_positions smp ON smp.position_id = sp.id
  JOIN public.scan_members sm ON sm.scan_id = sp.scan_id AND sm.user_id = smp.user_id
  WHERE sp.scan_id = p_scan_id
    AND sp.is_active = true
    AND p_text ~* ('(^|[^a-zA-Z0-9_])@' || regexp_replace(sp.name, '([.*+?^${}()|[\]\/\\])', '\\\1', 'g') || '([^a-zA-Z0-9_]|$)');

  -- 3. Broadcast mention: @todos or @everyone (only if caller is OWNER or ADMIN)
  IF p_text ~* '(^|[^a-zA-Z0-9_])@(todos|everyone)([^a-zA-Z0-9_]|$)' THEN
    RETURN QUERY
    SELECT DISTINCT sm.user_id, 'ALL'::text, 'todos'::text
    FROM public.scan_members sm
    WHERE sm.scan_id = p_scan_id;
  END IF;
END;
$$;

-- Advance Pipeline Stage with Dependency Enforcement
CREATE OR REPLACE FUNCTION public.advance_pipeline_stage(
  p_scan_id uuid,
  p_production_chapter_id uuid,
  p_stage_slug text,
  p_new_status text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_stage public.scan_workflow_stages;
  v_dep text;
  v_dep_stage public.scan_workflow_stages;
  v_dep_record public.scan_chapter_stages;
  v_caller uuid := auth.uid();
  v_chapter public.scan_production_chapters;
BEGIN
  IF NOT public.is_scan_member(p_scan_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT * INTO v_chapter FROM public.scan_production_chapters 
  WHERE id = p_production_chapter_id AND scan_id = p_scan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Capítulo em produção não encontrado.';
  END IF;

  SELECT * INTO v_stage FROM public.scan_workflow_stages 
  WHERE scan_id = p_scan_id AND slug = p_stage_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa de workflow "%" não existe nesta Scan.', p_stage_slug;
  END IF;

  -- Verify prerequisite dependencies
  IF p_new_status IN ('IN_PROGRESS', 'DONE') AND v_stage.dependencies IS NOT NULL AND array_length(v_stage.dependencies, 1) > 0 THEN
    FOREACH v_dep IN ARRAY v_stage.dependencies
    LOOP
      SELECT * INTO v_dep_stage FROM public.scan_workflow_stages WHERE scan_id = p_scan_id AND slug = v_dep;
      IF FOUND THEN
        -- Check if dep stage is done
        IF v_chapter.target_chapter_id IS NOT NULL THEN
          SELECT * INTO v_dep_record FROM public.scan_chapter_stages 
          WHERE chapter_id = v_chapter.target_chapter_id AND stage_id = v_dep_stage.id;
          IF v_dep_record.status IS DISTINCT FROM 'DONE' THEN
            RAISE EXCEPTION 'A etapa "%" está bloqueada pois a etapa pré-requisito "%" ainda não foi concluída.', v_stage.name, v_dep_stage.name;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Update chapter current stage
  UPDATE public.scan_production_chapters
  SET current_stage_slug = p_stage_slug, updated_at = now()
  WHERE id = p_production_chapter_id;

  RETURN jsonb_build_object('success', true, 'stage', p_stage_slug, 'status', p_new_status);
END;
$$;

-- Seed Default Workspace Components for a Scan
CREATE OR REPLACE FUNCTION public.seed_scan_workspace_defaults(p_scan_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Default Channels
  INSERT INTO public.scan_channels (scan_id, name, slug, description, category, type, display_order)
  VALUES
    (p_scan_id, 'geral', 'geral', 'Canal de conversa geral da equipe da Scan', 'GERAL', 'CHAT', 1),
    (p_scan_id, 'avisos', 'avisos', 'Avisos e comunicados oficiais da liderança', 'GERAL', 'ANNOUNCEMENT', 2),
    (p_scan_id, 'produção', 'producao', 'Discussões técnicas, lançamentos e dúvidas de pipeline', 'PRODUÇÃO', 'CHAT', 3)
  ON CONFLICT (scan_id, slug) DO NOTHING;

  -- 2. Default Workflow Stages
  INSERT INTO public.scan_workflow_stages (scan_id, name, slug, description, color, display_order, required, dependencies)
  VALUES
    (p_scan_id, 'Raw', 'raw', 'Obtenção dos arquivos de imagem originais em alta resolução', '#64748b', 1, true, '{}'),
    (p_scan_id, 'Clean / Redraw', 'clean_redraw', 'Limpeza de balões, onomatopeias e reconstrução de arte', '#ec4899', 2, false, '{"raw"}'),
    (p_scan_id, 'Tradução', 'traducao', 'Tradução do idioma original mantendo o tom e vocabulário da obra', '#3b82f6', 3, true, '{"raw"}'),
    (p_scan_id, 'Typeset', 'typeset', 'Diagramação de fontes e posicionamento nos balões', '#eab308', 4, true, '{"clean_redraw", "traducao"}'),
    (p_scan_id, 'Revisão', 'revisao', 'Verificação ortográfica, fluidez de leitura e gramática', '#8b5cf6', 5, true, '{"typeset"}'),
    (p_scan_id, 'Quality Control (QC)', 'qc', 'Inspeção minuciosa página a página antes da liberação', '#06b6d4', 6, true, '{"revisao"}'),
    (p_scan_id, 'Pronto para Upar', 'ready', 'Capítulo finalizado e aprovado para publicação no catálogo', '#10b981', 7, true, '{"qc"}')
  ON CONFLICT (scan_id, slug) DO UPDATE SET
    dependencies = EXCLUDED.dependencies;

  -- 3. Default Positions
  INSERT INTO public.scan_positions (scan_id, name, description, display_order, is_active)
  VALUES
    (p_scan_id, 'Tradutor', 'Responsável pela tradução fiel e adaptação dos textos', 1, true),
    (p_scan_id, 'Revisor', 'Garante a precisão gramatical, coerência e estilo dos diálogos', 2, true),
    (p_scan_id, 'Cleaner / Redrawer', 'Limpa os balões de diálogo e redesenha artes de fundo', 3, true),
    (p_scan_id, 'Typesetter', 'Insere as falas diagramadas com fontes apropriadas para cada contexto', 4, true),
    (p_scan_id, 'Quality Control (QC)', 'Audita as páginas prontas apontando correções finais', 5, true),
    (p_scan_id, 'Uploader', 'Organiza metadados e publica os capítulos na plataforma', 6, true)
  ON CONFLICT DO NOTHING;

  -- 4. Default Academy Tutorials
  INSERT INTO public.scan_academy_tutorials (scan_id, title, slug, category, content, is_published, display_order)
  VALUES
    (
      p_scan_id,
      'Manual de Boas Práticas de Tradução',
      'manual-traducao',
      'Tradução',
      '# Manual de Tradução\n\nBem-vindo à equipe de tradução! Este guia define os padrões esperados para garantir fluidez e qualidade máxima.\n\n### 1. Diretrizes Essenciais\n- **Consulte o Glossário:** Antes de começar qualquer capítulo, abra o Glossário da obra para conferir termos técnicos, nomes próprios e golpes já padronizados.\n- **Pontuação e Expressividade:** Use reticências com moderação. Mantenha exclamações coerentes com a emoção da cena.\n- **Onomatopeias:** Quando necessário, inclua notas no arquivo para o Typesetter indicando o significado do efeito sonoro.',
      true,
      1
    ),
    (
      p_scan_id,
      'Guia de Revisão e Quality Control (QC)',
      'guia-revisao-qc',
      'QC',
      '# Guia de Revisão e QC\n\nO revisor e o agente de QC são os guardiões finais da qualidade antes do leitor ver o capítulo.\n\n### Checklist Rápido\n- [ ] Nomes de personagens batem com o Glossário da Obra\n- [ ] Não há textos vazando para fora dos balões\n- [ ] As fontes usadas respeitam a hierarquia (gritos, sussurros, narração)\n- [ ] A numeração e a ordem de leitura das páginas estão 100% corretas',
      true,
      2
    )
  ON CONFLICT (scan_id, slug) DO NOTHING;
END;
$$;
