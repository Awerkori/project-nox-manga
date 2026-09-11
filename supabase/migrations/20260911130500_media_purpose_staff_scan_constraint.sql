-- Migration: 20260911130500_media_purpose_staff_scan_constraint.sql
-- Description: Expand media_purpose_check to support staff_manual and scan_chapter for storage routing

ALTER TABLE public.media DROP CONSTRAINT IF EXISTS media_purpose_check;
ALTER TABLE public.media ADD CONSTRAINT media_purpose_check CHECK (
  purpose IN ('editorial', 'staff_manual', 'scan_chapter', 'avatar', 'banner', 'profile_banner', 'comment_banner', 'scan_logo', 'scan_banner', 'cosmetic')
);
