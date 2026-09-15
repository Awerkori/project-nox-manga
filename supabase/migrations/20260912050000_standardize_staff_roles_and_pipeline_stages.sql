-- Migration: Standardize Staff Roles and Pipeline Stages
-- 20260912050000_standardize_staff_roles_and_pipeline_stages.sql

-- ======================================================================
-- 1. STANDARDIZE OFFICIAL STAFF ROLES (scan_positions)
-- Canonical 7 roles:
-- 1: Dono
-- 2: Gerente
-- 3: Raw Provider
-- 4: Tradutor
-- 5: Clean/Redraw
-- 6: Typer
-- 7: Revisor (QC)
-- ======================================================================

DO $$
DECLARE
  v_scan RECORD;
  v_clean_redraw_id uuid;
  v_typer_id uuid;
  v_revisor_qc_id uuid;
  v_raw_id uuid;
  v_trad_id uuid;
  v_dono_id uuid;
  v_gerente_id uuid;
BEGIN
  FOR v_scan IN SELECT id FROM public.scans LOOP
    -- A. Rename existing canonical positions if present
    -- Cleaner / Redrawer -> Clean/Redraw
    UPDATE public.scan_positions 
    SET name = 'Clean/Redraw', display_order = 5, is_active = true
    WHERE scan_id = v_scan.id AND name = 'Cleaner / Redrawer';

    -- Typesetter -> Typer
    UPDATE public.scan_positions 
    SET name = 'Typer', display_order = 6, is_active = true
    WHERE scan_id = v_scan.id AND name = 'Typesetter';

    -- Revisor -> Revisor (QC)
    UPDATE public.scan_positions 
    SET name = 'Revisor (QC)', display_order = 7, is_active = true
    WHERE scan_id = v_scan.id AND name = 'Revisor';

    -- Raw Provider -> order 3
    UPDATE public.scan_positions 
    SET display_order = 3, is_active = true
    WHERE scan_id = v_scan.id AND name = 'Raw Provider';

    -- Tradutor -> order 4
    UPDATE public.scan_positions 
    SET display_order = 4, is_active = true
    WHERE scan_id = v_scan.id AND name = 'Tradutor';

    -- B. Ensure Dono & Gerente exist
    INSERT INTO public.scan_positions (scan_id, name, description, display_order, is_active)
    VALUES (v_scan.id, 'Dono', 'Dono e fundador da Scan', 1, true)
    ON CONFLICT (scan_id, name) DO UPDATE SET display_order = 1, is_active = true;

    INSERT INTO public.scan_positions (scan_id, name, description, display_order, is_active)
    VALUES (v_scan.id, 'Gerente', 'Gerência de projetos, equipe e publicações', 2, true)
    ON CONFLICT (scan_id, name) DO UPDATE SET display_order = 2, is_active = true;

    -- Ensure Clean/Redraw, Typer, Revisor (QC), Raw Provider, Tradutor exist
    INSERT INTO public.scan_positions (scan_id, name, description, display_order, is_active)
    VALUES (v_scan.id, 'Raw Provider', 'Obtenção e fornecimento dos arquivos originais em alta resolução', 3, true)
    ON CONFLICT (scan_id, name) DO UPDATE SET display_order = 3, is_active = true;

    INSERT INTO public.scan_positions (scan_id, name, description, display_order, is_active)
    VALUES (v_scan.id, 'Tradutor', 'Tradução e localização fiel dos diálogos e narrativas', 4, true)
    ON CONFLICT (scan_id, name) DO UPDATE SET display_order = 4, is_active = true;

    INSERT INTO public.scan_positions (scan_id, name, description, display_order, is_active)
    VALUES (v_scan.id, 'Clean/Redraw', 'Limpeza dos balões e reconstrução das artes e fundos', 5, true)
    ON CONFLICT (scan_id, name) DO UPDATE SET display_order = 5, is_active = true;

    INSERT INTO public.scan_positions (scan_id, name, description, display_order, is_active)
    VALUES (v_scan.id, 'Typer', 'Diagramação das falas, efeitos sonoros e tipografia nos balões', 6, true)
    ON CONFLICT (scan_id, name) DO UPDATE SET display_order = 6, is_active = true;

    INSERT INTO public.scan_positions (scan_id, name, description, display_order, is_active)
    VALUES (v_scan.id, 'Revisor (QC)', 'Revisão textual, coerência e controle rigoroso de qualidade', 7, true)
    ON CONFLICT (scan_id, name) DO UPDATE SET display_order = 7, is_active = true;

    -- Fetch primary IDs
    SELECT id INTO v_clean_redraw_id FROM public.scan_positions WHERE scan_id = v_scan.id AND name = 'Clean/Redraw';
    SELECT id INTO v_typer_id FROM public.scan_positions WHERE scan_id = v_scan.id AND name = 'Typer';
    SELECT id INTO v_revisor_qc_id FROM public.scan_positions WHERE scan_id = v_scan.id AND name = 'Revisor (QC)';

    -- C. Migrate foreign keys from redundant / obsolete positions to official ones
    -- 1. Cleaner & Redrawer -> Clean/Redraw
    -- Delete redundant assignments where user already has Clean/Redraw
    DELETE FROM public.scan_member_positions
    WHERE position_id IN (
      SELECT id FROM public.scan_positions WHERE scan_id = v_scan.id AND name IN ('Cleaner', 'Redrawer')
    )
    AND user_id IN (
      SELECT user_id FROM public.scan_member_positions WHERE position_id = v_clean_redraw_id
    );

    UPDATE public.scan_member_positions
    SET position_id = v_clean_redraw_id
    WHERE position_id IN (
      SELECT id FROM public.scan_positions WHERE scan_id = v_scan.id AND name IN ('Cleaner', 'Redrawer')
    );

    UPDATE public.scan_recruitment_openings
    SET position_id = v_clean_redraw_id
    WHERE position_id IN (
      SELECT id FROM public.scan_positions WHERE scan_id = v_scan.id AND name IN ('Cleaner', 'Redrawer')
    );

    UPDATE public.scan_applications
    SET position_id = v_clean_redraw_id
    WHERE position_id IN (
      SELECT id FROM public.scan_positions WHERE scan_id = v_scan.id AND name IN ('Cleaner', 'Redrawer')
    );

    UPDATE public.scan_invites
    SET position_id = v_clean_redraw_id
    WHERE position_id IN (
      SELECT id FROM public.scan_positions WHERE scan_id = v_scan.id AND name IN ('Cleaner', 'Redrawer')
    );

    UPDATE public.scan_message_mentions
    SET target_role_id = v_clean_redraw_id,
        mention_text = '@Clean/Redraw'
    WHERE target_role_id IN (
      SELECT id FROM public.scan_positions WHERE scan_id = v_scan.id AND name IN ('Cleaner', 'Redrawer', 'Cleaner / Redrawer')
    );

    -- 2. Quality Control (QC) & Quality Checker -> Revisor (QC)
    -- Delete redundant assignments where user already has Revisor (QC)
    DELETE FROM public.scan_member_positions
    WHERE position_id IN (
      SELECT id FROM public.scan_positions WHERE scan_id = v_scan.id AND name IN ('Quality Control (QC)', 'Quality Checker')
    )
    AND user_id IN (
      SELECT user_id FROM public.scan_member_positions WHERE position_id = v_revisor_qc_id
    );

    UPDATE public.scan_member_positions
    SET position_id = v_revisor_qc_id
    WHERE position_id IN (
      SELECT id FROM public.scan_positions WHERE scan_id = v_scan.id AND name IN ('Quality Control (QC)', 'Quality Checker')
    );

    UPDATE public.scan_recruitment_openings
    SET position_id = v_revisor_qc_id
    WHERE position_id IN (
      SELECT id FROM public.scan_positions WHERE scan_id = v_scan.id AND name IN ('Quality Control (QC)', 'Quality Checker')
    );

    UPDATE public.scan_applications
    SET position_id = v_revisor_qc_id
    WHERE position_id IN (
      SELECT id FROM public.scan_positions WHERE scan_id = v_scan.id AND name IN ('Quality Control (QC)', 'Quality Checker')
    );

    UPDATE public.scan_invites
    SET position_id = v_revisor_qc_id
    WHERE position_id IN (
      SELECT id FROM public.scan_positions WHERE scan_id = v_scan.id AND name IN ('Quality Control (QC)', 'Quality Checker')
    );

    UPDATE public.scan_message_mentions
    SET target_role_id = v_revisor_qc_id,
        mention_text = '@Revisor (QC)'
    WHERE target_role_id IN (
      SELECT id FROM public.scan_positions WHERE scan_id = v_scan.id AND name IN ('Quality Control (QC)', 'Quality Checker', 'Revisor')
    );

    -- 3. Any leftover Typesetter mentions -> Typer
    UPDATE public.scan_message_mentions
    SET target_role_id = v_typer_id,
        mention_text = '@Typer'
    WHERE target_role_id IN (
      SELECT id FROM public.scan_positions WHERE scan_id = v_scan.id AND name IN ('Typesetter')
    );

    -- D. Deduplicate scan_member_positions just in case
    DELETE FROM public.scan_member_positions a
    USING public.scan_member_positions b
    WHERE a.ctid < b.ctid
      AND a.scan_id = b.scan_id
      AND a.user_id = b.user_id
      AND a.position_id = b.position_id;

    -- E. Safely delete obsolete positions
    DELETE FROM public.scan_positions
    WHERE scan_id = v_scan.id
      AND name NOT IN (
        'Dono',
        'Gerente',
        'Raw Provider',
        'Tradutor',
        'Clean/Redraw',
        'Typer',
        'Revisor (QC)'
      );
  END LOOP;
