-- Hotfix: grant select on content_rating column to anon and authenticated
grant select (content_rating) on public.works to anon, authenticated;
