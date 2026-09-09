-- ==============================================================================
-- Project Nox Importer - Migration 20260909070000:
-- Telemetry Architecture: Clean Separation of Active vs Historical Recovered Errors
-- ==============================================================================

begin;

-- 1. Add telemetry columns to importer_queue
alter table public.importer_queue
  add column if not exists last_recovered_error text,
  add column if not exists recovered_at timestamptz,
  add column if not exists last_error_at timestamptz,
  add column if not exists retry_reason text;

-- 2. Update importer_acquire_job to clear last_error on acquire and archive to last_recovered_error
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
  v_focus_request_id uuid;
  v_focus_work_id uuid;
  v_focus_created_at timestamptz;
  v_focus_status text;
  v_has_pending_jobs boolean;
  v_has_pending_mappings boolean;
  v_has_completed_work boolean;
  v_job_id uuid;
begin
  -- 1. Check if there is an active focus work (Absolute Priority)
  select sr.id, sr.work_id, sr.created_at, sr.status
  into v_focus_request_id, v_focus_work_id, v_focus_created_at, v_focus_status
  from public.importer_staff_requests sr
  where sr.status in ('QUEUED', 'IMPORTING', 'RETRYING')
  order by sr.created_at desc
  limit 1;

  if v_focus_work_id is not null then
    -- Check if focus work still has active queue tasks
    select exists (
      select 1 from public.importer_queue q_focus
      where (q_focus.payload->>'workId')::text = v_focus_work_id::text
        and q_focus.status in ('QUEUED', 'IMPORTING', 'RETRY')
    ) into v_has_pending_jobs;

    -- Check if focus work still has pending, importing, or staged mappings
    select exists (
      select 1 from public.importer_chapter_mappings cm
      where cm.work_id = v_focus_work_id
        and cm.status in ('PENDING', 'IMPORTING', 'STAGED')
    ) into v_has_pending_mappings;

    -- Check if at least some work was actually done/completed
    select (
      exists (
        select 1 from public.importer_chapter_mappings cm_done
        where cm_done.work_id = v_focus_work_id and cm_done.status = 'COMPLETED'
      )
      or exists (
        select 1 from public.importer_work_mappings wm_done
        where wm_done.work_id = v_focus_work_id and wm_done.sync_status = 'COMPLETED'
      )
    ) into v_has_completed_work;

    -- Only auto-completes if work actually finished AND request is older than 30 seconds
    if not v_has_pending_jobs and not v_has_pending_mappings and v_has_completed_work and (v_focus_created_at < now() - interval '30 seconds') then
      update public.importer_staff_requests
      set status = 'COMPLETED', updated_at = now()
      where public.importer_staff_requests.id = v_focus_request_id;

      v_focus_work_id := null;
      v_focus_request_id := null;
    elsif v_focus_status = 'QUEUED' then
      -- Transition QUEUED to IMPORTING once processing begins
      update public.importer_staff_requests
      set status = 'IMPORTING', updated_at = now()
      where public.importer_staff_requests.id = v_focus_request_id
        and public.importer_staff_requests.status = 'QUEUED';
    end if;
  end if;

  -- 2. Select next job respecting focus mode
  select q.id into v_job_id
  from public.importer_queue q
  where (
    (q.status in ('QUEUED', 'RETRY') and q.next_run_at <= now())
    or
    (q.status = 'IMPORTING' and q.lease_expires_at < now())
  )
  -- Single-focus constraint: when active, acquire ONLY jobs belonging to focus work.
  and (
    v_focus_work_id is null
    or
    (q.payload->>'workId')::text = v_focus_work_id::text
  )
  and (p_source is null or q.source = p_source)
  and not exists (
    select 1 from public.importer_sources s
    where s.id = q.source
      and (s.enabled = false or s.status = 'PAUSED' or (s.cooldown_until is not null and s.cooldown_until > now()))
  )
  order by
    case
      -- 0. Absolute Priority Work jobs always jump to the top
      when v_focus_work_id is not null and (q.payload->>'workId')::text = v_focus_work_id::text then 100

      -- 1. Progressive Blocker (Canonical Barrier)
      when q.task_type = 'IMPORT_CHAPTER'
       and q.payload->>'workId' is not null
       and q.chapter_sort_key is not null
       and exists (
         select 1
         from public.importer_chapter_mappings staged
         where staged.work_id = (q.payload->>'workId')::uuid
           and staged.status = 'STAGED'
           and staged.chapter_sort_key > q.chapter_sort_key
       )
       and not exists (
         select 1
         from public.importer_queue q2
         where q2.task_type = 'IMPORT_CHAPTER'
           and (q2.payload->>'workId')::text = q.payload->>'workId'
           and q2.status in ('QUEUED', 'RETRY', 'IMPORTING')
           and q2.id != q.id
           and q2.chapter_sort_key < q.chapter_sort_key
       )
       and not exists (
         select 1
         from public.importer_chapter_mappings m2
         left join public.chapters c2 on c2.id = m2.chapter_id
         where m2.work_id = (q.payload->>'workId')::uuid
           and m2.chapter_sort_key < q.chapter_sort_key
           and m2.status not in ('STAGED', 'COMPLETED')
           and m2.is_gap = false
           and (c2.published_at is null or c2.id is null)
       ) then 90

      else q.priority
    end desc,
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
      last_recovered_error = case
        when public.importer_queue.last_error is not null then public.importer_queue.last_error
        else public.importer_queue.last_recovered_error
      end,
      recovered_at = case
        when public.importer_queue.last_error is not null then now()
        else public.importer_queue.recovered_at
      end,
      last_error = null,
      retry_reason = null,
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

