-- Migration: Definitive Global Notifications & Email Engine

-- 1. Extend public.notifications with full metadata
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('URGENT', 'NORMAL', 'INFO')),
  ADD COLUMN IF NOT EXISTS scan_id uuid REFERENCES public.scans(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS context text;

-- Index for querying unread and recent notifications per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON public.notifications(user_id, read_at, created_at DESC);

-- 2. Ensure RLS on public.notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. Extend public.scan_email_outbox with notification link
ALTER TABLE public.scan_email_outbox
  ADD COLUMN IF NOT EXISTS notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_scan_email_outbox_notif ON public.scan_email_outbox(notification_id);
CREATE INDEX IF NOT EXISTS idx_scan_email_outbox_recipient ON public.scan_email_outbox(recipient_user_id);

-- 4. Enable Supabase Realtime for public.notifications
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
  END IF;
END $$;

-- 5. RPC: Mark a single notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
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

  UPDATE public.notifications
  SET read_at = now()
  WHERE id = p_notification_id AND user_id = v_uid;

  RETURN jsonb_build_object('success', true, 'id', p_notification_id);
END;
$$;

-- 6. RPC: Mark all user notifications as read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;

  UPDATE public.notifications
  SET read_at = now()
  WHERE user_id = v_uid AND read_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'marked_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
