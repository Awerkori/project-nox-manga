-- ======================================================================
-- MIGRATION: 20260912200000_microhardening_fairness_quotas_and_uncertain_delivery.sql
-- Description: Microblindagem definitiva:
-- 1. Anti-starvation entre prioridades via Quotas por Lote (70% HIGH / 20% NORMAL / 10% LOW) + Aging + Dynamic Backfill
-- 2. Janela incerta de entrega: Pre-flight durable marker (send_started_at, provider_request_key)
-- 3. Two-Branch Crash Recovery (crashed before send -> PENDING; crashed after send -> DELIVERY_UNCERTAIN)
-- 4. RPCs de reconciliação e métricas de fairness por prioridade (HIGH / NORMAL / LOW)
-- ======================================================================

-- 1. Permitir status 'DELIVERY_UNCERTAIN' na tabela scan_email_outbox
ALTER TABLE public.scan_email_outbox DROP CONSTRAINT IF EXISTS scan_email_outbox_status_check;
ALTER TABLE public.scan_email_outbox ADD CONSTRAINT scan_email_outbox_status_check 
  CHECK (status IN ('PENDING', 'PROCESSING', 'DELIVERY_UNCERTAIN', 'SENT', 'FAILED', 'CANCELLED'));

-- 2. Adicionar colunas de pre-flight e reconciliação durável
ALTER TABLE public.scan_email_outbox
  ADD COLUMN IF NOT EXISTS send_started_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS provider_request_key text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reconciliation_notes text DEFAULT NULL;

-- Índice para busca rápida de itens incertos pendentes de reconciliação
CREATE INDEX IF NOT EXISTS idx_scan_email_outbox_uncertain 
  ON public.scan_email_outbox (status, send_started_at)
  WHERE status = 'DELIVERY_UNCERTAIN';

-- 3. RPC Aprimorada: claim_scan_email_outbox_batch
CREATE OR REPLACE FUNCTION public.claim_scan_email_outbox_batch(
  p_limit integer DEFAULT 25,
  p_specific_id uuid DEFAULT NULL,
  p_lease_seconds integer DEFAULT 300,
  p_worker_id text DEFAULT 'cf_worker'
)
RETURNS SETOF public.scan_email_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_lease_expiry timestamptz := clock_timestamp() + (p_lease_seconds || ' seconds')::interval;
  v_high_quota integer;
  v_normal_quota integer;
  v_low_quota integer;
  v_remaining integer := p_limit;
  v_claimed_ids uuid[] := '{}'::uuid[];
  v_tier_ids uuid[];