END;
$$;


-- ======================================================================
-- 2. STANDARDIZE VISIBLE PIPELINE STAGES (scan_workflow_stages)
-- Exact 7 stages in strict visual & operational order:
-- 1: Raw Provider  (slug: raw,           deps: [])
-- 2: Tradução      (slug: traducao,      deps: [raw])
-- 3: Clean/Redraw  (slug: clean_redraw,  deps: [raw])
-- 4: Typeset       (slug: typeset,       deps: [traducao, clean_redraw])
-- 5: Revisor (QC)  (slug: revisor_qc,    deps: [typeset])
-- 6: Pré Aprovado  (slug: pre_aprovado,  deps: [revisor_qc])
-- 7: Publicado     (slug: publicado,     deps: [pre_aprovado])
-- ======================================================================

DO $$
DECLARE
  v_scan RECORD;
  v_raw_pos_id uuid;
  v_trad_pos_id uuid;
  v_clean_pos_id uuid;
  v_typer_pos_id uuid;
  v_qc_pos_id uuid;

  v_stage_raw_id uuid;
  v_stage_trad_id uuid;
  v_stage_clean_id uuid;
  v_stage_typeset_id uuid;
  v_stage_revisor_id uuid;
  v_stage_pre_aprovado_id uuid;
  v_stage_pub_id uuid;
  v_old_qc_id uuid;
  v_old_preview_id uuid;
