-- Migration: 20260912235900_drop_pages_unique_media_id_and_cleanup.sql
-- Description: Drop redundant unique(chapter_id, media_id) constraint on public.pages.
-- Chapters can legitimate have the same media_id across multiple positions (e.g. scan disclaimer/credit banner at start and end).
-- The primary key of public.pages is (chapter_id, position).

ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_chapter_id_media_id_key;

-- Reset active_uploads counter on storage_shards to clean slate
UPDATE public.storage_shards SET active_uploads = 0 WHERE active_uploads > 0;
