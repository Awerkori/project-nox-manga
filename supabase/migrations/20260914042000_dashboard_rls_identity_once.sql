-- Statement-level identity for remaining dashboard reads.
ALTER POLICY "staff_requests_select" ON public."importer_staff_requests" USING ((SELECT public.is_editor()));
ALTER POLICY "importer_sources_staff_select" ON public."importer_sources" USING ((SELECT public.is_editor()));
ALTER POLICY "importer_telemetry_staff_select" ON public."importer_telemetry" USING ((SELECT public.is_editor()));
ALTER POLICY "reports_staff_select" ON public."reports" USING ((SELECT public.is_editor()));
ALTER POLICY "chapter_manifest_select" ON public."importer_chapter_manifest" USING ((SELECT public.is_editor()));
