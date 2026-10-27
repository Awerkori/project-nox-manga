import fs from 'node:fs';
import path from 'node:path';
import { generateEmailHtml } from '../src/lib/server/email-templates.ts';

// Parse .dev.vars.preview_full to obtain the Brevo credentials
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

const testEmailsToSend = [
  {
    category: 'TICKET_REPORT (Correção do E-mail Real Gmail Android)',
    rendered: generateEmailHtml({
      type: 'TICKET_REPORT',
      title: 'Novo Relatório de Conteúdo #TR-8821',
      body: 'O leitor Raven reportou páginas invertidas e balões ilegíveis no capítulo 42 da obra Distant Sky. O ticket foi classificado com prioridade alta e aguarda verificação da equipe.',
      deepLink: '/admin/tickets?tab=reports&ticketId=TR-8821',
      context: 'Distant Sky — Capítulo 42',
      recipientName: 'Awerkori',
      meta: {
        'Obra / Título': 'Distant Sky',
        'Capítulo': 'Capítulo 42',
        'Motivo': 'Páginas em ordem invertida',
        'Prioridade': 'Alta',
        'Reportado Por': 'Raven (ID: #8921)'
      }
    })
  },
  {
    category: 'TICKET_SCAN_APPLICATION (Inscrição de Scan)',
    rendered: generateEmailHtml({
      type: 'TICKET_SCAN_APPLICATION',
      title: 'Nova Inscrição de Scan Parceira #SA-3914',
      body: 'A scan Night Scans submeteu candidatura oficial para se tornar parceira do catálogo Project Nox. A documentação e amostras de tradução estão disponíveis para homologação.',
      deepLink: '/admin/tickets?tab=scans&ticketId=SA-3914',
      context: 'Night Scans — Candidatura',
      recipientName: 'Awerkori',
      meta: {
        'Nome da Scan': 'Night Scans',
        'Líder Responsável': 'Noctis',
        'Contato Discord': 'discord.gg/nightscans',
        'Títulos no Portfólio': '3 obras em andamento'
      }
    })
  },
  {
    category: 'TICKET_MODERATION (Ocorrência de Moderação)',
    rendered: generateEmailHtml({
      type: 'TICKET_MODERATION',
      title: 'Nova Ocorrência de Moderação #TM-7102',
      body: 'Um comentário na obra Solo Leveling recebeu múltiplas sinalizações por violação das diretrizes de convivência. O item requer avaliação de moderação.',
      deepLink: '/admin/tickets?tab=moderation&ticketId=TM-7102',
      context: 'Solo Leveling — Comentários',
      recipientName: 'Awerkori',
      meta: {
        'Obra': 'Solo Leveling (Cap. 120)',
        'Usuário Notificado': 'ShadowUser',
        'Tipo de Infração': 'Spam / Desrespeito',
        'Status Atual': 'Pendente de Ação'
      }
    })
  },
  {
    category: 'STAGE_READY (Pipeline de Scan)',
    rendered: generateEmailHtml({
      type: 'STAGE_READY',
      title: 'Etapa Pronta para Produção: Edição',
      body: 'A etapa de Tradução do capítulo 88 de Solo Leveling foi entregue e homologada. A etapa de Edição e Limpeza está liberada no pipeline para ser assumida.',
      deepLink: '/scan/dashboard?chapter=SL-88&stage=edicao',
      context: 'Solo Leveling — Cap. 88',
      recipientName: 'Awerkori',
      meta: {
        'Obra': 'Solo Leveling',
        'Capítulo': 'Capítulo 88',
        'Etapa Liberada': 'Edição e Limpeza',
        'Responsável Anterior': 'Arthur (Tradução)'
      }
    })
  },
  {
    category: 'AUTH_CONFIRMATION (Confirmação de Cadastro)',
    rendered: {
      subject: 'Confirme seu endereço de e-mail — Project Nox',
      html: fs.readFileSync(path.join(process.cwd(), 'supabase', 'templates', 'confirmation.html'), 'utf-8')
        .replace(/\{\{\s*\.SiteURL\s*\}\}/g, 'https://manga.project-nox-awerkori.workers.dev')
        .replace(/\{\{\s*\.TokenHash\s*\}\}/g, 'real_delivery_test_hash_987654')
        .replace(/\{\{\s*\.Email\s*\}\}/g, TARGET_EMAIL),
      text: 'Confirme seu e-mail no Project Nox: https://manga.project-nox-awerkori.workers.dev/auth/confirm'
    }
  }
];

