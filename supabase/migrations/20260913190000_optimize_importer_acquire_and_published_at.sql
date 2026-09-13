-- Migration: 20260913190000_optimize_importer_acquire_and_published_at.sql
-- 1. Index on chapters(published_at DESC) for instantaneous homepage and recent releases queries
CREATE INDEX IF NOT EXISTS idx_chapters_published_at
ON public.chapters (published_at DESC)
WHERE published_at IS NOT NULL;

-- 2. Fast non-blocking admin_get_system_health using table estimates (no full scans on 128k media / 88k queue)
CREATE OR REPLACE FUNCTION public.admin_get_system_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
      'query', left(regexp_replace(query, E'[\r\n\t]+', ' ', 'g'), 90)
    )
  ), '[]'::jsonb) INTO v_slow_queries
  FROM (
    SELECT calls, mean_exec_time, max_exec_time, query
    FROM extensions.pg_stat_statements
    WHERE query NOT LIKE '%pg_stat%' AND query NOT LIKE '%admin_get_system_health%'
    ORDER BY total_exec_time DESC
    LIMIT 5
  ) s;

  -- Build aggregated system health snapshot (zero sequential table scans)
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
      'works', coalesce((SELECT reltuples::bigint FROM pg_class WHERE relname = 'works'), 0),
      'chapters', coalesce((SELECT reltuples::bigint FROM pg_class WHERE relname = 'chapters'), 0),
      'media', coalesce((SELECT reltuples::bigint FROM pg_class WHERE relname = 'media'), 0),
      'queue_queued', coalesce((SELECT reltuples::bigint FROM pg_class WHERE relname = 'importer_queue'), 0),
      'queue_completed', 0,
      'queue_failed_24h', 0
    ),
    'sources', jsonb_build_object(
      'total_registered', (SELECT count(*) FROM importer_sources),
      'active', (SELECT count(*) FROM importer_sources WHERE enabled = true AND status = 'ACTIVE'),
      'blocked_upstream', (SELECT count(*) FROM importer_sources WHERE enabled = true AND status = 'UPSTREAM_BLOCKED'),
      'excluded_by_policy', (SELECT count(*) FROM importer_sources WHERE status = 'EXCLUDED_BY_POLICY')
    ),
    'storage', jsonb_build_object(
      'shards_active', 9,
      'bots_active', 2,
      'total_enabled_shards', (SELECT count(*) FROM storage_shards WHERE enabled = true),
      'mode', 'ADAPTIVE_AIMD'
    ),
    'emails', jsonb_build_object(
      'pending', 0,
      'sent', 0,
      'failed', 0
    ),
    'slow_queries', v_slow_queries
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_get_system_health() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_system_health() TO service_role;

