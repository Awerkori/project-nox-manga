-- ==============================================================================
-- PROJECT NOX — MIGRATION 20261104220000
-- PROCEDURE DE EXPIRAÇÃO DE PRAZOS E DEVOLUÇÃO AUTOMÁTICA (YSQL / YUGABYTE)
-- AUDITORIA 24.5 — ISOLAMENTO PREVIEW/PRODUÇÃO E IDENTIFICAÇÃO DE DADOS SINTÉTICOS
-- ==============================================================================
-- Descrição:
-- 1. Elimina a sobrecarga insegura de 1 argumento (p_scan_id uuid) que não
--    possuía o parâmetro de isolamento p_only_test_chapters.
-- 2. Define a função canônica public.process_expired_scan_stages_ysql com 
--    parâmetro explícito p_only_test_chapters (DEFAULT false).
-- 3. Substitui quaisquer heurísticas frágeis (número de capítulo, termos em título)
--    por checagem explícita e verificável no metadado estruturado:
--    (COALESCE(pc.checklist_state->>'is_synthetic_fixture', 'false'))::boolean IS TRUE.
-- 4. Blinda o envio de notificações em public.check_and_send_deadline_warnings_ysql,
--    garantindo que execuções de homologação ou Preview não gerem notificações reais.
-- 5. Aplica SECURITY DEFINER com search_path imutável (public, pg_temp) e
--    restringe permissões ao princípio de menor privilégio.
-- ==============================================================================

-- 1. Remover sobrecargas legadas inseguras de 1 argumento
DROP FUNCTION IF EXISTS public.process_expired_scan_stages_ysql(uuid);
DROP FUNCTION IF EXISTS public.check_and_send_deadline_warnings_ysql(uuid);

-- 2. Procedure de Devolução Automática com Isolamento Estrito
CREATE OR REPLACE FUNCTION public.process_expired_scan_stages_ysql(
  p_scan_id uuid DEFAULT NULL,
  p_only_test_chapters boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
  v_devolved_count integer := 0;
  v_availability_version integer;
  v_devolved_ids uuid[] := '{}';
BEGIN
  FOR r IN
    SELECT 
      cs.id as stage_id,
      cs.scan_id,
      cs.assigned_to,
      cs.due_at,
      cs.extension_count,
      cs.availability_version,
      cs.production_chapter_id,
      cs.chapter_id,
      cs.notes,
      ws.id as workflow_stage_id,
      ws.name as stage_name,
      ws.slug as stage_slug,
      pc.chapter_number,
      pc.chapter_title,
      pc.checklist_state,
      w.title as work_title
    FROM public.scan_chapter_stages cs
    JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
    JOIN public.scan_production_chapters pc ON pc.id = COALESCE(cs.production_chapter_id, cs.chapter_id)
    JOIN public.works w ON w.id = pc.work_id
    WHERE cs.status = 'IN_PROGRESS'
      AND cs.assigned_to IS NOT NULL
      AND cs.due_at IS NOT NULL
      AND cs.due_at < now()
      AND (p_scan_id IS NULL OR cs.scan_id = p_scan_id)
      AND (
        NOT p_only_test_chapters 
        OR (COALESCE(pc.checklist_state->>'is_synthetic_fixture', 'false'))::boolean IS TRUE
      )
    FOR UPDATE OF cs
  LOOP
    v_availability_version := COALESCE(r.availability_version, 1) + 1;

    -- Devolve stage to queue (AVAILABLE) and record audit marker in notes
    UPDATE public.scan_chapter_stages
    SET status = 'AVAILABLE',
        previous_assigned_to = r.assigned_to,
        assigned_to = NULL,
        claimed_at = NULL,
        due_at = NULL,
        availability_version = v_availability_version,
        availability_reason = 'expired_returned_to_queue',
        notified_available = false,
        notes = CASE 
          WHEN notes IS NULL OR notes = '' THEN '[Devolução Automática - Prazo Expirado]'
          ELSE notes || ' | [Devolução Automática - Prazo Expirado]'
        END,
        last_activity_at = now(),
        updated_at = now()
    WHERE id = r.stage_id;

    -- Insert timeline event
    INSERT INTO public.scan_chapter_timeline (
      scan_id, production_chapter_id, stage_id, stage_slug, event_type,
      user_id, user_name, details
    ) VALUES (
      r.scan_id,
      COALESCE(r.production_chapter_id, r.chapter_id),
      r.workflow_stage_id,
      r.stage_slug,
      'EXPIRED_DEVOLUTION',
      r.assigned_to,
      'Sistema (Expiração de Prazo)',
      jsonb_build_object(
        'reason', 'Prazo de entrega expirado sem conclusão da etapa',
        'previous_assignee', r.assigned_to,
        'due_at', r.due_at,
        'extension_count', r.extension_count,
        'availability_version', v_availability_version,
        'preview_isolated_mode', p_only_test_chapters
      )
    );

    -- Only send notification to real users if NOT in preview/test mode
    IF NOT p_only_test_chapters THEN
      INSERT INTO public.notifications (
        user_id, scan_id, title, body, href, type, kind, priority, dedupe_key, created_at
      ) VALUES (
        r.assigned_to, r.scan_id,
        'Etapa devolvida à fila',
        'O prazo para concluir a etapa ' || r.stage_name || ' de ' || r.work_title || ' #' || r.chapter_number || ' expirou e ela foi devolvida à fila para outro membro assumir.',
        '/scan?tab=pipeline&stage=' || r.stage_slug,
        'STAGE_DEVOLVED', 'stage_devolved', 'HIGH',
        'stage_devolved:' || r.stage_id || ':' || r.assigned_to || ':' || to_char(r.due_at, 'YYYY-MM-DD-HH24'),
        now()
      );
    END IF;

    v_devolved_ids := array_append(v_devolved_ids, r.stage_id);
    v_devolved_count := v_devolved_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'devolved_count', v_devolved_count,
    'devolved_stage_ids', v_devolved_ids,
    'only_test_chapters', p_only_test_chapters
  );
