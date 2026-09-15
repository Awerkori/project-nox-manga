CREATE INDEX IF NOT EXISTS idx_importer_queue_chapter_sort_key
  ON public.importer_queue (chapter_sort_key);

CREATE INDEX IF NOT EXISTS idx_importer_chapter_manifest_sort_key
  ON public.importer_chapter_manifest (chapter_sort_key);