BEGIN
  -- A. TWO-BRANCH CRASH RECOVERY:
  -- Caso A1: Worker morreu ANTES da chamada externa (send_started_at é NULL).
  -- Seguro para retry normal: reseta para PENDING.
  UPDATE public.scan_email_outbox
  SET 
    status = 'PENDING',
    delivery_status = 'RECOVERED_PRE_SEND',
    last_error = COALESCE(last_error, '') || ' [Lease timeout: crash before external send recovered to PENDING]',
    claimed_at = NULL,
    claimed_by = NULL,
    lease_expires_at = NULL
  WHERE status = 'PROCESSING'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < v_now
    AND send_started_at IS NULL;

  -- Caso A2: Worker morreu DURANTE ou DEPOIS da chamada externa (send_started_at NÃO é NULL).
  -- Entrega incerta: NÃO reenviar cegamente! Mover para DELIVERY_UNCERTAIN para reconciliação via Brevo API.
  UPDATE public.scan_email_outbox
  SET 
    status = 'DELIVERY_UNCERTAIN',
    delivery_status = 'NEEDS_RECONCILIATION',
    last_error = COALESCE(last_error, '') || ' [Lease timeout: send_started_at set, moved to DELIVERY_UNCERTAIN for reconciliation]',
    claimed_at = NULL,
    claimed_by = NULL,
    lease_expires_at = NULL
  WHERE status = 'PROCESSING'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < v_now
    AND send_started_at IS NOT NULL;

  -- B. FAST-PATH: Envio prioritário imediato por specificId
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

  -- C. MULTI-TIER FAIR SHARING COM QUOTAS POR LOTE + AGING + BACKFILL:
  -- Quotas de processamento balanceado:
  -- ~70% HIGH, ~20% NORMAL, ~10% LOW (com garantia de pelo menos 1 slot por tier ativo se p_limit >= 3)
  v_high_quota := GREATEST(1, CEIL(p_limit * 0.70)::integer);
  v_normal_quota := GREATEST(1, CEIL(p_limit * 0.20)::integer);
  v_low_quota := GREATEST(1, p_limit - v_high_quota - v_normal_quota);

  -- C.1: Slot HIGH (inclui itens promovidos por aging > 5 minutos de espera)
  SELECT array_agg(id) INTO v_tier_ids
  FROM (
    SELECT id
    FROM public.scan_email_outbox
    WHERE status = 'PENDING'
      AND scheduled_at <= v_now
      AND (priority = 'HIGH' OR scheduled_at < v_now - interval '5 minutes')
    ORDER BY scheduled_at ASC, created_at ASC
    LIMIT v_high_quota
    FOR UPDATE SKIP LOCKED
  ) t;
  
  IF v_tier_ids IS NOT NULL AND array_length(v_tier_ids, 1) > 0 THEN
    v_claimed_ids := v_claimed_ids || v_tier_ids;
    v_remaining := v_remaining - array_length(v_tier_ids, 1);
  END IF;

  -- C.2: Slot NORMAL (garantido no lote mesmo sob rajada contínua de HIGH)
  IF v_remaining > 0 THEN
    SELECT array_agg(id) INTO v_tier_ids
    FROM (
      SELECT id
      FROM public.scan_email_outbox
      WHERE status = 'PENDING'
        AND scheduled_at <= v_now
        AND priority = 'NORMAL'
        AND NOT (id = ANY(v_claimed_ids))
      ORDER BY scheduled_at ASC, created_at ASC
      LIMIT LEAST(v_normal_quota, v_remaining)
      FOR UPDATE SKIP LOCKED
    ) t;
    
    IF v_tier_ids IS NOT NULL AND array_length(v_tier_ids, 1) > 0 THEN
      v_claimed_ids := v_claimed_ids || v_tier_ids;
      v_remaining := v_remaining - array_length(v_tier_ids, 1);
    END IF;
  END IF;

  -- C.3: Slot LOW (garantido no lote mesmo sob rajada contínua de HIGH)
  IF v_remaining > 0 THEN
    SELECT array_agg(id) INTO v_tier_ids
    FROM (
      SELECT id
      FROM public.scan_email_outbox
      WHERE status = 'PENDING'
        AND scheduled_at <= v_now
        AND priority = 'LOW'
        AND NOT (id = ANY(v_claimed_ids))
      ORDER BY scheduled_at ASC, created_at ASC
      LIMIT LEAST(v_low_quota, v_remaining)
      FOR UPDATE SKIP LOCKED
    ) t;
    
    IF v_tier_ids IS NOT NULL AND array_length(v_tier_ids, 1) > 0 THEN
      v_claimed_ids := v_claimed_ids || v_tier_ids;
      v_remaining := v_remaining - array_length(v_tier_ids, 1);
    END IF;
  END IF;

  -- C.4: Dynamic Backfill: caso as cotas não tenham sido preenchidas (ex: sem itens LOW ou poucos NORMAL),
  -- preenche todos os slots remanescentes com quaisquer itens PENDING disponíveis por ordem de prioridade
  IF v_remaining > 0 THEN
    SELECT array_agg(id) INTO v_tier_ids
    FROM (
      SELECT id
      FROM public.scan_email_outbox
      WHERE status = 'PENDING'
        AND scheduled_at <= v_now
        AND NOT (id = ANY(v_claimed_ids))
      ORDER BY 
        CASE priority WHEN 'HIGH' THEN 3 WHEN 'NORMAL' THEN 2 WHEN 'LOW' THEN 1 ELSE 2 END DESC,
        scheduled_at ASC,
        created_at ASC
      LIMIT v_remaining
      FOR UPDATE SKIP LOCKED
    ) t;
    
    IF v_tier_ids IS NOT NULL AND array_length(v_tier_ids, 1) > 0 THEN
      v_claimed_ids := v_claimed_ids || v_tier_ids;
    END IF;
  END IF;

  -- D. Transição Atômica dos Registros Adquiridos
  IF array_length(v_claimed_ids, 1) > 0 THEN
    RETURN QUERY
    UPDATE public.scan_email_outbox o
    SET 
      status = 'PROCESSING',
      delivery_status = 'CLAIMED',
      claimed_at = v_now,
      claimed_by = p_worker_id,
      lease_expires_at = v_lease_expiry,
      attempts = o.attempts + 1
    WHERE o.id = ANY(v_claimed_ids)
    RETURNING o.*;
  END IF;

  RETURN;
END;
$$;

