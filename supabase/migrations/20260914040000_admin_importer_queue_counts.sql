CREATE OR REPLACE FUNCTION public.admin_importer_queue_counts()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
SELECT jsonb_build_object(
 'queued',count(*) FILTER(WHERE status='QUEUED'),
 'importing',count(*) FILTER(WHERE status='IMPORTING'),
 'retry',count(*) FILTER(WHERE status='RETRY'),
 'paused',count(*) FILTER(WHERE status='PAUSED_BY_STAFF'),
 'cancelled',count(*) FILTER(WHERE status='CANCELLED_BY_STAFF'),
 'completed',count(*) FILTER(WHERE status='COMPLETED'),
 'failed',count(*) FILTER(WHERE status='FAILED'),
 'failed1h',count(*) FILTER(WHERE status='FAILED' AND updated_at>now()-interval '1 hour'),
 'failed24h',count(*) FILTER(WHERE status='FAILED' AND updated_at>now()-interval '24 hours')
) FROM public.importer_queue;
$$;
REVOKE ALL ON FUNCTION public.admin_importer_queue_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_importer_queue_counts() TO authenticated,service_role;