BEGIN
  FOR v_scan IN SELECT id FROM public.scans LOOP
    -- Fetch official position IDs
    SELECT id INTO v_raw_pos_id FROM public.scan_positions WHERE scan_id = v_scan.id AND name = 'Raw Provider';
    SELECT id INTO v_trad_pos_id FROM public.scan_positions WHERE scan_id = v_scan.id AND name = 'Tradutor';
    SELECT id INTO v_clean_pos_id FROM public.scan_positions WHERE scan_id = v_scan.id AND name = 'Clean/Redraw';
    SELECT id INTO v_typer_pos_id FROM public.scan_positions WHERE scan_id = v_scan.id AND name = 'Typer';
    SELECT id INTO v_qc_pos_id FROM public.scan_positions WHERE scan_id = v_scan.id AND name = 'Revisor (QC)';

    -- 1. Stage: Raw Provider
    UPDATE public.scan_workflow_stages
    SET name = 'Raw Provider',
        display_order = 1,
        dependencies = '{}',
        color = '#64748b',
        allowed_position_ids = CASE WHEN v_raw_pos_id IS NOT NULL THEN ARRAY[v_raw_pos_id] ELSE '{}'::uuid[] END,
        requires_output = true,
        is_active = true
    WHERE scan_id = v_scan.id AND slug = 'raw';

    -- 2. Stage: Tradução
    UPDATE public.scan_workflow_stages
    SET name = 'Tradução',
        display_order = 2,
        dependencies = '{"raw"}',
        color = '#3b82f6',
        allowed_position_ids = CASE WHEN v_trad_pos_id IS NOT NULL THEN ARRAY[v_trad_pos_id] ELSE '{}'::uuid[] END,
        requires_output = true,
        is_active = true
    WHERE scan_id = v_scan.id AND slug = 'traducao';

    -- 3. Stage: Clean/Redraw
    UPDATE public.scan_workflow_stages
    SET name = 'Clean/Redraw',
        display_order = 3,
        dependencies = '{"raw"}',
        color = '#ec4899',
        allowed_position_ids = CASE WHEN v_clean_pos_id IS NOT NULL THEN ARRAY[v_clean_pos_id] ELSE '{}'::uuid[] END,
        requires_output = true,
        is_active = true
    WHERE scan_id = v_scan.id AND slug = 'clean_redraw';

    -- 4. Stage: Typeset
    UPDATE public.scan_workflow_stages
    SET name = 'Typeset',
        display_order = 4,
        dependencies = '{"traducao", "clean_redraw"}',
        color = '#eab308',
        allowed_position_ids = CASE WHEN v_typer_pos_id IS NOT NULL THEN ARRAY[v_typer_pos_id] ELSE '{}'::uuid[] END,
        requires_output = true,
        is_active = true
    WHERE scan_id = v_scan.id AND slug = 'typeset';

    -- 5. Stage: Revisor (QC) (transform 'revisao' stage into 'revisor_qc')
    UPDATE public.scan_workflow_stages
    SET name = 'Revisor (QC)',
        slug = 'revisor_qc',
        display_order = 5,
        dependencies = '{"typeset"}',
        color = '#a855f7',
        allowed_position_ids = CASE WHEN v_qc_pos_id IS NOT NULL THEN ARRAY[v_qc_pos_id] ELSE '{}'::uuid[] END,
        requires_output = false,
        is_active = true
    WHERE scan_id = v_scan.id AND slug IN ('revisao', 'revisor_qc');

    -- If revisor_qc wasn't present from revisao, insert it
    INSERT INTO public.scan_workflow_stages (
      scan_id, name, slug, description, color, display_order, required, is_active, dependencies, allowed_position_ids, requires_output
    ) VALUES (
      v_scan.id, 'Revisor (QC)', 'revisor_qc', 'Revisão textual, coerência de diagramação e controle de qualidade',
      '#a855f7', 5, true, true, '{"typeset"}', CASE WHEN v_qc_pos_id IS NOT NULL THEN ARRAY[v_qc_pos_id] ELSE '{}'::uuid[] END, false
    ) ON CONFLICT (scan_id, slug) DO UPDATE SET
      name = 'Revisor (QC)',
      display_order = 5,
      dependencies = '{"typeset"}',
      allowed_position_ids = EXCLUDED.allowed_position_ids,
      requires_output = false;

    -- 6. Stage: Pré Aprovado (transform 'ready' stage into 'pre_aprovado')
    UPDATE public.scan_workflow_stages
    SET name = 'Pré Aprovado',
        slug = 'pre_aprovado',
        display_order = 6,
        dependencies = '{"revisor_qc"}',
        color = '#06b6d4',
        allowed_position_ids = '{}'::uuid[],
        requires_output = false,
        is_active = true
    WHERE scan_id = v_scan.id AND slug IN ('ready', 'pre_aprovado');

    INSERT INTO public.scan_workflow_stages (
      scan_id, name, slug, description, color, display_order, required, is_active, dependencies, allowed_position_ids, requires_output
    ) VALUES (
      v_scan.id, 'Pré Aprovado', 'pre_aprovado', 'Capítulo finalizado e validado, pronto para liberação oficial',
      '#06b6d4', 6, true, true, '{"revisor_qc"}', '{}'::uuid[], false
    ) ON CONFLICT (scan_id, slug) DO UPDATE SET
      name = 'Pré Aprovado',
      display_order = 6,
      dependencies = '{"revisor_qc"}',
      requires_output = false;

    -- 7. Stage: Publicado
    UPDATE public.scan_workflow_stages
    SET name = 'Publicado',
        display_order = 7,
        dependencies = '{"pre_aprovado"}',
        color = '#22c55e',
        allowed_position_ids = '{}'::uuid[],
        requires_output = false,
        is_active = true
    WHERE scan_id = v_scan.id AND slug = 'publicado';

    INSERT INTO public.scan_workflow_stages (
      scan_id, name, slug, description, color, display_order, required, is_active, dependencies, allowed_position_ids, requires_output
    ) VALUES (
      v_scan.id, 'Publicado', 'publicado', 'Capítulo publicado e ativo no site oficial do Project Nox',
      '#22c55e', 7, true, true, '{"pre_aprovado"}', '{}'::uuid[], false
    ) ON CONFLICT (scan_id, slug) DO UPDATE SET
      name = 'Publicado',
      display_order = 7,
      dependencies = '{"pre_aprovado"}',
      requires_output = false;

    -- Retrieve IDs for stage mapping
    SELECT id INTO v_stage_revisor_id FROM public.scan_workflow_stages WHERE scan_id = v_scan.id AND slug = 'revisor_qc';
    SELECT id INTO v_stage_pre_aprovado_id FROM public.scan_workflow_stages WHERE scan_id = v_scan.id AND slug = 'pre_aprovado';
    SELECT id INTO v_old_qc_id FROM public.scan_workflow_stages WHERE scan_id = v_scan.id AND slug = 'qc';
    SELECT id INTO v_old_preview_id FROM public.scan_workflow_stages WHERE scan_id = v_scan.id AND slug = 'preview';

    -- Re-map scan_chapter_stages
    -- Delete redundant chapter stages for old 'qc' and 'preview' if chapter already has the unified stages
    IF v_old_qc_id IS NOT NULL THEN
      DELETE FROM public.scan_chapter_stages
      WHERE stage_id = v_old_qc_id;
    END IF;

    IF v_old_preview_id IS NOT NULL THEN
      DELETE FROM public.scan_chapter_stages
      WHERE stage_id = v_old_preview_id;
    END IF;

    -- Re-point timeline entries
    IF v_old_qc_id IS NOT NULL THEN
      UPDATE public.scan_chapter_timeline
      SET stage_id = v_stage_revisor_id, stage_slug = 'revisor_qc'
      WHERE stage_id = v_old_qc_id;
    END IF;

    UPDATE public.scan_chapter_timeline
    SET stage_id = v_stage_revisor_id, stage_slug = 'revisor_qc'
    WHERE scan_id = v_scan.id AND stage_slug IN ('revisao', 'qc');

    IF v_old_preview_id IS NOT NULL THEN
      UPDATE public.scan_chapter_timeline
      SET stage_id = v_stage_pre_aprovado_id, stage_slug = 'pre_aprovado'
      WHERE stage_id = v_old_preview_id;
    END IF;

    UPDATE public.scan_chapter_timeline
    SET stage_id = v_stage_pre_aprovado_id, stage_slug = 'pre_aprovado'
    WHERE scan_id = v_scan.id AND stage_slug IN ('ready', 'preview');

    -- Re-point production files
    IF v_old_qc_id IS NOT NULL THEN
      UPDATE public.scan_production_files
      SET stage_id = v_stage_revisor_id, stage_slug = 'revisor_qc'
      WHERE stage_id = v_old_qc_id;
    END IF;

    UPDATE public.scan_production_files
    SET stage_id = v_stage_revisor_id, stage_slug = 'revisor_qc'
    WHERE scan_id = v_scan.id AND stage_slug IN ('revisao', 'qc');

    IF v_old_preview_id IS NOT NULL THEN
      UPDATE public.scan_production_files
      SET stage_id = v_stage_pre_aprovado_id, stage_slug = 'pre_aprovado'
      WHERE stage_id = v_old_preview_id;
    END IF;

    UPDATE public.scan_production_files
    SET stage_id = v_stage_pre_aprovado_id, stage_slug = 'pre_aprovado'
    WHERE scan_id = v_scan.id AND stage_slug IN ('ready', 'preview');

    -- Delete obsolete stages from scan_workflow_stages
    DELETE FROM public.scan_workflow_stages
    WHERE scan_id = v_scan.id
      AND slug NOT IN (
        'raw',
        'traducao',
        'clean_redraw',
        'typeset',
        'revisor_qc',
        'pre_aprovado',
        'publicado'
      );
  END LOOP;
