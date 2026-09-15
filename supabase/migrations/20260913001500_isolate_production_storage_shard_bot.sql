-- ======================================================================
-- Migration: Isolate PRODUCTION_STORAGE shard bot reference
-- Timestamp: 2026-09-13T00:15:00Z
-- Description:
--   Sets bot_reference = 'PRODUCTION_STORAGE' on shard 25fc2523-3c02-4be9-ad3b-cacc2a5041ae
--   and existing scan_production_files records, completing physical decoupling
--   from STAFF_STORAGE.
-- ======================================================================

UPDATE public.storage_shards
SET 
  bot_reference = 'PRODUCTION_STORAGE',
  updated_at = now()
WHERE id = '25fc2523-3c02-4be9-ad3b-cacc2a5041ae';

UPDATE public.scan_production_files
SET 
  bot_reference = 'PRODUCTION_STORAGE'
WHERE storage_shard_id = '25fc2523-3c02-4be9-ad3b-cacc2a5041ae'
  AND bot_reference = 'STAFF_STORAGE';
