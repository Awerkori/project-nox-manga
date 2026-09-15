-- ==============================================================================
-- HARDENED EMAIL OUTBOX: ATOMIC CLAIM, FAIR PRIORITY & CRASH RECOVERY
-- ==============================================================================

-- 1. Extend public.scan_email_outbox with priority, lease, and cancellation audit
ALTER TABLE public.scan_email_outbox
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('HIGH', 'NORMAL', 'LOW')),
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_by text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Optimized indexes for queue draining and lease monitoring
CREATE INDEX IF NOT EXISTS idx_scan_email_outbox_queue 
  ON public.scan_email_outbox (status, priority, scheduled_at, created_at);

CREATE INDEX IF NOT EXISTS idx_scan_email_outbox_lease 
  ON public.scan_email_outbox (status, lease_expires_at) 
  WHERE status = 'PROCESSING';

-- 2. Update trigger to assign priority toDerived Emails
CREATE OR REPLACE FUNCTION public.trg_notification_derive_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_username text;
  v_subject text;
  v_html text;
  v_idempotency_key text;
  v_badge_color text := '#6366f1';
  v_badge_text text := 'NOTIFICAÇÃO';
  v_cta_label text := 'Acessar no Project Nox';
  v_url text;
  v_priority text := 'NORMAL';
