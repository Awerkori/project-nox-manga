import { createClient } from '@supabase/supabase-js';
import { getOwnerClient } from './owner-session.mjs';

process.loadEnvFile('.env');

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';
const SCAN_ID = '04872e99-37ad-4d45-aed4-35759d0eae33'; // Project Nox
const WORK_ID = '2e94a28a-06e1-41ba-bdfa-5a2bbf400bae'; // Wise Knight Life
const TARGET_EMAIL = 'awerkori@gmail.com';
const TARGET_USER_ID = '732fbe87-5040-41fb-9983-0aedb2af44c8';
const BREVO_API_KEY = process.env.BREVO_API_KEY;

const admin = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function uploadMockDeliverable(stageRecord, uploaderId, fileName = 'raw_chapter.zip') {
  const { data, error } = await admin.from('scan_production_files').insert({
    scan_id: SCAN_ID,
    work_id: WORK_ID,
    production_chapter_id: stageRecord.production_chapter_id,
    stage_id: stageRecord.stage_id,
    stage_slug: 'raw',
    file_name: fileName,
    byte_size: 1024 * 1024 * 2,
    mime_type: 'application/zip',
    file_key: `mock/${stageRecord.production_chapter_id}/${fileName}`,
    provider: 'TELEGRAM',
    version: stageRecord.availability_version || 1,
    is_current: true,
    uploaded_by: uploaderId
  }).select().single();
  if (error) throw new Error(`Upload mock deliverable error: ${error.message}`);
  return data;
}

