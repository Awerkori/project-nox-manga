-- Persistent, stage-aware collaboration notes for a production chapter.
-- This is deliberately separate from the immutable pipeline timeline: notes
-- are editable/moderatable messages, while each mutation is retained in its
-- own small audit trail and mirrored to the chapter timeline.

DO $$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(required_table ORDER BY required_table)
  INTO v_missing
  FROM (VALUES
    ('scans'), ('members'), ('scan_members'), ('scan_production_chapters'),
    ('scan_workflow_stages'), ('scan_chapter_timeline')
  ) AS required(required_table)
  WHERE to_regclass('public.' || required_table) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'SCAN_CHAPTER_NOTES_YSQL_PREREQUISITES_MISSING: %',
      array_to_string(v_missing, ', ');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.scan_chapter_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  production_chapter_id uuid NOT NULL REFERENCES public.scan_production_chapters(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.scan_workflow_stages(id) ON DELETE SET NULL,
  author_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 3000),
  kind text NOT NULL DEFAULT 'NORMAL' CHECK (kind IN ('NORMAL', 'IMPORTANT', 'PENDING')),
  is_pinned boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_chapter_notes_active
  ON public.scan_chapter_notes (production_chapter_id, is_pinned DESC, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.scan_chapter_note_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  production_chapter_id uuid NOT NULL REFERENCES public.scan_production_chapters(id) ON DELETE CASCADE,
  note_id uuid NOT NULL REFERENCES public.scan_chapter_notes(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('CREATED', 'EDITED', 'DELETED', 'PINNED', 'UNPINNED')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_chapter_note_events_audit
  ON public.scan_chapter_note_events (note_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.create_scan_chapter_note_ysql(
  p_scan_id uuid,
  p_production_chapter_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean,
  p_stage_id uuid,
  p_body text,
  p_kind text DEFAULT 'NORMAL'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text;
  v_note_id uuid;
  v_actor_name text := 'Membro';
  v_kind text := upper(trim(COALESCE(p_kind, 'NORMAL')));
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF length(trim(COALESCE(p_body, ''))) NOT BETWEEN 1 AND 3000 THEN
    RAISE EXCEPTION 'CHAPTER_NOTE_BODY_INVALID';
  END IF;
  IF v_kind NOT IN ('NORMAL', 'IMPORTANT', 'PENDING') THEN RAISE EXCEPTION 'CHAPTER_NOTE_KIND_INVALID'; END IF;

  PERFORM 1 FROM public.scan_production_chapters
  WHERE id = p_production_chapter_id AND scan_id = p_scan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCTION_CHAPTER_NOT_FOUND'; END IF;
  SELECT role INTO v_role FROM public.scan_members
  WHERE scan_id = p_scan_id AND user_id = p_actor_id;
  IF v_role IS NULL AND NOT COALESCE(p_is_global_admin, false) THEN
    RAISE EXCEPTION 'SCAN_MEMBERSHIP_REQUIRED';
  END IF;
  IF p_stage_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.scan_workflow_stages WHERE id = p_stage_id AND scan_id = p_scan_id
  ) THEN RAISE EXCEPTION 'CHAPTER_NOTE_STAGE_INVALID'; END IF;

  INSERT INTO public.scan_chapter_notes (
    scan_id, production_chapter_id, stage_id, author_id, body, kind
  ) VALUES (
    p_scan_id, p_production_chapter_id, p_stage_id, p_actor_id, trim(p_body), v_kind
  ) RETURNING id INTO v_note_id;

  INSERT INTO public.scan_chapter_note_events (
    scan_id, production_chapter_id, note_id, actor_id, event_type, details
  ) VALUES (
    p_scan_id, p_production_chapter_id, v_note_id, p_actor_id, 'CREATED',
    jsonb_build_object('kind', v_kind, 'stage_id', p_stage_id)
  );
  SELECT COALESCE(display_name, username, 'Membro') INTO v_actor_name FROM public.members WHERE id = p_actor_id;
  INSERT INTO public.scan_chapter_timeline (
    scan_id, production_chapter_id, stage_id, event_type, user_id, user_name, details
  ) VALUES (
    p_scan_id, p_production_chapter_id, p_stage_id, 'NOTE_ADDED', p_actor_id,
    COALESCE(v_actor_name, 'Membro'), jsonb_build_object('note_id', v_note_id, 'kind', v_kind)
  );
  RETURN jsonb_build_object('success', true, 'note_id', v_note_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.edit_scan_chapter_note_ysql(
  p_note_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean,
  p_body text,
  p_kind text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_note public.scan_chapter_notes;
  v_role text;
  v_kind text;
  v_actor_name text := 'Membro';
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF length(trim(COALESCE(p_body, ''))) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'CHAPTER_NOTE_BODY_INVALID'; END IF;
  SELECT * INTO v_note FROM public.scan_chapter_notes WHERE id = p_note_id FOR UPDATE;
  IF NOT FOUND OR v_note.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'CHAPTER_NOTE_NOT_FOUND'; END IF;
  SELECT role INTO v_role FROM public.scan_members WHERE scan_id = v_note.scan_id AND user_id = p_actor_id;
  IF v_role IS NULL AND NOT COALESCE(p_is_global_admin, false) THEN RAISE EXCEPTION 'SCAN_MEMBERSHIP_REQUIRED'; END IF;
  IF v_note.author_id <> p_actor_id AND v_role NOT IN ('OWNER', 'ADMIN') AND NOT COALESCE(p_is_global_admin, false) THEN
    RAISE EXCEPTION 'CHAPTER_NOTE_EDIT_FORBIDDEN';
  END IF;
  v_kind := COALESCE(upper(trim(NULLIF(p_kind, ''))), v_note.kind);
  IF v_kind NOT IN ('NORMAL', 'IMPORTANT', 'PENDING') THEN RAISE EXCEPTION 'CHAPTER_NOTE_KIND_INVALID'; END IF;
  UPDATE public.scan_chapter_notes SET body = trim(p_body), kind = v_kind, updated_at = now() WHERE id = v_note.id;
  INSERT INTO public.scan_chapter_note_events (scan_id, production_chapter_id, note_id, actor_id, event_type, details)
  VALUES (v_note.scan_id, v_note.production_chapter_id, v_note.id, p_actor_id, 'EDITED', jsonb_build_object('kind', v_kind));
  SELECT COALESCE(display_name, username, 'Membro') INTO v_actor_name FROM public.members WHERE id = p_actor_id;
  INSERT INTO public.scan_chapter_timeline (scan_id, production_chapter_id, stage_id, event_type, user_id, user_name, details)
  VALUES (v_note.scan_id, v_note.production_chapter_id, v_note.stage_id, 'NOTE_EDITED', p_actor_id, COALESCE(v_actor_name, 'Membro'), jsonb_build_object('note_id', v_note.id));
  RETURN jsonb_build_object('success', true, 'note_id', v_note.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_scan_chapter_note_ysql(
  p_note_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_note public.scan_chapter_notes;
  v_role text;
  v_actor_name text := 'Membro';
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  SELECT * INTO v_note FROM public.scan_chapter_notes WHERE id = p_note_id FOR UPDATE;
  IF NOT FOUND OR v_note.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'CHAPTER_NOTE_NOT_FOUND'; END IF;
  SELECT role INTO v_role FROM public.scan_members WHERE scan_id = v_note.scan_id AND user_id = p_actor_id;
  IF v_role IS NULL AND NOT COALESCE(p_is_global_admin, false) THEN RAISE EXCEPTION 'SCAN_MEMBERSHIP_REQUIRED'; END IF;
  IF v_note.author_id <> p_actor_id AND v_role NOT IN ('OWNER', 'ADMIN') AND NOT COALESCE(p_is_global_admin, false) THEN
    RAISE EXCEPTION 'CHAPTER_NOTE_DELETE_FORBIDDEN';
  END IF;
  UPDATE public.scan_chapter_notes SET deleted_at = now(), deleted_by = p_actor_id, is_pinned = false, updated_at = now() WHERE id = v_note.id;
  INSERT INTO public.scan_chapter_note_events (scan_id, production_chapter_id, note_id, actor_id, event_type)
  VALUES (v_note.scan_id, v_note.production_chapter_id, v_note.id, p_actor_id, 'DELETED');
  SELECT COALESCE(display_name, username, 'Membro') INTO v_actor_name FROM public.members WHERE id = p_actor_id;
  INSERT INTO public.scan_chapter_timeline (scan_id, production_chapter_id, stage_id, event_type, user_id, user_name, details)
  VALUES (v_note.scan_id, v_note.production_chapter_id, v_note.stage_id, 'NOTE_DELETED', p_actor_id, COALESCE(v_actor_name, 'Membro'), jsonb_build_object('note_id', v_note.id));
  RETURN jsonb_build_object('success', true, 'note_id', v_note.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.pin_scan_chapter_note_ysql(
  p_note_id uuid,
  p_actor_id uuid,
  p_is_global_admin boolean,
  p_pinned boolean
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_note public.scan_chapter_notes;
  v_role text;
  v_actor_name text := 'Membro';
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  SELECT * INTO v_note FROM public.scan_chapter_notes WHERE id = p_note_id FOR UPDATE;
  IF NOT FOUND OR v_note.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'CHAPTER_NOTE_NOT_FOUND'; END IF;
  SELECT role INTO v_role FROM public.scan_members WHERE scan_id = v_note.scan_id AND user_id = p_actor_id;
  IF v_role NOT IN ('OWNER', 'ADMIN') AND NOT COALESCE(p_is_global_admin, false) THEN RAISE EXCEPTION 'CHAPTER_NOTE_PIN_FORBIDDEN'; END IF;
  UPDATE public.scan_chapter_notes SET is_pinned = COALESCE(p_pinned, false), updated_at = now() WHERE id = v_note.id;
  INSERT INTO public.scan_chapter_note_events (scan_id, production_chapter_id, note_id, actor_id, event_type)
  VALUES (v_note.scan_id, v_note.production_chapter_id, v_note.id, p_actor_id,
    CASE WHEN p_pinned THEN 'PINNED' ELSE 'UNPINNED' END);
  SELECT COALESCE(display_name, username, 'Membro') INTO v_actor_name FROM public.members WHERE id = p_actor_id;
  INSERT INTO public.scan_chapter_timeline (scan_id, production_chapter_id, stage_id, event_type, user_id, user_name, details)
  VALUES (v_note.scan_id, v_note.production_chapter_id, v_note.stage_id,
    CASE WHEN p_pinned THEN 'NOTE_PINNED' ELSE 'NOTE_UNPINNED' END,
    p_actor_id, COALESCE(v_actor_name, 'Membro'), jsonb_build_object('note_id', v_note.id));
  RETURN jsonb_build_object('success', true, 'note_id', v_note.id, 'is_pinned', COALESCE(p_pinned, false));
END;
$$;
