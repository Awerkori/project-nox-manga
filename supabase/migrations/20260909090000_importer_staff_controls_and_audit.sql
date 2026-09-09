-- ==============================================================================
-- Project Nox Importer - Migration 20260909090000:
-- Staff Controls Semantics, Human Intervention Audit & Safe Cancellation Checkpoints
-- ==============================================================================

begin;

-- 1. Update check constraint on importer_queue.status
alter table public.importer_queue drop constraint if exists importer_queue_status_check;
alter table public.importer_queue add constraint importer_queue_status_check check (
  status in ('QUEUED', 'IMPORTING', 'COMPLETED', 'FAILED', 'RETRY', 'PAUSED_BY_STAFF', 'CANCELLED_BY_STAFF')
);

-- 2. Add staff control columns to importer_queue
alter table public.importer_queue
  add column if not exists cancel_requested boolean not null default false,
  add column if not exists cancelled_by uuid references public.members(id) on delete set null,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists paused_by uuid references public.members(id) on delete set null,
  add column if not exists paused_at timestamptz,
  add column if not exists pause_reason text;

create index if not exists idx_importer_queue_cancel_req on public.importer_queue(cancel_requested) where cancel_requested = true;
create index if not exists idx_importer_queue_staff_status on public.importer_queue(status) where status in ('PAUSED_BY_STAFF', 'CANCELLED_BY_STAFF');

-- 3. Update check constraint on importer_work_mappings.sync_status & add freeze columns
alter table public.importer_work_mappings drop constraint if exists importer_work_mappings_sync_status_check;
alter table public.importer_work_mappings add constraint importer_work_mappings_sync_status_check check (
  sync_status in ('SYNCED', 'AMBIGUOUS', 'IGNORED', 'FAILED', 'COMPLETED', 'FROZEN_BY_STAFF')
);

alter table public.importer_work_mappings
  add column if not exists frozen_by uuid references public.members(id) on delete set null,
  add column if not exists frozen_at timestamptz,
  add column if not exists freeze_reason text;

-- 4. Update check constraint on importer_work_health.health_status
alter table public.importer_work_health drop constraint if exists importer_work_health_health_status_check;
alter table public.importer_work_health add constraint importer_work_health_health_status_check check (
  health_status in ('HEALTHY', 'INCOMPLETE', 'RECONCILING', 'BLOCKED', 'UNVERIFIED', 'FROZEN_BY_STAFF')
);

