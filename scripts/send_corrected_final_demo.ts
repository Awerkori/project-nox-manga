import fs from 'node:fs';
import path from 'node:path';
import { generateEmailHtml } from '../src/lib/server/email-templates.ts';

// 1. Read Brevo credentials
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

function injectFinalTestBanner(rawHtml: string, modelName: string): string {
  const banner = `
    <!-- Final Verification Banner -->
    <tr>
      <td style="padding: 10px 18px; background-color: #1a162b; border-bottom: 1px solid #2e264a; text-align: center; font-size: 11px; color: #dfc28d; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
        <strong>[TESTE FINAL CORRIGIDO]</strong> Modelo <em>${modelName}</em> com correção de botão (seta Unicode única <code>→</code> sem entidades literais).
      </td>
    </tr>
  `;
  return rawHtml.replace(/(<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;[^>]*>)/i, `$1\n${banner}`);
}

const CORRECTION_MODELS = [
  // 1. Security: Password Changed (Primary model requested by user)
  {
    templateId: 'SECURITY_PASSWORD_CHANGED',
    subject: '[TESTE FINAL] Alerta de Segurança: Senha Alterada com Sucesso',
    render: () => {
      const res = generateEmailHtml({
        type: 'SECURITY_PASSWORD_CHANGED',
        title: 'Senha Alterada com Sucesso',
        body: 'A senha da sua conta Project Nox foi alterada com êxito.\n\nSe você mesmo realizou essa alteração, nenhuma ação é necessária da sua parte.\n\nIMPORTANTE: Se você NÃO realizou essa alteração, redefina sua senha imediatamente para proteger sua conta.',
        deepLink: '/perfil?tab=security',
        recipientName: 'Awerkori',
        meta: {
          'Evento': 'Alteração de Senha',
          'Data e Hora': '28/10/2026, 01:25 (Horário de Brasília)',
          'Origem': 'Sessão Web Segura Autenticada',
          'Status': 'Concluído com Êxito'
        }
      });
      return { subject: res.subject, html: injectFinalTestBanner(res.html, 'SECURITY_PASSWORD_CHANGED'), text: res.text };
    }
  },

  // 2. Security: Email Changed
  {
    templateId: 'SECURITY_EMAIL_CHANGED',
    subject: '[TESTE FINAL] Alerta de Segurança: Endereço de E-mail Alterado',
    render: () => {
      const res = generateEmailHtml({
        type: 'SECURITY_EMAIL_CHANGED',
        title: 'Endereço de E-mail Principal Alterado',
        body: 'O endereço de e-mail associado à sua conta Project Nox foi alterado.\n\nUm link de validação foi emitido para certificar a titularidade da nova caixa postal.\n\nCaso você NÃO tenha solicitado esta mudança, sua conta pode estar comprometida.',
        deepLink: '/perfil?tab=security',
        recipientName: 'Awerkori',
        meta: {
          'Evento': 'Atualização de E-mail',
          'Data e Hora': '28/10/2026, 01:25 (Horário de Brasília)',
          'E-mail Novo': 'awerkori+novo@gmail.com',
          'Status': 'Aguardando Confirmação'
        }
      });
      return { subject: res.subject, html: injectFinalTestBanner(res.html, 'SECURITY_EMAIL_CHANGED'), text: res.text };
    }
  },

  // 3. Stale Task Reminder
  {
    templateId: 'TASK_REMINDER_STALE',
    subject: '[TESTE FINAL] Lembrete de Produção: Distant Sky — Cap. 80 (Typeset)',
    render: () => {
      const res = generateEmailHtml({
        type: 'TASK_REMINDER_STALE',
        title: 'Typeset em Andamento — Distant Sky Cap. 80',
        body: 'Olá, Preston! Você ainda possui um capítulo em andamento na Night Scans.\n\nA etapa de Typeset do capítulo 80 de Distant Sky está sob sua responsabilidade há mais de 3 dias sem nova atividade registrada.\n\nSe precisar de ajuda ou de mais tempo, converse com sua equipe no painel da scan.',
        deepLink: '/scan?id=04872e99-37ad-4d45-aed4-35759d0eae33&tab=tasks&stageId=demo-typeset',
        context: 'Distant Sky — Cap. 80',
        recipientName: 'Preston',
        meta: {
          'Obra': 'Distant Sky',
          'Capítulo': '80',
          'Etapa': 'Typeset',
          'Scan': 'Night Scans',
          'Atribuído em': '25/10/2026, 14:30',
          'Última Atividade': 'Há 3 dias (25/10/2026)'
        }
      });
      return { subject: res.subject, html: injectFinalTestBanner(res.html, 'TASK_REMINDER_STALE'), text: res.text };
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
  console.log('DISPATCH OF CORRECTED FINAL TEST EMAILS VIA BREVO');
  console.log(`Destination: ${TARGET_EMAIL}`);
  console.log(`Sender: ${BREVO_FROM_NAME} <${BREVO_FROM_EMAIL}>`);
  console.log('================================================================\n');

  const auditLog: any[] = [];

  for (const item of CORRECTION_MODELS) {
    console.log(`Dispatching ${item.templateId}...`);
    const rendered = item.render();
    console.log(`Subject: ${item.subject}`);

    // Verify in memory that the HTML button contains NO &rarr; or double arrows
    if (rendered.html.includes('&amp;rarr;') || rendered.html.includes('&rarr; →') || rendered.html.includes('→ →')) {
      throw new Error(`FATAL: ${item.templateId} still contains corrupted arrow entity!`);
    }

    try {
      const sendRes = await sendViaBrevo(item.subject, rendered.html, rendered.text);
      console.log(`✓ Brevo accepted! MsgId: ${sendRes.messageId}`);
      auditLog.push({
        templateId: item.templateId,
        subject: item.subject,
        recipient: TARGET_EMAIL,
        messageId: sendRes.messageId,
        sentAt: new Date().toISOString(),
        deliveryStatus: 'ACCEPTED'
      });
    } catch (err: any) {
      console.error(`✗ Error sending ${item.templateId}:`, err.message);
      auditLog.push({
        templateId: item.templateId,
        subject: item.subject,
        recipient: TARGET_EMAIL,
        error: err.message,
        sentAt: new Date().toISOString(),
        deliveryStatus: 'FAILED'
      });
    }

    await new Promise(r => setTimeout(r, 1800));
  }

  console.log('\n--- Waiting 18 seconds for Brevo delivery and event indexing ---');
  await new Promise(r => setTimeout(r, 18000));

  const events = await verifyDeliveryEvents();
  for (const log of auditLog) {
    if (!log.messageId) continue;
    const matched = events.filter((e: any) => e.messageId === log.messageId);
    if (matched.length > 0) {
      log.brevoEvents = matched.map((e: any) => ({
        event: e.event,
        date: e.date,
        subject: e.subject
      }));
      log.deliveryStatus = matched.some((e: any) => e.event === 'delivered') ? 'DELIVERED' : 'PROCESSING';
    } else {
      log.deliveryStatus = 'ACCEPTED_AND_QUEUED';
    }
    console.log(`[VERIFIED] ${log.templateId}: Status=${log.deliveryStatus} (MsgId: ${log.messageId})`);
  }

  const outPath = path.join(ARTIFACT_DIR, 'email_corrected_final_brevo_audit.json');
  fs.writeFileSync(outPath, JSON.stringify(auditLog, null, 2));
  console.log(`\nAudit saved to: ${outPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
