import fs from 'node:fs';
import path from 'node:path';
import { generateEmailHtml } from '../src/lib/server/email-templates.ts';

// 1. Read Brevo credentials from .dev.vars.preview_full
const devVarsPath = path.join(process.cwd(), '.dev.vars.preview_full');
const devVarsContent = fs.readFileSync(devVarsPath, 'utf-8');

function getVar(key: string): string {
  const match = devVarsContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!match) throw new Error(`Missing ${key} in .dev.vars.preview_full`);
  let val = match[1].trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  return val;
}

const BREVO_API_KEY = getVar('BREVO_API_KEY');
const BREVO_FROM_EMAIL = getVar('BREVO_FROM_EMAIL');
const BREVO_FROM_NAME = getVar('BREVO_FROM_NAME') || 'Project Nox';
const TARGET_EMAIL = 'awerkori@gmail.com';
const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

function injectDemoNotice(rawHtml: string, typeName: string): string {
  const demoNotice = `
    <!-- Demonstrative Test Banner -->
    <tr>
      <td style="padding: 10px 18px; background-color: #1a162b; border-bottom: 1px solid #2e264a; text-align: center; font-size: 11px; color: #dfc28d; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
        <strong>[DEMONSTRAÇÃO FUNCIONAL INTELIGENTE]</strong> Modelo <em>${typeName}</em> da Rodada de Auditoria da Pipeline. Botões e links utilizam rotas seguras de demonstração.
      </td>
    </tr>
  `;
  return rawHtml.replace(/(<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;[^>]*>)/i, `$1\n${demoNotice}`);
}

