-- Migration: Grant authenticated users permissions to update and delete their own notifications
-- Resolves: 42501 permission denied for table notifications when marking read or deleting

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;

-- Ensure RLS policies for UPDATE and DELETE
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Ensure Realtime replica identity sends full row on update
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Ensure RPCs are executable by authenticated users
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
