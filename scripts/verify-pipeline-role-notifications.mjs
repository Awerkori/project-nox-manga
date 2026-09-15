// scripts/verify-pipeline-role-notifications.mjs
// Comprehensive verification suite for:
// 1. Role-Gated Automatic Pipeline Notifications
// 2. Strict DAG Invariant & Parallel AND-Join Enforcement (Typeset blocked until Clean & Tradução are DONE)
// 3. QC Reservation (Targeted notifications when qc_assignee_id is set)
// 4. Pré Aprovado Leadership Alert (OWNER and ADMIN / Gerente only)
// 5. Devolução / Return to Queue with Availability Version Increment (v1 -> v2)
// 6. Legitimate Rework with Version Increment (v2 -> v3)
// 7. Deterministic Deduplication Key Formatting & Idempotency
// 8. Personal Seen State (scan_pipeline_stage_seen) & RPC mark_pipeline_stage_seen
// 9. Transactional Outbox (scan_email_outbox) generation with Brevo metadata

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
process.loadEnvFile('.env');

const admin = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const SCAN_ID = '04872e99-37ad-4d45-aed4-35759d0eae33'; // Project Nox
const WORK_ID = 'c08a2531-7bf3-4324-979a-f7de0e66a62d'; // Céu Distante

// Members under test
const OWNER_ID = '732fbe87-5040-41fb-9983-0aedb2af44c8'; // Owner (all positions)
const MIAKA_ID = 'ef19a199-4871-4602-ba2e-9a29edd1f299'; // Staff, Typer only
const PRISTAM_ID = '86b6a05e-9c2d-4bb4-8381-c9890c730f17'; // Staff, Raw Provider + Clean/Redraw
const SOUSA_ID = '5c68de04-c72a-4df8-86a7-b851057208dc'; // Staff, multiple positions

async function getAuthClientForUser(userId) {
  const { data: { user }, error: uErr } = await admin.auth.admin.getUserById(userId);
  if (uErr || !user) throw new Error(`User not found: ${userId}`);
  const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.email });
  if (lErr) throw lErr;

  const cookies = [];
  const ssrClient = createServerClient(process.env.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookies,
      setAll: (v) => cookies.push(...v)
    }
  });
  const { data: authData, error: vErr } = await ssrClient.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink'
  });
  if (vErr) throw vErr;

  return createClient(process.env.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${authData.session.access_token}`
      }
    }
  });
}

async function uploadMockDeliverable(stageRecord, uploaderId, fileName = 'file.zip') {
  const stageSlug = stageRecord.stage?.slug || stageRecord.stage_slug || 'stage';
  const { data, error } = await admin.from('scan_production_files').insert({
    scan_id: SCAN_ID,
    work_id: WORK_ID,
    production_chapter_id: stageRecord.production_chapter_id,
    stage_id: stageRecord.stage_id,
    stage_slug: stageSlug,
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

const results = [];
function record(testName, passed, details = '') {
  results.push({ testName, passed, details });
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${testName} ${details ? '(' + details + ')' : ''}`);
}

