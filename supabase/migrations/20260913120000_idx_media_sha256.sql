-- Migration: Index on media(sha256) for deduplication lookups
-- Eliminates sequential scan on 121,880+ rows that caused 11,347 seconds of CPU load
-- and connection pool exhaustion under concurrent importer/worker operations.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_sha256 
ON public.media (sha256) 
WHERE storage_ready = true;
