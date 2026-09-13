export interface EmailTemplateParams {
  type: string;
  title: string;
  body: string;
  deepLink: string;
  context?: string;
  recipientName?: string;
  actorName?: string;
  baseUrl?: string;
}

export function generateEmailHtml({
  type,
  title,
  body,
  deepLink,
  context,
  recipientName = 'Membro',
  actorName,
  baseUrl = 'https://manga.project-nox-awerkori.workers.dev'
}: EmailTemplateParams): { subject: string; html: string } {
  const fullUrl = deepLink.startsWith('http') ? deepLink : `${baseUrl.replace(/\/$/, '')}${deepLink.startsWith('/') ? '' : '/'}${deepLink}`;

  let badgeColor = '#6366f1'; // Indigo default
  let badgeText = 'NOTIFICAÇÃO';
  let subject = `[Project Nox] ${title}`;

  switch (type) {
    case 'MENTION':
    case 'ROLE_MENTION':
      badgeColor = '#818cf8';
      badgeText = type === 'ROLE_MENTION' ? 'MENÇÃO DE CARGO' : 'MENÇÃO DIRETA';
      subject = actorName ? `${actorName} mencionou você no Project Nox` : `Você foi mencionado no Project Nox`;
      break;

    case 'REPLY_CHAT':
    case 'REPLY_COMMENT':
      badgeColor = '#38bdf8';
      badgeText = 'RESPOSTA';
      subject = actorName ? `${actorName} respondeu sua mensagem no Project Nox` : `Nova resposta para você no Project Nox`;
      break;

    case 'LEVEL_UP':
      badgeColor = '#eab308';
      badgeText = 'LEVEL UP!';
      subject = `Parabéns! ${title} no Project Nox`;
      break;

    case 'ACHIEVEMENT':
      badgeColor = '#f59e0b';
      badgeText = 'CONQUISTA';
      subject = `Nova conquista desbloqueada: ${title}`;
      break;

    case 'NEW_CHAPTER':
    case 'CHAPTER_PUBLISHED':
      badgeColor = '#10b981';
      badgeText = 'NOVO CAPÍTULO';
      subject = `Novo capítulo disponível: ${context ? context + ' - ' : ''}${title}`;
      break;

    case 'TASK_ASSIGNED':
    case 'STAGE_READY':
    case 'QC_ISSUE':
    case 'REWORK':
      badgeColor = type === 'QC_ISSUE' || type === 'REWORK' ? '#ef4444' : '#6366f1';
      badgeText = type === 'REWORK' ? 'RETRABALHO' : type === 'QC_ISSUE' ? 'QC PENDENTE' : 'PRODUÇÃO';
      subject = `[Scan] ${title}`;
      break;

    case 'APPLICATION':
    case 'APPLICATION_UPDATE':
      badgeColor = '#ec4899';
      badgeText = 'RECRUTAMENTO';
      subject = `[Recrutamento] ${title}`;
      break;

    case 'MURAL_POST':
      badgeColor = '#8b5cf6';
      badgeText = 'MURAL';
      subject = `[Mural] ${title}`;
      break;
  }

  const ctaLabel = type === 'MENTION' || type === 'ROLE_MENTION' || type === 'REPLY_CHAT'
    ? 'Ver mensagem'
    : type.includes('CHAPTER')
    ? 'Ler agora'
    : type === 'LEVEL_UP'
    ? 'Ver meu perfil'
    : type === 'ACHIEVEMENT'
    ? 'Ver minhas conquistas'
    : type.includes('APPLICATION')
    ? 'Ver candidatura'
    : type.includes('TASK') || type.includes('STAGE') || type.includes('QC') || type.includes('REWORK')
    ? 'Abrir capítulo no Pipeline'
    : 'Ver na plataforma';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #09090b; min-height: 100vh; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #141417; border: 1px solid #27272a; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 32px; background: linear-gradient(180deg, rgba(99, 102, 241, 0.12) 0%, transparent 100%); border-bottom: 1px solid #1f1f23;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 18px; font-weight: 800; letter-spacing: 0.05em; color: #f4f4f5; text-transform: uppercase;">PROJECT <span style="color: #6366f1;">NOX</span></span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: ${badgeColor}; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 10px; border-radius: 9999px; letter-spacing: 0.05em;">
                      ${badgeText}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #a1a1aa;">Olá, <strong style="color: #f4f4f5;">${escapeHtml(recipientName)}</strong></p>
              
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff; line-height: 1.3;">
                ${escapeHtml(title)}
              </h1>

              ${context ? `
              <div style="margin: 0 0 16px 0; display: inline-block; background: #18181b; border: 1px solid #27272a; padding: 4px 10px; border-radius: 6px; font-size: 12px; color: #818cf8; font-weight: 600;">
                ${escapeHtml(context)}
              </div>
              ` : ''}

              <div style="background-color: #18181b; border-left: 3px solid ${badgeColor}; border-radius: 4px; padding: 16px; margin: 16px 0 24px 0; color: #d4d4d8; font-size: 14px; line-height: 1.6;">
                ${escapeHtml(body).replace(/\n/g, '<br>')}
              </div>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 28px 0 8px 0;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #4f46e5;">
                    <a href="${fullUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; background-color: #4f46e5; border: 1px solid #6366f1;">
                      ${ctaLabel} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #0d0d10; border-top: 1px solid #1f1f23; font-size: 12px; color: #71717a; text-align: center; line-height: 1.5;">
              <p style="margin: 0 0 4px 0;">Você recebeu este e-mail por ser membro cadastrado no <strong>Project Nox</strong>.</p>
              <p style="margin: 0;"><a href="${baseUrl}" style="color: #6366f1; text-decoration: none;">project-nox.com</a> &bull; Notificações instantâneas</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
