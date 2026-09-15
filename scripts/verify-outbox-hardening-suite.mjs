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
  console.log('===============================================================');
  console.log('🛡️ STARTING OUTBOX HARDENING & ANTI-STARVATION TEST SUITE');
  console.log('===============================================================');

  // -------------------------------------------------------------
  // TEST 1: Atomic Claim & Concurrency Protection (SKIP LOCKED)
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Atomic Claim Concurrency (Two Simultaneous Workers) ---');
  
  // Create 6 dummy pending test items
  const testBatchIds = [];
  for (let i = 1; i <= 6; i++) {
    const { data } = await admin.from('scan_email_outbox').insert({
      scan_id: SCAN_ID,
      recipient_user_id: TARGET_USER_ID,
      recipient_email: 'test_concurrency@example.com',
      subject: `Concurrency Test Item #${i}`,
      html_body: '<p>Test</p>',
      status: 'PENDING',
      delivery_status: 'QUEUED',
      priority: 'HIGH',
      scheduled_at: new Date(Date.now() - 7200000 + i * 1000).toISOString(),
      created_at: new Date(Date.now() - 7200000 + i * 1000).toISOString(),
      idempotency_key: `test:concurrency:${Date.now()}:${i}`,
      attempts: 0
    }).select('id').single();
    testBatchIds.push(data.id);
  }

  // Simulate two workers hitting claim_scan_email_outbox_batch at the exact same millisecond
  const [worker1Claims, worker2Claims] = await Promise.all([
    admin.rpc('claim_scan_email_outbox_batch', { p_limit: 3, p_worker_id: 'worker_A' }),
    admin.rpc('claim_scan_email_outbox_batch', { p_limit: 3, p_worker_id: 'worker_B' })
  ]);

  const w1Ids = (worker1Claims.data || []).map(r => r.id).filter(id => testBatchIds.includes(id));
  const w2Ids = (worker2Claims.data || []).map(r => r.id).filter(id => testBatchIds.includes(id));
  
  const intersection = w1Ids.filter(id => w2Ids.includes(id));
  record('Test 1.1: Workers claimed non-overlapping distinct items (0 duplicates)', intersection.length === 0, `overlap=${intersection.length}`);
  record('Test 1.2: All candidate items successfully partitioned across workers', w1Ids.length + w2Ids.length === 6, `w1=${w1Ids.length}, w2=${w2Ids.length}`);

  // Clean up test items
  await admin.from('scan_email_outbox').delete().in('id', testBatchIds);

  // -------------------------------------------------------------
  // TEST 2: Crash & Lease Recovery
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Crash During Processing & Lease Recovery ---');
  
  const { data: crashedItem } = await admin.from('scan_email_outbox').insert({
    scan_id: SCAN_ID,
    recipient_user_id: TARGET_USER_ID,
    recipient_email: 'test_crash@example.com',
    subject: 'Crash Test Item',
    html_body: '<p>Crash</p>',
    status: 'PROCESSING',
    delivery_status: 'CLAIMED',
    priority: 'HIGH',
    claimed_at: new Date(Date.now() - 600000).toISOString(),
    lease_expires_at: new Date(Date.now() - 300000).toISOString(), // expired 5 mins ago
    idempotency_key: `test:crash:${Date.now()}`,
    attempts: 1
  }).select('id').single();

  // Run claim batch: should recover expired lease and return it for processing
  const { data: recoveredItems } = await admin.rpc('claim_scan_email_outbox_batch', {
    p_limit: 5,
    p_specific_id: crashedItem.id,
    p_worker_id: 'recovery_worker'
  });

  const isRecovered = (recoveredItems || []).some(r => r.id === crashedItem.id);
  record('Test 2.1: Expired lease was automatically recovered from crashed state', isRecovered, `recovered=${isRecovered}`);

  await admin.from('scan_email_outbox').delete().eq('id', crashedItem.id);

  // -------------------------------------------------------------
  // TEST 3: Fair Scheduling & Anti-Starvation (50 Old vs 10 New)
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Fair Scheduling & Anti-Starvation (50 Old vs 10 New) ---');

  const oldItemIds = [];
  const baseOldTime = Date.now() - 3600000; // 1 hour ago
  for (let i = 1; i <= 50; i++) {
    const { data } = await admin.from('scan_email_outbox').insert({
      scan_id: SCAN_ID,
      recipient_user_id: TARGET_USER_ID,
      recipient_email: 'test_starvation_old@example.com',
      subject: `Old Bulk Item #${i}`,
      html_body: '<p>Old</p>',
      status: 'PENDING',
      delivery_status: 'QUEUED',
      priority: 'NORMAL',
      created_at: new Date(baseOldTime + i * 1000).toISOString(),
      scheduled_at: new Date(baseOldTime + i * 1000).toISOString(),
      idempotency_key: `test:starve:old:${Date.now()}:${i}`,
      attempts: 0
    }).select('id').single();
    oldItemIds.push(data.id);
  }

  const newItemIds = [];
  for (let i = 1; i <= 10; i++) {
    const { data } = await admin.from('scan_email_outbox').insert({
      scan_id: SCAN_ID,
      recipient_user_id: TARGET_USER_ID,
      recipient_email: 'test_starvation_new@example.com',
      subject: `New Priority Item #${i}`,
      html_body: '<p>New</p>',
      status: 'PENDING',
      delivery_status: 'QUEUED',
      priority: 'HIGH',
      idempotency_key: `test:starve:new:${Date.now()}:${i}`,
      attempts: 0
    }).select('id').single();
    newItemIds.push(data.id);
  }

  // Drain in batches of 20
  const claimedOrder = [];
  for (let b = 0; b < 5; b++) {
    const { data: batch } = await admin.rpc('claim_scan_email_outbox_batch', {
      p_limit: 20,
      p_worker_id: `drain_batch_${b}`
    });
    if (batch && batch.length > 0) {
      claimedOrder.push(...batch.map(r => r.id));
      // Mark as sent to allow next batch to advance
      await admin.from('scan_email_outbox').update({ status: 'SENT' }).in('id', batch.map(r => r.id));
    }
  }

  const { data: drainedItems } = await admin
    .from('scan_email_outbox')
    .select('id, status, claimed_by')
    .in('id', [...oldItemIds, ...newItemIds]);

  const oldDrained = oldItemIds.every(id => {
    const found = (drainedItems || []).find(d => d.id === id);
    return found && found.status !== 'PENDING';
  });
  const newDrained = newItemIds.every(id => {
    const found = (drainedItems || []).find(d => d.id === id);
    return found && found.status !== 'PENDING';
  });
  
  record('Test 3.1: High priority items processed first without blocking', claimedOrder.slice(0, 10).every(id => newItemIds.includes(id)), '10 High items processed at top');
  record('Test 3.2: All 50 older items were completely drained (NO STARVATION)', oldDrained, `drainedCount=${oldItemIds.filter(id => (drainedItems || []).find(d => d.id === id)?.status !== 'PENDING').length}/50`);
  record('Test 3.3: Total batch processed all 60 items completely', oldDrained && newDrained, `totalProcessed=${(drainedItems || []).filter(d => d.status !== 'PENDING').length}/60`);

  // Cleanup test starvation items
  await admin.from('scan_email_outbox').delete().in('id', [...oldItemIds, ...newItemIds]);

  // -------------------------------------------------------------
  // TEST 4: Outbox Created Outside HTTP Request (Cron / Autonomous Drain)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Autonomous Draining for Outbox Born Outside HTTP ---');

  // Insert outbox item directly in DB as would happen from a direct trigger or background script
  const { data: dbDirectItem } = await admin.from('scan_email_outbox').insert({
    scan_id: SCAN_ID,
    recipient_user_id: TARGET_USER_ID,
    recipient_email: 'test_autonomous@example.com',
    subject: 'Direct DB Trigger Outbox Item',
    html_body: '<p>Autonomous</p>',
    status: 'PENDING',
    delivery_status: 'QUEUED',
    priority: 'HIGH',
    idempotency_key: `test:direct_db:${Date.now()}`,
    attempts: 0
  }).select('id').single();

  // Trigger the autonomous email processor endpoint (same handler called by Cloudflare cron)
  const cronRes = await fetch(`${PROD_URL}/api/internal/email-processor?limit=25`, {
    method: 'POST',
    headers: { 'x-scheduled-cron': '*/2 * * * *' }
  });
  const cronJson = await cronRes.json();

  const { data: autonomousAfter } = await admin
    .from('scan_email_outbox')
    .select('status, delivery_status, attempts')
    .eq('id', dbDirectItem.id)
    .single();

  record('Test 4.1: Autonomous scheduled worker responded HTTP 200', cronRes.status === 200, `status=${cronRes.status}`);
  record('Test 4.2: Direct DB item was autonomously claimed and processed', autonomousAfter?.status !== 'PENDING', `status=${autonomousAfter?.status}`);

  await admin.from('scan_email_outbox').delete().eq('id', dbDirectItem.id);

  // -------------------------------------------------------------
  // TEST 5: Real-time specificId Dispatch
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: specificId Priority Fast-Path ---');
  
  const { data: specificItem } = await admin.from('scan_email_outbox').insert({
    scan_id: SCAN_ID,
    recipient_user_id: TARGET_USER_ID,
    recipient_email: 'test_specific@example.com',
    subject: 'Specific ID Fast-Path Test',
    html_body: '<p>Specific</p>',
    status: 'PENDING',
    delivery_status: 'QUEUED',
    priority: 'NORMAL',
    idempotency_key: `test:specific:${Date.now()}`,
    attempts: 0
  }).select('id').single();

  const specificRes = await fetch(`${PROD_URL}/api/internal/email-processor?id=${specificItem.id}`);
  const specificJson = await specificRes.json();

  const { data: specificAfter } = await admin
    .from('scan_email_outbox')
    .select('status, delivery_status')
    .eq('id', specificItem.id)
    .single();

  record('Test 5.1: specificId fast-path processed requested item immediately', specificAfter?.status !== 'PENDING', `status=${specificAfter?.status}`);

  await admin.from('scan_email_outbox').delete().eq('id', specificItem.id);

  // -------------------------------------------------------------
  // TEST 6: Observability Metrics & Stall Detection RPC
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Observability Metrics & Stall Detection ---');
  const { data: metrics, error: metErr } = await admin.rpc('get_scan_email_outbox_metrics');
  
  record('Test 6.1: get_scan_email_outbox_metrics executed successfully', Boolean(metrics) && !metErr, `pending=${metrics?.pending_count}, sent=${metrics?.sent_count}`);
  record('Test 6.2: Metrics contains all required health fields', 
    'oldest_pending_age_seconds' in metrics && 'queue_stalled' in metrics && 'sent_count' in metrics,
    `stalled=${metrics?.queue_stalled}, oldest_age=${metrics?.oldest_pending_age_seconds}s`
  );

  // -------------------------------------------------------------
  // TEST 7: Controlled Production Real Delivery & Brevo Verification
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Controlled Production Real Delivery to awerkori@gmail.com ---');
  
  const { client: ownerClient } = await getOwnerClient(PROD_URL);
  const chNum = Math.floor(95000 + Math.random() * 4000);

  const { data: chId, error: chErr } = await ownerClient.rpc('create_scan_production_chapter', {
    p_scan_id: SCAN_ID,
    p_work_id: WORK_ID,
    p_chapter_number: chNum,
    p_chapter_label: `Blindagem Final Entrega #${chNum}`,
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
  const tradStage = stages.find(s => s.scan_workflow_stages?.slug === 'traducao');

  // Claim and complete raw to release Tradução
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

  // Get notification and outbox for Tradução
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

  record('Test 7.1: Pipeline stage created notification and outbox with priority HIGH', outbox?.priority === 'HIGH', `priority=${outbox?.priority}`);

  // Process via worker
  const dispatchRes = await fetch(`${PROD_URL}/api/internal/email-processor?id=${outbox.id}`);
  const dispatchJson = await dispatchRes.json();

  const { data: outboxSent } = await admin
    .from('scan_email_outbox')
    .select('*')
    .eq('id', outbox.id)
    .single();

  record('Test 7.2: Worker processed outbox item with atomic claim', outboxSent?.status === 'SENT', `status=${outboxSent?.status}`);
  record('Test 7.3: Brevo Message-ID returned', Boolean(outboxSent?.provider_message_id), `msgId=${outboxSent?.provider_message_id}`);

  // Poll Brevo for delivered event
  let deliveredEvent = null;
  const pollStart = Date.now();
  while (Date.now() - pollStart < 45000) {
    const res = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?limit=5&email=${encodeURIComponent(TARGET_EMAIL)}`, {
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

  record('Test 7.4: Brevo registered confirmed "delivered" event for real recipient', Boolean(deliveredEvent), `deliveredAt=${deliveredEvent?.date}`);

  // Cleanup sibling pending items created by test chapter
  const { data: siblingPending } = await admin
    .from('scan_email_outbox')
    .select('id')
    .eq('status', 'PENDING')
    .like('idempotency_key', `%:${chId}:%`);
  for (const item of (siblingPending || [])) {
    await admin.rpc('cancel_scan_email_outbox_item', {
      p_outbox_id: item.id,
      p_reason: 'Automated test suite chapter sibling outbox item',
      p_actor: 'hardening_suite'
    });
  }

  console.log('\n===============================================================');
  console.log('📊 OUTBOX HARDENING TEST SUITE SUMMARY:');
  console.log('===============================================================');
  const allPassed = results.every(r => r.passed);
  results.forEach(r => console.log(`${r.passed ? '✅' : '❌'} ${r.name}`));
  console.log(`\nTotal: ${results.filter(r => r.passed).length} / ${results.length} PASSED`);
  if (!allPassed) {
    throw new Error('Some hardening tests failed!');
  }
}

run().catch(err => {
  console.error('TEST SUITE ERROR:', err);
  process.exit(1);
});
