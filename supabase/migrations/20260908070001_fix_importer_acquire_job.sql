create or replace function public.importer_acquire_job(
  p_worker_id text,
  p_lease_duration interval default interval '5 minutes',
  p_source text default null
)
returns table (
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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
begin
  select q.id into v_job_id
  from public.importer_queue q
  where (
    (q.status in ('QUEUED', 'RETRY') and q.next_run_at <= now())
    or
    (q.status = 'IMPORTING' and q.lease_expires_at < now())
  )
  and (p_source is null or q.source = p_source)
  order by
    q.priority desc,
    q.chapter_sort_key asc nulls last,
    q.next_run_at asc,
    q.created_at asc
  limit 1
  for update skip locked;

  if v_job_id is not null then
    return query
    update public.importer_queue
    set
      status = 'IMPORTING',
      locked_by = p_worker_id,
      locked_at = now(),
      lease_expires_at = now() + p_lease_duration,
      attempts = public.importer_queue.attempts + 1,
      updated_at = now()
    where public.importer_queue.id = v_job_id
    returning
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
  end if;
end;
$$;
