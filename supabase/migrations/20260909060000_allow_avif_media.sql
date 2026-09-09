-- ============================================================================
-- Migration: 20260909060000_allow_avif_media.sql
-- Description: Allow AVIF image format in public.media and nox-media bucket
-- ============================================================================

alter table public.media drop constraint if exists media_mime_check;
alter table public.media add constraint media_mime_check check(mime in ('image/jpeg','image/png','image/webp','image/gif','image/avif'));

update storage.buckets set allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','image/avif'] where id = 'nox-media';
