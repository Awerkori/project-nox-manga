-- ==============================================================================
-- Project Nox Importer - Migration 20260909110000:
-- Source Operational Isolation & UPSTREAM_BLOCKED Handling
-- 1. Expands importer_sources.status to include UPSTREAM_BLOCKED, DEGRADED, RECOVERING.
-- 2. Adds blocked_reason, blocked_details, last_health_check_at to importer_sources.
-- 3. Expands importer_queue.status to include BLOCKED_BY_UPSTREAM.
-- 4. Parks existing nexus_toons jobs in BLOCKED_BY_UPSTREAM status.
-- 5. Updates importer_acquire_job to strictly ignore UPSTREAM_BLOCKED sources.
-- ==============================================================================

begin;

-- 1. UPDATE IMPORTER_SOURCES SCHEMA
alter table public.importer_sources
  drop constraint if exists importer_sources_status_check;

alter table public.importer_sources
  add constraint importer_sources_status_check
  check (status in ('ACTIVE', 'PAUSED', 'COOLDOWN', 'DISABLED', 'UPSTREAM_BLOCKED', 'DEGRADED', 'RECOVERING'));

alter table public.importer_sources
  add column if not exists blocked_reason text,
  add column if not exists blocked_details jsonb not null default '{}'::jsonb,
  add column if not exists last_health_check_at timestamptz;

-- 2. UPDATE IMPORTER_QUEUE SCHEMA
alter table public.importer_queue
  drop constraint if exists importer_queue_status_check;

alter table public.importer_queue
  add constraint importer_queue_status_check
  check (status in ('QUEUED', 'IMPORTING', 'COMPLETED', 'FAILED', 'RETRY', 'PAUSED_BY_STAFF', 'CANCELLED_BY_STAFF', 'BLOCKED_BY_UPSTREAM'));

create index if not exists idx_importer_queue_blocked_upstream
  on public.importer_queue(source, status)
  where status = 'BLOCKED_BY_UPSTREAM';

-- 3. SET NEXUS_TOONS AS UPSTREAM_BLOCKED
update public.importer_sources
set
  status = 'UPSTREAM_BLOCKED',
  enabled = false,
  blocked_reason = 'CLOUDFLARE_DATACENTER_BLOCK',
  blocked_details = jsonb_build_object(
    'reason', 'CLOUDFLARE_DATACENTER_BLOCK',
    'message', 'Cloudflare bloqueia o ambiente atual do Importer (DIScloud / OVH ASN 16276). Local/Mihon: funcional; DIScloud: HTTP 403.',
    'local_status', 200,
    'discloud_status', 403
  ),
  last_health_check_at = now(),
  updated_at = now()
where id = 'nexus_toons';

-- 4. PARK EXISTING NEXUS_TOONS QUEUE JOBS SAFELY IN BLOCKED_BY_UPSTREAM
update public.importer_queue
set
  status = 'BLOCKED_BY_UPSTREAM',
  locked_by = null,
  locked_at = null,
  lease_expires_at = null,
  last_error = 'Fonte bloqueada pelo Cloudflare WAF no ambiente DIScloud (ASN 16276). Preservado até liberação.',
  updated_at = now()
where source = 'nexus_toons'
  and status in ('QUEUED', 'RETRY', 'IMPORTING');

-- 5. UPDATE IMPORTER_ACQUIRE_JOB
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
    -- Ensure focus work is not frozen
    if exists (
      select 1 from public.importer_work_mappings wm_f
      where wm_f.work_id = v_focus_work_id and wm_f.sync_status = 'FROZEN_BY_STAFF'
    ) then
      v_focus_work_id := null;
      v_focus_request_id := null;
    else
      -- Check pending work
      select exists (
        select 1 from public.importer_queue q
        where (q.payload->>'workId')::text = v_focus_work_id::text
          and q.status in ('QUEUED', 'RETRY', 'IMPORTING')
          and q.cancel_requested = false
      ) into v_has_pending_jobs;

      select exists (
        select 1 from public.importer_chapter_mappings m
        where m.work_id = v_focus_work_id
          and m.status in ('QUEUED', 'IMPORTING', 'STAGED')
      ) into v_has_pending_mappings;

      select exists (
        select 1 from public.importer_work_mappings wm_done
        where wm_done.work_id = v_focus_work_id and wm_done.sync_status = 'COMPLETED'
      ) into v_has_completed_work;

      if not v_has_pending_jobs and not v_has_pending_mappings and v_has_completed_work then
        update public.importer_staff_requests
        set status = 'COMPLETED', updated_at = now()
        where public.importer_staff_requests.id = v_focus_request_id;

        v_focus_work_id := null;
        v_focus_request_id := null;
      elsif v_focus_status = 'QUEUED' then
        update public.importer_staff_requests
        set status = 'IMPORTING', updated_at = now()
        where public.importer_staff_requests.id = v_focus_request_id
          and public.importer_staff_requests.status = 'QUEUED';
      end if;
    end if;
  end if;

  -- 2. Select next job respecting focus mode, staff controls, and provider operational health
  select q.id into v_job_id
  from public.importer_queue q
  where (
    (q.status in ('QUEUED', 'RETRY') and q.next_run_at <= now())
    or
    (q.status = 'IMPORTING' and q.lease_expires_at < now())
  )
  -- Strictly avoid cancel requested jobs
  and q.cancel_requested = false
  -- Strictly avoid jobs of FROZEN works
  and not exists (
    select 1 from public.importer_work_mappings wm_fz
    where wm_fz.work_id = (q.payload->>'workId')::uuid
      and wm_fz.sync_status = 'FROZEN_BY_STAFF'
  )
  -- Single-focus constraint: when active, acquire ONLY jobs belonging to focus work.
  and (
    v_focus_work_id is null
    or
    (q.payload->>'workId')::text = v_focus_work_id::text
  )
  and (p_source is null or q.source = p_source)
  -- Strictly avoid disabled, paused, or upstream-blocked sources
  and not exists (
    select 1 from public.importer_sources s
    where s.id = q.source
      and (
        s.enabled = false
        or s.status in ('PAUSED', 'UPSTREAM_BLOCKED', 'DISABLED')
        or (s.cooldown_until is not null and s.cooldown_until > now())
      )
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
           and q2.cancel_requested = false
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

commit;