// Targeted catalog of new and modified intelligent pipeline/security models
const DEMO_EMAILS = [
  // 1. STAGE_READY: Chapter available for specific role in scan (e.g. Typer)
  {
    index: '01/08',
    type: 'STAGE_READY',
    subject: '[DEMO NOX 01/08] Etapa Disponível: Distant Sky — Cap. 80 (Typeset)',
    render: () => {
      const res = generateEmailHtml({
        type: 'STAGE_READY',
        title: 'Typeset — Distant Sky Cap. 80',
        body: 'A tradução e a limpeza do capítulo 80 de Distant Sky foram concluídas com sucesso.\n\nA etapa de Typeset está agora disponível no pipeline para os membros com o cargo de Typer da Night Scans.',
        deepLink: '/scan?id=04872e99-37ad-4d45-aed4-35759d0eae33&tab=pipeline',
        context: 'Distant Sky — Cap. 80',
        recipientName: 'Preston',
        meta: {
          'Obra': 'Distant Sky',
          'Capítulo': '80',
          'Etapa': 'Typeset',
          'Scan': 'Night Scans',
          'Cargo Requerido': 'Typer'
        }
      });
      return { subject: res.subject, html: injectDemoNotice(res.html, 'STAGE_READY'), text: res.text };
    }
  },

  // 2. TASK_ASSIGNED: Task assumed by team member
  {
    index: '02/08',
    type: 'TASK_ASSIGNED',
    subject: '[DEMO NOX 02/08] Nova Tarefa Atribuída: Distant Sky — Cap. 80 (Typeset)',
    render: () => {
      const res = generateEmailHtml({
        type: 'TASK_ASSIGNED',
        title: 'Typeset — Distant Sky Cap. 80',
        body: 'Você assumiu a etapa de Typeset do capítulo 80 de Distant Sky na Night Scans.\n\nOs arquivos de tradução e páginas limpas já estão disponíveis no seu espaço de trabalho.',
        deepLink: '/scan?id=04872e99-37ad-4d45-aed4-35759d0eae33&tab=tasks&stageId=demo-typeset',
        context: 'Distant Sky — Cap. 80',
        recipientName: 'Preston',
        meta: {
          'Obra': 'Distant Sky',
          'Capítulo': '80',
          'Etapa': 'Typeset',
          'Scan': 'Night Scans',
          'Responsável': 'Preston'
        }
      });
      return { subject: res.subject, html: injectDemoNotice(res.html, 'TASK_ASSIGNED'), text: res.text };
    }
  },

  // 3. TASK_REMINDER_STALE: Friendly reminder after 3 days of inactivity
  {
    index: '03/08',
    type: 'TASK_REMINDER_STALE',
    subject: '[DEMO NOX 03/08] Lembrete de Produção: Distant Sky — Cap. 80 (Typeset)',
    render: () => {
      const res = generateEmailHtml({
        type: 'TASK_REMINDER_STALE',
        title: 'Typeset em Andamento — Distant Sky Cap. 80',
        body: 'Olá, Preston! Você ainda possui um capítulo em andamento na Night Scans.\n\nA etapa de Typeset do capítulo 80 de Distant Sky está sob sua responsabilidade há mais de 3 dias sem nova atividade registrada.\n\nSe precisar de ajuda ou de mais tempo, converse com sua equipe no painel da scan.',
        deepLink: '/scan?id=04872e99-37ad-4d45-aed4-35759d0eae33&tab=tasks&stageId=demo-typeset',
        context: 'Distant Sky — Cap. 80',
        recipientName: 'Preston',
        ctaLabel: 'Continuar Trabalho no Painel',
        meta: {
          'Obra': 'Distant Sky',
          'Capítulo': '80',
          'Etapa': 'Typeset',
          'Scan': 'Night Scans',
          'Atribuído em': '24/10/2026, 14:30',
          'Última Atividade': 'Há 3 dias (24/10/2026)'
        }
      });
      return { subject: res.subject, html: injectDemoNotice(res.html, 'TASK_REMINDER_STALE'), text: res.text };
    }
  },

  // 4. STAGE_UNCLAIMED_REMINDER: Available stage without assignee
  {
    index: '04/08',
    type: 'STAGE_UNCLAIMED_REMINDER',
    subject: '[DEMO NOX 04/08] Etapa Aguardando Responsável: Distant Sky — Cap. 80',
    render: () => {
      const res = generateEmailHtml({
        type: 'STAGE_UNCLAIMED_REMINDER',
        title: 'Clean/Redraw sem responsável — Distant Sky Cap. 80',
        body: 'A etapa Clean/Redraw de Distant Sky — Capítulo 80 está disponível há mais de 3 dias no pipeline da Night Scans sem que nenhum membro a tenha assumido.\n\nSe você possui o cargo necessário ou gerencia a equipe, acesse o painel para atribuir a tarefa.',
        deepLink: '/scan?id=04872e99-37ad-4d45-aed4-35759d0eae33&tab=pipeline',
        context: 'Distant Sky — Cap. 80',
        recipientName: 'Awerkori',
        ctaLabel: 'Assumir ou Atribuir Etapa',
        meta: {
          'Obra': 'Distant Sky',
          'Capítulo': '80',
          'Etapa': 'Clean/Redraw',
          'Scan': 'Night Scans',
          'Disponível desde': '24/10/2026, 09:15'
        }
      });
      return { subject: res.subject, html: injectDemoNotice(res.html, 'STAGE_UNCLAIMED_REMINDER'), text: res.text };
    }
  },

  // 5. SECURITY_PASSWORD_CHANGED: Critical security alert
  {
    index: '05/08',
    type: 'SECURITY_PASSWORD_CHANGED',
    subject: '[DEMO NOX 05/08] Alerta de Segurança: Senha Alterada com Sucesso',
    render: () => {
      const res = generateEmailHtml({
        type: 'SECURITY_PASSWORD_CHANGED',
        title: 'Senha Alterada com Sucesso',
        body: 'A senha da sua conta Project Nox foi alterada com êxito.\n\nSe você mesmo realizou essa alteração, nenhuma ação é necessária da sua parte.\n\nIMPORTANTE: Se você NÃO realizou essa alteração, acerte o acesso imediatamente redefinindo sua senha e entre em contato com nosso suporte.',
        deepLink: '/perfil?tab=security',
        recipientName: 'Awerkori',
        ctaLabel: 'Verificar Segurança da Minha Conta',
        meta: {
          'Evento': 'Alteração de Senha',
          'Data e Hora': '27/10/2026, 21:40 (Horário de Brasília)',
          'Origem': 'Sessão Web Segura Autenticada',
          'Status': 'Concluído com Êxito'
        }
      });
      return { subject: res.subject, html: injectDemoNotice(res.html, 'SECURITY_PASSWORD_CHANGED'), text: res.text };
    }
  },

  // 6. SECURITY_EMAIL_CHANGED: Critical security alert
  {
    index: '06/08',
    type: 'SECURITY_EMAIL_CHANGED',
    subject: '[DEMO NOX 06/08] Alerta de Segurança: Endereço de E-mail Alterado',
    render: () => {
      const res = generateEmailHtml({
        type: 'SECURITY_EMAIL_CHANGED',
        title: 'Endereço de E-mail Principal Alterado',
        body: 'O endereço de e-mail associado à sua conta Project Nox foi alterado.\n\nUm link de validação foi emitido para certificar a titularidade da nova caixa postal.\n\nCaso você NÃO tenha solicitado esta mudança, sua conta pode estar comprometida. Acesse a área de segurança imediatamente.',
        deepLink: '/perfil?tab=security',
        recipientName: 'Awerkori',
        ctaLabel: 'Verificar Segurança da Minha Conta',
        meta: {
          'Evento': 'Atualização de E-mail',
          'Data e Hora': '27/10/2026, 21:40 (Horário de Brasília)',
          'E-mail Novo': 'awerkori+novo@gmail.com',
          'Status': 'Aguardando Confirmação'
        }
      });
      return { subject: res.subject, html: injectDemoNotice(res.html, 'SECURITY_EMAIL_CHANGED'), text: res.text };
    }
  },

  // 7. SCAN_INVITE: Invitation to scan team
  {
    index: '07/08',
    type: 'SCAN_INVITE',
    subject: '[DEMO NOX 07/08] Convite Oficial: Você foi convidado para a Night Scans',
    render: () => {
      const res = generateEmailHtml({
        type: 'SCAN_INVITE',
        title: 'Convite para Integrar a Night Scans',
        body: 'A liderança da Night Scans enviou um convite oficial para que você integre a equipe editorial da scan no Project Nox.\n\nAo aceitar, você terá acesso aos canais internos, ao mural e ao pipeline de produção de obras.',
        deepLink: '/scan?id=04872e99-37ad-4d45-aed4-35759d0eae33',
        context: 'Night Scans',
        recipientName: 'Awerkori',
        ctaLabel: 'Ver Convite no Painel da Scan',
        meta: {
          'Scan': 'Night Scans',
          'Convidado por': 'Diretoria Night Scans',
          'Data': '27/10/2026',
          'Status': 'Aguardando sua Aceitação'
        }
      });
      return { subject: res.subject, html: injectDemoNotice(res.html, 'SCAN_INVITE'), text: res.text };
    }
  },

  // 8. SCAN_ROLE_UPDATED: Role updated in scan team
  {
    index: '08/08',
    type: 'SCAN_ROLE_UPDATED',
    subject: '[DEMO NOX 08/08] Cargos Atualizados na Night Scans: Typer e Revisor (QC)',
    render: () => {
      const res = generateEmailHtml({
        type: 'SCAN_ROLE_UPDATED',
        title: 'Cargos e Permissões Atualizados',
        body: 'Seus cargos na equipe Night Scans foram atualizados pela administração.\n\nVocê agora possui as atribuições de Typer e Revisor (QC). Você começará a receber avisos automáticos no painel sempre que essas etapas ficarem disponíveis.',
        deepLink: '/scan?id=04872e99-37ad-4d45-aed4-35759d0eae33',
        context: 'Night Scans',
        recipientName: 'Preston',
        ctaLabel: 'Acessar Painel da Scan',
        meta: {
          'Scan': 'Night Scans',
          'Novos Cargos': 'Typer, Revisor (QC)',
          'Permissões': 'Produção editorial de capítulos',
          'Atualizado em': '27/10/2026'
        }
      });
      return { subject: res.subject, html: injectDemoNotice(res.html, 'SCAN_ROLE_UPDATED'), text: res.text };
    }
  }
];