END;
$$;

-- 3. Procedure de Alerta Preventivo de Prazo com Isolamento Estrito
CREATE OR REPLACE FUNCTION public.check_and_send_deadline_warnings_ysql(
  p_scan_id uuid DEFAULT NULL,
  p_only_test_chapters boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
  v_count integer := 0;
  v_sp_due text;
BEGIN
  FOR r IN
    SELECT 
      cs.id as stage_id,
      cs.scan_id,
      cs.assigned_to,
      cs.due_at,
      ws.name as stage_name,
      pc.chapter_number,
      w.title as work_title
    FROM public.scan_chapter_stages cs
    JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
    JOIN public.scan_production_chapters pc ON pc.id = COALESCE(cs.production_chapter_id, cs.chapter_id)
    JOIN public.works w ON w.id = pc.work_id
    WHERE cs.status = 'IN_PROGRESS'
      AND cs.assigned_to IS NOT NULL
      AND cs.due_at IS NOT NULL
      AND cs.due_at > now()
      AND cs.due_at - now() <= interval '24 hours'
      AND (cs.due_warning_sent_at IS NULL OR (cs.extended_at IS NOT NULL AND cs.due_warning_sent_at < cs.extended_at))
      AND (p_scan_id IS NULL OR cs.scan_id = p_scan_id)
      AND (
        NOT p_only_test_chapters 
        OR (COALESCE(pc.checklist_state->>'is_synthetic_fixture', 'false'))::boolean IS TRUE
      )
    LIMIT 100
  LOOP
    v_sp_due := to_char(r.due_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY às 23:59');

    -- Only send notification to real users if NOT in preview/test mode
    IF NOT p_only_test_chapters THEN
      INSERT INTO public.notifications (
        user_id, scan_id, title, body, href, type, kind, priority, dedupe_key, created_at
      ) VALUES (
        r.assigned_to, r.scan_id,
        'Seu prazo está chegando ao fim!',
        'Você tem uma entrega próxima: ' || r.work_title || ', capítulo #' || r.chapter_number || ', etapa ' || r.stage_name || '. Prazo até ' || v_sp_due || '. Se precisar, você pode prorrogar por mais dois dias.',
        '/scan?tab=calendario',
        'DEADLINE_WARNING', 'deadline_warning', 'HIGH',
        'deadline_warning:' || r.stage_id || ':' || r.assigned_to || ':' || to_char(r.due_at, 'YYYY-MM-DD-HH24'),
        now()
      );
    END IF;

    UPDATE public.scan_chapter_stages
    SET due_warning_sent_at = now()
    WHERE id = r.stage_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 4. Menor Privilégio: Restringir execução de funções administrativas
REVOKE ALL ON FUNCTION public.process_expired_scan_stages_ysql(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_expired_scan_stages_ysql(uuid, boolean) TO postgres, yugabyte;

REVOKE ALL ON FUNCTION public.check_and_send_deadline_warnings_ysql(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_send_deadline_warnings_ysql(uuid, boolean) TO postgres, yugabyte;

-- ==============================================================================
-- VERIFICAÇÃO / VERIFICATION:
-- 1. Verificar sobrecargas ativas (deve retornar apenas a de 2 argumentos):
--    SELECT proname, pg_get_function_identity_arguments(oid) 
--    FROM pg_proc WHERE proname = 'process_expired_scan_stages_ysql';
-- 2. Testar isolamento sintético seguro (devolve zero quando não há fixtures):
--    SELECT public.process_expired_scan_stages_ysql(NULL, true);
-- ==============================================================================
-- ROLLBACK:
-- Em caso de necessidade de reversão para a versão anterior:
-- DROP FUNCTION IF EXISTS public.process_expired_scan_stages_ysql(uuid, boolean);
-- (recriar a versão 20261104000000 sem os parâmetros de isolamento sintético).
-- ==============================================================================
