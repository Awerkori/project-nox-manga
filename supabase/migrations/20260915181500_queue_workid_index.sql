-- Ends the migration runner's BEGIN block
COMMIT;

-- Create index concurrently without locking the queue table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_importer_queue_workid_import 
ON public.importer_queue ((payload->>'workId')) 
WHERE status IN ('QUEUED', 'RETRY') AND task_type = 'IMPORT_CHAPTER';

-- Starts a new transaction for the runner's COMMIT block
BEGIN;
