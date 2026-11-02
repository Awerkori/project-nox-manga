-- Migration: 20260915190000_guard_official_scan_hard_delete.sql
-- Purpose: keep the official Project Nox scan undeletable at the database boundary.
-- This is intentionally a CREATE OR REPLACE of the existing SECURITY DEFINER
-- function so direct RPC calls cannot bypass the UI's is_official check.

CREATE OR REPLACE FUNCTION public.global_admin_hard_delete_scan(
  p_scan_id uuid,
  p_reason text DEFAULT 'Exclusão definitiva autorizada por Admin Global',
  p_confirmation text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scan_name text;
  v_scan_is_official boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas Administradores Globais podem executar exclusão definitiva.';
  END IF;

  SELECT name, is_official
    INTO v_scan_name, v_scan_is_official
  FROM public.scans
  WHERE id = p_scan_id;

  IF v_scan_name IS NULL THEN
    RAISE EXCEPTION 'Scan não encontrada.';
  END IF;

  IF v_scan_is_official THEN
    RAISE EXCEPTION 'A scan oficial Project Nox não pode ser removida.';
  END IF;

  IF trim(p_confirmation) IS NULL OR trim(p_confirmation) <> trim(v_scan_name) THEN
    RAISE EXCEPTION 'Confirmação inválida. Digite exatamente o nome da scan (%) para confirmar a exclusão definitiva.', v_scan_name;
  END IF;

  -- Keep published works/chapters and their historical credits intact by only
  -- removing the Scan's public junction rows.
  DELETE FROM public.chapter_scans WHERE scan_id = p_scan_id;
  DELETE FROM public.work_scans WHERE scan_id = p_scan_id;

  -- Purge private workspace data in the same database function invocation.
  DELETE FROM public.scan_tasks WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_chapter_qc_issues WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_chapter_stages WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_production_files WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_production_chapters WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_mural_reactions WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_mural_comments WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_mural_posts WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_attachments WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_message_threads WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_messages WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_channel_preferences WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_channels WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_tutorial_reads WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_tutorial_versions WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_academy_tutorials WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_notification_preferences WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_notifications WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_email_outbox WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_member_onboarding WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_onboarding_templates WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_recruitment_questions WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_applications WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_recruitment_openings WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_member_positions WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_positions WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_invites WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_project_requests WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_transfer_requests WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_integrations WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_staff_notes WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_storage_usage WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_activity WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_comments WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_slug_history WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_work_uploaders WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_checklist_configs WHERE scan_id = p_scan_id;
  DELETE FROM public.work_references WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_wiki_versions WHERE scan_id = p_scan_id;
  DELETE FROM public.scan_members WHERE scan_id = p_scan_id;

  INSERT INTO public.scan_global_audit_log (scan_id, scan_name, admin_id, action, reason)
  VALUES (p_scan_id, v_scan_name, auth.uid(), 'SCAN_HARD_DELETED', p_reason);

  DELETE FROM public.scans WHERE id = p_scan_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_scan_name', v_scan_name
  );
END;
$$;
