export interface EmailTemplateParams {
  type: string;
  title: string;
  body: string;
  deepLink: string;
  context?: string | null;
  recipientName?: string;
  actorName?: string;
  baseUrl?: string;
  meta?: Record<string, string>;
  ctaLabel?: string;
  securityNotice?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Escapes HTML characters safely for email templates.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates an authoritative, responsive, dark-mode resilient transactional email
 * following the Project Nox visual identity standards.
 */
export function generateEmailHtml({
  type,
  title,
  body,
  deepLink,
  context,
  recipientName = 'Membro',
  actorName,
  baseUrl = 'https://manga.project-nox-awerkori.workers.dev',
  meta,
  ctaLabel: customCtaLabel,
  securityNotice
}: EmailTemplateParams): RenderedEmail {
  const fullUrl = deepLink.startsWith('http')
    ? deepLink
    : `${baseUrl.replace(/\/$/, '')}${deepLink.startsWith('/') ? '' : '/'}${deepLink}`;

  // Default color tokens (Project Nox Brand Identity)
  let badgeColor = '#b59af5'; // Official Purple
  let badgeBg = 'rgba(181, 154, 245, 0.12)';
  let badgeBorder = 'rgba(181, 154, 245, 0.35)';
  let badgeText = 'NOTIFICAÇÃO';
  let defaultSubject = `[Project Nox] ${title}`;
  let defaultCtaLabel = 'Acessar no Project Nox';
  let headerNotice: string | null = null;

  switch (type) {
    // -------------------------------------------------------------------------
    // 1. Central de Tickets & Moderação Administrativa
    // -------------------------------------------------------------------------
    case 'TICKET_REPORT':
      badgeColor = '#f59e0b'; // Amber / Orange
      badgeBg = 'rgba(245, 158, 11, 0.14)';
      badgeBorder = 'rgba(245, 158, 11, 0.4)';
      badgeText = 'RELATÓRIO DE CONTEÚDO';
      defaultSubject = `[Project Nox] Relatório de Conteúdo: ${context || title}`;
      defaultCtaLabel = 'Verificar Relatório no Painel';
      headerNotice = 'Ação administrativa necessária para a Staff do Site';
      break;

    case 'TICKET_SCAN_APPLICATION':
      badgeColor = '#dfc28d'; // Nox Gold
      badgeBg = 'rgba(223, 194, 141, 0.14)';
      badgeBorder = 'rgba(223, 194, 141, 0.45)';
      badgeText = 'INSCRIÇÃO DE SCAN';
      defaultSubject = `[Project Nox] Nova Parceria de Scan: ${context || title}`;
      defaultCtaLabel = 'Revisar Inscrição no Painel';
      headerNotice = 'Candidatura de parceria aguardando homologação global';
      break;

    case 'TICKET_MODERATION':
      badgeColor = '#ef4444'; // Red
      badgeBg = 'rgba(239, 68, 68, 0.14)';
      badgeBorder = 'rgba(239, 68, 68, 0.4)';
      badgeText = 'OCORRÊNCIA DE MODERAÇÃO';
      defaultSubject = `[Project Nox] Moderação de Conteúdo: ${context || title}`;
      defaultCtaLabel = 'Analisar Ocorrência no Painel';
      headerNotice = 'Denúncia de conduta submetida para avaliação administrativa';
      break;

    // -------------------------------------------------------------------------
    // 2. Scans e Pipeline de Produção de Capítulos
    // -------------------------------------------------------------------------
    case 'TASK_ASSIGNED':
      badgeColor = '#8b5cf6'; // Violet
      badgeBg = 'rgba(139, 92, 246, 0.14)';
      badgeBorder = 'rgba(139, 92, 246, 0.4)';
      badgeText = 'TAREFA DE PRODUÇÃO';
      defaultSubject = `[Scan] Nova Tarefa Atribuída: ${context ? context + ' — ' : ''}${title}`;
      defaultCtaLabel = 'Abrir Tarefa no Painel da Scan';
      headerNotice = 'Atribuição operacional na equipe de produção';
      break;

    case 'STAGE_READY':
      badgeColor = '#6366f1'; // Indigo
      badgeBg = 'rgba(99, 102, 241, 0.14)';
      badgeBorder = 'rgba(99, 102, 241, 0.4)';
      badgeText = 'ETAPA DISPONÍVEL';
      defaultSubject = `[Scan] Etapa Pronta para Produção: ${context ? context + ' — ' : ''}${title}`;
      defaultCtaLabel = 'Reivindicar Etapa no Pipeline';
      headerNotice = 'Etapa liberada para reivindicação no pipeline';
      break;

    case 'TASK_REMINDER_STALE':
      badgeColor = '#f59e0b'; // Amber
      badgeBg = 'rgba(245, 158, 11, 0.14)';
      badgeBorder = 'rgba(245, 158, 11, 0.4)';
      badgeText = 'LEMBRETE DE TAREFA';
      defaultSubject = `[Scan] Lembrete: Tarefa em Andamento — ${context ? context + ' — ' : ''}${title}`;
      defaultCtaLabel = 'Continuar Trabalho no Painel';
      headerNotice = 'Acompanhamento de produção da sua equipe de scan';
      break;

    case 'STAGE_UNCLAIMED_REMINDER':
      badgeColor = '#f59e0b'; // Amber
      badgeBg = 'rgba(245, 158, 11, 0.14)';
      badgeBorder = 'rgba(245, 158, 11, 0.4)';
      badgeText = 'ETAPA AGUARDANDO RESPONSÁVEL';
      defaultSubject = `[Scan] Etapa Aguardando Responsável: ${context ? context + ' — ' : ''}${title}`;
      defaultCtaLabel = 'Assumir Etapa no Pipeline';
      headerNotice = 'Capítulo disponível aguardando início de produção na scan';
      break;

    case 'SCAN_INVITE':
      badgeColor = '#dfc28d'; // Nox Gold
      badgeBg = 'rgba(223, 194, 141, 0.14)';
      badgeBorder = 'rgba(223, 194, 141, 0.45)';
      badgeText = 'CONVITE PARA EQUIPE';
      defaultSubject = `[Scan] Convite para a Equipe: ${context || title}`;
      defaultCtaLabel = 'Ver Convite no Painel da Scan';
      headerNotice = 'Convite oficial para integrar a equipe de uma Scan';
      break;

    case 'SCAN_ROLE_UPDATED':
      badgeColor = '#8b5cf6'; // Violet
      badgeBg = 'rgba(139, 92, 246, 0.14)';
      badgeBorder = 'rgba(139, 92, 246, 0.4)';
      badgeText = 'CARGOS ATUALIZADOS';
      defaultSubject = `[Scan] Cargos Atualizados: ${context || title}`;
      defaultCtaLabel = 'Acessar Painel da Scan';
      headerNotice = 'Atualização de funções e permissões editoriais na equipe';
      break;

    case 'QC_ISSUE':
      badgeColor = '#f43f5e'; // Rose / QC Alert
      badgeBg = 'rgba(244, 63, 94, 0.14)';
      badgeBorder = 'rgba(244, 63, 94, 0.4)';
      badgeText = 'CONTROLE DE QUALIDADE';
      defaultSubject = `[Scan] Revisão de QC Pendente: ${context ? context + ' — ' : ''}${title}`;
      defaultCtaLabel = 'Verificar Observações de QC';
      headerNotice = 'Revisão e apontamentos de qualidade do capítulo';
      break;

    case 'REWORK':
      badgeColor = '#ef4444'; // Red Rework
      badgeBg = 'rgba(239, 68, 68, 0.14)';
      badgeBorder = 'rgba(239, 68, 68, 0.4)';
      badgeText = 'RETRABALHO SOLICITADO';
      defaultSubject = `[Scan] Retrabalho Solicitado no Capítulo: ${context ? context + ' — ' : ''}${title}`;
      defaultCtaLabel = 'Ver Instruções de Retrabalho';
      headerNotice = 'Retrabalho obrigatório antes da aprovação final';
      break;

    case 'APPLICATION':
      badgeColor = '#ec4899'; // Pink
      badgeBg = 'rgba(236, 72, 153, 0.14)';
      badgeBorder = 'rgba(236, 72, 153, 0.4)';
      badgeText = 'RECRUTAMENTO DE SCAN';
      defaultSubject = `[Scan] Nova Candidatura de Membro: ${context ? context + ' — ' : ''}${title}`;
      defaultCtaLabel = 'Avaliar Candidatura na Scan';
      headerNotice = 'Nova inscrição de membro recebida para a equipe';
      break;

    case 'APPLICATION_UPDATE':
      badgeColor = '#10b981'; // Emerald
      badgeBg = 'rgba(16, 185, 129, 0.14)';
      badgeBorder = 'rgba(16, 185, 129, 0.4)';
      badgeText = 'RESPOSTA DE RECRUTAMENTO';
      defaultSubject = `[Scan] Atualização da sua Candidatura: ${context ? context + ' — ' : ''}${title}`;
      defaultCtaLabel = 'Ver Detalhes da Candidatura';
      headerNotice = 'Atualização oficial do seu processo seletivo';
      break;

    case 'MURAL_POST':
      badgeColor = '#a855f7'; // Purple Mural
      badgeBg = 'rgba(168, 85, 247, 0.14)';
      badgeBorder = 'rgba(168, 85, 247, 0.4)';
      badgeText = 'MURAL DA SCAN';
      defaultSubject = `[Scan] Comunicado no Mural: ${context ? context + ' — ' : ''}${title}`;
      defaultCtaLabel = 'Abrir Mural da Equipe';
      headerNotice = 'Comunicado interno para os membros da equipe';
      break;

    // -------------------------------------------------------------------------
    // 3. Comunidade, Interações e Leitores
    // -------------------------------------------------------------------------
    case 'MENTION':
      badgeColor = '#06b6d4'; // Cyan
      badgeBg = 'rgba(6, 182, 212, 0.14)';
      badgeBorder = 'rgba(6, 182, 212, 0.4)';
      badgeText = 'MENÇÃO DIRETA';
      defaultSubject = actorName
        ? `${actorName} mencionou você no Project Nox`
        : `Você recebeu uma menção no Project Nox`;
      defaultCtaLabel = 'Ver Mensagem na Plataforma';
      headerNotice = 'Você foi citado diretamente em uma conversa';
      break;

    case 'ROLE_MENTION':
      badgeColor = '#14b8a6'; // Teal
      badgeBg = 'rgba(20, 184, 166, 0.14)';
      badgeBorder = 'rgba(20, 184, 166, 0.4)';
      badgeText = 'MENÇÃO DE CARGO';
      defaultSubject = actorName
        ? `${actorName} mencionou seu cargo no Project Nox`
        : `Menção destinada ao seu cargo no Project Nox`;
      defaultCtaLabel = 'Ver Mensagem da Equipe';
      headerNotice = 'Chamado coletivo para a sua função na scan';
      break;

    case 'REPLY_CHAT':
      badgeColor = '#38bdf8'; // Sky Blue
      badgeBg = 'rgba(56, 189, 248, 0.14)';
      badgeBorder = 'rgba(56, 189, 248, 0.4)';
      badgeText = 'RESPOSTA NO CHAT';
      defaultSubject = actorName
        ? `${actorName} respondeu sua mensagem no Project Nox`
        : `Nova resposta para você no chat do Project Nox`;
      defaultCtaLabel = 'Abrir Mensagem no Chat';
      headerNotice = 'Nova resposta enviada para você no chat da produção';
      break;

    case 'REPLY_COMMENT':
      badgeColor = '#b59af5'; // Nox Purple
      badgeBg = 'rgba(181, 154, 245, 0.14)';
      badgeBorder = 'rgba(181, 154, 245, 0.4)';
      badgeText = 'RESPOSTA EM COMENTÁRIO';
      defaultSubject = actorName
        ? `${actorName} respondeu seu comentário no Project Nox`
        : `Nova resposta no seu comentário no Project Nox`;
      defaultCtaLabel = 'Ver Resposta na Obra';
      headerNotice = 'Novo comentário publicado na sua conversa';
      break;

    case 'NEW_CHAPTER':
    case 'CHAPTER_PUBLISHED':
      badgeColor = '#10b981'; // Emerald
      badgeBg = 'rgba(16, 185, 129, 0.14)';
      badgeBorder = 'rgba(16, 185, 129, 0.4)';
      badgeText = 'NOVO CAPÍTULO';
      defaultSubject = `Novo Capítulo: ${context ? context + ' — ' : ''}${title}`;
      defaultCtaLabel = 'Ler Capítulo Agora';
      headerNotice = 'Novo lançamento disponível no catálogo oficial';
      break;

    // -------------------------------------------------------------------------
    // 4. Progressão e Conquistas
    // -------------------------------------------------------------------------
    case 'LEVEL_UP':
      badgeColor = '#eab308'; // Level Up Yellow
      badgeBg = 'rgba(234, 179, 8, 0.14)';
      badgeBorder = 'rgba(234, 179, 8, 0.4)';
      badgeText = 'LEVEL UP!';
      defaultSubject = `Parabéns! Você alcançou o Nível ${context || title} no Project Nox!`;
      defaultCtaLabel = 'Ver Meu Perfil e Recompensas';
      headerNotice = 'Evolução de patente reconhecida na comunidade';
      break;

    case 'ACHIEVEMENT':
      badgeColor = '#dfc28d'; // Gold
      badgeBg = 'rgba(223, 194, 141, 0.14)';
      badgeBorder = 'rgba(223, 194, 141, 0.45)';
      badgeText = 'CONQUISTA DESBLOQUEADA';
      defaultSubject = `Nova Conquista: ${title} no Project Nox!`;
      defaultCtaLabel = 'Ver Minhas Conquistas';
      headerNotice = 'Nova insígnia conquistada na sua jornada';
      break;

    case 'SYSTEM':
      badgeColor = '#b59af5';
      badgeBg = 'rgba(181, 154, 245, 0.14)';
      badgeBorder = 'rgba(181, 154, 245, 0.4)';
      badgeText = 'COMUNICADO OFICIAL';
      defaultSubject = `[Project Nox] ${title}`;
      defaultCtaLabel = 'Acessar no Project Nox';
      headerNotice = 'Informativo institucional da administração';
      break;

    // -------------------------------------------------------------------------
    // 5. Autenticação (quando disparado pelo gerador unificado)
    // -------------------------------------------------------------------------
    case 'AUTH_CONFIRMATION':
      badgeColor = '#b59af5';
      badgeBg = 'rgba(181, 154, 245, 0.14)';
      badgeBorder = 'rgba(181, 154, 245, 0.4)';
      badgeText = 'CONFIRMAÇÃO DE CADASTRO';
      defaultSubject = 'Boas-vindas ao Project Nox — Confirme seu e-mail';
      defaultCtaLabel = 'Confirmar Meu E-mail';
      headerNotice = 'Acesso pessoal à plataforma Project Nox';
      break;

    case 'AUTH_RECOVERY':
      badgeColor = '#b59af5';
      badgeBg = 'rgba(181, 154, 245, 0.14)';
      badgeBorder = 'rgba(181, 154, 245, 0.4)';
      badgeText = 'RECUPERAÇÃO DE CONTA';
      defaultSubject = 'Recupere o acesso à sua conta — Project Nox';
      defaultCtaLabel = 'Redefinir Minha Senha';
      headerNotice = 'Segurança e controle de acesso à sua conta';
      break;

    case 'AUTH_EMAIL_CHANGE':
      badgeColor = '#b59af5';
      badgeBg = 'rgba(181, 154, 245, 0.14)';
      badgeBorder = 'rgba(181, 154, 245, 0.4)';
      badgeText = 'ALTERAÇÃO DE E-MAIL';
      defaultSubject = 'Confirme seu novo endereço de e-mail — Project Nox';
      defaultCtaLabel = 'Confirmar Novo E-mail';
      headerNotice = 'Atualização de credenciais de acesso';
      break;

    case 'AUTH_INVITE':
      badgeColor = '#dfc28d';
      badgeBg = 'rgba(223, 194, 141, 0.14)';
      badgeBorder = 'rgba(223, 194, 141, 0.45)';
      badgeText = 'CONVITE DE MEMBRO';
      defaultSubject = 'Você recebeu um convite especial para o Project Nox';
      defaultCtaLabel = 'Aceitar Convite e Acessar';
      headerNotice = 'Acesso exclusivo à comunidade Project Nox';
      break;

    // -------------------------------------------------------------------------
    // 6. Alertas Críticos de Segurança da Conta
    // -------------------------------------------------------------------------
    case 'SECURITY_PASSWORD_CHANGED':
      badgeColor = '#ef4444'; // Red Security Alert
      badgeBg = 'rgba(239, 68, 68, 0.14)';
      badgeBorder = 'rgba(239, 68, 68, 0.4)';
      badgeText = 'ALERTA DE SEGURANÇA';
      defaultSubject = '[Project Nox] Alerta de Segurança: Senha Alterada com Sucesso';
      defaultCtaLabel = 'Verificar Segurança da Minha Conta';
      headerNotice = 'Alteração de credenciais críticas na sua conta';
      break;

    case 'SECURITY_EMAIL_CHANGED':
      badgeColor = '#ef4444'; // Red Security Alert
      badgeBg = 'rgba(239, 68, 68, 0.14)';
      badgeBorder = 'rgba(239, 68, 68, 0.4)';
      badgeText = 'ALERTA DE SEGURANÇA';
      defaultSubject = '[Project Nox] Alerta de Segurança: Endereço de E-mail Alterado';
      defaultCtaLabel = 'Verificar Segurança da Minha Conta';
      headerNotice = 'Alteração do endereço de e-mail principal da sua conta';
      break;

    default:
      badgeColor = '#b59af5';
      badgeBg = 'rgba(181, 154, 245, 0.12)';
      badgeBorder = 'rgba(181, 154, 245, 0.35)';
      badgeText = 'NOTIFICAÇÃO';
      defaultSubject = `[Project Nox] ${title}`;
      defaultCtaLabel = 'Acessar no Project Nox';
      break;
  }

  const subject = defaultSubject;
  const rawCta = (customCtaLabel || defaultCtaLabel).trim();
  // Strip any trailing &rarr;, &amp;rarr;, →, -> or trailing whitespace to avoid double arrows or literal entities
  const cleanCta = rawCta.replace(/(&rarr;|&amp;rarr;|→|->|\s)+$/g, '').trim();
  const ctaButtonHtml = `${escapeHtml(cleanCta)} →`;

  // Render metadata rows if provided
  let metaHtml = '';
  if (meta && Object.keys(meta).length > 0) {
    const rows = Object.entries(meta).map(([key, value]) => `
      <tr>
        <td style="padding: 9px 12px; font-size: 11px; font-weight: 700; color: #8e8a9c; text-transform: uppercase; letter-spacing: 0.06em; width: 35%; border-bottom: 1px solid #1f2334; vertical-align: top;">
          ${escapeHtml(key)}
        </td>
        <td style="padding: 9px 12px; font-size: 13.5px; font-weight: 600; color: #f4f1f8; border-bottom: 1px solid #1f2334; vertical-align: top;">
          ${escapeHtml(value)}
        </td>
      </tr>
    `).join('');

    metaHtml = `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0; background: #0c0d15; border: 1px solid #202436; border-radius: 8px; overflow: hidden;">
        ${rows}
      </table>
    `;
  }

  const currentYear = new Date().getFullYear();

  // Bulletproof HTML email markup
  const html = `<!DOCTYPE html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark light">
  <meta name="supported-color-schemes" content="dark light">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    :root { color-scheme: dark light; supported-color-schemes: dark light; }
    html, body { margin: 0 auto !important; padding: 0 !important; height: 100% !important; width: 100% !important; }
    * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
    div[style*="margin: 16px 0"] { margin: 0 !important; }
    table, td { mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important; }
    table { border-spacing: 0 !important; border-collapse: collapse !important; table-layout: fixed !important; margin: 0 auto !important; }
    img { -ms-interpolation-mode: bicubic; }
    a { text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
      .header-cell { padding: 28px 16px 20px 16px !important; }
      .content-cell { padding: 24px 18px 28px 18px !important; }
      .footer-cell { padding: 20px 18px !important; }
      .cta-button { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #07080d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f1f8; -webkit-font-smoothing: antialiased;">
  <!-- Full Screen Wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #07080d; min-height: 100vh; padding: 36px 12px;">
    <tr>
      <td align="center" style="padding: 0;">
        <!-- Email Container Card -->
        <table role="presentation" width="100%" class="email-container" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #0f111a; border: 1px solid #23273a; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 48px rgba(0, 0, 0, 0.7);">
          
          <!-- ============================================================= -->
          <!-- HEADER: Centered PROJECT (Dourado) + NOX (Roxo) & Centered Tag -->
          <!-- ============================================================= -->
          <tr>
            <td class="header-cell" style="padding: 32px 28px 24px 28px; background: linear-gradient(180deg, rgba(139, 92, 246, 0.12) 0%, rgba(15, 17, 26, 0.8) 100%); border-bottom: 1px solid #1f2334; text-align: center;">
              
              <!-- Brand Identity: PROJECT (Gold) + NOX (Purple) Perfectly Centered -->
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto; text-align: center;">
                <tr>
                  <td align="center" style="text-align: center;">
                    <!-- PROJECT (Dourado Oficial Project Nox) -->
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 800; letter-spacing: 0.26em; color: #dfc28d; text-transform: uppercase; line-height: 1.1; margin: 0 auto; padding-left: 0.26em; text-align: center;">
                      PROJECT
                    </div>
                    <!-- NOX (Roxo Oficial Project Nox, perfeitamente alinhado ao centro de PROJECT) -->
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 900; letter-spacing: 0.22em; color: #b59af5; text-transform: uppercase; line-height: 1.1; margin: 4px auto 0 auto; padding-left: 0.22em; text-align: center;">
                      NOX
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Category Badge / Pill: Centered directly below the brand lockup -->
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin: 16px auto 0 auto; text-align: center;">
                <tr>
                  <td align="center" style="background-color: ${badgeBg}; border: 1px solid ${badgeBorder}; border-radius: 9999px; padding: 6px 18px; text-align: center;">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 800; color: ${badgeColor}; text-transform: uppercase; letter-spacing: 0.08em; display: inline-block; line-height: 1.2;">
                      ${badgeText}
                    </span>
                  </td>
                </tr>
              </table>

              ${headerNotice ? `
              <div style="margin: 12px auto 0 auto; font-size: 11.5px; color: #8e8a9c; text-align: center; max-width: 440px; line-height: 1.4;">
                ${escapeHtml(headerNotice)}
              </div>
              ` : ''}

            </td>
          </tr>

          <!-- ============================================================= -->
          <!-- BODY: Main Content Block                                       -->
          <!-- ============================================================= -->
          <tr>
            <td class="content-cell" style="padding: 32px 36px 36px 36px;">
              
              <!-- Personalized Greeting -->
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #9e9aa8; line-height: 1.5;">
                Olá, <strong style="color: #ffffff; font-weight: 700;">${escapeHtml(recipientName)}</strong>,
              </p>

              <!-- Main Title -->
              <h1 style="margin: 0 0 16px 0; font-size: 21px; font-weight: 800; color: #ffffff; line-height: 1.35; letter-spacing: -0.01em;">
                ${escapeHtml(title)}
              </h1>

              <!-- Context Capsule (When Applicable) -->
              ${context ? `
              <div style="margin: 0 0 18px 0; display: inline-block; background: #151827; border: 1px solid rgba(181, 154, 245, 0.25); padding: 5px 12px; border-radius: 6px; font-size: 12px; color: #c4b5fd; font-weight: 700; letter-spacing: 0.02em;">
                ${escapeHtml(context)}
              </div>
              ` : ''}

              <!-- Key Metadata Rows (If provided) -->
              ${metaHtml}

              <!-- Highlighted Body Box -->
              <div style="background-color: #131624; border: 1px solid #23273a; border-left: 3px solid ${badgeColor}; border-radius: 8px; padding: 18px 20px; margin: 16px 0 24px 0; color: #d5d0e2; font-size: 14.5px; line-height: 1.65;">
                ${escapeHtml(body).replace(/\n/g, '<br>')}
              </div>

              <!-- Primary Call To Action (Bulletproof CTA Button) -->
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin: 28px auto 8px auto;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: #7c3aed;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${fullUrl}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="20%" stroke="f" fillcolor="#7c3aed">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">${ctaButtonHtml}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${fullUrl}" target="_blank" class="cta-button" style="display: inline-block; padding: 14px 34px; font-size: 14.5px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 10px; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); border: 1px solid #9061f9; letter-spacing: 0.02em; text-align: center; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);">
                      ${ctaButtonHtml}
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Fallback Direct URL Box -->
              <div style="margin: 28px 0 0 0; padding-top: 20px; border-top: 1px solid #1c2030;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #787484; line-height: 1.5; text-align: center;">
                  Se o botão acima não abrir, copie e cole o link no seu navegador:
                </p>
                <div style="background: #090a10; border: 1px solid #1c2030; border-radius: 6px; padding: 10px 14px; font-size: 11px; color: #b59af5; font-family: ui-monospace, Menlo, Monaco, 'Courier New', monospace; word-break: break-all; text-align: center; line-height: 1.45;">
                  ${fullUrl}
                </div>
              </div>

              ${securityNotice ? `
              <div style="margin: 20px 0 0 0; background: #0c0d15; border-radius: 6px; padding: 12px 14px; font-size: 11.5px; color: #7a7686; line-height: 1.5; text-align: center;">
                ${escapeHtml(securityNotice)}
              </div>
              ` : ''}

            </td>
          </tr>

          <!-- ============================================================= -->
          <!-- FOOTER: Institutional Links & Copyright                       -->
          <!-- ============================================================= -->
          <tr>
            <td class="footer-cell" style="padding: 24px 32px; background-color: #0b0c13; border-top: 1px solid #1a1c2b; font-size: 12px; color: #6f6b7c; text-align: center; line-height: 1.6;">
              <p style="margin: 0 0 6px 0;">
                Você recebeu esta notificação por estar cadastrado no <strong>Project Nox</strong>.
              </p>
              <p style="margin: 0 0 10px 0; color: #5a5666;">
                Histórias que nascem nas sombras e conquistam a noite.
              </p>
              <p style="margin: 0; font-size: 11px; color: #4b4756;">
                &copy; ${currentYear} Project Nox &bull; <a href="${baseUrl}" style="color: #b59af5; text-decoration: none;">manga.project-nox-awerkori.workers.dev</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${badgeText} — PROJECT NOX\n\nOlá, ${recipientName},\n\n${title}\n\n${context ? `[${context}]\n\n` : ''}${body}\n\nAcessar: ${fullUrl}\n\nProject Nox — manga.project-nox-awerkori.workers.dev`;

  return { subject, html, text };
}