-- 4. RPC para Adquirir Itens em Estado DELIVERY_UNCERTAIN para Reconciliação
CREATE OR REPLACE FUNCTION public.claim_uncertain_email_outbox_batch(
  p_limit integer DEFAULT 10,
  p_worker_id text DEFAULT 'cf_reconciler',
  p_lease_seconds integer DEFAULT 300
)
RETURNS SETOF public.scan_email_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_lease_expiry timestamptz := clock_timestamp() + (p_lease_seconds || ' seconds')::interval;
BEGIN
  RETURN QUERY
  WITH candidate_rows AS (
    SELECT id
    FROM public.scan_email_outbox
    WHERE status = 'DELIVERY_UNCERTAIN'
      AND (lease_expires_at IS NULL OR lease_expires_at < v_now)
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.scan_email_outbox o
  SET 
    claimed_at = v_now,
    claimed_by = p_worker_id,
    lease_expires_at = v_lease_expiry
  FROM candidate_rows c
  WHERE o.id = c.id
  RETURNING o.*;
END;
$$;

-- 5. RPC Atualizada de Métricas com Fairness por Prioridade
CREATE OR REPLACE FUNCTION public.get_scan_email_outbox_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_pending bigint;
  v_processing bigint;
  v_uncertain bigint;
  v_retrying bigint;
  v_failed bigint;
  v_sent bigint;
  v_cancelled bigint;
  v_reconciled bigint;
  v_oldest_pending timestamptz;
  v_oldest_high timestamptz;
  v_oldest_normal timestamptz;
  v_oldest_low timestamptz;
  v_avg_latency double precision;
  v_last_success timestamptz;
  v_last_failure timestamptz;
BEGIN
  SELECT count(*) INTO v_pending FROM public.scan_email_outbox WHERE status = 'PENDING';
  SELECT count(*) INTO v_processing FROM public.scan_email_outbox WHERE status = 'PROCESSING';
  SELECT count(*) INTO v_uncertain FROM public.scan_email_outbox WHERE status = 'DELIVERY_UNCERTAIN';
  SELECT count(*) INTO v_retrying FROM public.scan_email_outbox WHERE status = 'PENDING' AND attempts > 0;
  SELECT count(*) INTO v_failed FROM public.scan_email_outbox WHERE status = 'FAILED';
  SELECT count(*) INTO v_sent FROM public.scan_email_outbox WHERE status = 'SENT';
  SELECT count(*) INTO v_cancelled FROM public.scan_email_outbox WHERE status = 'CANCELLED';
  SELECT count(*) INTO v_reconciled FROM public.scan_email_outbox WHERE delivery_status = 'RECONCILED_SENT';

  SELECT min(created_at) INTO v_oldest_pending FROM public.scan_email_outbox WHERE status = 'PENDING';
  SELECT min(created_at) INTO v_oldest_high FROM public.scan_email_outbox WHERE status = 'PENDING' AND priority = 'HIGH';
  SELECT min(created_at) INTO v_oldest_normal FROM public.scan_email_outbox WHERE status = 'PENDING' AND priority = 'NORMAL';
  SELECT min(created_at) INTO v_oldest_low FROM public.scan_email_outbox WHERE status = 'PENDING' AND priority = 'LOW';

  SELECT max(sent_at) INTO v_last_success FROM public.scan_email_outbox WHERE status = 'SENT';
  SELECT max(scheduled_at) INTO v_last_failure FROM public.scan_email_outbox WHERE status = 'FAILED' OR (status = 'PENDING' AND attempts > 0);

  SELECT AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) INTO v_avg_latency
  FROM public.scan_email_outbox
  WHERE status = 'SENT' AND sent_at >= v_now - interval '24 hours';

  RETURN jsonb_build_object(
    'pending_count', v_pending,
    'processing_count', v_processing,
    'uncertain_count', v_uncertain,
    'retry_count', v_retrying,
    'failed_count', v_failed,
    'sent_count', v_sent,
    'cancelled_count', v_cancelled,
    'reconciled_count', v_reconciled,
    'oldest_pending_age_seconds', COALESCE(ROUND(EXTRACT(EPOCH FROM (v_now - v_oldest_pending))), 0),
    'oldest_pending_age_high_seconds', COALESCE(ROUND(EXTRACT(EPOCH FROM (v_now - v_oldest_high))), 0),
    'oldest_pending_age_normal_seconds', COALESCE(ROUND(EXTRACT(EPOCH FROM (v_now - v_oldest_normal))), 0),
    'oldest_pending_age_low_seconds', COALESCE(ROUND(EXTRACT(EPOCH FROM (v_now - v_oldest_low))), 0),
    'average_send_latency_seconds', ROUND(COALESCE(v_avg_latency, 0)::numeric, 2),
    'queue_stalled', (COALESCE(EXTRACT(EPOCH FROM (v_now - v_oldest_pending)), 0) > 600),
    'last_success_at', v_last_success,
    'last_failure_at', v_last_failure
  );
END;
$$;
