-- Migration: Chat Refinements, Message Actions, Channel Read States, and Outbox Flexibility

-- 1. Scan Messages: Edit flags
ALTER TABLE public.scan_messages 
  ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz DEFAULT NULL;

-- 2. Scan Email Outbox: Make scan_id nullable and add provider tracking columns
ALTER TABLE public.scan_email_outbox 
  ALTER COLUMN scan_id DROP NOT NULL;

ALTER TABLE public.scan_email_outbox 
  ADD COLUMN IF NOT EXISTS provider_message_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'QUEUED';

-- 3. Enable Realtime for scan_message_reactions if not already added
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'scan_message_reactions'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_message_reactions;
    END IF;
  END IF;
END $$;

-- 4. Channel Read States (Tracking unread messages & divider per user)
CREATE TABLE IF NOT EXISTS public.scan_channel_read_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.scan_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  last_read_message_id uuid REFERENCES public.scan_messages(id) ON DELETE SET NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_scan_channel_read_lookup ON public.scan_channel_read_states(channel_id, user_id);

ALTER TABLE public.scan_channel_read_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scan_channel_read_select ON public.scan_channel_read_states;
CREATE POLICY scan_channel_read_select ON public.scan_channel_read_states 
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS scan_channel_read_insert ON public.scan_channel_read_states;
CREATE POLICY scan_channel_read_insert ON public.scan_channel_read_states 
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS scan_channel_read_update ON public.scan_channel_read_states;
CREATE POLICY scan_channel_read_update ON public.scan_channel_read_states 
  FOR UPDATE TO authenticated 
  USING (user_id = auth.uid());

-- 5. RPC: Mark Scan Channel Read
CREATE OR REPLACE FUNCTION public.mark_scan_channel_read(
  p_scan_id uuid,
  p_channel_id uuid,
  p_message_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  INSERT INTO public.scan_channel_read_states (scan_id, channel_id, user_id, last_read_message_id, last_read_at)
  VALUES (p_scan_id, p_channel_id, v_uid, p_message_id, now())
  ON CONFLICT (channel_id, user_id)
  DO UPDATE SET
    last_read_message_id = EXCLUDED.last_read_message_id,
    last_read_at = now();

  RETURN jsonb_build_object('success', true, 'channel_id', p_channel_id, 'message_id', p_message_id);
END;
$$;

-- 6. RPC: Toggle Scan Message Reaction
CREATE OR REPLACE FUNCTION public.toggle_scan_message_reaction(
  p_message_id uuid,
  p_emoji text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clean_emoji text := trim(p_emoji);
  v_existing_id uuid;
  v_action text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  IF length(v_clean_emoji) = 0 OR length(v_clean_emoji) > 32 THEN
    RAISE EXCEPTION 'Emoji inválido';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.scan_message_reactions
  WHERE message_id = p_message_id AND user_id = v_uid AND emoji = v_clean_emoji;

  IF v_existing_id IS NOT NULL THEN
    DELETE FROM public.scan_message_reactions WHERE id = v_existing_id;
    v_action := 'REMOVED';
  ELSE
    INSERT INTO public.scan_message_reactions (message_id, user_id, emoji)
    VALUES (p_message_id, v_uid, v_clean_emoji);
    v_action := 'ADDED';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'action', v_action,
    'message_id', p_message_id,
    'emoji', v_clean_emoji
  );
END;
$$;

-- 7. RPC: Edit Scan Message
CREATE OR REPLACE FUNCTION public.edit_scan_message(
  p_message_id uuid,
  p_new_content text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_msg record;
  v_clean text := trim(p_new_content);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  IF length(v_clean) = 0 THEN
    RAISE EXCEPTION 'Mensagem não pode ser vazia';
  END IF;

  SELECT * INTO v_msg
  FROM public.scan_messages
  WHERE id = p_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mensagem não encontrada';
  END IF;

  -- Only author can edit their own content
  IF v_msg.user_id <> v_uid THEN
    RAISE EXCEPTION 'Apenas o autor pode editar esta mensagem' USING errcode = '42501';
  END IF;

  UPDATE public.scan_messages
  SET content = v_clean,
      is_edited = true,
      edited_at = now(),
      updated_at = now()
  WHERE id = p_message_id;

  RETURN jsonb_build_object('success', true, 'message_id', p_message_id, 'is_edited', true);
END;
$$;

-- 8. RPC: Delete Scan Message
CREATE OR REPLACE FUNCTION public.delete_scan_message(
  p_message_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_msg record;
  v_is_lead boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  SELECT * INTO v_msg
  FROM public.scan_messages
  WHERE id = p_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mensagem não encontrada';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.scan_members 
    WHERE scan_id = v_msg.scan_id AND user_id = v_uid AND role IN ('OWNER', 'ADMIN')
  ) INTO v_is_lead;

  -- Author or Scan Leader can delete
  IF v_msg.user_id <> v_uid AND NOT v_is_lead THEN
    RAISE EXCEPTION 'Sem permissão para excluir esta mensagem' USING errcode = '42501';
  END IF;

  DELETE FROM public.scan_messages WHERE id = p_message_id;

  RETURN jsonb_build_object('success', true, 'message_id', p_message_id);
END;
$$;

GRANT ALL ON public.scan_channel_read_states TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_scan_channel_read(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_scan_message_reaction(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edit_scan_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_scan_message(uuid) TO authenticated;