BEGIN
  -- A. Obter e-mail do destinatário via auth.users
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RETURN NEW;
  END IF;

  -- B. Obter nome do usuário
  SELECT COALESCE(display_name, username, 'Membro') INTO v_username
  FROM public.members
  WHERE id = NEW.user_id;

  -- C. Chave de idempotência estrita derivada do notification_id
  v_idempotency_key := 'email:notif:' || NEW.id;

  -- D. Mapear template e prioridade por tipo de notificação
  IF NEW.kind = 'pipeline_stage_available' OR NEW.type IN ('TASK_ASSIGNED', 'STAGE_READY', 'QC_ISSUE', 'REWORK', 'MENTION', 'ROLE_MENTION') THEN
    v_priority := 'HIGH';
  ELSIF NEW.type IN ('BULK_CHAPTERS', 'TEST') THEN
    v_priority := 'LOW';
  ELSE
    v_priority := COALESCE(NEW.priority, 'NORMAL');
    IF v_priority NOT IN ('HIGH', 'NORMAL', 'LOW') THEN
      v_priority := 'NORMAL';
    END IF;
  END IF;

  IF NEW.kind = 'pipeline_stage_available' THEN
    IF NEW.title ILIKE '%retrabalho%' THEN
      v_badge_color := '#ef4444';
      v_badge_text := 'RETRABALHO';
    ELSIF NEW.title ILIKE '%fila%' THEN
      v_badge_color := '#f59e0b';
      v_badge_text := 'FILA';
    ELSIF NEW.title ILIKE '%aprovação%' OR NEW.title ILIKE '%pré aprovado%' THEN
      v_badge_color := '#10b981';
      v_badge_text := 'PRÉ APROVADO';
    ELSE
      v_badge_color := '#6366f1';
      v_badge_text := 'PIPELINE';
    END IF;
    v_subject := COALESCE(NEW.title, 'Etapa disponível no Pipeline') || ' — Project Nox';
    v_cta_label := 'Ver na Pipeline';
  ELSIF NEW.type = 'LEVEL_UP' THEN
    v_badge_color := '#eab308';
    v_badge_text := 'LEVEL UP!';
    v_subject := 'Parabéns! ' || COALESCE(NEW.title, 'Você alcançou um novo nível no Project Nox!');
    v_cta_label := 'Ver meu perfil';
  ELSIF NEW.type = 'ACHIEVEMENT' THEN
    v_badge_color := '#f59e0b';
    v_badge_text := 'CONQUISTA';
    v_subject := 'Nova conquista desbloqueada: ' || COALESCE(NEW.title, 'Conquista Nox');
    v_cta_label := 'Ver conquistas';
  ELSIF NEW.type = 'NEW_CHAPTER' OR NEW.type = 'CHAPTER_PUBLISHED' THEN
    v_badge_color := '#10b981';
    v_badge_text := 'NOVO CAPÍTULO';
    v_subject := 'Novo capítulo disponível: ' || COALESCE(NEW.title, 'Novo capítulo');
    v_cta_label := 'Ler agora';
  ELSIF NEW.type = 'MENTION' OR NEW.type = 'ROLE_MENTION' THEN
    v_badge_color := '#818cf8';
    v_badge_text := CASE WHEN NEW.type = 'ROLE_MENTION' THEN 'MENÇÃO DE CARGO' ELSE 'MENÇÃO DIRETA' END;
    v_subject := 'Você foi mencionado no Project Nox';
    v_cta_label := 'Ver mensagem';
  ELSIF NEW.type = 'REPLY_CHAT' OR NEW.type = 'REPLY_COMMENT' THEN
    v_badge_color := '#38bdf8';
    v_badge_text := 'RESPOSTA';
    v_subject := 'Nova resposta para você no Project Nox';
    v_cta_label := 'Ver resposta';
  ELSIF NEW.type IN ('TASK_ASSIGNED', 'STAGE_READY', 'QC_ISSUE', 'REWORK') THEN
    v_badge_color := CASE WHEN NEW.type IN ('QC_ISSUE', 'REWORK') THEN '#ef4444' ELSE '#6366f1' END;
    v_badge_text := 'PRODUÇÃO';
    v_subject := '[Scan] ' || COALESCE(NEW.title, 'Atualização de Produção');
    v_cta_label := 'Abrir no Pipeline';
  ELSIF NEW.type IN ('APPLICATION', 'APPLICATION_UPDATE') THEN
    v_badge_color := '#ec4899';
    v_badge_text := 'RECRUTAMENTO';
    v_subject := '[Recrutamento] ' || COALESCE(NEW.title, 'Candidatura');
    v_cta_label := 'Ver candidatura';
  END IF;

  v_url := 'https://manga.project-nox-awerkori.workers.dev' || COALESCE(NEW.href, '/notificacoes');

  -- E. Gerar HTML do e-mail
  v_html := '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>'
    || '<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#f4f4f5;">'
    || '<table width="100%" cellspacing="0" cellpadding="0" style="background-color:#09090b;padding:32px 16px;"><tr><td align="center">'
    || '<table width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#141417;border:1px solid #27272a;border-radius:12px;overflow:hidden;">'
    || '<tr><td style="padding:24px 32px;background:linear-gradient(180deg,rgba(99,102,241,0.12) 0%,transparent 100%);border-bottom:1px solid #1f1f23;">'
    || '<table width="100%" cellspacing="0" cellpadding="0"><tr>'
    || '<td><span style="font-size:18px;font-weight:800;letter-spacing:0.05em;color:#f4f4f5;text-transform:uppercase;">PROJECT <span style="color:#6366f1;">NOX</span></span></td>'
    || '<td align="right"><span style="display:inline-block;background-color:' || v_badge_color || ';color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;padding:3px 10px;border-radius:9999px;">' || v_badge_text || '</span></td>'
    || '</tr></table></td></tr>'
    || '<tr><td style="padding:32px;">'
    || '<p style="margin:0 0 16px 0;font-size:15px;color:#a1a1aa;">Olá, <strong style="color:#f4f4f5;">' || public.fn_html_escape(v_username) || '</strong></p>'
    || '<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">' || public.fn_html_escape(COALESCE(NEW.title, 'Notificação')) || '</h1>'
    || CASE WHEN NEW.context IS NOT NULL AND length(trim(NEW.context)) > 0 THEN '<div style="margin:0 0 16px 0;display:inline-block;background:#18181b;border:1px solid #27272a;padding:4px 10px;border-radius:6px;font-size:12px;color:#818cf8;font-weight:600;">' || public.fn_html_escape(NEW.context) || '</div>' ELSE '' END
    || '<div style="background-color:#18181b;border-left:3px solid ' || v_badge_color || ';border-radius:4px;padding:16px;margin:16px 0 24px 0;color:#d4d4d8;font-size:14px;line-height:1.6;">'
    || public.fn_html_escape(COALESCE(NEW.body, 'Você possui uma nova atualização.'))
    || '</div>'
    || '<table cellspacing="0" cellpadding="0" style="margin:28px 0 8px 0;"><tr>'
    || '<td align="center" style="border-radius:8px;background-color:#4f46e5;">'
    || '<a href="' || v_url || '" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#4f46e5;border:1px solid #6366f1;">'
    || v_cta_label || ' &rarr;</a>'
    || '</td></tr></table>'
    || '</td></tr>'
    || '<tr><td style="padding:20px 32px;background-color:#0d0d10;border-top:1px solid #1f1f23;font-size:12px;color:#71717a;text-align:center;">'
    || '<p style="margin:0 0 4px 0;">Você recebeu este e-mail por ser membro do <strong>Project Nox</strong>.</p>'
    || '</td></tr></table></td></tr></table></body></html>';

  -- F. Inserir na outbox (idempotência absoluta por idempotency_key e prioridade associada)
  INSERT INTO public.scan_email_outbox (
    notification_id,
    scan_id,
    recipient_user_id,
    recipient_email,
    subject,
    html_body,
    status,
    delivery_status,
    priority,
    idempotency_key,
    attempts
  ) VALUES (
    NEW.id,
    NEW.scan_id,
    NEW.user_id,
    v_email,
    v_subject,
    v_html,
    'PENDING',
    'QUEUED',
    v_priority,
    v_idempotency_key,
    0
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Atomic Batch Claim RPC with SKIP LOCKED, Lease Recovery & Fairness
CREATE OR REPLACE FUNCTION public.claim_scan_email_outbox_batch(
  p_limit int DEFAULT 20,
  p_specific_id uuid DEFAULT NULL,
  p_lease_seconds int DEFAULT 300,
  p_worker_id text DEFAULT NULL
)
RETURNS SETOF public.scan_email_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_lease_expiry timestamptz := v_now + (p_lease_seconds || ' seconds')::interval;
BEGIN
  -- A. Crash Recovery: recupera itens travados em PROCESSING cujo lease expirou
  UPDATE public.scan_email_outbox
  SET 
    status = 'PENDING',
    delivery_status = 'RECOVERED_FROM_CRASH',
    last_error = COALESCE(last_error, '') || ' [Crash/Lease timeout recovered]',
    claimed_at = NULL,
    claimed_by = NULL,
    lease_expires_at = NULL
  WHERE status = 'PROCESSING'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < v_now;

  -- B. Fast-Path: solicitação de ID específico prioritário
  IF p_specific_id IS NOT NULL THEN
    RETURN QUERY
    UPDATE public.scan_email_outbox o
    SET 
      status = 'PROCESSING',
      delivery_status = 'CLAIMED',
      claimed_at = v_now,
      claimed_by = p_worker_id,
      lease_expires_at = v_lease_expiry,
      attempts = o.attempts + 1
    WHERE o.id = p_specific_id
      AND (
        o.status = 'PENDING'
        OR (o.status = 'PROCESSING' AND o.lease_expires_at < v_now)
      )
    RETURNING o.*;
    RETURN;
  END IF;

  -- C. General Fair Drain com SKIP LOCKED:
  -- Prioridade Lógica: HIGH (3) > NORMAL (2) > LOW (1)
  -- Ordem dentro da mesma prioridade: FIFO Estrito (scheduled_at ASC, created_at ASC)
  -- Evita starvation garantindo que itens prontos sejam processados
  RETURN QUERY
  WITH candidate_rows AS (
    SELECT id
    FROM public.scan_email_outbox
    WHERE status = 'PENDING'
      AND scheduled_at <= v_now
    ORDER BY 
      CASE priority
        WHEN 'HIGH' THEN 3
        WHEN 'NORMAL' THEN 2
        WHEN 'LOW' THEN 1
        ELSE 2
      END DESC,
      scheduled_at ASC,
      created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.scan_email_outbox o
  SET 
    status = 'PROCESSING',
    delivery_status = 'CLAIMED',
    claimed_at = v_now,
    claimed_by = p_worker_id,
    lease_expires_at = v_lease_expiry,
    attempts = o.attempts + 1
  FROM candidate_rows c
  WHERE o.id = c.id
  RETURNING o.*;
END;
$$;

-- 4. Audited Cancellation RPC
CREATE OR REPLACE FUNCTION public.cancel_scan_email_outbox_item(
  p_outbox_id uuid,
  p_reason text,
  p_actor text DEFAULT 'system'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.scan_email_outbox
  SET 
    status = 'CANCELLED',
    delivery_status = 'CANCELLED',
    cancellation_reason = p_reason,
    cancelled_by = p_actor,
    cancelled_at = now()
  WHERE id = p_outbox_id
    AND status IN ('PENDING', 'PROCESSING');

  RETURN FOUND;
END;
$$;

-- 5. Outbox Observability & Health Metrics RPC
CREATE OR REPLACE FUNCTION public.get_scan_email_outbox_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pending int;
  v_processing int;
  v_retrying int;
  v_failed int;
  v_sent int;
  v_cancelled int;
  v_oldest_pending timestamptz;
  v_oldest_age_sec int := 0;
  v_last_success timestamptz;
  v_last_failure timestamptz;
  v_avg_latency_sec numeric := 0;
BEGIN
  SELECT count(*) INTO v_pending FROM public.scan_email_outbox WHERE status = 'PENDING';
  SELECT count(*) INTO v_processing FROM public.scan_email_outbox WHERE status = 'PROCESSING';
  SELECT count(*) INTO v_retrying FROM public.scan_email_outbox WHERE status = 'PENDING' AND attempts > 0;
  SELECT count(*) INTO v_failed FROM public.scan_email_outbox WHERE status = 'FAILED';
  SELECT count(*) INTO v_sent FROM public.scan_email_outbox WHERE status = 'SENT';
  SELECT count(*) INTO v_cancelled FROM public.scan_email_outbox WHERE status = 'CANCELLED';

  SELECT min(created_at) INTO v_oldest_pending FROM public.scan_email_outbox WHERE status = 'PENDING';
  IF v_oldest_pending IS NOT NULL THEN
    v_oldest_age_sec := EXTRACT(EPOCH FROM (clock_timestamp() - v_oldest_pending))::int;
  END IF;

  SELECT max(sent_at) INTO v_last_success FROM public.scan_email_outbox WHERE status = 'SENT';
  SELECT max(scheduled_at) INTO v_last_failure FROM public.scan_email_outbox WHERE status = 'FAILED' OR (status = 'PENDING' AND attempts > 0);

  SELECT COALESCE(round(avg(EXTRACT(EPOCH FROM (sent_at - created_at))), 2), 0)
  INTO v_avg_latency_sec
  FROM public.scan_email_outbox
  WHERE status = 'SENT' AND sent_at IS NOT NULL AND created_at >= (now() - interval '24 hours');

  RETURN jsonb_build_object(
    'pending_count', v_pending,
    'processing_count', v_processing,
    'retry_count', v_retrying,
    'failed_count', v_failed,
    'sent_count', v_sent,
    'cancelled_count', v_cancelled,
    'oldest_pending_age_seconds', v_oldest_age_sec,
    'average_send_latency_seconds', v_avg_latency_sec,
    'last_success_at', v_last_success,
    'last_failure_at', v_last_failure,
    'queue_stalled', (v_oldest_age_sec > 600 AND v_pending > 0)
  );
END;
$$;
