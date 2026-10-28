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

function getAuthHtml(fileName: string, typeName: string, subjectTitle: string) {
  const filePath = path.join(process.cwd(), 'supabase', 'templates', fileName);
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content
    .replace(/\{\{\s*\.SiteURL\s*\}\}/g, 'https://manga.project-nox-awerkori.workers.dev')
    .replace(/\{\{\s*\.TokenHash\s*\}\}/g, 'demonstrativo_apenas_hash_seguro_preview')
    .replace(/\{\{\s*\.Email\s*\}\}/g, TARGET_EMAIL);

  // Insert a subtle, non-intrusive demonstrative notice inside the email
  const demoNotice = `
    <!-- Demonstrative Test Banner -->
    <tr>
      <td style="padding: 10px 18px; background-color: #1a162b; border-bottom: 1px solid #2e264a; text-align: center; font-size: 11px; color: #dfc28d; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
        <strong>[AMOSTRA DE AVALIAÇÃO VISUAL]</strong> Este e-mail é uma demonstração de layout do modelo <em>${typeName}</em>. O botão utiliza token demonstrativo seguro.
      </td>
    </tr>
  `;
  content = content.replace(/(<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;[^>]*>)/i, `$1\n${demoNotice}`);
  return content;
}

// Complete Catalog of all 22 emails to send to awerkori@gmail.com
const ALL_22_EMAILS = [
  // 1. Central de Tickets
  {
    index: '01/22',
    type: 'TICKET_REPORT',
    subject: '[TESTE NOX 01/22] Relatório de Conteúdo',
    html: generateEmailHtml({
      type: 'TICKET_REPORT',
      title: 'Relatório de Conteúdo: Distant Sky — Cap. 42',
      body: 'O usuário Raven submeteu um relatório apontando páginas fora de ordem e balões de diálogo cortados no capítulo 42 de Distant Sky.\n\nA equipe de moderação deve inspecionar as páginas reportadas e solicitar revisão se necessário.',
      deepLink: '/admin/tickets?tab=reports&ticketId=TR-10492',
      context: 'Distant Sky — Cap. 42',
      recipientName: 'Awerkori',
      meta: {
        'Obra / Título': 'Distant Sky',
        'Capítulo': 'Capítulo 42',
        'Motivo': 'Páginas em ordem invertida',
        'Prioridade': 'Alta',
        'Reportado Por': 'Raven (ID: #8921)'
      }
    }).html,
    text: 'Relatório de Conteúdo #TR-10492 em Distant Sky Cap. 42'
  },
  {
    index: '02/22',
    type: 'TICKET_SCAN_APPLICATION',
    subject: '[TESTE NOX 02/22] Inscrição de Scan',
    html: generateEmailHtml({
      type: 'TICKET_SCAN_APPLICATION',
      title: 'Nova Inscrição de Scan: Night Scans',
      body: 'A scan Night Scans submeteu candidatura oficial para se tornar parceira do catálogo Project Nox.\n\nDocumentos, amostras de edição e links para canais oficiais da equipe estão disponíveis para homologação da administração.',
      deepLink: '/admin/tickets?tab=scans&ticketId=SA-4029',
      context: 'Candidatura Oficial de Parceria',
      recipientName: 'Awerkori',
      meta: {
        'Nome da Scan': 'Night Scans',
        'Líder Responsável': 'Noctis',
        'Discord de Contato': 'discord.gg/nightscans',
        'Obras Ativas': '3 títulos em andamento'
      }
    }).html,
    text: 'Nova Inscrição de Scan: Night Scans'
  },
  {
    index: '03/22',
    type: 'TICKET_MODERATION',
    subject: '[TESTE NOX 03/22] Ocorrência de Moderação',
    html: generateEmailHtml({
      type: 'TICKET_MODERATION',
      title: 'Ocorrência de Moderação: Solo Leveling',
      body: 'Um comentário publicado na seção do capítulo 120 de Solo Leveling recebeu múltiplas sinalizações por violação das diretrizes de convivência comunitária.',
      deepLink: '/admin/tickets?tab=moderation&ticketId=TM-8910',
      context: 'Solo Leveling — Cap. 120',
      recipientName: 'Awerkori',
      meta: {
        'Usuário Notificado': 'ShadowUser',
        'Tipo de Infração': 'Spam / Desrespeito',
        'Localização': 'Comentários — Cap. 120',
        'Status Atual': 'Pendente de Ação'
      }
    }).html,
    text: 'Ocorrência de Moderação na obra Solo Leveling'
  },

  // 2. Pipeline das Scans
  {
    index: '04/22',
    type: 'TASK_ASSIGNED',
    subject: '[TESTE NOX 04/22] Tarefa de Produção',
    html: generateEmailHtml({
      type: 'TASK_ASSIGNED',
      title: 'Nova Tarefa Atribuída: Tradução',
      body: 'Você foi escalado como responsável pela etapa de Tradução (Coreano -> Português) no capítulo 15 da obra Omniscient Reader.\n\nFavor conferir as notas de tradução e o prazo estimado no painel da scan.',
      deepLink: '/scan/dashboard?chapter=OR-15&stage=traducao',
      context: 'Omniscient Reader — Cap. 15',
      recipientName: 'Awerkori',
      meta: {
        'Obra': 'Omniscient Reader',
        'Capítulo': 'Capítulo 15',
        'Etapa': 'Tradução (PT-BR)',
        'Prazo Estimado': '48 horas'
      }
    }).html,
    text: 'Nova Tarefa de Produção: Tradução em Omniscient Reader Cap. 15'
  },
  {
    index: '05/22',
    type: 'STAGE_READY',
    subject: '[TESTE NOX 05/22] Etapa Disponível no Pipeline',
    html: generateEmailHtml({
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
    }).html,
    text: 'Etapa Pronta no Pipeline: Edição de Solo Leveling Cap. 88'
  },
  {
    index: '06/22',
    type: 'QC_ISSUE',
    subject: '[TESTE NOX 06/22] Revisão de Controle de Qualidade (QC)',
    html: generateEmailHtml({
      type: 'QC_ISSUE',
      title: 'Observações de Quality Control no Cap. 25',
      body: 'O revisor de QC inspecionou os arquivos do capítulo 25 de The Beginning After the End e apontou pequenos ajustes necessários antes da publicação.',
      deepLink: '/scan/dashboard?chapter=TBATE-25&stage=qc',
      context: 'The Beginning After the End — Cap. 25',
      recipientName: 'Awerkori',
      meta: {
        'Capítulo': 'Capítulo 25',
        'Problemas Apontados': '3 balões fora de alinhamento (págs. 8, 12 e 14)',
        'Revisor de QC': 'Valkyrie'
      }
    }).html,
    text: 'Revisão de QC Pendente em TBATE Cap. 25'
  },
  {
    index: '07/22',
    type: 'REWORK',
    subject: '[TESTE NOX 07/22] Solicitação de Retrabalho',
    html: generateEmailHtml({
      type: 'REWORK',
      title: 'Retrabalho Solicitado no Capítulo 70',
      body: 'Foram identificadas inconsistências com as fontes oficiais e artefatos de compressão nas páginas finais. O capítulo foi devolvido para retrabalho.',
      deepLink: '/scan/dashboard?chapter=SSS-70&stage=rework',
      context: 'SSS-Class Suicide Hunter — Cap. 70',
      recipientName: 'Awerkori',
      meta: {
        'Etapa': 'Typesetting / Redraw',
        'Motivo': 'Fontes fora do guia de estilo da obra',
        'Ação Necessária': 'Ajustar tipografia e reenviar pacote zip'
      }
    }).html,
    text: 'Retrabalho Solicitado no Capítulo 70 de SSS-Class Suicide Hunter'
  },

  // 3. Recrutamento e Comunicação das Scans
  {
    index: '08/22',
    type: 'APPLICATION',
    subject: '[TESTE NOX 08/22] Candidatura de Recrutamento',
    html: generateEmailHtml({
      type: 'APPLICATION',
      title: 'Nova Candidatura de Recrutamento',
      body: 'Um candidato enviou teste para a vaga de Tradutor (Coreano -> Português) da equipe de tradução.',
      deepLink: '/scan/recrutamento?appId=9012',
      context: 'Recrutamento da Scan',
      recipientName: 'Awerkori',
      meta: {
        'Candidato': 'JinWoo (Discord: jinwoo#1234)',
        'Cargo Desejado': 'Tradutor KR->PT',
        'Teste Anexado': 'Sim (capitulo_teste.pdf)',
        'Experiência': '2 anos em scans de manhwa'
      }
    }).html,
    text: 'Nova Candidatura de Recrutamento recebida'
  },
  {
    index: '09/22',
    type: 'APPLICATION_UPDATE',
    subject: '[TESTE NOX 09/22] Atualização de Candidatura',
    html: generateEmailHtml({
      type: 'APPLICATION_UPDATE',
      title: 'Resultado da sua Candidatura na Scan Nox',
      body: 'Temos uma excelente notícia! Sua candidatura para a equipe de Edição da Scan Nox foi avaliada e aprovada pela liderança da equipe.',
      deepLink: '/scan/candidaturas/minhas',
      context: 'Resultado de Seleção',
      recipientName: 'Awerkori',
      meta: {
        'Novo Status': 'Aprovado com Louvor',
        'Cargo': 'Editor e Limpador',
        'Próximo Passo': 'Acessar canal privado no Discord'
      }
    }).html,
    text: 'Sua candidatura na Scan Nox foi atualizada para Aprovado'
  },
  {
    index: '10/22',
    type: 'MURAL_POST',
    subject: '[TESTE NOX 10/22] Comunicado no Mural da Scan',
    html: generateEmailHtml({
      type: 'MURAL_POST',
      title: 'Comunicado no Mural: Escala de Fim de Semana',
      body: 'Publicamos o cronograma atualizado de entregas e os títulos prioritários para o próximo fim de semana. Por favor, confirmem seus prazos no painel da equipe.',
      deepLink: '/scan/mural',
      context: 'Mural de Avisos da Scan',
      recipientName: 'Awerkori'
    }).html,
    text: 'Novo comunicado publicado no mural da equipe'
  },
  {
    index: '11/22',
    type: 'MENTION',
    subject: '[TESTE NOX 11/22] Menção Direta em Chat/Comentário',
    html: generateEmailHtml({
      type: 'MENTION',
      title: 'Você foi mencionado por Arthur',
      body: '"@Awerkori por favor verifique os balões de efeito sonoro da página 14 antes de fechar o arquivo final do capítulo."',
      deepLink: '/scan/chat?ref=msg_9102',
      context: 'Chat de Produção',
      recipientName: 'Awerkori'
    }).html,
    text: 'Arthur mencionou você no Project Nox'
  },
  {
    index: '12/22',
    type: 'ROLE_MENTION',
    subject: '[TESTE NOX 12/22] Menção de Cargo da Scan',
    html: generateEmailHtml({
      type: 'ROLE_MENTION',
      title: 'Chamado para o Cargo: Tradutores',
      body: 'Os capítulos brutos (raws) em alta definição dos lançamentos da semana de Eleceed já estão disponíveis na fila para tradução.',
      deepLink: '/scan/dashboard',
      context: 'Equipe de Tradutores',
      recipientName: 'Awerkori'
    }).html,
    text: 'Novo chamado coletivo para a equipe de Tradutores'
  },
  {
    index: '13/22',
    type: 'REPLY_CHAT',
    subject: '[TESTE NOX 13/22] Nova Mensagem no Chat de Produção',
    html: generateEmailHtml({
      type: 'REPLY_CHAT',
      title: 'Nova Mensagem no Chat de Produção',
      body: 'Valkyrie respondeu sua dúvida: "As fontes de efeitos sonoros desse manhwa já estão padronizadas no drive da equipe."',
      deepLink: '/scan/chat?room=orv',
      recipientName: 'Awerkori'
    }).html,
    text: 'Nova resposta recebida no chat de produção'
  },

  // 4. Plataforma e Comunidade
  {
    index: '14/22',
    type: 'REPLY_COMMENT',
    subject: '[TESTE NOX 14/22] Resposta ao seu Comentário',
    html: generateEmailHtml({
      type: 'REPLY_COMMENT',
      title: 'Nova Resposta no seu Comentário',
      body: 'Shadow respondeu: "Concordo totalmente com a sua análise, a adaptação dessa cena em relação à webnovel ficou impecável!"',
      deepLink: '/obra/omniscient-reader/capitulo-120#comment-8910',
      context: 'Omniscient Reader — Cap. 120',
      recipientName: 'Awerkori'
    }).html,
    text: 'Shadow respondeu ao seu comentário em Omniscient Reader'
  },
  {
    index: '15/22',
    type: 'NEW_CHAPTER',
    subject: '[TESTE NOX 15/22] Novo Capítulo Publicado',
    html: generateEmailHtml({
      type: 'NEW_CHAPTER',
      title: 'Novo Capítulo Publicado: Cap. 180',
      body: 'O capítulo 180 de Eleceed acabou de ser publicado e já está pronto para leitura em alta definição no catálogo do Project Nox.',
      deepLink: '/obra/eleceed/capitulo-180',
      context: 'Eleceed — Lançamento',
      recipientName: 'Awerkori'
    }).html,
    text: 'Capítulo 180 de Eleceed publicado no Project Nox'
  },
  {
    index: '16/22',
    type: 'LEVEL_UP',
    subject: '[TESTE NOX 16/22] Subida de Nível de Usuário',
    html: generateEmailHtml({
      type: 'LEVEL_UP',
      title: 'Parabéns! Você alcançou o Nível 25',
      body: 'Sua atividade constante na comunidade e suas leituras frequentes elevaram sua patente para Cavaleiro das Sombras.',
      deepLink: '/perfil/awerkori',
      context: 'Progressão do Usuário',
      recipientName: 'Awerkori',
      meta: {
        'Novo Nível': 'Nível 25',
        'Título Desbloqueado': 'Cavaleiro das Sombras',
        'Recompensa': '+200 Pontos de Reputação'
      }
    }).html,
    text: 'Parabéns! Você subiu para o Nível 25 no Project Nox'
  },
  {
    index: '17/22',
    type: 'ACHIEVEMENT',
    subject: '[TESTE NOX 17/22] Conquista Desbloqueada',
    html: generateEmailHtml({
      type: 'ACHIEVEMENT',
      title: 'Conquista Desbloqueada: Leitor Noturno',
      body: 'Você alcançou a impressionante marca de 500 capítulos lidos na plataforma Project Nox e desbloqueou a insígnia de Leitor Noturno.',
      deepLink: '/perfil/awerkori/conquistas',
      context: 'Conquistas da Comunidade',
      recipientName: 'Awerkori',
      meta: {
        'Conquista': 'Leitor Noturno (Grau Ouro)',
        'Emblema': 'badge-gold-reader.svg',
        'Progresso': '500 / 500 Capítulos Lidos'
      }
    }).html,
    text: 'Nova Conquista Desbloqueada: Leitor Noturno'
  },
  {
    index: '18/22',
    type: 'SYSTEM',
    subject: '[TESTE NOX 18/22] Comunicado Oficial do Sistema',
    html: generateEmailHtml({
      type: 'SYSTEM',
      title: 'Manutenção Programada Concluída com Sucesso',
      body: 'A migração dos servidores do Project Nox foi concluída com êxito. O catálogo, as bibliotecas pessoais e os painéis de produção das scans estão operando normalmente.',
      deepLink: '/',
      context: 'Comunicado Oficial do Sistema',
      recipientName: 'Awerkori'
    }).html,
    text: 'Comunicado Oficial: Manutenção Programada Concluída'
  },

  // 5. Conta e Autenticação (Novo Design Acolhedor e Seguro)
  {
    index: '19/22',
    type: 'AUTH_CONFIRMATION',
    subject: '[TESTE NOX 19/22] Confirmação de Cadastro',
    html: getAuthHtml('confirmation.html', 'CONFIRMAÇÃO DE CADASTRO', 'Boas-vindas ao Project Nox!'),
    text: 'Boas-vindas ao Project Nox! Confirme seu e-mail para ativar sua conta: https://manga.project-nox-awerkori.workers.dev/auth/confirm'
  },
  {
    index: '20/22',
    type: 'AUTH_RECOVERY',
    subject: '[TESTE NOX 20/22] Recuperação e Redefinição de Senha',
    html: getAuthHtml('recovery.html', 'RECUPERAÇÃO DE CONTA', 'Redefinição de Senha de Acesso'),
    text: 'Redefinição de Senha no Project Nox: https://manga.project-nox-awerkori.workers.dev/auth/confirm'
  },
  {
    index: '21/22',
    type: 'AUTH_EMAIL_CHANGE',
    subject: '[TESTE NOX 21/22] Alteração de Endereço de E-mail',
    html: getAuthHtml('email_change.html', 'ALTERAÇÃO DE E-MAIL', 'Confirmação de Novo Endereço de E-mail'),
    text: 'Confirmação de Novo Endereço de E-mail no Project Nox: https://manga.project-nox-awerkori.workers.dev/auth/confirm'
  },
  {
    index: '22/22',
    type: 'AUTH_INVITE',
    subject: '[TESTE NOX 22/22] Convite de Membro da Plataforma',
    html: getAuthHtml('invite.html', 'CONVITE DE MEMBRO', 'Você recebeu um convite para o Project Nox'),
    text: 'Você recebeu um convite para o Project Nox: https://manga.project-nox-awerkori.workers.dev/auth/confirm'
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
    const errorText = await response.text();
    throw new Error(`Brevo send error HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  return result; // contains { messageId: '<...>' }
}

async function verifyDeliveryEvents() {
  const encodedEmail = encodeURIComponent(TARGET_EMAIL);
  const response = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?limit=50&email=${encodedEmail}&sort=desc`, {
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY
    }
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.events || [];
}

async function main() {
  console.log('================================================================');
  console.log('REAL DISPATCH OF ALL 22 PROJECT NOX EMAIL MODELS VIA BREVO');
  console.log(`Destination: ${TARGET_EMAIL}`);
  console.log(`Sender: ${BREVO_FROM_NAME} <${BREVO_FROM_EMAIL}>`);
  console.log(`Total models to dispatch: ${ALL_22_EMAILS.length}`);
  console.log('================================================================\n');

  const deliveryAudit: any[] = [];

  for (const item of ALL_22_EMAILS) {
    console.log(`\nDispatching [${item.index}] ${item.type}...`);
    console.log(`Subject: ${item.subject}`);

    try {
      const sendResult = await sendViaBrevo(item.subject, item.html, item.text);
      console.log(`✓ Accepted by Brevo! MessageId: ${sendResult.messageId}`);

      deliveryAudit.push({
        index: item.index,
        templateId: item.type,
        subject: item.subject,
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
        subject: item.subject,
        recipient: TARGET_EMAIL,
        error: err.message,
        sentAt: new Date().toISOString(),
        accepted: false,
        deliveryStatus: 'FAILED'
      });
    }

    // Delay 1.6s between dispatches to stay well within Brevo rate limits
    await new Promise(r => setTimeout(r, 1600));
  }

  console.log('\n--- Waiting 18 seconds for Brevo delivery and event indexing ---');
  await new Promise(r => setTimeout(r, 18000));

  // Query events to correlate delivered events
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

  // Save audit artifact
  const auditReportPath = path.join(ARTIFACT_DIR, 'email_brevo_real_delivery_all_22_audit.json');
  fs.writeFileSync(auditReportPath, JSON.stringify(deliveryAudit, null, 2), 'utf-8');
  console.log(`\nAudit saved to ${auditReportPath}`);

  const deliveredCount = deliveryAudit.filter(a => a.deliveryStatus === 'DELIVERED').length;
  const acceptedCount = deliveryAudit.filter(a => a.accepted).length;
  console.log('\n================================================================');
  console.log(`DISPATCH SUMMARY:`);
  console.log(`Total Models: ${ALL_22_EMAILS.length}`);
  console.log(`Accepted by Brevo API: ${acceptedCount} / ${ALL_22_EMAILS.length}`);
  console.log(`Confirmed DELIVERED in Brevo Events: ${deliveredCount} / ${ALL_22_EMAILS.length}`);
  console.log('================================================================');
}

main().catch(err => {
  console.error('Fatal send error:', err);
  process.exit(1);
});
