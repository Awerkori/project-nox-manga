-- Reinstate the existing column-level read policy after the identity migration
-- inadvertently granted SELECT on the complete chapters table.
REVOKE SELECT ON public.chapters FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, work_id, number, title, published_at, created_at) ON public.chapters TO anon, authenticated;
GRANT SELECT (canonical_chapter_key, display_number, chapter_order_key, chapter_kind, edition, language, origin, views_total) ON public.chapters TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