END;
$$;


-- ======================================================================
-- 3. UPDATE PRESET SEED FUNCTIONS
-- ======================================================================

CREATE OR REPLACE FUNCTION public.seed_scan_default_positions(p_scan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_presets text[] := ARRAY[
    'Dono',
    'Gerente',
    'Raw Provider',
    'Tradutor',
    'Clean/Redraw',
    'Typer',
    'Revisor (QC)'
  ];
  v_pos text;
  v_order integer := 1;
BEGIN
  FOREACH v_pos IN ARRAY v_presets LOOP
    INSERT INTO public.scan_positions (scan_id, name, display_order, is_active)
    VALUES (p_scan_id, v_pos, v_order, true)
    ON CONFLICT (scan_id, name) DO UPDATE SET display_order = v_order;
    v_order := v_order + 1;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_scan_workspace_defaults(p_scan_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_raw_pos_id uuid;
  v_trad_pos_id uuid;
  v_clean_pos_id uuid;
  v_typer_pos_id uuid;
  v_qc_pos_id uuid;
BEGIN
  -- 1. Default Channels
  INSERT INTO public.scan_channels (scan_id, name, slug, description, category, type, display_order)
  VALUES
    (p_scan_id, 'geral', 'geral', 'Canal de conversa geral da equipe da Scan', 'GERAL', 'CHAT', 1),
    (p_scan_id, 'avisos', 'avisos', 'Avisos e comunicados oficiais da liderança', 'GERAL', 'ANNOUNCEMENT', 2),
    (p_scan_id, 'produção', 'producao', 'Discussões técnicas, lançamentos e dúvidas de pipeline', 'PRODUÇÃO', 'CHAT', 3)
  ON CONFLICT (scan_id, slug) DO NOTHING;

  -- 2. Default Positions
  PERFORM public.seed_scan_default_positions(p_scan_id);

  SELECT id INTO v_raw_pos_id FROM public.scan_positions WHERE scan_id = p_scan_id AND name = 'Raw Provider';
  SELECT id INTO v_trad_pos_id FROM public.scan_positions WHERE scan_id = p_scan_id AND name = 'Tradutor';
  SELECT id INTO v_clean_pos_id FROM public.scan_positions WHERE scan_id = p_scan_id AND name = 'Clean/Redraw';
  SELECT id INTO v_typer_pos_id FROM public.scan_positions WHERE scan_id = p_scan_id AND name = 'Typer';
  SELECT id INTO v_qc_pos_id FROM public.scan_positions WHERE scan_id = p_scan_id AND name = 'Revisor (QC)';

  -- 3. Default Workflow Stages (Strict 7 Canonical Stages)
  INSERT INTO public.scan_workflow_stages (
    scan_id, name, slug, description, color, display_order, required, is_active, dependencies, allowed_position_ids, requires_output
  ) VALUES
    (p_scan_id, 'Raw Provider', 'raw', 'Obtenção dos arquivos de imagem originais em alta resolução', '#64748b', 1, true, true, '{}', CASE WHEN v_raw_pos_id IS NOT NULL THEN ARRAY[v_raw_pos_id] ELSE '{}'::uuid[] END, true),
    (p_scan_id, 'Tradução', 'traducao', 'Tradução e localização fiel mantendo o tom e vocabulário da obra', '#3b82f6', 2, true, true, '{"raw"}', CASE WHEN v_trad_pos_id IS NOT NULL THEN ARRAY[v_trad_pos_id] ELSE '{}'::uuid[] END, true),
    (p_scan_id, 'Clean/Redraw', 'clean_redraw', 'Limpeza de balões, onomatopeias e reconstrução de arte', '#ec4899', 3, true, true, '{"raw"}', CASE WHEN v_clean_pos_id IS NOT NULL THEN ARRAY[v_clean_pos_id] ELSE '{}'::uuid[] END, true),
    (p_scan_id, 'Typeset', 'typeset', 'Diagramação de fontes e posicionamento nos balões', '#eab308', 4, true, true, '{"traducao", "clean_redraw"}', CASE WHEN v_typer_pos_id IS NOT NULL THEN ARRAY[v_typer_pos_id] ELSE '{}'::uuid[] END, true),
    (p_scan_id, 'Revisor (QC)', 'revisor_qc', 'Revisão textual, coerência de diagramação e controle rigoroso de qualidade', '#a855f7', 5, true, true, '{"typeset"}', CASE WHEN v_qc_pos_id IS NOT NULL THEN ARRAY[v_qc_pos_id] ELSE '{}'::uuid[] END, false),
    (p_scan_id, 'Pré Aprovado', 'pre_aprovado', 'Capítulo finalizado e aprovado para publicação no catálogo', '#06b6d4', 6, true, true, '{"revisor_qc"}', '{}'::uuid[], false),
    (p_scan_id, 'Publicado', 'publicado', 'Capítulo publicado e ativo no site oficial do Project Nox', '#22c55e', 7, true, true, '{"pre_aprovado"}', '{}'::uuid[], false)
  ON CONFLICT (scan_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    display_order = EXCLUDED.display_order,
    dependencies = EXCLUDED.dependencies,
    allowed_position_ids = EXCLUDED.allowed_position_ids,
    requires_output = EXCLUDED.requires_output;

  -- 4. Default Academy Tutorials
  INSERT INTO public.scan_academy_tutorials (scan_id, title, slug, category, content, is_published, display_order)
  VALUES
    (
      p_scan_id,
      'Manual de Boas Práticas de Tradução',
      'manual-traducao',
      'Tradução',
      '# Manual de Tradução\n\nBem-vindo à equipe de tradução! Este guia define os padrões esperados para garantir fluidez e qualidade máxima.\n\n### 1. Diretrizes Essenciais\n- **Consulte o Glossário:** Antes de começar qualquer capítulo, abra o Glossário da obra para conferir termos técnicos, nomes próprios e golpes já padronizados.\n- **Pontuação e Expressividade:** Use reticências com moderação. Mantenha exclamações coerentes com a emoção da cena.\n- **Onomatopeias:** Quando necessário, inclua notas no arquivo para o Typer indicando o significado do efeito sonoro.',
      true,
      1
    )
  ON CONFLICT DO NOTHING;
END;
$$;


-- ======================================================================
-- 4. UPDATE RESOLVE DEPENDENCIES RPC FOR CANONICAL 7 STAGES
-- ======================================================================

CREATE OR REPLACE FUNCTION public.resolve_scan_chapter_dependencies(
  p_production_chapter_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prod_chapter public.scan_production_chapters;
  v_stage_record RECORD;
  v_dep_slug text;
  v_dep_stage RECORD;
  v_dep_files_exist boolean;
  v_all_deps_satisfied boolean;
  v_deps_array text[];
  v_target_user RECORD;
  v_newly_available boolean;
  v_upstream_file RECORD;
  v_downstream_file RECORD;
BEGIN
  SELECT * INTO v_prod_chapter FROM public.scan_production_chapters WHERE id = p_production_chapter_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 1. STALE DOWNSTREAM CHECK
  FOR v_upstream_file IN (
    SELECT spf.stage_slug, MAX(spf.version) as current_version
    FROM public.scan_production_files spf
    WHERE spf.production_chapter_id = p_production_chapter_id
      AND spf.is_current = true
    GROUP BY spf.stage_slug
  ) LOOP
    FOR v_downstream_file IN (
      SELECT spf.*
      FROM public.scan_production_files spf
      WHERE spf.production_chapter_id = p_production_chapter_id
        AND spf.is_current = true
        AND spf.stage_slug != v_upstream_file.stage_slug
        AND spf.input_files IS NOT NULL
        AND jsonb_array_length(spf.input_files) > 0
    ) LOOP
      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_downstream_file.input_files) elem
        WHERE elem->>'stage_slug' = v_upstream_file.stage_slug
          AND (elem->>'version')::int < v_upstream_file.current_version
      ) THEN
        UPDATE public.scan_production_files
        SET 
          is_stale = true,
          stale_reason = 'Insumo de ' || v_upstream_file.stage_slug || ' atualizado para v' || v_upstream_file.current_version
        WHERE id = v_downstream_file.id;

        UPDATE public.scan_chapter_stages cs
        SET 
          status = 'REWORK',
          rejection_reason = 'Insumo atualizado: Nova versão de ' || v_upstream_file.stage_slug || ' (v' || v_upstream_file.current_version || ') disponível. Revalidação/Typeset necessário.',
          last_activity_at = now(),
          updated_at = now()
        FROM public.scan_workflow_stages ws
        WHERE ws.id = cs.stage_id
          AND cs.production_chapter_id = p_production_chapter_id
          AND ws.slug = v_downstream_file.stage_slug
          AND cs.status IN ('DONE', 'AVAILABLE');
      END IF;
    END LOOP;
  END LOOP;

  -- 2. EVALUATE STAGES PROGRESSION
  FOR v_stage_record IN (
    SELECT 
      cs.id AS chapter_stage_id,
      cs.status,
      cs.notified_available,
      ws.id AS workflow_stage_id,
      ws.slug AS stage_slug,
      ws.name AS stage_name,
      ws.dependencies,
      ws.requires_output,
      ws.display_order
    FROM public.scan_chapter_stages cs
    JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
    WHERE cs.production_chapter_id = p_production_chapter_id
    ORDER BY ws.display_order ASC
  ) LOOP
    IF v_stage_record.status IN ('DONE', 'SKIPPED', 'IN_PROGRESS', 'REWORK') THEN
      CONTINUE;
    END IF;

    v_deps_array := v_stage_record.dependencies;

    IF v_deps_array IS NULL OR array_length(v_deps_array, 1) IS NULL OR array_length(v_deps_array, 1) = 0 THEN
      IF v_stage_record.status = 'BLOCKED' THEN
        UPDATE public.scan_chapter_stages 
        SET status = 'AVAILABLE', last_activity_at = now(), updated_at = now() 
        WHERE id = v_stage_record.chapter_stage_id;
      END IF;
      CONTINUE;
    END IF;

    v_all_deps_satisfied := true;

    FOREACH v_dep_slug IN ARRAY v_deps_array LOOP
      SELECT 
        cs.status,
        ws.requires_output,
        ws.id AS dep_stage_id
      INTO v_dep_stage
      FROM public.scan_chapter_stages cs
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE cs.production_chapter_id = p_production_chapter_id 
        AND ws.slug = v_dep_slug;

      IF NOT FOUND THEN
        v_all_deps_satisfied := false;
        EXIT;
      END IF;

      IF v_dep_stage.status NOT IN ('DONE', 'SKIPPED') THEN
        v_all_deps_satisfied := false;
        EXIT;
      END IF;

      IF v_dep_stage.status = 'DONE' AND COALESCE(v_dep_stage.requires_output, true) THEN
        SELECT EXISTS (
          SELECT 1 FROM public.scan_production_files 
          WHERE production_chapter_id = p_production_chapter_id 
            AND stage_id = v_dep_stage.dep_stage_id 
            AND is_current = true
        ) INTO v_dep_files_exist;

        IF NOT v_dep_files_exist THEN
          v_all_deps_satisfied := false;
          EXIT;
        END IF;
      END IF;
    END LOOP;

    v_newly_available := false;

    IF v_all_deps_satisfied THEN
      IF v_stage_record.status = 'BLOCKED' THEN
        UPDATE public.scan_chapter_stages 
        SET 
          status = 'AVAILABLE', 
          last_activity_at = now(), 
          updated_at = now() 
        WHERE id = v_stage_record.chapter_stage_id;

        v_newly_available := true;
      END IF;

      IF (v_newly_available OR v_stage_record.status = 'AVAILABLE') AND NOT COALESCE(v_stage_record.notified_available, false) THEN
        INSERT INTO public.scan_chapter_timeline (
          scan_id,
          production_chapter_id,
          stage_id,
          stage_slug,
          event_type,
          user_id,
          user_name,
          details
        ) VALUES (
          v_prod_chapter.scan_id,
          p_production_chapter_id,
          v_stage_record.workflow_stage_id,
          v_stage_record.stage_slug,
          'stage_became_available',
          NULL,
          'Sistema Editorial',
          jsonb_build_object(
            'stage_name', v_stage_record.stage_name,
            'stage_slug', v_stage_record.stage_slug,
            'chapter_number', v_prod_chapter.chapter_number
          )
        );

        -- Notify staff with matching position
        FOR v_target_user IN (
          SELECT DISTINCT sm.user_id
          FROM public.scan_members sm
          JOIN public.scan_member_positions smp ON smp.user_id = sm.user_id AND smp.scan_id = sm.scan_id
          JOIN public.scan_positions sp ON sp.id = smp.position_id
          WHERE sm.scan_id = v_prod_chapter.scan_id
            AND (
              lower(sp.name) = lower(v_stage_record.stage_name)
              OR lower(sp.name) LIKE '%' || lower(v_stage_record.stage_slug) || '%'
              OR (v_stage_record.stage_slug = 'raw' AND lower(sp.name) LIKE '%raw%')
              OR (v_stage_record.stage_slug = 'traducao' AND lower(sp.name) LIKE '%trad%')
              OR (v_stage_record.stage_slug = 'clean_redraw' AND (lower(sp.name) LIKE '%clean%' OR lower(sp.name) LIKE '%redraw%'))
              OR (v_stage_record.stage_slug = 'typeset' AND (lower(sp.name) LIKE '%type%'))
              OR (v_stage_record.stage_slug = 'revisor_qc' AND (lower(sp.name) LIKE '%revis%' OR lower(sp.name) LIKE '%qc%'))
            )
        ) LOOP
          INSERT INTO public.scan_notifications (
            scan_id,
            user_id,
            type,
            title,
            body,
            deep_link
          ) VALUES (
            v_prod_chapter.scan_id,
            v_target_user.user_id,
            'STAGE_READY',
            'Novo capítulo disponível para ' || v_stage_record.stage_name,
            'Capítulo #' || v_prod_chapter.chapter_number || ' agora está pronto e aguardando na fila.',
            '/scan?id=' || v_prod_chapter.scan_id || '&tab=minha_fila&stage=' || v_stage_record.stage_slug
          );
        END LOOP;

        UPDATE public.scan_chapter_stages 
        SET notified_available = true 
        WHERE id = v_stage_record.chapter_stage_id;
      END IF;
    ELSE
      IF v_stage_record.status = 'AVAILABLE' THEN
        UPDATE public.scan_chapter_stages 
        SET status = 'BLOCKED', notified_available = false, updated_at = now() 
        WHERE id = v_stage_record.chapter_stage_id;
      END IF;
    END IF;
  END LOOP;
END;
$$;
