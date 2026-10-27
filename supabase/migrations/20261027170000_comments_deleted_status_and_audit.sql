-- Migration: 20261027170000_comments_deleted_status_and_audit.sql
-- Description: Add deleted and deleted_at columns to comments for administrative moderation audit and real visibility tracking

ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS deleted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_comments_deleted ON public.comments(deleted) WHERE deleted = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'comments_admin_update'
  ) THEN
    CREATE POLICY comments_admin_update ON public.comments
      FOR UPDATE
      TO authenticated
      USING (is_editor())
      WITH CHECK (is_editor());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'comments_admin_delete'
  ) THEN
    CREATE POLICY comments_admin_delete ON public.comments
      FOR DELETE
      TO authenticated
      USING (is_editor());
  END IF;
END $$;
