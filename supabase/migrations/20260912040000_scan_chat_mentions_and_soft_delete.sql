-- Migration: Scan Chat Structured Mentions, Soft Delete & Permissions
-- 20260912040000_scan_chat_mentions_and_soft_delete.sql

-- 1. Colunas de Soft Delete em scan_messages
ALTER TABLE public.scan_messages 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) DEFAULT NULL;

-- 2. Garantir REPLICA IDENTITY FULL para eventos Realtime completos
ALTER TABLE public.scan_messages REPLICA IDENTITY FULL;

-- 3. Tabela Estruturada de Menções: scan_message_mentions
CREATE TABLE IF NOT EXISTS public.scan_message_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.scan_messages(id) ON DELETE CASCADE,
  mention_type text NOT NULL CHECK (mention_type IN ('USER', 'ROLE', 'ALL')),
  target_user_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  target_role_id uuid REFERENCES public.scan_positions(id) ON DELETE CASCADE,
  mention_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_msg_mentions_msg ON public.scan_message_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_scan_msg_mentions_user ON public.scan_message_mentions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_scan_msg_mentions_role ON public.scan_message_mentions(target_role_id);

-- Habilitar RLS em scan_message_mentions
ALTER TABLE public.scan_message_mentions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'scan_message_mentions' 
      AND policyname = 'scan_message_mentions_select'
  ) THEN
    CREATE POLICY scan_message_mentions_select ON public.scan_message_mentions
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'scan_message_mentions' 
      AND policyname = 'scan_message_mentions_insert'
  ) THEN
    CREATE POLICY scan_message_mentions_insert ON public.scan_message_mentions
      FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.scan_message_mentions TO authenticated;
GRANT ALL ON public.scan_message_mentions TO service_role;

-- 4. RPC Definitive Delete / Soft-Delete Scan Message
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
  v_is_admin boolean := false;
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

  IF v_msg.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message_id', p_message_id, 'already_deleted', true);
  END IF;

  -- Checar se é liderança da Scan (OWNER ou ADMIN)
  SELECT EXISTS (
    SELECT 1 FROM public.scan_members 
    WHERE scan_id = v_msg.scan_id AND user_id = v_uid AND role IN ('OWNER', 'ADMIN')
  ) INTO v_is_lead;

  -- Checar se é staff do site
  SELECT EXISTS (
    SELECT 1 FROM public.access_roles
    WHERE user_id = v_uid AND role IN ('ADMIN', 'STAFF_SITE') AND suspended = false
  ) INTO v_is_admin;

  -- Autor da mensagem, liderança da Scan ou Admin podem excluir
  IF v_msg.user_id <> v_uid AND NOT v_is_lead AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Sem permissão para excluir mensagem de outro membro' USING errcode = '42501';
  END IF;

  -- Soft delete: preserva referências de reply, thread e deep links sem quebrar
  UPDATE public.scan_messages
  SET 
    deleted_at = now(),
    deleted_by = v_uid,
    content = 'Mensagem excluída',
    pinned = false
  WHERE id = p_message_id;

  -- Limpar reações da mensagem excluída
  DELETE FROM public.scan_message_reactions
  WHERE message_id = p_message_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message_id', p_message_id, 
    'deleted_by', v_uid,
    'deleted_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_scan_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_scan_message(uuid) TO service_role;
