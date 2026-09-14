-- Preserve public visibility and staff authorization, with a statement-level staff check.
ALTER POLICY chapters_public ON public.chapters USING (
  (SELECT public.is_editor()) OR (
    published_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.works w WHERE w.id=chapters.work_id AND w.published
    )
  )
);
ALTER POLICY pages_public ON public.pages USING (
  (SELECT public.is_editor()) OR public.public_chapter(chapter_id)
);
