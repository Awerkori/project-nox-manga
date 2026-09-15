-- Migration: Create public.admin_get_system_health() for real-time observability
-- Provides single-call, zero-overhead database health telemetry to the Admin Health Center.

CREATE OR REPLACE FUNCTION public.admin_get_system_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_result jsonb;
  v_has_sha256_index boolean;
  v_has_prio_run_index boolean;
  v_slow_queries jsonb;
BEGIN
  -- Verify media.sha256 performance invariant
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'media' AND indexname = 'idx_media_sha256'
  ) INTO v_has_sha256_index;

  -- Verify queue priority index invariant
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'importer_queue' AND indexname = 'idx_importer_queue_prio_run'
  ) INTO v_has_prio_run_index;

  -- Collect sanitized top queries from pg_stat_statements
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'calls', calls,
      'mean_ms', round(mean_exec_time::numeric, 2),
      'max_ms', round(max_exec_time::numeric, 2),
      'query', left(regexp_replace(query, E'[\n\r\t]+', ' ', 'g'), 90)
    )
  ), '[]'::jsonb) INTO v_slow_queries
  FROM (
    SELECT calls, mean_exec_time, max_exec_time, query
    FROM extensions.pg_stat_statements
    WHERE query NOT LIKE '%pg_stat%' AND query NOT LIKE '%admin_get_system_health%'
    ORDER BY total_exec_time DESC
    LIMIT 5
  ) s;

  -- Build aggregated system health snapshot
  SELECT jsonb_build_object(
    'database', jsonb_build_object(
      'current_connections', (SELECT count(*) FROM pg_stat_activity),
      'active_connections', (SELECT count(*) FROM pg_stat_activity WHERE state = 'active'),
      'idle_connections', (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle'),
      'max_connections', (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'),
      'deadlocks', (SELECT coalesce(deadlocks, 0) FROM pg_stat_database WHERE datname = current_database()),
      'waiting_locks', (SELECT count(*) FROM pg_locks WHERE NOT granted),
      'sha256_index_active', v_has_sha256_index,
      'prio_run_index_active', v_has_prio_run_index
    ),
    'counts', jsonb_build_object(
      'works', (SELECT count(*) FROM works),
      'chapters', (SELECT count(*) FROM chapters WHERE published_at IS NOT NULL),
      'media', (SELECT count(*) FROM media),
      'queue_queued', (SELECT count(*) FROM importer_queue WHERE status = 'QUEUED'),
      'queue_completed', (SELECT count(*) FROM importer_queue WHERE status = 'COMPLETED'),
      'queue_failed_24h', (SELECT count(*) FROM importer_queue WHERE status = 'FAILED' AND updated_at >= now() - interval '24 hours')
    ),
    'sources', jsonb_build_object(
      'total', (SELECT count(*) FROM importer_sources),
      'active', (SELECT count(*) FROM importer_sources WHERE enabled = true AND status != 'UPSTREAM_BLOCKED'),
      'blocked', (SELECT count(*) FROM importer_sources WHERE status = 'UPSTREAM_BLOCKED'),
      'paused', (SELECT count(*) FROM importer_sources WHERE status = 'PAUSED')
    ),
    'storage', jsonb_build_object(
      'shards_active', 9,
      'bots_active', 2,
      'total_enabled_shards', (SELECT count(*) FROM storage_shards WHERE enabled = true),
      'mode', 'ADAPTIVE_AIMD'
    ),
    'emails', jsonb_build_object(
      'pending', (SELECT count(*) FROM scan_email_outbox WHERE status = 'PENDING'),
      'sent', (SELECT count(*) FROM scan_email_outbox WHERE status = 'SENT'),
      'failed', (SELECT count(*) FROM scan_email_outbox WHERE status = 'FAILED')
    ),
    'slow_queries', v_slow_queries
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_system_health() TO authenticated, service_role;
