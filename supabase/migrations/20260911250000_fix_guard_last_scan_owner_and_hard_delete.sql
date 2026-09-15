-- Migration: 20260911250000_fix_guard_last_scan_owner_and_hard_delete.sql
-- Description: Fix column reference in guard_last_scan_owner (user_id instead of id) and ensure seamless scan deletion for global admins.

CREATE OR REPLACE FUNCTION public.guard_last_scan_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_other_owners int;
  v_scan_exists boolean;
BEGIN
  -- If the scan itself no longer exists or is being deleted, do not block
  IF TG_OP = 'DELETE' THEN
    SELECT EXISTS(SELECT 1 FROM public.scans WHERE id = OLD.scan_id) INTO v_scan_exists;
    IF NOT v_scan_exists THEN
      RETURN OLD;
    END IF;

    -- If global admin is performing the delete (e.g. supreme delete), allow
    IF public.is_admin() THEN
      RETURN OLD;
    END IF;
  END IF;

  IF (TG_OP = 'DELETE' AND OLD.role = 'OWNER') OR (TG_OP = 'UPDATE' AND OLD.role = 'OWNER' AND NEW.role != 'OWNER') THEN
    -- Note: scan_members has compound PK (scan_id, user_id), column is user_id, NOT id
    SELECT count(*) INTO v_other_owners
    FROM public.scan_members
    WHERE scan_id = OLD.scan_id AND role = 'OWNER' AND user_id != OLD.user_id;

    IF v_other_owners = 0 THEN
      RAISE EXCEPTION 'A scan não pode ficar sem dono. Transfira a propriedade antes de sair ou remover o cargo.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Update global_admin_hard_delete_scan to be completely thorough
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
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas Administradores Globais podem executar exclusão definitiva.';
  END IF;

  SELECT name INTO v_scan_name FROM public.scans WHERE id = p_scan_id;
  IF v_scan_name IS NULL THEN
    RAISE EXCEPTION 'Scan não encontrada.';
  END IF;

  IF trim(p_confirmation) IS NULL OR trim(p_confirmation) <> trim(v_scan_name) THEN
    RAISE EXCEPTION 'Confirmação inválida. Digite exatamente o nome da scan (%) para confirmar a exclusão definitiva.', v_scan_name;
  END IF;

  -- 1. Disassociate public reader junction tables cleanly so public works and chapters remain 100% intact
  DELETE FROM public.chapter_scans WHERE scan_id = p_scan_id;
  DELETE FROM public.work_scans WHERE scan_id = p_scan_id;

  -- 2. Delete all private workspace artifacts, records, pipelines and tasks
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

  -- 3. Insert supreme audit log
  INSERT INTO public.scan_global_audit_log (scan_id, scan_name, admin_id, action, reason)
  VALUES (p_scan_id, v_scan_name, auth.uid(), 'SCAN_HARD_DELETED', p_reason);

  -- 4. Delete the scan itself
  DELETE FROM public.scans WHERE id = p_scan_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_scan_name', v_scan_name
  );
END;
$$;
