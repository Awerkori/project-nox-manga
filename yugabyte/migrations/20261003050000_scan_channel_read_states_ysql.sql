-- Authoritative YSQL storage for Scan chat read markers.
-- The legacy Supabase migration created this relation, but the Scan workspace
-- now reads and writes it through Yugabyte directly.  Keep this migration
-- idempotent and avoid ownership-sensitive foreign keys: membership/channel
-- authorization is enforced by the YSQL-backed workspace queries.

CREATE TABLE IF NOT EXISTS public.scan_channel_read_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  user_id uuid NOT NULL,
  last_read_message_id uuid,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_scan_channel_read_lookup_ysql
  ON public.scan_channel_read_states(channel_id, user_id);

