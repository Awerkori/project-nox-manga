-- Global Scan deletion on the authoritative YSQL plane.
-- Public works/chapters are preserved; only their Scan attribution is removed.
-- The dynamic cleanup is intentional: older installations do not all have the
-- same optional workspace tables, so an absent table must not make the
-- migration or a deletion fail.
CREATE OR REPLACE FUNCTION public.global_admin_hard_delete_scan_ysql(
  p_scan_id uuid,
  p_confirmation text,
  p_reason text,
  p_actor_id uuid,
  p_is_global_admin boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scan_name text;
  v_table record;
BEGIN
  IF NOT COALESCE(p_is_global_admin, false) THEN
    RAISE EXCEPTION 'GLOBAL_ADMIN_REQUIRED';
  END IF;

  SELECT name INTO v_scan_name
  FROM public.scans
  WHERE id = p_scan_id
  FOR UPDATE;

  IF v_scan_name IS NULL THEN
    RAISE EXCEPTION 'SCAN_NOT_FOUND';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_confirmation, '')), '') IS NULL
     OR BTRIM(p_confirmation) <> BTRIM(v_scan_name) THEN
    RAISE EXCEPTION 'SCAN_CONFIRMATION_INVALID';
  END IF;

  -- Keep published catalogue content alive while removing Scan attribution.
  IF to_regclass('public.chapter_scans') IS NOT NULL THEN
    DELETE FROM public.chapter_scans WHERE scan_id = p_scan_id;
  END IF;
  IF to_regclass('public.work_scans') IS NOT NULL THEN
    DELETE FROM public.work_scans WHERE scan_id = p_scan_id;
  END IF;

  -- Delete private workspace rows. Child-first ordering covers the YSQL
  -- tables with foreign keys to stages/messages/notes; optional legacy tables
  -- are handled only when present in this installation.
  FOR v_table IN
    SELECT columns.table_name
    FROM information_schema.columns
    JOIN information_schema.tables catalog_tables
      ON catalog_tables.table_schema = columns.table_schema
     AND catalog_tables.table_name = columns.table_name
    WHERE columns.table_schema = 'public'
      AND columns.column_name = 'scan_id'
      AND catalog_tables.table_type = 'BASE TABLE'
      AND columns.table_name NOT IN ('scans', 'work_scans', 'chapter_scans', 'scan_global_audit_log')
    ORDER BY CASE columns.table_name
      WHEN 'scan_message_reactions' THEN 1
      WHEN 'scan_message_mentions_ysql' THEN 2
      WHEN 'scan_pipeline_stage_seen' THEN 3
      WHEN 'scan_chapter_note_events' THEN 4
      WHEN 'scan_chapter_notes' THEN 5
      WHEN 'scan_pipeline_upload_attempts' THEN 6
      WHEN 'scan_production_files' THEN 7
      WHEN 'scan_chapter_stages' THEN 8
      WHEN 'scan_production_chapters' THEN 9
      WHEN 'scan_workflow_stages' THEN 10
      ELSE 50
    END,
    columns.table_name
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE scan_id = $1', v_table.table_name)
      USING p_scan_id;
  END LOOP;

  -- Preserve an audit record even though the Scan row is removed. The FK on
  -- scan_global_audit_log is defined ON DELETE SET NULL in the legacy schema.
  IF to_regclass('public.scan_global_audit_log') IS NOT NULL THEN
    INSERT INTO public.scan_global_audit_log (scan_id, scan_name, admin_id, action, reason)
    VALUES (p_scan_id, v_scan_name, p_actor_id, 'SCAN_HARD_DELETED', p_reason);
  END IF;

  DELETE FROM public.scans WHERE id = p_scan_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_scan_name', v_scan_name,
    'public_content_preserved', true
  );
END;
$$;
