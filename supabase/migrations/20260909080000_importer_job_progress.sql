-- ==============================================================================
-- Project Nox Importer - Migration 20260909080000:
-- Real-time chapter import progress tracking (stage, current, total)
-- ==============================================================================

begin;

alter table public.importer_queue
  add column if not exists progress_current integer default 0,
  add column if not exists progress_total integer default 0,
  add column if not exists progress_stage text default null;

commit;