-- 5. Create Staff Audit Table
create table if not exists public.importer_staff_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.members(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  old_state text null,
  new_state text null,
  reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_importer_staff_audit_action on public.importer_staff_audit(action, created_at desc);
create index if not exists idx_importer_staff_audit_target on public.importer_staff_audit(target_type, target_id);

-- 6. RPC: Cancel Job with safe checkpoint handling
create or replace function public.importer_staff_cancel_job(
  p_job_id uuid,
  p_actor_id uuid default null,
  p_reason text default 'Cancelado pela Staff'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job record;
begin
  select * into v_job
  from public.importer_queue
  where id = p_job_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Job não encontrado');
  end if;

  if v_job.status = 'IMPORTING' then
    -- Signal running worker to terminate at next safe checkpoint
    update public.importer_queue
    set
      cancel_requested = true,
      cancel_reason = p_reason,
      cancelled_by = p_actor_id,
      cancelled_at = now(),
      updated_at = now()
    where id = p_job_id;

    insert into public.importer_staff_audit(actor_id, action, target_type, target_id, old_state, new_state, reason, metadata)
    values (p_actor_id, 'CANCEL_JOB_REQUESTED', 'JOB', p_job_id::text, v_job.status, 'CANCEL_REQUESTED', p_reason, jsonb_build_object('worker_id', v_job.locked_by));

    return jsonb_build_object('success', true, 'mode', 'ASYNC_SIGNAL', 'message', 'Cancelamento solicitado. Worker irá interromper no próximo checkpoint seguro.');
  else
    -- Immediately cancel non-active job
    update public.importer_queue
    set
      status = 'CANCELLED_BY_STAFF',
      cancel_requested = false,
      cancelled_by = p_actor_id,
      cancelled_at = now(),
      cancel_reason = p_reason,
      locked_by = null,
      locked_at = null,
      lease_expires_at = null,
      last_error = null,
      updated_at = now()
    where id = p_job_id;

    insert into public.importer_staff_audit(actor_id, action, target_type, target_id, old_state, new_state, reason, metadata)
    values (p_actor_id, 'CANCEL_JOB', 'JOB', p_job_id::text, v_job.status, 'CANCELLED_BY_STAFF', p_reason, '{}'::jsonb);

    return jsonb_build_object('success', true, 'mode', 'IMMEDIATE', 'message', 'Job cancelado pela Staff com sucesso.');
  end if;
end;
$$;

-- 7. RPC: Pause Job (indefinite pause until manual resume)
create or replace function public.importer_staff_pause_job(
  p_job_id uuid,
  p_actor_id uuid default null,
  p_reason text default 'Pausado pela Staff'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job record;
begin
  select * into v_job
  from public.importer_queue
  where id = p_job_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Job não encontrado');
  end if;

  update public.importer_queue
  set
    status = 'PAUSED_BY_STAFF',
    paused_by = p_actor_id,
    paused_at = now(),
    pause_reason = p_reason,
    locked_by = null,
    locked_at = null,
    lease_expires_at = null,
    updated_at = now()
  where id = p_job_id;

  insert into public.importer_staff_audit(actor_id, action, target_type, target_id, old_state, new_state, reason, metadata)
  values (p_actor_id, 'PAUSE_JOB', 'JOB', p_job_id::text, v_job.status, 'PAUSED_BY_STAFF', p_reason, '{}'::jsonb);

  return jsonb_build_object('success', true, 'message', 'Job pausado pela Staff.');
end;
$$;

-- 8. RPC: Resume Job (from PAUSED_BY_STAFF back to QUEUED)
create or replace function public.importer_staff_resume_job(
  p_job_id uuid,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job record;
begin
  select * into v_job
  from public.importer_queue
  where id = p_job_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Job não encontrado');
  end if;

  update public.importer_queue
  set
    status = 'QUEUED',
    next_run_at = now(),
    paused_by = null,
    paused_at = null,
    pause_reason = null,
    cancel_requested = false,
    updated_at = now()
  where id = p_job_id;

  insert into public.importer_staff_audit(actor_id, action, target_type, target_id, old_state, new_state, reason, metadata)
  values (p_actor_id, 'RESUME_JOB', 'JOB', p_job_id::text, v_job.status, 'QUEUED', 'Retomado pela Staff', '{}'::jsonb);

  return jsonb_build_object('success', true, 'message', 'Job retomado e colocado na fila para execução.');
end;
$$;

-- 9. RPC: Postpone Job (temporary delay: 1h, 6h, 24h)
create or replace function public.importer_staff_postpone_job(
  p_job_id uuid,
  p_delay interval,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job record;
  v_next timestamptz;
begin
  select * into v_job
  from public.importer_queue
  where id = p_job_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Job não encontrado');
  end if;

  v_next := now() + p_delay;

  update public.importer_queue
  set
    status = case when status = 'IMPORTING' then 'RETRY' else status end,
    next_run_at = v_next,
    locked_by = null,
    locked_at = null,
    lease_expires_at = null,
    updated_at = now()
  where id = p_job_id;

  insert into public.importer_staff_audit(actor_id, action, target_type, target_id, old_state, new_state, reason, metadata)
  values (p_actor_id, 'POSTPONE_JOB', 'JOB', p_job_id::text, v_job.status, v_job.status, 'Adiado temporariamente', jsonb_build_object('next_run_at', v_next));

  return jsonb_build_object('success', true, 'message', 'Job adiado temporariamente com sucesso.');
end;
$$;

-- 10. RPC: Freeze Work (operational freeze across all providers)
create or replace function public.importer_staff_freeze_work(
  p_work_id uuid,
  p_actor_id uuid default null,
  p_reason text default 'Congelado pela Staff'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancelled_count integer := 0;
  v_active_count integer := 0;
begin
  -- 1. Mark mappings as FROZEN_BY_STAFF
  update public.importer_work_mappings
  set
    sync_status = 'FROZEN_BY_STAFF',
    frozen_by = p_actor_id,
    frozen_at = now(),
    freeze_reason = p_reason,
    updated_at = now()
  where work_id = p_work_id;

  -- 2. Mark health as FROZEN_BY_STAFF
  update public.importer_work_health
  set
    health_status = 'FROZEN_BY_STAFF',
    updated_at = now()
  where work_id = p_work_id;

  -- 3. Cancel non-active jobs
  with cancelled as (
    update public.importer_queue
    set
      status = 'CANCELLED_BY_STAFF',
      cancelled_by = p_actor_id,
      cancelled_at = now(),
      cancel_reason = 'Obra congelada pela Staff: ' || p_reason,
      updated_at = now()
    where (payload->>'workId')::text = p_work_id::text
      and status in ('QUEUED', 'RETRY', 'PAUSED_BY_STAFF')
    returning id
  )
  select count(*) into v_cancelled_count from cancelled;

  -- 4. Signal active importing jobs to cancel at checkpoint
  with signaled as (
    update public.importer_queue
    set
      cancel_requested = true,
      cancelled_by = p_actor_id,
      cancelled_at = now(),
      cancel_reason = 'Obra congelada pela Staff: ' || p_reason,
      updated_at = now()
    where (payload->>'workId')::text = p_work_id::text
      and status = 'IMPORTING'
    returning id
  )
  select count(*) into v_active_count from signaled;

  insert into public.importer_staff_audit(actor_id, action, target_type, target_id, old_state, new_state, reason, metadata)
  values (p_actor_id, 'FREEZE_WORK', 'WORK', p_work_id::text, 'ACTIVE', 'FROZEN_BY_STAFF', p_reason, jsonb_build_object('cancelled_jobs', v_cancelled_count, 'signaled_jobs', v_active_count));

  return jsonb_build_object('success', true, 'cancelledJobs', v_cancelled_count, 'signaledJobs', v_active_count, 'message', 'Obra congelada pela Staff com sucesso.');
end;
$$;

-- 11. RPC: Unfreeze Work (restore to ACTIVE / SYNCED)
create or replace function public.importer_staff_unfreeze_work(
  p_work_id uuid,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Restore mappings to SYNCED
  update public.importer_work_mappings
  set
    sync_status = 'SYNCED',
    frozen_by = null,
    frozen_at = null,
    freeze_reason = null,
    updated_at = now()
  where work_id = p_work_id
    and sync_status = 'FROZEN_BY_STAFF';

  -- 2. Restore health to INCOMPLETE (will be audited/reconciled on next cycle)
  update public.importer_work_health
  set
    health_status = 'INCOMPLETE',
    updated_at = now()
  where work_id = p_work_id
    and health_status = 'FROZEN_BY_STAFF';

  insert into public.importer_staff_audit(actor_id, action, target_type, target_id, old_state, new_state, reason, metadata)
  values (p_actor_id, 'UNFREEZE_WORK', 'WORK', p_work_id::text, 'FROZEN_BY_STAFF', 'SYNCED', 'Descongelado pela Staff', '{}'::jsonb);

  return jsonb_build_object('success', true, 'message', 'Obra descongelada com sucesso. Reconciliação reativada.');
end;
$$;

-- 12. Update importer_acquire_job to strictly ignore FROZEN works and cancel_requested jobs
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

  -- 2. Select next job respecting focus mode and staff controls
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
      cancel_requested = false,
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

-- 13. Update importer_release_job to handle CANCELLED_BY_STAFF cleanly
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
    last_error = case when p_status = 'CANCELLED_BY_STAFF' then null else p_error end,
    last_error_at = case when p_error is not null and p_status != 'CANCELLED_BY_STAFF' then now() else last_error_at end,
    retry_reason = case when p_error is not null and p_status != 'CANCELLED_BY_STAFF' then 'PROVIDER_ERROR' else null end,
    cancel_requested = false,
    next_run_at = v_next_run,
    updated_at = now()
  where id = p_job_id
    and (locked_by = p_worker_id or locked_by is null);

  return found;
end;
$$;

grant execute on function public.importer_staff_cancel_job(uuid, uuid, text) to service_role, authenticated;
grant execute on function public.importer_staff_pause_job(uuid, uuid, text) to service_role, authenticated;
grant execute on function public.importer_staff_resume_job(uuid, uuid) to service_role, authenticated;
grant execute on function public.importer_staff_postpone_job(uuid, interval, uuid) to service_role, authenticated;
grant execute on function public.importer_staff_freeze_work(uuid, uuid, text) to service_role, authenticated;
grant execute on function public.importer_staff_unfreeze_work(uuid, uuid) to service_role, authenticated;

commit;