async function runVerification() {
  console.log('\n======================================================');
  console.log('🚀 STARTING DEFINITIVE PIPELINE NOTIFICATIONS VERIFICATION');
  console.log('======================================================\n');

  let testChapterId = null;
  let devChId = null;

  try {
    console.log('Authenticating user clients...');
    const ownerClient = await getAuthClientForUser(OWNER_ID);
    const pristamClient = await getAuthClientForUser(PRISTAM_ID);
    const miakaClient = await getAuthClientForUser(MIAKA_ID);
    const sousaClient = await getAuthClientForUser(SOUSA_ID);
    console.log('✓ Authenticated Owner, Pristam, Miaka, Sousa successfully.\n');

    // -------------------------------------------------------------
    // SCENARIO 1: RAW Chapter Creation & Availability Broadcast
    // -------------------------------------------------------------
    console.log('--- SCENARIO 1: RAW Chapter Creation & Role-Gated Dispatch ---');
    const testChNum = Math.floor(99000 + Math.random() * 9000);

    const { data: createData, error: createErr } = await ownerClient.rpc('create_scan_production_chapter', {
      p_scan_id: SCAN_ID,
      p_work_id: WORK_ID,
      p_chapter_number: testChNum,
      p_chapter_label: 'Capítulo de Teste E2E Notificações',
      p_chapter_type: 'NUMBER',
      p_template: 'MANHWA',
      p_priority: 'HIGH',
      p_auto_claim: false
    });

    if (createErr) throw new Error(`Failed to create test chapter: ${createErr.message}`);
    testChapterId = typeof createData === 'string' ? createData : createData?.id || createData?.chapter_id;
    if (!testChapterId) {
      const { data: chRow } = await admin
        .from('scan_production_chapters')
        .select('id')
        .eq('scan_id', SCAN_ID)
        .eq('work_id', WORK_ID)
        .eq('chapter_number', testChNum)
        .single();
      testChapterId = chRow?.id;
    }
    console.log(`Created test chapter: ${testChapterId} (#${testChNum})`);

    const { data: stagesInit } = await admin
      .from('scan_chapter_stages')
      .select('*, stage:stage_id(slug, name)')
      .eq('production_chapter_id', testChapterId)
      .eq('scan_id', SCAN_ID);
    const rawStage = (stagesInit || []).find(s => s.stage?.slug === 'raw');

    record(
      'Scenario 1.1: RAW stage initialized as AVAILABLE with version 1',
      rawStage?.status === 'AVAILABLE' && rawStage?.availability_version === 1,
      `status=${rawStage?.status}, version=${rawStage?.availability_version}`
    );

    const { data: rawNotifs } = await admin
      .from('notifications')
      .select('*')
      .eq('scan_id', SCAN_ID)
      .like('dedupe_key', `pipeline_available:${SCAN_ID}:${testChapterId}:raw:1:%`);

    const rawNotifUserIds = (rawNotifs || []).map(n => n.user_id);
    record(
      'Scenario 1.2: RAW notification dispatched to Pristam (Raw Provider)',
      rawNotifUserIds.includes(PRISTAM_ID),
      `recipientCount=${rawNotifUserIds.length}`
    );
    record(
      'Scenario 1.3: RAW notification NOT sent to Miaka (Typer only)',
      !rawNotifUserIds.includes(MIAKA_ID),
      'Correctly role-gated'
    );

    const notifIds = (rawNotifs || []).map(n => n.id);
    const { data: rawOutbox } = await admin
      .from('scan_email_outbox')
      .select('*')
      .eq('scan_id', SCAN_ID)
      .in('notification_id', notifIds);

    record(
      'Scenario 1.4: Brevo Email Outbox received transactional email tasks',
      (rawOutbox || []).length > 0,
      `outboxCount=${rawOutbox?.length}`
    );

    // -------------------------------------------------------------
    // SCENARIO 2: RAW Claim & Completion -> Parallel Fork
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 2: RAW Claim & Completion -> Fork to Tradução & Clean/Redraw ---');

    // Pristam claims RAW stage
    const { error: claimRawErr } = await pristamClient.rpc('claim_scan_chapter_stage', {
      p_chapter_stage_id: rawStage.id
    });
    if (claimRawErr) throw new Error(`Pristam claim RAW error: ${claimRawErr.message}`);

    // Upload RAW deliverable
    await uploadMockDeliverable(rawStage, PRISTAM_ID, 'raw_pages.zip');

    // Pristam completes RAW stage
    const { error: completeRawErr } = await pristamClient.rpc('complete_scan_chapter_stage', {
      p_chapter_stage_id: rawStage.id,
      p_notes: 'RAW conferido com 40 páginas.'
    });
    if (completeRawErr) throw new Error(`Pristam complete RAW error: ${completeRawErr.message}`);

    const { data: stagesAfterRaw } = await admin
      .from('scan_chapter_stages')
      .select('*, stage:stage_id(slug, name)')
      .eq('production_chapter_id', testChapterId);

    const tradStage = stagesAfterRaw.find(s => s.stage?.slug === 'traducao');
    const cleanStage = stagesAfterRaw.find(s => s.stage?.slug === 'clean_redraw');
    const typeStage = stagesAfterRaw.find(s => s.stage?.slug === 'typeset');

    record(
      'Scenario 2.1: Tradução stage transitioned to AVAILABLE',
      tradStage?.status === 'AVAILABLE',
      `traducao.status=${tradStage?.status}`
    );
    record(
      'Scenario 2.2: Clean/Redraw stage transitioned to AVAILABLE',
      cleanStage?.status === 'AVAILABLE',
      `clean_redraw.status=${cleanStage?.status}`
    );
    record(
      'Scenario 2.3: Typeset stage remains BLOCKED (AND-join guard)',
      typeStage?.status === 'BLOCKED' || typeStage?.status === 'PENDING',
      `typeset.status=${typeStage?.status}`
    );

    const { data: forkNotifs } = await admin
      .from('notifications')
      .select('*')
      .eq('scan_id', SCAN_ID)
      .in('dedupe_key', [
        `pipeline_available:${SCAN_ID}:${testChapterId}:traducao:1:${SOUSA_ID}`,
        `pipeline_available:${SCAN_ID}:${testChapterId}:clean_redraw:1:${PRISTAM_ID}`
      ]);

    record(
      'Scenario 2.4: Fork notifications dispatched for Tradução and Clean/Redraw',
      (forkNotifs || []).length > 0,
      `forkNotifCount=${forkNotifs?.length}`
    );

    const { data: miakaTypeNotif } = await admin
      .from('notifications')
      .select('*')
      .eq('scan_id', SCAN_ID)
      .eq('user_id', MIAKA_ID)
      .like('dedupe_key', `pipeline_available:${SCAN_ID}:${testChapterId}:typeset:%`);

    record(
      'Scenario 2.5: Miaka (Typer) NOT notified while AND-join is incomplete',
      (miakaTypeNotif || []).length === 0,
      'Typeset blocked as expected'
    );

    // -------------------------------------------------------------
    // SCENARIO 3: Partial Parallel Completion (Tradução DONE, Clean still AVAILABLE)
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 3: Complete Tradução Only -> Typeset Still BLOCKED ---');

    await sousaClient.rpc('claim_scan_chapter_stage', { p_chapter_stage_id: tradStage.id });
    await uploadMockDeliverable(tradStage, SOUSA_ID, 'script.docx');
    await sousaClient.rpc('complete_scan_chapter_stage', { p_chapter_stage_id: tradStage.id });

    const { data: stagesAfterTrad } = await admin
      .from('scan_chapter_stages')
      .select('*, stage:stage_id(slug)')
      .eq('production_chapter_id', testChapterId);

    const typeStageAfterTrad = stagesAfterTrad.find(s => s.stage?.slug === 'typeset');
    record(
      'Scenario 3.1: Typeset is STILL BLOCKED after Tradução only',
      typeStageAfterTrad?.status === 'BLOCKED' || typeStageAfterTrad?.status === 'PENDING',
      `typeset.status=${typeStageAfterTrad?.status}`
    );

    // -------------------------------------------------------------
    // SCENARIO 4: Complete Second Parallel Stage -> Typeset Becomes AVAILABLE
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 4: Complete Clean/Redraw -> Typeset AVAILABLE & Typer Notified ---');

    await pristamClient.rpc('claim_scan_chapter_stage', { p_chapter_stage_id: cleanStage.id });
    await uploadMockDeliverable(cleanStage, PRISTAM_ID, 'cleaned_pages.zip');
    await pristamClient.rpc('complete_scan_chapter_stage', { p_chapter_stage_id: cleanStage.id });

    const { data: stagesAfterBoth } = await admin
      .from('scan_chapter_stages')
      .select('*, stage:stage_id(slug)')
      .eq('production_chapter_id', testChapterId);

    const typeStageAfterBoth = stagesAfterBoth.find(s => s.stage?.slug === 'typeset');
    record(
      'Scenario 4.1: Typeset transitions to AVAILABLE after BOTH dependencies DONE',
      typeStageAfterBoth?.status === 'AVAILABLE',
      `typeset.status=${typeStageAfterBoth?.status}`
    );

    const { data: miakaNotifs } = await admin
      .from('notifications')
      .select('*')
      .eq('scan_id', SCAN_ID)
      .eq('user_id', MIAKA_ID)
      .eq('dedupe_key', `pipeline_available:${SCAN_ID}:${testChapterId}:typeset:1:${MIAKA_ID}`);

    record(
      'Scenario 4.2: Miaka (Typer) receives Typeset notification with deterministic dedupe_key',
      (miakaNotifs || []).length === 1,
      `title="${miakaNotifs?.[0]?.title}"`
    );

    // -------------------------------------------------------------
    // SCENARIO 5: Typeset Completion with QC Reservation (Targeted)
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 5: Typeset Completion with QC Reservation ---');

    const qcStage = stagesAfterBoth.find(s => s.stage?.slug === 'revisor_qc');

    await admin
      .from('scan_chapter_stages')
      .update({ qc_assignee_id: OWNER_ID })
      .eq('id', qcStage.id);

    await miakaClient.rpc('claim_scan_chapter_stage', { p_chapter_stage_id: typeStageAfterBoth.id });
    await uploadMockDeliverable(typeStageAfterBoth, MIAKA_ID, 'typeset_final.zip');
    await miakaClient.rpc('complete_scan_chapter_stage', { p_chapter_stage_id: typeStageAfterBoth.id });

    const { data: qcStageUpdated } = await admin
      .from('scan_chapter_stages')
      .select('*')
      .eq('id', qcStage.id)
      .single();

    record(
      'Scenario 5.1: Revisor (QC) stage transitioned to AVAILABLE',
      qcStageUpdated?.status === 'AVAILABLE',
      `qc.status=${qcStageUpdated?.status}`
    );

    const { data: qcNotifs } = await admin
      .from('notifications')
      .select('*')
      .eq('scan_id', SCAN_ID)
      .like('dedupe_key', `pipeline_available:${SCAN_ID}:${testChapterId}:revisor_qc:1:%`);

    const qcNotifUsers = (qcNotifs || []).map(n => n.user_id);
    record(
      'Scenario 5.2: QC notification sent directly to reserved user (Owner)',
      qcNotifUsers.includes(OWNER_ID),
      `recipientCount=${qcNotifUsers.length}`
    );
    record(
      'Scenario 5.3: Other revisores (Sousa) did NOT receive generic broadcast when QC was reserved',
      !qcNotifUsers.includes(SOUSA_ID),
      'Targeted reservation verified'
    );

    // -------------------------------------------------------------
    // SCENARIO 6: QC Completion -> Pré Aprovado (Leadership Alert)
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 6: QC Completion -> Pré Aprovado Leadership Alert ---');

    await ownerClient.rpc('claim_scan_chapter_stage', { p_chapter_stage_id: qcStage.id });
    // QC doesn't require deliverable file
    await ownerClient.rpc('complete_scan_chapter_stage', {
      p_chapter_stage_id: qcStage.id,
      p_notes: 'Revisão textual aprovada.'
    });

    const { data: stagesPre } = await admin
      .from('scan_chapter_stages')
      .select('*, stage:stage_id(slug)')
      .eq('production_chapter_id', testChapterId);
    const preStage = (stagesPre || []).find(s => s.stage?.slug === 'pre_aprovado');

    record(
      'Scenario 6.1: Pré Aprovado stage transitioned to AVAILABLE',
      preStage?.status === 'AVAILABLE',
      `pre_aprovado.status=${preStage?.status}`
    );

    const { data: preNotifs } = await admin
      .from('notifications')
      .select('*')
      .eq('scan_id', SCAN_ID)
      .like('dedupe_key', `pipeline_available:${SCAN_ID}:${testChapterId}:pre_aprovado:1:%`);

    const preNotifUsers = (preNotifs || []).map(n => n.user_id);
    record(
      'Scenario 6.2: Pré Aprovado notification received by Scan Leadership (Owner)',
      preNotifUsers.includes(OWNER_ID),
      `recipients=${preNotifUsers.length}`
    );
    record(
      'Scenario 6.3: Regular Staff (Pristam, Miaka) did NOT receive leadership approval alert',
      !preNotifUsers.includes(PRISTAM_ID) && !preNotifUsers.includes(MIAKA_ID),
      'Leadership gating verified'
    );

    // -------------------------------------------------------------
    // SCENARIO 7: Devolução / Return to Queue (Version Bump v1 -> v2)
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 7: Devolução / Return to Queue (Version Bump) ---');

    const devChNum = Math.floor(88000 + Math.random() * 9000);
    await ownerClient.rpc('create_scan_production_chapter', {
      p_scan_id: SCAN_ID,
      p_work_id: WORK_ID,
      p_chapter_number: devChNum,
      p_chapter_label: 'Capítulo Teste Devolução e Retrabalho',
      p_chapter_type: 'NUMBER',
      p_template: 'MANHWA',
      p_priority: 'NORMAL',
      p_auto_claim: false
    });

    const { data: devChRow } = await admin
      .from('scan_production_chapters')
      .select('id')
      .eq('scan_id', SCAN_ID)
      .eq('work_id', WORK_ID)
      .eq('chapter_number', devChNum)
      .single();
    devChId = devChRow?.id;

    const { data: devStagesInit } = await admin
      .from('scan_chapter_stages')
      .select('*, stage:stage_id(slug)')
      .eq('production_chapter_id', devChId);
    const devRawStage = (devStagesInit || []).find(s => s.stage?.slug === 'raw');

    // Pristam claims RAW stage
    await pristamClient.rpc('claim_scan_chapter_stage', { p_chapter_stage_id: devRawStage.id });

    // Pristam returns stage to queue
    const { error: releaseErr } = await pristamClient.rpc('release_scan_chapter_stage', {
      p_chapter_stage_id: devRawStage.id,
      p_reason: 'Precisei me ausentar por motivos de saúde'
    });

    if (releaseErr) throw new Error(`release_scan_chapter_stage error: ${releaseErr.message}`);

    const { data: releasedStage } = await admin
      .from('scan_chapter_stages')
      .select('*')
      .eq('id', devRawStage.id)
      .single();

    record(
      'Scenario 7.1: release_scan_chapter_stage increments availability_version to 2',
      releasedStage?.availability_version === 2,
      `version=${releasedStage?.availability_version}`
    );
    record(
      'Scenario 7.2: availability_reason set to returned_to_queue',
      releasedStage?.availability_reason === 'returned_to_queue',
      `reason=${releasedStage?.availability_reason}`
    );

    const { data: v2Notifs } = await admin
      .from('notifications')
      .select('*')
      .eq('scan_id', SCAN_ID)
      .like('dedupe_key', `pipeline_available:${SCAN_ID}:${devChId}:raw:2:%`);

    record(
      'Scenario 7.3: Broadcast notification for v2 emitted with "voltou para a fila"',
      (v2Notifs || []).length > 0 && v2Notifs[0].title.includes('voltou para a fila'),
      `title="${v2Notifs?.[0]?.title}"`
    );

    // -------------------------------------------------------------
    // SCENARIO 8: Legitimate Rework (Version Bump v2 -> v3)
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 8: Legitimate Rework Return (Version Bump v3) ---');

    await pristamClient.rpc('claim_scan_chapter_stage', { p_chapter_stage_id: devRawStage.id });
    await uploadMockDeliverable(devRawStage, PRISTAM_ID, 'raw_v2.zip');
    await pristamClient.rpc('complete_scan_chapter_stage', { p_chapter_stage_id: devRawStage.id });

    const { data: devStages } = await admin
      .from('scan_chapter_stages')
      .select('*, stage:stage_id(slug)')
      .eq('production_chapter_id', devChId);
    const devCleanStage = (devStages || []).find(s => s.stage?.slug === 'clean_redraw');

    await pristamClient.rpc('claim_scan_chapter_stage', { p_chapter_stage_id: devCleanStage.id });

    const { error: returnErr } = await pristamClient.rpc('return_scan_chapter_stage', {
      p_source_stage_id: devCleanStage.id,
      p_target_stage_slug: 'raw',
      p_reason: 'Páginas 12 e 14 vieram corrompidas no RAW original'
    });

    if (returnErr) throw new Error(`return_scan_chapter_stage error: ${returnErr.message}`);

    const { data: reworkRawStage } = await admin
      .from('scan_chapter_stages')
      .select('*')
      .eq('id', devRawStage.id)
      .single();

    record(
      'Scenario 8.1: return_scan_chapter_stage increments availability_version to 3',
      reworkRawStage?.availability_version === 3,
      `version=${reworkRawStage?.availability_version}`
    );
    record(
      'Scenario 8.2: availability_reason set to rework and status to REWORK',
      reworkRawStage?.availability_reason === 'rework' && reworkRawStage?.status === 'REWORK',
      `reason=${reworkRawStage?.availability_reason}, status=${reworkRawStage?.status}`
    );

    const { data: v3Notifs } = await admin
      .from('notifications')
      .select('*')
      .eq('scan_id', SCAN_ID)
      .like('dedupe_key', `pipeline_available:${SCAN_ID}:${devChId}:raw:3:%`);

    record(
      'Scenario 8.3: Rework notification emitted with "em retrabalho"',
      (v3Notifs || []).length > 0 && v3Notifs[0].title.includes('retrabalho'),
      `title="${v3Notifs?.[0]?.title}"`
    );

    // -------------------------------------------------------------
    // SCENARIO 9: Idempotency & Duplicate Protection
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 9: Idempotency & Dedupe Verification ---');

    await pristamClient.rpc('release_scan_chapter_stage', {
      p_chapter_stage_id: devRawStage.id,
      p_reason: 'Double click release'
    });

    const { data: idempStageCheck } = await admin
      .from('scan_chapter_stages')
      .select('availability_version')
      .eq('id', devRawStage.id)
      .single();

    record(
      'Scenario 9.1: Double release call is idempotent (no extra version bump)',
      idempStageCheck?.availability_version === 3,
      `version=${idempStageCheck?.availability_version}`
    );

    const countBefore = (await admin.from('notifications').select('*', { count: 'exact', head: true })).count;
    await admin.rpc('dispatch_pipeline_stage_availability_notification', {
      p_chapter_stage_id: devRawStage.id
    });
    const countAfter = (await admin.from('notifications').select('*', { count: 'exact', head: true })).count;

    record(
      'Scenario 9.2: dispatch_pipeline_stage_availability_notification is idempotent with dedupe_key',
      countBefore === countAfter,
      `before=${countBefore}, after=${countAfter}`
    );

    // -------------------------------------------------------------
    // SCENARIO 10: Seen State RPC & Persistence
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 10: Seen State RPC (mark_pipeline_stage_seen) ---');

    const { data: seenData, error: seenErr } = await pristamClient.rpc('mark_pipeline_stage_seen', {
      p_chapter_stage_id: devRawStage.id
    });

    if (seenErr) throw new Error(`mark_pipeline_stage_seen error: ${seenErr.message}`);

    const { data: seenRow } = await admin
      .from('scan_pipeline_stage_seen')
      .select('*')
      .eq('user_id', PRISTAM_ID)
      .eq('chapter_stage_id', devRawStage.id)
      .eq('availability_version', 3)
      .single();

    record(
      'Scenario 10.1: Row inserted into scan_pipeline_stage_seen for (user, stage, version)',
      Boolean(seenRow?.id),
      `seen_id=${seenRow?.id}, version=${seenRow?.availability_version}`
    );

    const { data: secondSeenData, error: secondSeenErr } = await pristamClient.rpc('mark_pipeline_stage_seen', {
      p_chapter_stage_id: devRawStage.id
    });

    record(
      'Scenario 10.2: Re-calling mark_pipeline_stage_seen is idempotent and succeeds',
      secondSeenData?.success === true && !secondSeenErr,
      'Idempotent RPC verified'
    );

    // Cleanup
    console.log('\n--- CLEANING UP TEST CHAPTERS ---');
    if (testChapterId) {
      await admin.from('scan_production_chapters').delete().eq('id', testChapterId);
    }
    if (devChId) {
      await admin.from('scan_production_chapters').delete().eq('id', devChId);
    }
    console.log('✓ Cleaned up test chapters');

  } catch (err) {
    console.error('Fatal error during verification:', err);
    record('Fatal Execution Error', false, err.message);
  }

  console.log('\n======================================================');
  console.log('📊 VERIFICATION RESULTS SUMMARY:');
  console.log('======================================================');
  let passCount = 0;
  for (const r of results) {
    if (r.passed) passCount++;
    console.log(`${r.passed ? '✅' : '❌'} ${r.testName}`);
  }
  console.log(`\nTotal: ${passCount} / ${results.length} PASSED`);
  if (passCount === results.length) {
    console.log('🎉 ALL BACKEND & DAG SCENARIOS PASSED WITH 100% ACCURACY!\n');
  } else {
    console.error('⚠️ SOME TESTS FAILED. Check log output above.\n');
  }
}

runVerification();
