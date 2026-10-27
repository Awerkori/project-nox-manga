-- Migration: Synchronize database trigger email template with unified Project Nox design system

CREATE OR REPLACE FUNCTION public.trg_notification_derive_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_email text;
  v_username text;
  v_subject text;
  v_html text;
  v_idempotency_key text;
  v_badge_color text := '#b59af5';
  v_badge_bg text := 'rgba(181, 154, 245, 0.14)';
  v_badge_border text := 'rgba(181, 154, 245, 0.4)';
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
  IF NEW.kind = 'pipeline_stage_available' OR NEW.type IN ('TASK_ASSIGNED', 'STAGE_READY', 'QC_ISSUE', 'REWORK', 'MENTION', 'ROLE_MENTION', 'TICKET_SCAN_APPLICATION', 'TICKET_MODERATION') THEN
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
      v_badge_bg := 'rgba(239, 68, 68, 0.14)';
      v_badge_border := 'rgba(239, 68, 68, 0.4)';
      v_badge_text := 'RETRABALHO SOLICITADO';
    ELSIF NEW.title ILIKE '%fila%' THEN
      v_badge_color := '#f59e0b';
      v_badge_bg := 'rgba(245, 158, 11, 0.14)';
      v_badge_border := 'rgba(245, 158, 11, 0.4)';
      v_badge_text := 'FILA DE PRODUÇÃO';
    ELSIF NEW.title ILIKE '%aprovação%' OR NEW.title ILIKE '%pré aprovado%' THEN
      v_badge_color := '#10b981';
      v_badge_bg := 'rgba(16, 185, 129, 0.14)';
      v_badge_border := 'rgba(16, 185, 129, 0.4)';
      v_badge_text := 'PRÉ-APROVADO';
    ELSE
      v_badge_color := '#6366f1';
      v_badge_bg := 'rgba(99, 102, 241, 0.14)';
      v_badge_border := 'rgba(99, 102, 241, 0.4)';
      v_badge_text := 'ETAPA DO PIPELINE';
    END IF;
    v_subject := '[Scan] ' || COALESCE(NEW.title, 'Etapa disponível no Pipeline');
    v_cta_label := 'Reivindicar Etapa no Pipeline';
  ELSIF NEW.type = 'LEVEL_UP' THEN
    v_badge_color := '#eab308';
    v_badge_bg := 'rgba(234, 179, 8, 0.14)';
    v_badge_border := 'rgba(234, 179, 8, 0.4)';
    v_badge_text := 'LEVEL UP!';
    v_subject := 'Parabéns! ' || COALESCE(NEW.title, 'Você alcançou um novo nível no Project Nox!');
    v_cta_label := 'Ver Meu Perfil e Recompensas';
  ELSIF NEW.type = 'ACHIEVEMENT' THEN
    v_badge_color := '#f59e0b';
    v_badge_bg := 'rgba(245, 158, 11, 0.14)';
    v_badge_border := 'rgba(245, 158, 11, 0.4)';
    v_badge_text := 'CONQUISTA DESBLOQUEADA';
    v_subject := 'Nova conquista: ' || COALESCE(NEW.title, 'Conquista Nox');
    v_cta_label := 'Ver Minhas Conquistas';
  ELSIF NEW.type = 'NEW_CHAPTER' OR NEW.type = 'CHAPTER_PUBLISHED' THEN
    v_badge_color := '#10b981';
    v_badge_bg := 'rgba(16, 185, 129, 0.14)';
    v_badge_border := 'rgba(16, 185, 129, 0.4)';
    v_badge_text := 'NOVO CAPÍTULO';
    v_subject := 'Novo capítulo disponível: ' || COALESCE(NEW.title, 'Novo capítulo');
    v_cta_label := 'Ler Capítulo Agora';
  ELSIF NEW.type = 'MENTION' OR NEW.type = 'ROLE_MENTION' THEN
    v_badge_color := '#818cf8';
    v_badge_bg := 'rgba(129, 140, 248, 0.14)';
    v_badge_border := 'rgba(129, 140, 248, 0.4)';
    v_badge_text := CASE WHEN NEW.type = 'ROLE_MENTION' THEN 'MENÇÃO DE CARGO' ELSE 'MENÇÃO DIRETA' END;
    v_subject := 'Você recebeu uma menção no Project Nox';
    v_cta_label := 'Ver Mensagem na Plataforma';
  ELSIF NEW.type = 'REPLY_CHAT' OR NEW.type = 'REPLY_COMMENT' THEN
    v_badge_color := '#38bdf8';
    v_badge_bg := 'rgba(56, 189, 248, 0.14)';
    v_badge_border := 'rgba(56, 189, 248, 0.4)';
    v_badge_text := CASE WHEN NEW.type = 'REPLY_CHAT' THEN 'RESPOSTA NO CHAT' ELSE 'RESPOSTA EM COMENTÁRIO' END;
    v_subject := 'Nova resposta para você no Project Nox';
    v_cta_label := 'Ver Resposta';
  ELSIF NEW.type IN ('TASK_ASSIGNED', 'STAGE_READY', 'QC_ISSUE', 'REWORK') THEN
    v_badge_color := CASE WHEN NEW.type IN ('QC_ISSUE', 'REWORK') THEN '#ef4444' ELSE '#8b5cf6' END;
    v_badge_bg := CASE WHEN NEW.type IN ('QC_ISSUE', 'REWORK') THEN 'rgba(239, 68, 68, 0.14)' ELSE 'rgba(139, 92, 246, 0.14)' END;
    v_badge_border := CASE WHEN NEW.type IN ('QC_ISSUE', 'REWORK') THEN 'rgba(239, 68, 68, 0.4)' ELSE 'rgba(139, 92, 246, 0.4)' END;
    v_badge_text := CASE WHEN NEW.type = 'REWORK' THEN 'RETRABALHO SOLICITADO' WHEN NEW.type = 'QC_ISSUE' THEN 'QC PENDENTE' ELSE 'TAREFA DE PRODUÇÃO' END;
    v_subject := '[Scan] ' || COALESCE(NEW.title, 'Atualização de Produção');
    v_cta_label := 'Abrir Tarefa no Painel da Scan';
  ELSIF NEW.type IN ('APPLICATION', 'APPLICATION_UPDATE') THEN
    v_badge_color := '#ec4899';
    v_badge_bg := 'rgba(236, 72, 153, 0.14)';
    v_badge_border := 'rgba(236, 72, 153, 0.4)';
    v_badge_text := 'RECRUTAMENTO DE SCAN';
    v_subject := '[Scan] ' || COALESCE(NEW.title, 'Candidatura de Membro');
    v_cta_label := 'Ver Candidatura na Scan';
  ELSIF NEW.type = 'TICKET_SCAN_APPLICATION' THEN
    v_badge_color := '#dfc28d';
    v_badge_bg := 'rgba(223, 194, 141, 0.14)';
    v_badge_border := 'rgba(223, 194, 141, 0.45)';
    v_badge_text := 'INSCRIÇÃO DE SCAN';
    v_subject := '[Project Nox] Nova Parceria de Scan: ' || COALESCE(NEW.context, NEW.title);
    v_cta_label := 'Revisar Inscrição no Painel';
  ELSIF NEW.type = 'TICKET_REPORT' THEN
    v_badge_color := '#f59e0b';
    v_badge_bg := 'rgba(245, 158, 11, 0.14)';
    v_badge_border := 'rgba(245, 158, 11, 0.4)';
    v_badge_text := 'RELATÓRIO DE CONTEÚDO';
    v_subject := '[Project Nox] Relatório de Conteúdo: ' || COALESCE(NEW.context, NEW.title);
    v_cta_label := 'Verificar Relatório no Painel';
  ELSIF NEW.type = 'TICKET_MODERATION' THEN
    v_badge_color := '#ef4444';
    v_badge_bg := 'rgba(239, 68, 68, 0.14)';
    v_badge_border := 'rgba(239, 68, 68, 0.4)';
    v_badge_text := 'OCORRÊNCIA DE MODERAÇÃO';
    v_subject := '[Project Nox] Moderação de Conteúdo: ' || COALESCE(NEW.context, NEW.title);
    v_cta_label := 'Analisar Ocorrência no Painel';
  END IF;

  v_url := 'https://manga.project-nox-awerkori.workers.dev' || COALESCE(NEW.href, '/notificacoes');

  -- E. Gerar HTML do e-mail com layout unificado, PROJECT (dourado) e NOX (roxo) perfeitamente centralizados
  v_html := '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>'
    || '<body style="margin:0;padding:0;background-color:#07080d;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#f4f1f8;-webkit-font-smoothing:antialiased;">'
    || '<table width="100%" cellspacing="0" cellpadding="0" style="background-color:#07080d;min-height:100vh;padding:36px 12px;"><tr><td align="center" style="padding:0;">'
    || '<table width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background-color:#0f111a;border:1px solid #23273a;border-radius:16px;overflow:hidden;box-shadow:0 20px 48px rgba(0,0,0,0.7);">'
    -- Header centralizado
    || '<tr><td style="padding:32px 28px 24px 28px;background:linear-gradient(180deg,rgba(139,92,246,0.12) 0%,rgba(15,17,26,0.8) 100%);border-bottom:1px solid #1f2334;text-align:center;">'
    || '<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;text-align:center;"><tr><td align="center" style="text-align:center;">'
    || '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.26em;color:#dfc28d;text-transform:uppercase;line-height:1.1;margin:0 auto;padding-left:0.26em;text-align:center;">PROJECT</div>'
    || '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:24px;font-weight:900;letter-spacing:0.22em;color:#b59af5;text-transform:uppercase;line-height:1.1;margin:4px auto 0 auto;padding-left:0.22em;text-align:center;">NOX</div>'
    || '</td></tr></table>'
    -- Badge centralizada abaixo do logo
    || '<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:16px auto 0 auto;text-align:center;"><tr>'
    || '<td align="center" style="background-color:' || v_badge_bg || ';border:1px solid ' || v_badge_border || ';border-radius:9999px;padding:6px 18px;text-align:center;">'
    || '<span style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:11px;font-weight:800;color:' || v_badge_color || ';text-transform:uppercase;letter-spacing:0.08em;display:inline-block;line-height:1.2;">' || v_badge_text || '</span>'
    || '</td></tr></table>'
    || '</td></tr>'
    -- Body
    || '<tr><td style="padding:32px 36px 36px 36px;">'
    || '<p style="margin:0 0 16px 0;font-size:15px;color:#9e9aa8;line-height:1.5;">Olá, <strong style="color:#ffffff;">' || public.fn_html_escape(v_username) || '</strong>,</p>'
    || '<h1 style="margin:0 0 16px 0;font-size:21px;font-weight:800;color:#ffffff;line-height:1.35;letter-spacing:-0.01em;">' || public.fn_html_escape(COALESCE(NEW.title, 'Notificação')) || '</h1>'
    || CASE WHEN NEW.context IS NOT NULL AND length(trim(NEW.context)) > 0 THEN '<div style="margin:0 0 18px 0;display:inline-block;background:#151827;border:1px solid rgba(181,154,245,0.25);padding:5px 12px;border-radius:6px;font-size:12px;color:#c4b5fd;font-weight:700;">' || public.fn_html_escape(NEW.context) || '</div>' ELSE '' END
    || '<div style="background-color:#131624;border:1px solid #23273a;border-left:3px solid ' || v_badge_color || ';border-radius:8px;padding:18px 20px;margin:16px 0 24px 0;color:#d5d0e2;font-size:14.5px;line-height:1.65;">'
    || public.fn_html_escape(COALESCE(NEW.body, 'Você possui uma nova atualização.'))
    || '</div>'
    -- CTA Button
    || '<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:28px auto 8px auto;"><tr>'
    || '<td align="center" style="border-radius:10px;background-color:#7c3aed;">'
    || '<a href="' || v_url || '" target="_blank" style="display:inline-block;padding:14px 34px;font-size:14.5px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background:linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%);border:1px solid #9061f9;letter-spacing:0.02em;text-align:center;box-shadow:0 4px 14px rgba(124,58,237,0.35);">'
    || v_cta_label || ' &rarr;</a>'
    || '</td></tr></table>'
    -- Fallback link
    || '<div style="margin:28px 0 0 0;padding-top:20px;border-top:1px solid #1c2030;">'
    || '<p style="margin:0 0 8px 0;font-size:12px;color:#787484;line-height:1.5;text-align:center;">Se o botão acima não abrir, copie e cole o link no seu navegador:</p>'
    || '<div style="background:#090a10;border:1px solid #1c2030;border-radius:6px;padding:10px 14px;font-size:11px;color:#b59af5;font-family:monospace;word-break:break-all;text-align:center;line-height:1.45;">' || v_url || '</div>'
    || '</div>'
    || '</td></tr>'
    -- Footer
    || '<tr><td style="padding:22px 32px;background-color:#0b0c13;border-top:1px solid #1a1c2b;font-size:12px;color:#6f6b7c;text-align:center;line-height:1.6;">'
    || '<p style="margin:0 0 4px 0;">Histórias que nascem nas sombras e conquistam a noite.</p>'
    || '<p style="margin:0;font-size:11px;color:#4b4756;">Project Nox &bull; manga.project-nox-awerkori.workers.dev</p>'
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
$function$;
