-- Migration: 20260913150000_exclude_nexus_toons_and_toonlivre.sql
-- Permanently excludes nexus_toons and toonlivre from future importer operations and expansion sets.
-- Preserves existing historical data while disabling future scheduling and queueing.

ALTER TABLE public.importer_sources 
  DROP CONSTRAINT IF EXISTS importer_sources_status_check;

ALTER TABLE public.importer_sources 
  ADD CONSTRAINT importer_sources_status_check 
  CHECK (status IN (
    'ACTIVE', 'PAUSED', 'COOLDOWN', 'DISABLED', 'UPSTREAM_BLOCKED', 'DEGRADED', 'RECOVERING', 'EXCLUDED_BY_POLICY'
  ));

INSERT INTO public.importer_sources (id, name, base_url, enabled, status, blocked_reason)
VALUES 
  ('nexus_toons', 'Nexus Toons', 'https://nexustoons.com', false, 'EXCLUDED_BY_POLICY', 'POLICY_EXCLUSION_PERMANENT'),
  ('toonlivre', 'Toon Livre', 'https://toonlivre.net', false, 'EXCLUDED_BY_POLICY', 'POLICY_EXCLUSION_PERMANENT')
ON CONFLICT (id) DO UPDATE SET
  enabled = false,
  status = 'EXCLUDED_BY_POLICY',
  blocked_reason = 'POLICY_EXCLUSION_PERMANENT',
  updated_at = now();

UPDATE public.importer_queue
SET status = 'CANCELLED_BY_STAFF', last_error = 'Fonte excluída definitivamente por decisão de política do projeto.'
WHERE source IN ('nexus_toons', 'toonlivre') AND status IN ('QUEUED', 'RETRY', 'IMPORTING', 'BLOCKED_BY_UPSTREAM');
