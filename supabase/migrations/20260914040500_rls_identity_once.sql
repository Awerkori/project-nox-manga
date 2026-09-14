-- Evaluate identity once per statement; preserve policy roles and existing row predicates.
ALTER POLICY "importer_chapter_mappings_staff_select" ON public."importer_chapter_mappings" USING ((SELECT public.is_editor()));
ALTER POLICY "importer_queue_staff_select" ON public."importer_queue" USING ((SELECT public.is_editor()));
ALTER POLICY "work_health_select" ON public."importer_work_health" USING ((SELECT public.is_editor()));
ALTER POLICY works_public ON public.works USING (published OR (SELECT public.is_editor()));
