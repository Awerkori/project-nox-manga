-- Migration: 20260911230000_scan_workspace_mural_attachments_and_pipeline.sql
-- Description: Mural posts, comments, reactions, private attachments, tutorial versioning, and clean pipeline stages.

-- 1. Mural Posts
CREATE TABLE IF NOT EXISTS public.scan_mural_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  post_type text NOT NULL DEFAULT 'GERAL' CHECK (post_type IN ('GERAL', 'AVISO', 'ATUALIZACAO', 'PRODUCAO', 'IMPORTANTE')),
  is_pinned boolean NOT NULL DEFAULT false,
  pinned_at timestamptz,
  pinned_by uuid REFERENCES public.members(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_mural_posts_scan_pinned ON public.scan_mural_posts(scan_id, is_pinned DESC, created_at DESC);

-- 2. Mural Comments & Replies
CREATE TABLE IF NOT EXISTS public.scan_mural_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.scan_mural_posts(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.scan_mural_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_mural_comments_post ON public.scan_mural_comments(post_id, created_at ASC);

-- 3. Mural Reactions
CREATE TABLE IF NOT EXISTS public.scan_mural_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.scan_mural_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.scan_mural_comments(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_mural_reaction_target CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_mural_rx_post ON public.scan_mural_reactions(post_id, user_id, emoji) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_mural_rx_comment ON public.scan_mural_reactions(comment_id, user_id, emoji) WHERE comment_id IS NOT NULL;

-- 4. Private Attachments Storage
CREATE TABLE IF NOT EXISTS public.scan_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  context_type text NOT NULL CHECK (context_type IN ('MURAL_POST', 'MURAL_COMMENT', 'TUTORIAL', 'WIKI', 'CHAPTER', 'QC')),
  context_id uuid NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  original_filename text NOT NULL,
  safe_filename text NOT NULL,
  mime_type text NOT NULL,
  size bigint NOT NULL,
  checksum text,
  storage_reference text NOT NULL,
  storage_provider text NOT NULL DEFAULT 'PRIVATE_STORAGE',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_attachments_ctx ON public.scan_attachments(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_scan_attachments_scan ON public.scan_attachments(scan_id);

-- 5. Tutorial Versions
CREATE TABLE IF NOT EXISTS public.scan_tutorial_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id uuid NOT NULL REFERENCES public.scan_academy_tutorials(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  content text NOT NULL,
  updated_by uuid REFERENCES public.members(id),
  change_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_tutorial_versions ON public.scan_tutorial_versions(tutorial_id, version_number DESC);

-- 6. Tutorial Reads & Favorites
CREATE TABLE IF NOT EXISTS public.scan_tutorial_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id uuid NOT NULL REFERENCES public.scan_academy_tutorials(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  is_favorite boolean NOT NULL DEFAULT false,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tutorial_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_scan_tutorial_reads ON public.scan_tutorial_reads(user_id, scan_id);

-- 7. Add mandatory_for_roles and status to scan_academy_tutorials if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scan_academy_tutorials' AND column_name = 'status') THEN
    ALTER TABLE public.scan_academy_tutorials ADD COLUMN status text NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scan_academy_tutorials' AND column_name = 'mandatory_for_roles') THEN
    ALTER TABLE public.scan_academy_tutorials ADD COLUMN mandatory_for_roles text[] DEFAULT '{}';
  END IF;
END;
$$;

-- 8. Enable Row-Level Security (RLS) on all new tables
ALTER TABLE public.scan_mural_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_mural_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_mural_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_tutorial_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_tutorial_reads ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies
-- scan_mural_posts
CREATE POLICY scan_mural_posts_select ON public.scan_mural_posts
  FOR SELECT TO authenticated
  USING (is_scan_member(scan_id, auth.uid()) OR EXISTS (SELECT 1 FROM access_roles WHERE user_id = auth.uid() AND role = 'ADMIN' AND suspended = false));

CREATE POLICY scan_mural_posts_insert ON public.scan_mural_posts
  FOR INSERT TO authenticated
  WITH CHECK (is_scan_member(scan_id, auth.uid()));

CREATE POLICY scan_mural_posts_update ON public.scan_mural_posts
  FOR UPDATE TO authenticated
  USING (
    (is_scan_member(scan_id, auth.uid()) AND author_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM scan_members WHERE scan_id = scan_mural_posts.scan_id AND user_id = auth.uid() AND role IN ('OWNER', 'ADMIN')) OR
    EXISTS (SELECT 1 FROM access_roles WHERE user_id = auth.uid() AND role = 'ADMIN' AND suspended = false)
  );

CREATE POLICY scan_mural_posts_delete ON public.scan_mural_posts
  FOR DELETE TO authenticated
  USING (
    (is_scan_member(scan_id, auth.uid()) AND author_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM scan_members WHERE scan_id = scan_mural_posts.scan_id AND user_id = auth.uid() AND role IN ('OWNER', 'ADMIN')) OR
    EXISTS (SELECT 1 FROM access_roles WHERE user_id = auth.uid() AND role = 'ADMIN' AND suspended = false)
  );

-- scan_mural_comments
CREATE POLICY scan_mural_comments_select ON public.scan_mural_comments
  FOR SELECT TO authenticated
  USING (is_scan_member(scan_id, auth.uid()) OR EXISTS (SELECT 1 FROM access_roles WHERE user_id = auth.uid() AND role = 'ADMIN' AND suspended = false));

CREATE POLICY scan_mural_comments_insert ON public.scan_mural_comments
  FOR INSERT TO authenticated
  WITH CHECK (is_scan_member(scan_id, auth.uid()));

CREATE POLICY scan_mural_comments_delete ON public.scan_mural_comments
  FOR DELETE TO authenticated
  USING (
    (is_scan_member(scan_id, auth.uid()) AND author_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM scan_members WHERE scan_id = scan_mural_comments.scan_id AND user_id = auth.uid() AND role IN ('OWNER', 'ADMIN')) OR
    EXISTS (SELECT 1 FROM access_roles WHERE user_id = auth.uid() AND role = 'ADMIN' AND suspended = false)
  );

-- scan_mural_reactions
CREATE POLICY scan_mural_reactions_all ON public.scan_mural_reactions
  FOR ALL TO authenticated
  USING (is_scan_member(scan_id, auth.uid()) OR EXISTS (SELECT 1 FROM access_roles WHERE user_id = auth.uid() AND role = 'ADMIN' AND suspended = false))
  WITH CHECK (is_scan_member(scan_id, auth.uid()));

-- scan_attachments
CREATE POLICY scan_attachments_select ON public.scan_attachments
  FOR SELECT TO authenticated
  USING (is_scan_member(scan_id, auth.uid()) OR EXISTS (SELECT 1 FROM access_roles WHERE user_id = auth.uid() AND role = 'ADMIN' AND suspended = false));

CREATE POLICY scan_attachments_insert ON public.scan_attachments
  FOR INSERT TO authenticated
  WITH CHECK (is_scan_member(scan_id, auth.uid()));

CREATE POLICY scan_attachments_delete ON public.scan_attachments
  FOR DELETE TO authenticated
  USING (
    (is_scan_member(scan_id, auth.uid()) AND uploaded_by = auth.uid()) OR
    EXISTS (SELECT 1 FROM scan_members WHERE scan_id = scan_attachments.scan_id AND user_id = auth.uid() AND role IN ('OWNER', 'ADMIN')) OR
    EXISTS (SELECT 1 FROM access_roles WHERE user_id = auth.uid() AND role = 'ADMIN' AND suspended = false)
  );

-- scan_tutorial_versions
CREATE POLICY scan_tutorial_versions_select ON public.scan_tutorial_versions
  FOR SELECT TO authenticated
  USING (is_scan_member(scan_id, auth.uid()) OR EXISTS (SELECT 1 FROM access_roles WHERE user_id = auth.uid() AND role = 'ADMIN' AND suspended = false));

CREATE POLICY scan_tutorial_versions_insert ON public.scan_tutorial_versions
  FOR INSERT TO authenticated
  WITH CHECK (is_scan_member(scan_id, auth.uid()));

-- scan_tutorial_reads
CREATE POLICY scan_tutorial_reads_all ON public.scan_tutorial_reads
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_scan_member(scan_id, auth.uid()))
  WITH CHECK (user_id = auth.uid());

-- 10. Clean up and standardize pipeline stages
-- Migrate tasks from redundant slugs
UPDATE public.scan_tasks
SET stage_id = (
  SELECT s2.id FROM public.scan_workflow_stages s2
  WHERE s2.scan_id = scan_tasks.scan_id AND s2.slug = 'clean_redraw'
  LIMIT 1
)
WHERE stage_id IN (
  SELECT s.id FROM public.scan_workflow_stages s
  WHERE s.slug IN ('cleaner', 'redraw')
);

UPDATE public.scan_tasks
SET stage_id = (
  SELECT s2.id FROM public.scan_workflow_stages s2
  WHERE s2.scan_id = scan_tasks.scan_id AND s2.slug = 'ready'
  LIMIT 1
)
WHERE stage_id IN (
  SELECT s.id FROM public.scan_workflow_stages s
  WHERE s.slug IN ('pronto')
);

-- Delete redundant stages
DELETE FROM public.scan_workflow_stages
WHERE slug IN ('cleaner', 'redraw', 'pronto');

-- Re-sequence stages to the clean 9-stage standard:
-- 1: RAW
-- 2: CLEAN / REDRAW
-- 3: TRADUÇÃO
-- 4: TYPESET
-- 5: REVISÃO
-- 6: QC
-- 7: PRONTO PRA UPAR
-- 8: PREVIEW
-- 9: PUBLICADO
UPDATE public.scan_workflow_stages SET display_order = 1, name = 'RAW', dependencies = '{}' WHERE slug = 'raw';
UPDATE public.scan_workflow_stages SET display_order = 2, name = 'CLEAN / REDRAW', dependencies = '{"raw"}' WHERE slug = 'clean_redraw';
UPDATE public.scan_workflow_stages SET display_order = 3, name = 'TRADUÇÃO', dependencies = '{"raw"}' WHERE slug = 'traducao';
UPDATE public.scan_workflow_stages SET display_order = 4, name = 'TYPESET', dependencies = '{"clean_redraw","traducao"}' WHERE slug = 'typeset';
UPDATE public.scan_workflow_stages SET display_order = 5, name = 'REVISÃO', dependencies = '{"typeset"}' WHERE slug = 'revisao';
UPDATE public.scan_workflow_stages SET display_order = 6, name = 'QC', dependencies = '{"revisao"}' WHERE slug = 'qc';
UPDATE public.scan_workflow_stages SET display_order = 7, name = 'PRONTO PRA UPAR', dependencies = '{"qc"}' WHERE slug = 'ready';

-- Ensure PREVIEW (8) and PUBLICADO (9) exist in scan_workflow_stages for all scans
INSERT INTO public.scan_workflow_stages (scan_id, name, slug, description, color, display_order, required, is_active, dependencies)
SELECT s.id, 'PREVIEW', 'preview', 'Validação visual privada no leitor antes do lançamento', '#6366f1', 8, true, true, '{"ready"}'::text[]
FROM public.scans s
ON CONFLICT (scan_id, slug) DO UPDATE SET display_order = 8, name = 'PREVIEW', dependencies = '{"ready"}';

INSERT INTO public.scan_workflow_stages (scan_id, name, slug, description, color, display_order, required, is_active, dependencies)
SELECT s.id, 'PUBLICADO', 'publicado', 'Capítulo publicado e ativo no site oficial do Project Nox', '#10b981', 9, true, true, '{"preview"}'::text[]
FROM public.scans s
ON CONFLICT (scan_id, slug) DO UPDATE SET display_order = 9, name = 'PUBLICADO', dependencies = '{"preview"}';

-- Replace seed_scan_default_stages function
CREATE OR REPLACE FUNCTION public.seed_scan_default_stages(p_scan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.scan_workflow_stages (scan_id, name, slug, description, color, display_order, required, is_active, dependencies)
  VALUES
    (p_scan_id, 'RAW', 'raw', 'Obtenção dos arquivos originais em alta resolução', '#64748b', 1, true, true, '{}'::text[]),
    (p_scan_id, 'CLEAN / REDRAW', 'clean_redraw', 'Limpeza de balões, remoção de SFX e reconstrução de arte', '#ec4899', 2, false, true, '{"raw"}'::text[]),
    (p_scan_id, 'TRADUÇÃO', 'traducao', 'Tradução do texto e adaptação cultural do roteiro', '#3b82f6', 3, true, true, '{"raw"}'::text[]),
    (p_scan_id, 'TYPESET', 'typeset', 'Diagramação, escolha de fontes, balões e lettering', '#eab308', 4, true, true, '{"clean_redraw","traducao"}'::text[]),
    (p_scan_id, 'REVISÃO', 'revisao', 'Revisão ortográfica, coerência e adequação textual', '#8b5cf6', 5, true, true, '{"typeset"}'::text[]),
    (p_scan_id, 'QC', 'qc', 'Quality Control página a página e inspeção minuciosa', '#06b6d4', 6, true, true, '{"revisao"}'::text[]),
    (p_scan_id, 'PRONTO PRA UPAR', 'ready', 'Arquivos finais compilados e prontos para envio', '#10b981', 7, true, true, '{"qc"}'::text[]),
    (p_scan_id, 'PREVIEW', 'preview', 'Validação visual privada no leitor antes do lançamento', '#6366f1', 8, true, true, '{"ready"}'::text[]),
    (p_scan_id, 'PUBLICADO', 'publicado', 'Capítulo publicado e ativo no site oficial do Project Nox', '#059669', 9, true, true, '{"preview"}'::text[])
  ON CONFLICT (scan_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    display_order = EXCLUDED.display_order,
    dependencies = EXCLUDED.dependencies;
END;
$$;

-- 11. Add Realtime publications for scan collaboration tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_mural_posts;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_mural_comments;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_mural_reactions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_notifications;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_tasks;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;