revoke all on function public.importer_acquire_job(text, interval, text) from public, anon, authenticated;
grant execute on function public.importer_acquire_job(text, interval, text) to service_role;

-- 3. Update importer_recover_stalled_leases to record clean telemetry without string concatenation
create or replace function public.importer_recover_stalled_leases()
returns table (
  recovered_count integer,
  failed_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recovered integer := 0;
  v_failed integer := 0;
begin
  with requeued_jobs as (
    update public.importer_queue
    set
      status = 'RETRY',
      locked_by = null,
      locked_at = null,
      lease_expires_at = null,
      next_run_at = now(),
      retry_reason = 'LEASE_TIMEOUT',
      last_error = 'Lease expirado (worker reiniciado ou demorado na tentativa ' || attempts || ')',
      last_error_at = now(),
      updated_at = now()
    where status = 'IMPORTING'
      and lease_expires_at < now()
    returning id
  )
  select count(*)::integer into v_recovered from requeued_jobs;

  return query select v_recovered, v_failed;
end;
$$;

revoke all on function public.importer_recover_stalled_leases() from public, anon, authenticated;
grant execute on function public.importer_recover_stalled_leases() to service_role;

-- 4. Update importer_release_job to record last_error_at and retry_reason
create or replace function public.importer_release_job(
  p_job_id uuid,
  p_worker_id text,
  p_status text,
  p_error text default null,
  p_retry_delay interval default null,
  p_retry_delay_minutes numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_run timestamptz;
  v_effective_delay interval;
begin
  if p_status = 'RETRY' then
    if p_retry_delay is not null then
      v_effective_delay := p_retry_delay;
    elsif p_retry_delay_minutes is not null then
      v_effective_delay := (p_retry_delay_minutes || ' minutes')::interval;
    else
      v_effective_delay := interval '1 minute';
    end if;
    v_next_run := now() + v_effective_delay;
  else
    v_next_run := now();
  end if;

  update public.importer_queue
  set
    status = p_status,
    locked_by = null,
    locked_at = null,
    lease_expires_at = null,
    last_error = p_error,
    last_error_at = case when p_error is not null then now() else last_error_at end,
    retry_reason = case when p_error is not null then 'PROVIDER_ERROR' else null end,
    next_run_at = v_next_run,
    updated_at = now()
  where id = p_job_id
    and (locked_by = p_worker_id or locked_by is null);

  return found;
end;
$$;

revoke all on function public.importer_release_job(uuid, text, text, text, interval, numeric) from public, anon, authenticated;
grant execute on function public.importer_release_job(uuid, text, text, text, interval, numeric) to service_role;

commit;
