-- Aggregate on the server: PostgREST row caps must not truncate queue counts.
CREATE OR REPLACE FUNCTION public.admin_importer_queue_counts()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH per_source AS (
 SELECT source,
 count(*) FILTER(WHERE status='QUEUED') AS queued,
 count(*) FILTER(WHERE status='IMPORTING') AS importing,
 count(*) FILTER(WHERE status='RETRY') AS retry,
 count(*) FILTER(WHERE status='PAUSED_BY_STAFF') AS paused,
 count(*) FILTER(WHERE status='CANCELLED_BY_STAFF') AS cancelled,
 count(*) FILTER(WHERE status='COMPLETED') AS completed,
 count(*) FILTER(WHERE status='FAILED') AS failed,
 count(*) FILTER(WHERE status='FAILED' AND updated_at>now()-interval '1 hour') AS failed1h,
 count(*) FILTER(WHERE status='FAILED' AND updated_at>now()-interval '24 hours') AS failed24h,
 count(*) FILTER(WHERE status='BLOCKED_BY_UPSTREAM') AS blocked
 FROM public.importer_queue GROUP BY source
)
SELECT jsonb_build_object(
 'queued',coalesce(sum(queued),0),
 'importing',coalesce(sum(importing),0),
 'retry',coalesce(sum(retry),0),
 'paused',coalesce(sum(paused),0),
 'cancelled',coalesce(sum(cancelled),0),
 'completed',coalesce(sum(completed),0),
 'failed',coalesce(sum(failed),0),
 'failed1h',coalesce(sum(failed1h),0),
 'failed24h',coalesce(sum(failed24h),0),
 'blocked',coalesce(sum(blocked),0),
 'blockedBySource', coalesce(jsonb_object_agg(source,blocked) FILTER(WHERE blocked>0 AND source IS NOT NULL),'{}'::jsonb)
) FROM per_source;
$$;
REVOKE ALL ON FUNCTION public.admin_importer_queue_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_importer_queue_counts() TO authenticated,service_role;