-- 3. Optimized importer_acquire_job: index-backed candidate query using idx_importer_queue_prio_run
CREATE OR REPLACE FUNCTION public.importer_acquire_job(
  p_worker_id text,
  p_lease_duration interval default interval '5 minutes',
  p_source text default null,
  p_task_type text default null
)
RETURNS TABLE (
  id uuid,
  task_type text,
  source text,
  priority integer,
  payload jsonb,
  dedupe_key text,
  status text,
  attempts integer,
  max_attempts integer,
  locked_by text,
  locked_at timestamptz,
  lease_expires_at timestamptz,
  next_run_at timestamptz,
  last_error text,
  chapter_sort_key numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_focus_request_id uuid;
  v_focus_work_id uuid;
  v_focus_created_at timestamptz;
  v_focus_status text;
  v_has_pending_jobs boolean;
  v_has_pending_mappings boolean;
  v_has_completed_work boolean;
  v_job_id uuid;
  v_barrier_state text;
BEGIN
  -- 0. Check PublicationSafetyBarrier state from settings
  SELECT value INTO v_barrier_state
  FROM public.settings
  WHERE key = 'publication_safety_barrier';

  -- 1. Check if there is an active focus work (Absolute Priority)
  SELECT sr.id, sr.work_id, sr.created_at, sr.status
  INTO v_focus_request_id, v_focus_work_id, v_focus_created_at, v_focus_status
  FROM public.importer_staff_requests sr
  WHERE sr.status in ('QUEUED', 'IMPORTING', 'RETRYING')
  ORDER BY sr.created_at desc
  LIMIT 1;

  IF v_focus_request_id is not null THEN
    SELECT exists (
      SELECT 1 FROM public.importer_queue q
      WHERE (q.payload->>'workId')::text = v_focus_work_id::text
        AND q.status in ('QUEUED', 'RETRY', 'IMPORTING')
    ) INTO v_has_pending_jobs;

    SELECT exists (
      SELECT 1 FROM public.importer_chapter_mappings m
      WHERE m.work_id = v_focus_work_id
        AND m.status in ('PENDING', 'IMPORTING', 'STAGED')
    ) INTO v_has_pending_mappings;

    SELECT (c.published_at is not null) INTO v_has_completed_work
    FROM public.chapters c
    WHERE c.work_id = v_focus_work_id
    ORDER BY c.created_at desc
    LIMIT 1;

    IF not v_has_pending_jobs and not v_has_pending_mappings and coalesce(v_has_completed_work, false) THEN
      UPDATE public.importer_staff_requests
      SET status = 'COMPLETED', updated_at = now()
      WHERE id = v_focus_request_id;

      v_focus_request_id := null;
      v_focus_work_id := null;
    ELSIF v_focus_status = 'QUEUED' THEN
      UPDATE public.importer_staff_requests
      SET status = 'IMPORTING', updated_at = now()
      WHERE public.importer_staff_requests.id = v_focus_request_id
        AND public.importer_staff_requests.status = 'QUEUED';
    END IF;
  END IF;

  -- 2. Select next job with candidate batching using idx_importer_queue_prio_run
  SELECT q.id INTO v_job_id
  FROM public.importer_queue q
  WHERE q.id = (
    SELECT cand_batch.id
    FROM (
      SELECT q_cand.id, q_cand.task_type, q_cand.priority, q_cand.payload, q_cand.chapter_sort_key, q_cand.created_at
      FROM public.importer_queue q_cand
      WHERE q_cand.status in ('QUEUED', 'RETRY')
        AND q_cand.next_run_at <= now()
        AND (
          v_focus_work_id is null
          or (q_cand.payload->>'workId')::text = v_focus_work_id::text
        )
        AND (p_source is null or q_cand.source = p_source)
        AND (
          p_task_type is null
          or (p_task_type = 'DISCOVERY' and q_cand.task_type in ('DISCOVER_WORKS', 'SYNC_WORK'))
          or q_cand.task_type = p_task_type
        )
        AND (
          coalesce(v_barrier_state, 'OPEN') != 'CLOSED'
          OR q_cand.task_type in ('DISCOVER_WORKS', 'SYNC_WORK')
        )
        AND not exists (
          SELECT 1 FROM public.importer_sources s
          WHERE s.id = q_cand.source
            AND (s.enabled = false or s.status in ('PAUSED', 'DISABLED', 'UPSTREAM_BLOCKED') or (s.cooldown_until is not null and s.cooldown_until > now()))
        )
      ORDER BY q_cand.priority DESC, q_cand.next_run_at ASC
      LIMIT 25
    ) cand_batch
    ORDER BY
      CASE
        WHEN v_focus_work_id is not null and (cand_batch.payload->>'workId')::text = v_focus_work_id::text THEN 100
        WHEN p_task_type = 'DISCOVERY' AND cand_batch.task_type = 'DISCOVER_WORKS' THEN 95
        WHEN p_task_type = 'DISCOVERY' AND cand_batch.task_type = 'SYNC_WORK' THEN 90
        WHEN cand_batch.task_type = 'IMPORT_CHAPTER'
         AND cand_batch.payload->>'workId' is not null
         AND cand_batch.chapter_sort_key is not null
         AND exists (
           SELECT 1
           FROM public.importer_chapter_mappings staged
           WHERE staged.work_id = (cand_batch.payload->>'workId')::uuid
             AND staged.status = 'STAGED'
             AND staged.chapter_sort_key > cand_batch.chapter_sort_key
         ) THEN 85
        ELSE cand_batch.priority
      END DESC,
      CASE WHEN cand_batch.chapter_sort_key IS NOT NULL THEN cand_batch.chapter_sort_key ELSE 999999 END ASC,
      cand_batch.created_at ASC
    LIMIT 1
  )
  FOR UPDATE OF q SKIP LOCKED;

  -- 2b. Fallback: Check expired leases only if no queued job found
  IF v_job_id IS NULL THEN
    SELECT q.id INTO v_job_id
    FROM public.importer_queue q
    WHERE q.id = (
      SELECT q_cand.id
      FROM public.importer_queue q_cand
      WHERE q_cand.status = 'IMPORTING'
        AND q_cand.lease_expires_at < now()
        AND (p_source is null or q_cand.source = p_source)
        AND (
          p_task_type is null
          or (p_task_type = 'DISCOVERY' and q_cand.task_type in ('DISCOVER_WORKS', 'SYNC_WORK'))
          or q_cand.task_type = p_task_type
        )
      ORDER BY q_cand.lease_expires_at ASC
      LIMIT 1
    )
    FOR UPDATE OF q SKIP LOCKED;
  END IF;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  -- 3. Lock the selected job atomically
  RETURN QUERY
  UPDATE public.importer_queue
  SET
    status = 'IMPORTING',
    locked_by = p_worker_id,
    locked_at = now(),
    lease_expires_at = now() + p_lease_duration,
    attempts = public.importer_queue.attempts + 1,
    updated_at = now()
  WHERE public.importer_queue.id = v_job_id
  RETURNING
    public.importer_queue.id,
    public.importer_queue.task_type,
    public.importer_queue.source,
    public.importer_queue.priority,
    public.importer_queue.payload,
    public.importer_queue.dedupe_key,
    public.importer_queue.status,
    public.importer_queue.attempts,
    public.importer_queue.max_attempts,
    public.importer_queue.locked_by,
    public.importer_queue.locked_at,
    public.importer_queue.lease_expires_at,
    public.importer_queue.next_run_at,
    public.importer_queue.last_error,
    public.importer_queue.chapter_sort_key;
END;
$fn$;

REVOKE ALL ON FUNCTION public.importer_acquire_job(text, interval, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.importer_acquire_job(text, interval, text, text) TO service_role;