async function sendViaBrevo(subject: string, htmlContent: string, textContent: string) {
  const payload = {
    sender: { name: BREVO_FROM_NAME, email: BREVO_FROM_EMAIL },
    to: [{ email: TARGET_EMAIL, name: 'Awerkori' }],
    subject,
    htmlContent,
    textContent
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Brevo HTTP ${response.status}: ${errBody}`);
  }

  return response.json() as Promise<{ messageId: string }>;
}

async function verifyDeliveryEvents() {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0];
  const url = `https://api.brevo.com/v3/smtp/statistics/events?email=${encodeURIComponent(TARGET_EMAIL)}&limit=50&startDate=${startDate}&endDate=${endDate}&sort=desc`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY
    }
  });

  if (!response.ok) {
    console.warn(`[WARN] Failed to fetch Brevo events: ${response.status}`);
    return [];
  }

  const data: any = await response.json();
  return data.events || [];
}

async function main() {
  console.log('================================================================');
  console.log('REAL DISPATCH OF NEW/UPDATED INTELLIGENT NOTIFICATION DEMOS VIA BREVO');
  console.log(`Destination: ${TARGET_EMAIL}`);
  console.log(`Sender: ${BREVO_FROM_NAME} <${BREVO_FROM_EMAIL}>`);
  console.log(`Total models to dispatch: ${DEMO_EMAILS.length}`);
  console.log('================================================================\n');

  const deliveryAudit: any[] = [];

  for (const item of DEMO_EMAILS) {
    console.log(`\nDispatching [${item.index}] ${item.type}...`);
    const rendered = item.render();
    console.log(`Subject: ${rendered.subject}`);

    try {
      const sendResult = await sendViaBrevo(rendered.subject, rendered.html, rendered.text);
      console.log(`✓ Accepted by Brevo! MessageId: ${sendResult.messageId}`);

      deliveryAudit.push({
        index: item.index,
        templateId: item.type,
        subject: rendered.subject,
        recipient: TARGET_EMAIL,
        messageId: sendResult.messageId,
        sentAt: new Date().toISOString(),
        accepted: true,
        deliveryStatus: 'ACCEPTED'
      });
    } catch (err: any) {
      console.error(`✗ Error dispatching [${item.index}]:`, err.message);
      deliveryAudit.push({
        index: item.index,
        templateId: item.type,
        subject: rendered.subject,
        recipient: TARGET_EMAIL,
        error: err.message,
        sentAt: new Date().toISOString(),
        accepted: false,
        deliveryStatus: 'FAILED'
      });
    }

    // Delay 1.8s between dispatches
    await new Promise(r => setTimeout(r, 1800));
  }

  console.log('\n--- Waiting 18 seconds for Brevo delivery and event indexing ---');
  await new Promise(r => setTimeout(r, 18000));

  const events = await verifyDeliveryEvents();
  console.log(`Fetched ${events.length} recent Brevo events for ${TARGET_EMAIL}`);

  for (const audit of deliveryAudit) {
    if (!audit.messageId) continue;
    const matched = events.filter((e: any) => e.messageId === audit.messageId);
    if (matched.length > 0) {
      audit.brevoEvents = matched.map((e: any) => ({
        event: e.event,
        date: e.date,
        subject: e.subject
      }));
      audit.deliveryStatus = matched.some((e: any) => e.event === 'delivered') ? 'DELIVERED' : 'PROCESSING';
    } else {
      audit.brevoEvents = ['accepted_and_queued'];
      audit.deliveryStatus = 'ACCEPTED_AND_QUEUED';
    }
    console.log(`[${audit.index}] ${audit.templateId}: Status=${audit.deliveryStatus} (MsgId: ${audit.messageId})`);
  }

  // Save audit to artifacts directory
  const auditPath = path.join(ARTIFACT_DIR, 'email_intelligent_notifications_brevo_audit.json');
  fs.writeFileSync(auditPath, JSON.stringify(deliveryAudit, null, 2));
  console.log(`\nAudit recorded at: ${auditPath}`);
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