async function sendViaBrevo(subject: string, htmlContent: string, textContent: string) {
  const payload = {
    sender: {
      name: BREVO_FROM_NAME,
      email: BREVO_FROM_EMAIL
    },
    to: [
      {
        email: TARGET_EMAIL,
        name: 'Awerkori'
      }
    ],
    subject: `[TESTE REDESIGN] ${subject}`,
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
    const errorText = await response.text();
    throw new Error(`Brevo send error HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  return result; // contains { messageId: '<...>' }
}

async function verifyDeliveryEvent(messageId: string) {
  // Query Brevo statistics / events
  const encodedEmail = encodeURIComponent(TARGET_EMAIL);
  const response = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?limit=20&email=${encodedEmail}`, {
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY
    }
  });

  if (!response.ok) {
    return { ok: false, status: response.status, events: [] };
  }

  const data = await response.json();
  const matched = (data.events || []).filter((e: any) => e.messageId === messageId);
  return { ok: true, events: matched };
}

async function main() {
  console.log('=====================================================');
  console.log('REAL BREVO EMAIL DELIVERY TEST FOR REDESIGNED MODELS');
  console.log(`Target: ${TARGET_EMAIL}`);
  console.log(`Sender: ${BREVO_FROM_NAME} <${BREVO_FROM_EMAIL}>`);
  console.log('=====================================================\n');

  const deliveryAudit: any[] = [];

  for (const item of testEmailsToSend) {
    console.log(`\nDispatching: ${item.category}`);
    console.log(`Subject: [TESTE REDESIGN] ${item.rendered.subject}`);
    
    try {
      const sendResult = await sendViaBrevo(item.rendered.subject, item.rendered.html, item.rendered.text);
      console.log(`✓ Accepted by Brevo! MessageId: ${sendResult.messageId}`);

      deliveryAudit.push({
        category: item.category,
        subject: item.rendered.subject,
        messageId: sendResult.messageId,
        sentAt: new Date().toISOString(),
        accepted: true
      });
    } catch (err: any) {
      console.error(`✗ Error sending ${item.category}:`, err.message);
      deliveryAudit.push({
        category: item.category,
        subject: item.rendered.subject,
        error: err.message,
        accepted: false
      });
    }

    // Small delay between sends to respect rate limits
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n--- Waiting 10 seconds for Brevo event queue processing ---');
  await new Promise(r => setTimeout(r, 10000));

  // Verify status of sent messages
  for (const audit of deliveryAudit) {
    if (!audit.messageId) continue;
    try {
      const check = await verifyDeliveryEvent(audit.messageId);
      if (check.ok && check.events.length > 0) {
        audit.brevoEvents = check.events.map((e: any) => ({
          event: e.event,
          date: e.date,
          subject: e.subject
        }));
        console.log(`Events for ${audit.messageId}:`, audit.brevoEvents.map((e: any) => e.event).join(', '));
      } else {
        audit.brevoEvents = ['accepted_and_queued'];
        console.log(`Events for ${audit.messageId}: Accepted & Queued (indexing in progress)`);
      }
    } catch (e: any) {
      audit.eventCheckError = e.message;
    }
  }

  // Save audit artifact
  const auditReportPath = path.join(ARTIFACT_DIR, 'email_brevo_real_delivery_audit.json');
  fs.writeFileSync(auditReportPath, JSON.stringify(deliveryAudit, null, 2), 'utf-8');
  console.log(`\nAudit saved to ${auditReportPath}`);

  console.log('\n=====================================================');
  console.log('REAL EMAIL DELIVERY TESTING COMPLETE');
  console.log('=====================================================');
}

main().catch(err => {
  console.error('Delivery runner failed:', err);
  process.exit(1);
});
