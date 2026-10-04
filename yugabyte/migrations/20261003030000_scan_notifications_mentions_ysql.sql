-- Scan-only notifications, mentions and email queue on the authoritative YSQL
-- plane.  The legacy global notification service remains available to the
-- public site, but Scan writes do not use PostgREST/RPCs anymore.

CREATE TABLE IF NOT EXISTS public.scan_notification_dedupe (
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  dedupe_key text NOT NULL,
  notification_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scan_id, user_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS public.scan_message_mentions_ysql (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The legacy scan_messages relation is owned by the deployment role.  Do
  -- not require REFERENCES ownership here; the YSQL service validates the
  -- message/scan pair before writing and cleanup is handled by scan deletion.
  message_id uuid NOT NULL,
  mention_type text NOT NULL CHECK (mention_type IN ('USER', 'ROLE', 'ALL')),
  target_user_id uuid,
  target_role_id uuid,
  mention_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_message_mentions_ysql_message
  ON public.scan_message_mentions_ysql(message_id);
CREATE INDEX IF NOT EXISTS idx_scan_message_mentions_ysql_user
  ON public.scan_message_mentions_ysql(target_user_id);

CREATE TABLE IF NOT EXISTS public.scan_email_outbox_ysql (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid REFERENCES public.scans(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  delivery_status text NOT NULL DEFAULT 'QUEUED',
  priority text NOT NULL DEFAULT 'NORMAL',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  idempotency_key text NOT NULL UNIQUE,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  send_started_at timestamptz,
  provider_request_key text,
  provider_message_id text,
  lease_expires_at timestamptz,
  worker_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_email_outbox_ysql_queue
  ON public.scan_email_outbox_ysql(status, priority, scheduled_at, created_at);

CREATE OR REPLACE FUNCTION public.create_scan_notification_ysql(
  p_scan_id uuid,
  p_recipient_id uuid,
  p_actor_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_deep_link text,
  p_dedupe_key text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_scan_id IS NULL OR p_recipient_id IS NULL OR NULLIF(trim(p_dedupe_key), '') IS NULL THEN
    RAISE EXCEPTION 'SCAN_NOTIFICATION_ARGUMENT_INVALID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = p_recipient_id) THEN
    RAISE EXCEPTION 'SCAN_NOTIFICATION_RECIPIENT_NOT_FOUND';
  END IF;

  INSERT INTO public.scan_notification_dedupe(scan_id, user_id, dedupe_key)
  VALUES (p_scan_id, p_recipient_id, p_dedupe_key)
  ON CONFLICT (scan_id, user_id, dedupe_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT notification_id INTO v_id
    FROM public.scan_notification_dedupe
    WHERE scan_id = p_scan_id AND user_id = p_recipient_id AND dedupe_key = p_dedupe_key;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'notification_id', v_id);
  END IF;

  INSERT INTO public.scan_notifications(scan_id, user_id, type, title, body, deep_link)
  VALUES (p_scan_id, p_recipient_id, p_type, p_title, p_body, p_deep_link)
  RETURNING id INTO v_id;
  UPDATE public.scan_notification_dedupe
  SET notification_id = v_id
  WHERE scan_id = p_scan_id AND user_id = p_recipient_id AND dedupe_key = p_dedupe_key;
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'notification_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_scan_email_outbox_ysql(
  p_limit integer DEFAULT 20,
  p_specific_id uuid DEFAULT NULL,
  p_lease_seconds integer DEFAULT 300,
  p_worker_id text DEFAULT 'scan-mailer'
) RETURNS SETOF public.scan_email_outbox_ysql LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.scan_email_outbox_ysql
    WHERE (p_specific_id IS NULL AND status = 'PENDING'
      AND scheduled_at <= now() AND (lease_expires_at IS NULL OR lease_expires_at < now()))
       OR (p_specific_id IS NOT NULL AND id = p_specific_id AND status IN ('PENDING', 'PROCESSING'))
    ORDER BY CASE priority WHEN 'HIGH' THEN 0 WHEN 'NORMAL' THEN 1 ELSE 2 END,
      scheduled_at, created_at
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.scan_email_outbox_ysql o
  SET status = 'PROCESSING', attempts = o.attempts + 1,
      worker_id = p_worker_id,
      lease_expires_at = now() + make_interval(secs => GREATEST(30, p_lease_seconds))
  WHERE o.id IN (SELECT id FROM candidates)
  RETURNING o.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_uncertain_scan_email_outbox_ysql(
  p_limit integer DEFAULT 10,
  p_worker_id text DEFAULT 'scan-mail-reconciler',
  p_lease_seconds integer DEFAULT 300
) RETURNS SETOF public.scan_email_outbox_ysql LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.scan_email_outbox_ysql
    WHERE status = 'PROCESSING' AND send_started_at IS NOT NULL
      AND send_started_at < now() - interval '5 minutes'
      AND (lease_expires_at IS NULL OR lease_expires_at < now())
    ORDER BY send_started_at
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.scan_email_outbox_ysql o
  SET lease_expires_at = now() + make_interval(secs => GREATEST(30, p_lease_seconds)),
      worker_id = p_worker_id
  WHERE o.id IN (SELECT id FROM candidates)
  RETURNING o.*;
END;
$$;
