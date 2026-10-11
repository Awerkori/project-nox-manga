-- Dedicated authoritative YSQL read markers for Scan chat.
-- This avoids mutating a legacy-owned relation while keeping the read/unread
-- state on the same Yugabyte data plane as the rest of the workspace.

CREATE TABLE IF NOT EXISTS public.scan_channel_read_states_ysql (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  user_id uuid NOT NULL,
  last_read_message_id uuid,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_scan_channel_read_lookup_ysql_v2
  ON public.scan_channel_read_states_ysql(channel_id, user_id);
