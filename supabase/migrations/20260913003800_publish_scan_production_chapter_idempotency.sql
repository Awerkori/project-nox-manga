-- PROJECT NOX — MIGRATION: PUBLISH IDEMPOTENCY & CONCURRENCY SHIELD
-- Migration ID: 20260913003800_publish_scan_production_chapter_idempotency.sql

-- 1. Unique constraint on chapter_credit_snapshots to prevent duplicate credits on retries
CREATE UNIQUE INDEX IF NOT EXISTS uq_chapter_credit_snapshots_identity 
  ON public.chapter_credit_snapshots (chapter_id, production_chapter_id, publication_version, stage_slug, user_id);

-- 2. Fully idempotent publish_scan_production_chapter
CREATE OR REPLACE FUNCTION public.publish_scan_production_chapter(
  p_production_chapter_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_chapter public.scan_production_chapters;
  v_scan public.scans;
  v_member_role text;
  v_caller_name text;
  v_pub_chapter_id uuid;
  v_stage RECORD;
  v_user_snapshot RECORD;
  v_snapshot_version int;
BEGIN
  -- Serialize concurrent publishes with FOR UPDATE row lock
  SELECT * INTO v_chapter 
  FROM public.scan_production_chapters 
  WHERE id = p_production_chapter_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Capítulo em produção não encontrado.';
  END IF;

  -- IDEMPOTENCY BARRIER: If already published, return idempotent success with ZERO duplicated side effects
  IF v_chapter.status = 'PUBLISHED' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_published', true,
      'idempotent', true,
      'chapter_id', v_chapter.target_chapter_id,
      'publication_version', v_chapter.publication_version,
      'message', 'Capítulo já se encontra publicado.'
    );
  END IF;

  SELECT * INTO v_scan FROM public.scans WHERE id = v_chapter.scan_id;
  
  IF v_caller IS NOT NULL THEN
    SELECT role INTO v_member_role FROM public.scan_members WHERE scan_id = v_chapter.scan_id AND user_id = v_caller;
    IF (v_member_role NOT IN ('OWNER', 'ADMIN', 'UPLOADER') OR v_member_role IS NULL) AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Apenas administradores ou uploaders da Scan podem publicar.';
    END IF;
  END IF;

  SELECT COALESCE(display_name, username) INTO v_caller_name FROM public.members WHERE id = COALESCE(v_caller, v_chapter.created_by);
  IF v_caller_name IS NULL THEN
    v_caller_name := 'Project Nox Automation';
  END IF;

  -- Find or create public chapter
  IF v_chapter.target_chapter_id IS NOT NULL THEN
    v_pub_chapter_id := v_chapter.target_chapter_id;
    UPDATE public.chapters 
    SET published_at = COALESCE(published_at, now()) 
    WHERE id = v_pub_chapter_id;
  ELSE
    SELECT id INTO v_pub_chapter_id 
    FROM public.chapters 
    WHERE work_id = v_chapter.work_id AND number = v_chapter.chapter_number;

    IF NOT FOUND THEN
      INSERT INTO public.chapters (
        work_id,
        number,
        title,
        published_at
      ) VALUES (
        v_chapter.work_id,
        v_chapter.chapter_number,
        COALESCE(v_chapter.chapter_label, v_chapter.chapter_title, 'Capítulo ' || v_chapter.chapter_number),
        now()
      ) RETURNING id INTO v_pub_chapter_id;
    ELSE
      UPDATE public.chapters 
      SET published_at = COALESCE(published_at, now()) 
      WHERE id = v_pub_chapter_id;
    END IF;

    UPDATE public.scan_production_chapters 
    SET target_chapter_id = v_pub_chapter_id 
    WHERE id = p_production_chapter_id;
  END IF;

  -- Ensure scan association with public chapter
  INSERT INTO public.chapter_scans (chapter_id, scan_id)
  VALUES (v_pub_chapter_id, v_scan.id)
  ON CONFLICT (chapter_id, scan_id) DO NOTHING;

  v_snapshot_version := COALESCE(v_chapter.publication_version, 1);

  -- Freeze Credit Snapshots from completed/assigned stages (Idempotent ON CONFLICT)
  FOR v_stage IN (
    SELECT 
      cs.*,
      ws.name AS stage_name,
      ws.slug AS stage_slug,
      ws.display_order
    FROM public.scan_chapter_stages cs
    JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
    WHERE cs.production_chapter_id = p_production_chapter_id
      AND (cs.completed_by IS NOT NULL OR cs.assigned_to IS NOT NULL)
    ORDER BY ws.display_order ASC
  ) LOOP
    SELECT 
      m.id,
      COALESCE(m.display_name, m.username, 'Membro Staff') AS display_name,
      m.avatar_id
    INTO v_user_snapshot
    FROM public.members m 
    WHERE m.id = COALESCE(v_stage.completed_by, v_stage.assigned_to);

    IF FOUND THEN
      INSERT INTO public.chapter_credit_snapshots (
        chapter_id,
        production_chapter_id,
        publication_version,
        scan_id,
        scan_name_snapshot,
        scan_slug_snapshot,
        stage_name,
        stage_slug,
        user_id,
        display_name_snapshot,
        avatar_id_snapshot,
        role_order
      ) VALUES (
        v_pub_chapter_id,
        p_production_chapter_id,
        v_snapshot_version,
        v_scan.id,
        v_scan.name,
        v_scan.slug,
        v_stage.stage_name,
        v_stage.stage_slug,
        v_user_snapshot.id,
        v_user_snapshot.display_name,
        v_user_snapshot.avatar_id,
        v_stage.display_order
      )
      ON CONFLICT (chapter_id, production_chapter_id, publication_version, stage_slug, user_id) 
      DO NOTHING;
    END IF;
  END LOOP;

  -- Mark chapter PUBLISHED
  UPDATE public.scan_production_chapters 
  SET 
    status = 'PUBLISHED',
    publication_version = v_snapshot_version + 1,
    published_snapshot = jsonb_build_object(
      'published_at', now(),
      'published_by', v_caller,
      'publisher_name', v_caller_name,
      'chapter_id', v_pub_chapter_id,
      'version', v_snapshot_version
    ),
    updated_at = now()
  WHERE id = p_production_chapter_id;

  -- Timeline: Deduplicated insert
  IF NOT EXISTS (
    SELECT 1 FROM public.scan_chapter_timeline 
    WHERE production_chapter_id = p_production_chapter_id 
      AND event_type = 'PUBLISHED' 
      AND (details->>'publication_version')::int = v_snapshot_version
  ) THEN
    INSERT INTO public.scan_chapter_timeline (
      scan_id,
      production_chapter_id,
      event_type,
      user_id,
      user_name,
      details
    ) VALUES (
      v_scan.id,
      p_production_chapter_id,
      'PUBLISHED',
      v_caller,
      v_caller_name,
      jsonb_build_object(
        'target_chapter_id', v_pub_chapter_id,
        'publication_version', v_snapshot_version
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_published', false,
    'idempotent', false,
    'chapter_id', v_pub_chapter_id,
    'publication_version', v_snapshot_version
  );
END;
$$;
