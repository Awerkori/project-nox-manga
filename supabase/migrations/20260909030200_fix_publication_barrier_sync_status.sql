-- ==============================================================================
-- Project Nox Importer - Migration 20260909030200:
-- Refine importer_check_publication_barrier so routine maintenance syncs
-- on already-SYNCED works do not indefinitely block already-staged chapters.
-- ==============================================================================

create or replace function public.importer_check_publication_barrier(
  p_work_id uuid,
  p_target_sort_key numeric
)
returns table (
  can_publish boolean,
  reason text,
  blocking_count integer,
  blocking_sort_keys numeric[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sync_pending integer;
  v_blocking_keys numeric[];
  v_is_already_synced boolean;
begin
  -- Check if the work has already completed initial sync
  select exists (
    select 1
    from public.importer_work_mappings wm
    where wm.work_id = p_work_id
      and wm.sync_status = 'SYNCED'
      and wm.last_synced_at is not null
  ) into v_is_already_synced;

  -- Step 1: Safeguard 1 - Verify discovery is complete for this work
  -- If work has NEVER completed initial sync, any active SYNC_WORK blocks publication.
  if not v_is_already_synced then
    select count(*) into v_sync_pending
    from public.importer_queue q
    where q.task_type = 'SYNC_WORK'
      and q.status in ('QUEUED', 'IMPORTING')
      and (
        (q.payload->>'workId')::text = p_work_id::text
        or q.payload->>'sourceWorkId' in (
          select wm.source_work_id from public.importer_work_mappings wm where wm.work_id = p_work_id
        )
      );

    if v_sync_pending > 0 then
      return query select false, 'DISCOVERY_IN_PROGRESS'::text, v_sync_pending, array[]::numeric[];
      return;
    end if;
  end if;

  -- Step 2: Check for any preceding chapters in mappings or active queue that are NOT published
  select array_agg(distinct k order by k asc)
  into v_blocking_keys
  from (
    -- Preceding chapters in mappings
    select m.chapter_sort_key as k
    from public.importer_chapter_mappings m
    left join public.chapters c on c.id = m.chapter_id
    where m.work_id = p_work_id
      and m.chapter_sort_key < p_target_sort_key
      and m.is_gap = false
      and (c.published_at is null or c.id is null)

    union

    -- Preceding chapters active in queue
    select coalesce(q.chapter_sort_key, (q.payload->>'chapterNumber')::numeric) as k
    from public.importer_queue q
    where q.task_type = 'IMPORT_CHAPTER'
      and q.status in ('QUEUED', 'RETRY', 'IMPORTING')
      and (q.payload->>'workId')::text = p_work_id::text
      and coalesce(q.chapter_sort_key, (q.payload->>'chapterNumber')::numeric) < p_target_sort_key
  ) sub;

  if v_blocking_keys is not null and array_length(v_blocking_keys, 1) > 0 then
    return query select false, 'PRECEDING_CHAPTERS_UNPUBLISHED'::text, array_length(v_blocking_keys, 1), v_blocking_keys;
    return;
  end if;

  -- Barrier cleared: all preceding chapters are published or confirmed gaps
  return query select true, 'OK'::text, 0, array[]::numeric[];
end;
$$;

revoke all on function public.importer_check_publication_barrier(uuid, numeric) from public, anon, authenticated;
grant execute on function public.importer_check_publication_barrier(uuid, numeric) to service_role;
