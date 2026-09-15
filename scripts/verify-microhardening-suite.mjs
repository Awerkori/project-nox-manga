import { createClient } from '@supabase/supabase-js';
import { getOwnerClient } from './owner-session.mjs';

process.loadEnvFile('.env');

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';
const SCAN_ID = '04872e99-37ad-4d45-aed4-35759d0eae33';
const WORK_ID = '2e94a28a-06e1-41ba-bdfa-5a2bbf400bae';
const TARGET_EMAIL = 'awerkori@gmail.com';
const TARGET_USER_ID = '732fbe87-5040-41fb-9983-0aedb2af44c8';
const BREVO_API_KEY = process.env.BREVO_API_KEY;

const admin = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const results = [];
function record(name, passed, info = '') {
  results.push({ name, passed, info });
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${name} ${info ? `(${info})` : ''}`);
}

async function run() {
  console.log('======================================================================');
  console.log('🛡️ INICIANDO SUÍTE DE MICROBLINDAGEM: FAIRNESS & ENTREGA INCERTA');
  console.log('======================================================================');

  // ------------------------------------------------------------------
  // TESTE 1: Anti-Starvation Entre Tiers (HIGH contínuo vs NORMAL e LOW antigos)
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 1: Fairness Entre Prioridades (Quotas por Lote + Backfill) ---');
  
  const oldLowIds = [];
  const oldNormalIds = [];
  const baseTime = Date.now() - 120000; // 2 minutos atrás (dentro da janela de 5m para testar cotas de prioridade)

  for (let i = 1; i <= 6; i++) {
    const { data: lowItem } = await admin.from('scan_email_outbox').insert({
      scan_id: SCAN_ID,
      recipient_user_id: TARGET_USER_ID,
      recipient_email: 'test_starve_low@example.com',
      subject: `Old Low Priority Item #${i}`,
      html_body: '<p>Low</p>',
      status: 'PENDING',
      delivery_status: 'QUEUED',
      priority: 'LOW',
      created_at: new Date(baseTime + i * 1000).toISOString(),
      scheduled_at: new Date(baseTime + i * 1000).toISOString(),
      idempotency_key: `test:starve:low:${Date.now()}:${i}`
    }).select('id').single();
    oldLowIds.push(lowItem.id);
  }

  for (let i = 1; i <= 6; i++) {
    const { data: normItem } = await admin.from('scan_email_outbox').insert({
      scan_id: SCAN_ID,
      recipient_user_id: TARGET_USER_ID,
      recipient_email: 'test_starve_normal@example.com',
      subject: `Old Normal Priority Item #${i}`,
      html_body: '<p>Normal</p>',
      status: 'PENDING',
      delivery_status: 'QUEUED',
      priority: 'NORMAL',
      created_at: new Date(baseTime + i * 1000).toISOString(),
      scheduled_at: new Date(baseTime + i * 1000).toISOString(),
      idempotency_key: `test:starve:normal:${Date.now()}:${i}`
    }).select('id').single();
    oldNormalIds.push(normItem.id);
  }

  // Simular fluxo contínuo de 20 HIGH
  const highIds = [];
  for (let i = 1; i <= 20; i++) {
    const { data: highItem } = await admin.from('scan_email_outbox').insert({
      scan_id: SCAN_ID,
      recipient_user_id: TARGET_USER_ID,
      recipient_email: 'test_starve_high@example.com',
      subject: `Continuous High Priority Item #${i}`,
      html_body: '<p>High</p>',
      status: 'PENDING',
      delivery_status: 'QUEUED',
      priority: 'HIGH',
      idempotency_key: `test:starve:high:${Date.now()}:${i}`
    }).select('id').single();
    highIds.push(highItem.id);
  }

  // Executar primeiro lote de claim com limit = 15
  const { data: batch1 } = await admin.rpc('claim_scan_email_outbox_batch', {
    p_limit: 15,
    p_worker_id: 'fairness_worker_1'
  });

  const b1HighCount = (batch1 || []).filter(r => highIds.includes(r.id)).length;
  const b1NormalCount = (batch1 || []).filter(r => oldNormalIds.includes(r.id)).length;
  const b1LowCount = (batch1 || []).filter(r => oldLowIds.includes(r.id)).length;

  record('Teste 1.1: Primeiro lote alocou slots para HIGH (~70%)', b1HighCount > 0, `highCount=${b1HighCount}`);
  record('Teste 1.2: Primeiro lote alocou slots para NORMAL (~20%) (não foi bloqueado)', b1NormalCount > 0, `normalCount=${b1NormalCount}`);
  record('Teste 1.3: Primeiro lote alocou slots para LOW (~10%) (não foi starved por HIGH)', b1LowCount > 0, `lowCount=${b1LowCount}`);

  // Simular envio bem sucedido do batch 1 para prosseguir
  if (batch1 && batch1.length > 0) {
    await admin.from('scan_email_outbox').update({ status: 'SENT' }).in('id', batch1.map(r => r.id));
  }

  // Executar mais 2 lotes para esvaziar a fila
  for (let step = 2; step <= 3; step++) {
    const { data: batch } = await admin.rpc('claim_scan_email_outbox_batch', {
      p_limit: 15,
      p_worker_id: `fairness_worker_${step}`
    });
    if (batch && batch.length > 0) {
      await admin.from('scan_email_outbox').update({ status: 'SENT' }).in('id', batch.map(r => r.id));
    }
  }

  const { data: remainingItems } = await admin
    .from('scan_email_outbox')
    .select('id, status, priority')
    .in('id', [...oldLowIds, ...oldNormalIds, ...highIds]);

  const allLowDrained = oldLowIds.every(id => remainingItems.find(r => r.id === id)?.status !== 'PENDING');
  const allNormalDrained = oldNormalIds.every(id => remainingItems.find(r => r.id === id)?.status !== 'PENDING');
  const allHighDrained = highIds.every(id => remainingItems.find(r => r.id === id)?.status !== 'PENDING');

  record('Teste 1.4: 100% dos itens LOW antigos foram drenados sem starvation', allLowDrained, `lowDrained=${oldLowIds.filter(id => remainingItems.find(r => r.id === id)?.status !== 'PENDING').length}/6`);
  record('Teste 1.5: 100% dos itens NORMAL antigos foram drenados sem starvation', allNormalDrained, `normDrained=${oldNormalIds.filter(id => remainingItems.find(r => r.id === id)?.status !== 'PENDING').length}/6`);
  record('Teste 1.6: 100% dos itens HIGH contínuos foram atendidos com alta prioridade', allHighDrained, `highDrained=${highIds.filter(id => remainingItems.find(r => r.id === id)?.status !== 'PENDING').length}/20`);

  // Limpeza
  await admin.from('scan_email_outbox').delete().in('id', [...oldLowIds, ...oldNormalIds, ...highIds]);

  // ------------------------------------------------------------------
  // TESTE 2: Métricas de Fairness por Prioridade
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 2: Observabilidade de Fairness por Prioridade ---');
  const { data: metrics } = await admin.rpc('get_scan_email_outbox_metrics');

  record('Teste 2.1: RPC de métricas contém oldest_pending_age por prioridade',
    'oldest_pending_age_high_seconds' in metrics &&
    'oldest_pending_age_normal_seconds' in metrics &&
    'oldest_pending_age_low_seconds' in metrics &&
    'uncertain_count' in metrics &&
    'reconciled_count' in metrics,
    `highAge=${metrics?.oldest_pending_age_high_seconds}s, normAge=${metrics?.oldest_pending_age_normal_seconds}s, lowAge=${metrics?.oldest_pending_age_low_seconds}s`
  );

  // ------------------------------------------------------------------
  // TESTE 3: Crash ANTES do POST Externo
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 3: Crash Antes do POST (send_started_at = NULL) ---');
  const { data: preSendCrashItem } = await admin.from('scan_email_outbox').insert({
    scan_id: SCAN_ID,
    recipient_user_id: TARGET_USER_ID,
    recipient_email: 'test_pre_crash@example.com',
    subject: 'Pre-Send Crash Item',
    html_body: '<p>Pre Crash</p>',
    status: 'PROCESSING',
    delivery_status: 'CLAIMED',
    priority: 'HIGH',
    claimed_at: new Date(Date.now() - 600000).toISOString(),
    lease_expires_at: new Date(Date.now() - 300000).toISOString(), // lease expirou
    send_started_at: null, // NUNCA tentou envio externo
    scheduled_at: new Date(Date.now() + 60000).toISOString(), // futuro para não ser re-claimado no mesmo lote
    idempotency_key: `test:crash:pre:${Date.now()}`
  }).select('id').single();

  // Executa claim: deve recuperar para PENDING seguro
  await admin.rpc('claim_scan_email_outbox_batch', { p_limit: 5, p_worker_id: 'pre_crash_recovery' });

  const { data: preSendAfter } = await admin
    .from('scan_email_outbox')
    .select('status, delivery_status')
    .eq('id', preSendCrashItem.id)
    .single();

  record('Teste 3.1: Item cujo worker morreu ANTES do POST voltou a PENDING com segurança', preSendAfter?.status === 'PENDING' && preSendAfter?.delivery_status === 'RECOVERED_PRE_SEND', `status=${preSendAfter?.status}, delivery=${preSendAfter?.delivery_status}`);

  await admin.from('scan_email_outbox').delete().eq('id', preSendCrashItem.id);

  // ------------------------------------------------------------------
  // TESTE 4: Crash DEPOIS do POST (Brevo aceitou) -> Reconciliação Sem Duplicata
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 4: Crash Depois do POST (Janela Incerta) -> Reconciliação ---');
  
  // Realiza um envio real ao Brevo para obter um Message-ID válido e registrado
  const testSubj = `Teste Reconciliação #${Date.now()}`;
  const sendTime = new Date().toISOString();
  const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'Project Nox', email: 'awerkori@gmail.com' },
      to: [{ email: TARGET_EMAIL }],
      subject: testSubj,
      htmlContent: '<p>Teste de Reconciliação após crash simulado</p>'
    })
  });
  const brevoJson = await brevoRes.json();
  const realMessageId = brevoJson.messageId;

  // Simula o item no banco: send_started_at foi gravado, lease expirou, mas worker morreu antes de marcar SENT
  const { data: postCrashItem } = await admin.from('scan_email_outbox').insert({
    scan_id: SCAN_ID,
    recipient_user_id: TARGET_USER_ID,
    recipient_email: TARGET_EMAIL,
    subject: testSubj,
    html_body: '<p>Teste de Reconciliação</p>',
    status: 'PROCESSING',
    delivery_status: 'SENDING',
    priority: 'HIGH',
    claimed_at: new Date(Date.now() - 600000).toISOString(),
    lease_expires_at: new Date(Date.now() - 300000).toISOString(),
    send_started_at: sendTime, // timestamp do envio real
    provider_request_key: `req_${Date.now()}`,
    idempotency_key: `test:crash:post:${Date.now()}`
  }).select('id').single();

  // Executa o claim da outbox: a recuperação de crash detecta send_started_at != null
  // NÃO deve voltar para PENDING (bloqueia reenvio cego)! Deve mover para DELIVERY_UNCERTAIN!
  await admin.rpc('claim_scan_email_outbox_batch', { p_limit: 5, p_worker_id: 'post_crash_verifier' });

  const { data: postCrashAfterClaim } = await admin
    .from('scan_email_outbox')
    .select('status, delivery_status')
    .eq('id', postCrashItem.id)
    .single();

  record('Teste 4.1: Item após POST com lease expirado NÃO voltou a PENDING (bloqueou reenvio cego)', postCrashAfterClaim?.status === 'DELIVERY_UNCERTAIN', `status=${postCrashAfterClaim?.status}, delivery=${postCrashAfterClaim?.delivery_status}`);

  // Aguarda a indexação do evento no Brevo antes de acionar a reconciliação em produção
  for (let poll = 0; poll < 15; poll++) {
    await new Promise(r => setTimeout(r, 2500));
    const checkRes = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?limit=20&sort=desc&email=${encodeURIComponent(TARGET_EMAIL)}`, {
      headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY }
    });
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      const match = (checkData.events || []).find(e => (e.subject || '').includes(testSubj));
      if (match) break;
    }
  }

  // Dispara o reconciliador no endpoint de produção
  await fetch(`${PROD_URL}/api/internal/email-processor?limit=10`);

  const { data: reconciledItem } = await admin
    .from('scan_email_outbox')
    .select('status, delivery_status, provider_message_id, reconciled_at')
    .eq('id', postCrashItem.id)
    .single();

  record('Teste 4.2: Reconciliador localizou evento no Brevo e marcou RECONCILED_SENT sem reenvio', 
    reconciledItem?.status === 'SENT' && reconciledItem?.delivery_status === 'RECONCILED_SENT',
    `status=${reconciledItem?.status}, delivery=${reconciledItem?.delivery_status}, msgId=${reconciledItem?.provider_message_id}`
  );
  record('Teste 4.3: Message-ID do Brevo foi recuperado e persistido durante a reconciliação',
    Boolean(reconciledItem?.provider_message_id),
    `msgId=${reconciledItem?.provider_message_id}`
  );

  await admin.from('scan_email_outbox').delete().eq('id', postCrashItem.id);

  // ------------------------------------------------------------------
  // TESTE 5: Timeout / Falha Onde Brevo NÃO Recebeu -> Safe Retry
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 5: Tentativa Externa Perdida Sem Evento no Brevo -> Safe Retry ---');
  
  const ghostSubj = `NonExistent Ghost Subject ${Date.now()}`;
  const { data: ghostItem } = await admin.from('scan_email_outbox').insert({
    scan_id: SCAN_ID,
    recipient_user_id: TARGET_USER_ID,
    recipient_email: TARGET_EMAIL,
    subject: ghostSubj,
    html_body: '<p>Ghost</p>',
    status: 'DELIVERY_UNCERTAIN',
    delivery_status: 'NEEDS_RECONCILIATION',
    priority: 'HIGH',
    send_started_at: new Date(Date.now() - 700000).toISOString(), // > 10 minutos atrás
    provider_request_key: `ghost_req_${Date.now()}`,
    idempotency_key: `test:ghost:${Date.now()}`
  }).select('id').single();

  // Executa o endpoint de reconciliação
  await fetch(`${PROD_URL}/api/internal/email-processor?limit=10`);

  const { data: ghostAfter } = await admin
    .from('scan_email_outbox')
    .select('status, delivery_status, send_started_at, reconciled_at, last_error')
    .eq('id', ghostItem.id)
    .single();

  const isReleasedForRetry = (ghostAfter?.status === 'PENDING' && ghostAfter?.delivery_status === 'RECONCILED_RETRY') ||
                             Boolean(ghostAfter?.reconciled_at);

  record('Teste 5.1: Item sem evento no Brevo após período de graça foi liberado para retry seguro',
    isReleasedForRetry,
    `status=${ghostAfter?.status}, delivery=${ghostAfter?.delivery_status}, reconciledAt=${ghostAfter?.reconciled_at}`
  );

  await admin.from('scan_email_outbox').delete().eq('id', ghostItem.id);

  // ------------------------------------------------------------------
  // TESTE 6: Controlled Production Real Delivery to awerkori@gmail.com
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 6: Entrega Real Controlada na Pipeline de Produção ---');
  
  const { client: ownerClient } = await getOwnerClient(PROD_URL);
  const chNum = Math.floor(98000 + Math.random() * 1500);

  const { data: chId, error: chErr } = await ownerClient.rpc('create_scan_production_chapter', {
    p_scan_id: SCAN_ID,
    p_work_id: WORK_ID,
    p_chapter_number: chNum,
    p_chapter_label: `Microblindagem Final Entrega #${chNum}`,
    p_chapter_type: 'NUMBER',
    p_template: 'MANHWA',
    p_priority: 'NORMAL',
    p_auto_claim: false
  });
  if (chErr) throw chErr;

  const { data: stages } = await admin
    .from('scan_chapter_stages')
    .select('id, stage_id, status, production_chapter_id, scan_workflow_stages(slug)')
    .eq('production_chapter_id', chId);

  const rawStage = stages.find(s => s.scan_workflow_stages?.slug === 'raw');
  await ownerClient.rpc('claim_scan_chapter_stage', { p_chapter_stage_id: rawStage.id });
  await admin.from('scan_production_files').insert({
    scan_id: SCAN_ID,
    work_id: WORK_ID,
    production_chapter_id: chId,
    stage_id: rawStage.stage_id,
    stage_slug: 'raw',
    file_name: `raw_${chNum}.zip`,
    byte_size: 1024 * 1024,
    mime_type: 'application/zip',
    file_key: `mock/${chId}/raw_${chNum}.zip`,
    provider: 'TELEGRAM',
    version: 1,
    is_current: true,
    uploaded_by: TARGET_USER_ID
  });
  await ownerClient.rpc('complete_scan_chapter_stage', { p_chapter_stage_id: rawStage.id });

  // Pega notificação e outbox de Tradução para awerkori
  const { data: notif } = await admin
    .from('notifications')
    .select('id, dedupe_key')
    .eq('user_id', TARGET_USER_ID)
    .like('dedupe_key', `pipeline_available:${SCAN_ID}:${chId}:traducao:%`)
    .single();

  const { data: outbox } = await admin
    .from('scan_email_outbox')
    .select('*')
    .eq('notification_id', notif.id)
    .single();

  record('Teste 6.1: Notificação e outbox criadas com prioridade HIGH', outbox?.priority === 'HIGH', `priority=${outbox?.priority}`);

  // Dispara via worker de produção com specificId
  const dispatchRes = await fetch(`${PROD_URL}/api/internal/email-processor?id=${outbox.id}`);
  const dispatchJson = await dispatchRes.json();

  const { data: outboxSent } = await admin
    .from('scan_email_outbox')
    .select('*')
    .eq('id', outbox.id)
    .single();

  record('Teste 6.2: Worker produziu status SENT com pre-flight marker registrado', 
    outboxSent?.status === 'SENT' && Boolean(outboxSent?.send_started_at) && Boolean(outboxSent?.provider_request_key),
    `status=${outboxSent?.status}, startedAt=${outboxSent?.send_started_at}, reqKey=${outboxSent?.provider_request_key}`
  );
  record('Teste 6.3: Message-ID real do Brevo registrado', Boolean(outboxSent?.provider_message_id), `msgId=${outboxSent?.provider_message_id}`);

  // Polling Brevo para delivered event
  let deliveredEvent = null;
  const pollStart = Date.now();
  while (Date.now() - pollStart < 60000) {
    const res = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?limit=20&sort=desc&email=${encodeURIComponent(TARGET_EMAIL)}`, {
      headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY }
    });
    if (res.ok) {
      const data = await res.json();
      const match = (data.events || []).find(e => e.messageId === outboxSent.provider_message_id);
      if (match && match.event === 'delivered') {
        deliveredEvent = match;
        break;
      }
    }
    await new Promise(r => setTimeout(r, 4000));
  }

  record('Teste 6.4: Evento "delivered" do Brevo confirmado para destinatário real', Boolean(deliveredEvent), `deliveredAt=${deliveredEvent?.date}`);

  // Cancelar auditavelmente irmãos do capítulo de teste
  const { data: siblingPending } = await admin
    .from('scan_email_outbox')
    .select('id')
    .eq('status', 'PENDING')
    .like('idempotency_key', `%:${chId}:%`);
  for (const item of (siblingPending || [])) {
    await admin.rpc('cancel_scan_email_outbox_item', {
      p_outbox_id: item.id,
      p_reason: 'Automated test suite chapter sibling outbox item',
      p_actor: 'microhardening_suite'
    });
  }

  // ------------------------------------------------------------------
  // TESTE 7: Verificação Final de Saúde da Fila
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 7: Saúde Final da Fila ---');
  const { data: finalMetrics } = await admin.rpc('get_scan_email_outbox_metrics');
  record('Teste 7.1: Fila saudável sem stall (queue_stalled = false)', finalMetrics?.queue_stalled === false, `stalled=${finalMetrics?.queue_stalled}`);
  record('Teste 7.2: Sem registros presos em DELIVERY_UNCERTAIN (uncertain_count = 0)', finalMetrics?.uncertain_count === 0, `uncertain=${finalMetrics?.uncertain_count}`);

  console.log('\n======================================================================');
  console.log('📊 RESUMO DA SUÍTE DE MICROBLINDAGEM:');
  console.log('======================================================================');
  const allPassed = results.every(r => r.passed);
  results.forEach(r => console.log(`${r.passed ? '✅' : '❌'} ${r.name}`));
  console.log(`\nTotal: ${results.filter(r => r.passed).length} / ${results.length} APROVADOS`);
  if (!allPassed) {
    throw new Error('Alguns testes de microblindagem falharam!');
  }
}

run().catch(err => {
  console.error('ERRO NA SUÍTE DE TESTES:', err);
  process.exit(1);
});
