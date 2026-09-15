-- Fix foreign key constraint for return_to_stage_id to correctly reference scan_chapter_stages(id)
ALTER TABLE public.scan_chapter_stages 
  DROP CONSTRAINT IF EXISTS scan_chapter_stages_return_to_stage_id_fkey;

ALTER TABLE public.scan_chapter_stages 
  ADD CONSTRAINT scan_chapter_stages_return_to_stage_id_fkey 
  FOREIGN KEY (return_to_stage_id) REFERENCES public.scan_chapter_stages(id) ON DELETE SET NULL;
