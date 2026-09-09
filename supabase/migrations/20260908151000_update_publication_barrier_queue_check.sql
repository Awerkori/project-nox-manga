-- ==============================================================================
-- PROJECT NOX IMPORTER - Update publication barrier to check active queue items
-- ==============================================================================

begin;

-- 1. Backfill chapter_sort_key on existing importer_queue items if missing
update public.importer_queue
set chapter_sort_key = (payload->>'chapterNumber')::numeric
where chapter_sort_key is null and task_type = 'IMPORT_CHAPTER' and payload->>'chapterNumber' is not null;

-- 2. Index for fast barrier lookup on active queue
create index if not exists importer_queue_barrier_lookup_idx
  on public.importer_queue(task_type, status, ((payload->>'workId')::text), chapter_sort_key)
  where task_type = 'IMPORT_CHAPTER';

-- 3. Enhanced atomic publication barrier verification
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
begin
  -- Step 1: Safeguard 1 - Verify discovery is complete for this work
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

commit;
