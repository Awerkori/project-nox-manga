-- ==============================================================================
-- Project Nox Importer - Migration 20260909030000:
-- Add p_retry_delay_minutes to importer_release_job to support PostgREST RPC
-- ==============================================================================

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
    next_run_at = v_next_run,
    updated_at = now()
  where id = p_job_id
    and (locked_by = p_worker_id or locked_by is null);

  return found;
end;
$$;

revoke all on function public.importer_release_job(uuid, text, text, text, interval, numeric) from public, anon, authenticated;
grant execute on function public.importer_release_job(uuid, text, text, text, interval, numeric) to service_role;
