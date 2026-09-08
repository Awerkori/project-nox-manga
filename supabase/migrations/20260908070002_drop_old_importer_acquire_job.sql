-- Drop old 2-argument signature to eliminate overload ambiguity in PostgREST and Postgres
drop function if exists public.importer_acquire_job(text, interval);