async function main() {
  console.log('=====================================================');
  console.log('STARTING REAL EMAIL DELIVERY VERIFICATION & AUDIT');
  console.log('=====================================================');

  // 1. Audit Recipient Eligibility
  console.log('\n--- 1. AUDITING RECIPIENT ELIGIBILITY ---');
  const { data: member } = await admin
    .from('scan_members')
    .select('user_id, role, hidden_by_admin')
    .eq('scan_id', SCAN_ID)
    .eq('user_id', TARGET_USER_ID)
    .single();
  console.log('Scan Member:', member);

  const { data: positions } = await admin
    .from('scan_member_positions')
    .select('scan_positions(id, name, display_order)')
    .eq('scan_id', SCAN_ID)
    .eq('user_id', TARGET_USER_ID);
  console.log('Positions held:', positions.map(p => p.scan_positions?.name));

  const hasTranslator = positions.some(p => p.scan_positions?.name?.toLowerCase().includes('trad'));
  console.log('Has Tradutor role:', hasTranslator);
  if (!hasTranslator) {
    throw new Error('User does not have Tradutor role!');
  }

  // 2. Authenticate as Owner
  console.log('\n--- 2. AUTHENTICATING OWNER SESSION ---');
  const { client: ownerClient, user: ownerUser } = await getOwnerClient(PROD_URL);
  console.log('Authenticated as:', ownerUser.email, `(${ownerUser.id})`);

  // 3. Create Controlled Production Chapter
  const testChNum = Math.floor(80000 + Math.random() * 10000);
  console.log(`\n--- 3. CREATING CONTROLLED CHAPTER #${testChNum} ---`);
  
  const { data: chapterId, error: createErr } = await ownerClient.rpc('create_scan_production_chapter', {
    p_scan_id: SCAN_ID,
    p_work_id: WORK_ID,
    p_chapter_number: testChNum,
    p_chapter_label: `Entrega Real Tradução #${testChNum}`,
    p_chapter_type: 'NUMBER',
    p_template: 'MANHWA',
    p_priority: 'NORMAL',
    p_auto_claim: false
  });

  if (createErr) throw new Error(`Create chapter error: ${createErr.message}`);
  console.log('Chapter created:', chapterId);

  // Get raw and traducao stages
  const { data: stages } = await admin
    .from('scan_chapter_stages')
    .select('id, stage_id, status, availability_version, availability_reason, production_chapter_id, scan_workflow_stages(slug, name)')
    .eq('production_chapter_id', chapterId);

  const rawStage = stages.find(s => s.scan_workflow_stages?.slug === 'raw');
  const tradStage = stages.find(s => s.scan_workflow_stages?.slug === 'traducao');

  console.log('Initial stages:', {
    raw: { id: rawStage.id, status: rawStage.status },
    traducao: { id: tradStage.id, status: tradStage.status }
  });

  // Claim raw stage, upload deliverable file, and complete
  console.log('\n--- 4. CLAIMING, DELIVERING AND COMPLETING RAW STAGE ---');
  const { error: claimErr } = await ownerClient.rpc('claim_scan_chapter_stage', {
    p_chapter_stage_id: rawStage.id
  });
  if (claimErr) throw new Error(`Claim raw error: ${claimErr.message}`);

  await uploadMockDeliverable(rawStage, TARGET_USER_ID, `raw_${testChNum}.zip`);
  console.log('Deliverable uploaded for raw stage.');

  const { error: completeErr } = await ownerClient.rpc('complete_scan_chapter_stage', {
    p_chapter_stage_id: rawStage.id,
    p_notes: 'Raw concluída para liberar Tradução real'
  });
  if (completeErr) throw new Error(`Complete raw error: ${completeErr.message}`);
  console.log('Raw stage completed successfully.');

  // 5. Verify Tradução Stage Transitioned to AVAILABLE
  console.log('\n--- 5. VERIFYING TRADUÇÃO STAGE IS AVAILABLE ---');
  const { data: tradAfter } = await admin
    .from('scan_chapter_stages')
    .select('*')
    .eq('id', tradStage.id)
    .single();

  console.log('Tradução Stage State in DB:', {
    id: tradAfter.id,
    scan_id: tradAfter.scan_id,
    chapter_id: tradAfter.production_chapter_id,
    stage: 'traducao',
    status: tradAfter.status,
    availability_version: tradAfter.availability_version,
    availability_reason: tradAfter.availability_reason,
    notified_available: tradAfter.notified_available,
    timestamp: tradAfter.updated_at
  });

  // 6. Verify Internal Notification Created for awerkori
  console.log('\n--- 6. VERIFYING INTERNAL NOTIFICATION FOR awerkori ---');
  const { data: notifs } = await admin
    .from('notifications')
    .select('*')
    .eq('user_id', TARGET_USER_ID)
    .eq('scan_id', SCAN_ID)
    .like('dedupe_key', `pipeline_available:${SCAN_ID}:${chapterId}:traducao:%`)
    .order('created_at', { ascending: false });

  console.log('Found matching notifications count:', notifs?.length);
  if (!notifs || notifs.length === 0) {
    throw new Error('Internal notification was NOT created for Tradução!');
  }
  const notif = notifs[0];
  console.log('Internal Notification in DB:', {
    id: notif.id,
    title: notif.title,
    body: notif.body,
    dedupe_key: notif.dedupe_key,
    user_id: notif.user_id,
    created_at: notif.created_at
  });

  // 7. Verify Outbox Record Created
  console.log('\n--- 7. VERIFYING EMAIL OUTBOX RECORD ---');
  const { data: outboxRows } = await admin
    .from('scan_email_outbox')
    .select('*')
    .eq('notification_id', notif.id);

  if (!outboxRows || outboxRows.length === 0) {
    throw new Error('Scan email outbox record was NOT created for notification!');
  }
  const outboxItem = outboxRows[0];
  console.log('Outbox Record in DB:', {
    id: outboxItem.id,
    recipient_email: outboxItem.recipient_email,
    subject: outboxItem.subject,
    status: outboxItem.status,
    attempts: outboxItem.attempts,
    created_at: outboxItem.created_at,
    processed_at: outboxItem.sent_at,
    last_error: outboxItem.last_error,
    dedupe_key: outboxItem.idempotency_key
  });

  // 8. Invoke Cloudflare Worker Email Processor
  console.log('\n--- 8. INVOKING WORKER EMAIL PROCESSOR ---');
  console.log(`Calling ${PROD_URL}/api/internal/email-processor?id=${outboxItem.id}`);
  
  const workerRes = await fetch(`${PROD_URL}/api/internal/email-processor?id=${outboxItem.id}`);
  console.log('Worker HTTP Status:', workerRes.status);
  const workerJson = await workerRes.json();
  console.log('Worker Response:', JSON.stringify(workerJson, null, 2));

  // 9. Inspect Outbox after Processing
  console.log('\n--- 9. INSPECTING OUTBOX AFTER WORKER EXECUTION ---');
  const { data: updatedOutbox } = await admin
    .from('scan_email_outbox')
    .select('*')
    .eq('id', outboxItem.id)
    .single();

  console.log('Updated Outbox Record:', {
    id: updatedOutbox.id,
    destinatario: updatedOutbox.recipient_email,
    subject: updatedOutbox.subject,
    status: updatedOutbox.status,
    delivery_status: updatedOutbox.delivery_status,
    attempts: updatedOutbox.attempts,
    sent_at: updatedOutbox.sent_at,
    provider_message_id: updatedOutbox.provider_message_id,
    last_error: updatedOutbox.last_error,
    dedupe_key: updatedOutbox.idempotency_key
  });

  if (!updatedOutbox.provider_message_id) {
    throw new Error('No provider_message_id returned from Brevo!');
  }

  const messageId = updatedOutbox.provider_message_id;
  console.log(`\nBrevo Message-ID: ${messageId}`);

  // 10. Poll Brevo SMTP Statistics / Events for 'delivered'
  console.log('\n--- 10. POLLING BREVO API FOR REAL "delivered" EVENT ---');
  let deliveredEvent = null;
  const startTime = Date.now();
  const maxWaitMs = 60000; // poll up to 60s

  while (Date.now() - startTime < maxWaitMs) {
    const eventsRes = await fetch(
      `https://api.brevo.com/v3/smtp/statistics/events?limit=10&email=${encodeURIComponent(TARGET_EMAIL)}`,
      {
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY
        }
      }
    );

    if (eventsRes.ok) {
      const eventsData = await eventsRes.json();
      const match = (eventsData.events || []).find(e => e.messageId === messageId);
      if (match) {
        console.log(`[${new Date().toISOString()}] Event found: ${match.event} (date: ${match.date})`);
        if (match.event === 'delivered') {
          deliveredEvent = match;
          break;
        }
      } else {
        console.log(`[${new Date().toISOString()}] Waiting for Brevo event log...`);
      }
    } else {
      console.log(`Brevo query status: ${eventsRes.status}`);
    }

    await new Promise(r => setTimeout(r, 4000));
  }

  if (deliveredEvent) {
    console.log('\n=====================================================');
    console.log('🎉 CONFIRMED REAL EMAIL DELIVERY IN BREVO!');
    console.log('=====================================================');
    console.log('Delivered Event Details:');
    console.log(`  Message-ID: ${deliveredEvent.messageId}`);
    console.log(`  Event: ${deliveredEvent.event}`);
    console.log(`  Date / Delivered At: ${deliveredEvent.date}`);
    console.log(`  Recipient: ${deliveredEvent.email}`);
    console.log(`  Subject: ${deliveredEvent.subject}`);
  } else {
    console.warn('\nWarning: "delivered" event not yet indexed by Brevo events API within 60s.');
    const msgRes = await fetch(`https://api.brevo.com/v3/smtp/emails/${encodeURIComponent(messageId)}`, {
      headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY }
    });
    console.log('Single message status check:', msgRes.status);
    if (msgRes.ok) {
      const msgData = await msgRes.json();
      console.log('Single message data:', JSON.stringify(msgData, null, 2));
    }
  }

  console.log('\nVerification run finished successfully.');
}

main().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
