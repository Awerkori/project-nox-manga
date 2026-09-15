-- Migration: Automatic Outbox Derivation Trigger & Chapter Publication Dispatch

-- 1. Helper function for HTML escaping in SQL
CREATE OR REPLACE FUNCTION public.fn_html_escape(p_str text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT replace(replace(replace(replace(replace(COALESCE(p_str, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#039;');
$$;

-- 2. Trigger function to derive email outbox on notification insert
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
  v_cta_label text := 'Abrir no Project Nox';
  v_url text;
  v_idempotency_key text;
  v_html text;
  v_badge_color text := '#6366f1';
  v_badge_text text := 'NOTIFICAÇÃO';
BEGIN
  -- A. Obter e-mail do usuário no auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RETURN NEW;
  END IF;

  -- B. Obter nome do usuário
  SELECT COALESCE(display_name, username, 'Membro') INTO v_username 
  FROM public.members 
  WHERE id = NEW.user_id;

  -- C. Chave de idempotência estrita
  v_idempotency_key := 'email:notif:' || NEW.id::text;

  -- D. Definir assunto, cor e texto conforme o tipo
  v_subject := '[Project Nox] ' || COALESCE(NEW.title, 'Nova notificação');

  IF NEW.type = 'LEVEL_UP' THEN
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
    || replace(public.fn_html_escape(NEW.body), E'\n', '<br>') || '</div>'
    || '<table cellspacing="0" cellpadding="0" style="margin:28px 0 8px 0;"><tr><td align="center" style="border-radius:8px;background-color:#4f46e5;">'
    || '<a href="' || v_url || '" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#4f46e5;border:1px solid #6366f1;">'
    || v_cta_label || ' &rarr;</a></td></tr></table>'
    || '</td></tr>'
    || '<tr><td style="padding:20px 32px;background-color:#0d0d10;border-top:1px solid #1f1f23;font-size:12px;color:#71717a;text-align:center;">'
    || '<p style="margin:0 0 4px 0;">Você recebeu este e-mail por ser membro do <strong>Project Nox</strong>.</p>'
    || '</td></tr></table></td></tr></table></body></html>';

  -- F. Inserir na outbox (idempotência absoluta por idempotency_key)
  INSERT INTO public.scan_email_outbox (
    notification_id,
    scan_id,
    recipient_user_id,
    recipient_email,
    subject,
    html_body,
    status,
    delivery_status,
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
    v_idempotency_key,
    0
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Criar o trigger em public.notifications
DROP TRIGGER IF EXISTS trg_notifications_derive_email ON public.notifications;
CREATE TRIGGER trg_notifications_derive_email
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notification_derive_email();

-- 3. Trigger para notificar seguidores na publicação de novos capítulos
CREATE OR REPLACE FUNCTION public.trg_chapter_publish_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_work_title text;
  v_follower record;
BEGIN
  -- Apenas disparar quando transicionar para publicado pela primeira vez
  IF NEW.published_at IS NOT NULL AND (OLD IS NULL OR OLD.published_at IS NULL) THEN
    SELECT title INTO v_work_title FROM public.works WHERE id = NEW.work_id;

    FOR v_follower IN (
      SELECT user_id 
      FROM public.library 
      WHERE work_id = NEW.work_id AND (following = true OR favorite = true)
    ) LOOP
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        href,
        context,
        entity_type,
        entity_id,
        priority,
        dedupe_key
      ) VALUES (
        v_follower.user_id,
        'NEW_CHAPTER',
        'Novo capítulo de ' || COALESCE(v_work_title, 'Obra') || ' disponível: #' || NEW.number,
        'O capítulo #' || NEW.number || ' de ' || COALESCE(v_work_title, 'Obra') || ' acabou de ser publicado. Venha ler agora!',
        '/ler/' || NEW.id,
        v_work_title,
        'CHAPTER',
        NEW.id::text,
        'INFO',
        'chapter_pub:' || NEW.id || ':' || v_follower.user_id
      )
      ON CONFLICT (user_id, dedupe_key) DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chapter_published_notify ON public.chapters;
CREATE TRIGGER trg_chapter_published_notify
  AFTER INSERT OR UPDATE OF published_at ON public.chapters
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_chapter_publish_notify();
