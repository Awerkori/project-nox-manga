-- Persist the provider coordinates needed to delete Telegram objects safely.
-- The upload-attempt row is the durable link to the finalized file and also
-- covers the window where a user cancels before finalization completes.
ALTER TABLE public.scan_pipeline_upload_attempts
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS bot_reference text,
  ADD COLUMN IF NOT EXISTS telegram_file_id text,
  ADD COLUMN IF NOT EXISTS telegram_message_id text,
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS telegram_unique_file_id text;

CREATE INDEX IF NOT EXISTS idx_scan_pipeline_attempt_telegram_cleanup
  ON public.scan_pipeline_upload_attempts (telegram_chat_id, telegram_message_id)
  WHERE telegram_message_id IS NOT NULL;
