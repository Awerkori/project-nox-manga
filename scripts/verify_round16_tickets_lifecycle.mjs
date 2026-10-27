import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { getOwnerClient } from './owner-session.mjs';

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

// Load env files
for (const envPath of ['.dev.vars.preview_full', '.dev.vars.deploy', '.env']) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const l of lines) {
      const idx = l.indexOf('=');
      if (idx !== -1) {
        const k = l.slice(0, idx).trim();
        const v = l.slice(idx + 1).trim();
        if (!process.env[k] && v) process.env[k] = v;
      }
    }
  }
}

async function run() {
  console.log('=== STARTING ROUND 16 COMPREHENSIVE VERIFICATION ===');
  console.log('Target URL:', PREVIEW_URL);

  const testReport = {
    timestamp: new Date().toISOString(),
    tests: {},
    summary: { passed: 0, failed: 0 }
  };

  const record = (name, passed, details) => {
    testReport.tests[name] = { passed, details };
    if (passed) {
      testReport.summary.passed++;
      console.log(`[PASS] ${name}`);
    } else {
      testReport.summary.failed++;
      console.error(`[FAIL] ${name}:`, details);
    }
  };

  const { client, adminClient, cookies: ownerCookiesList, user: ownerUser } = await getOwnerClient(PREVIEW_URL);
  console.log('Owner authenticated:', ownerUser.email, `(${ownerUser.id})`);

  const getData = (res) => (Array.isArray(res?.data) ? res.data[0] : res?.data);

  // Ensure an existing chapter and work exist for test data
  const chapterRes = await adminClient
    .from('chapters')
    .select('id, work_id, number')
    .limit(1);
  const testChapter = getData(chapterRes);

  const workRes = await adminClient
    .from('works')
    .select('id, title, slug')
    .eq('id', testChapter.work_id)
    .limit(1);
  const testWork = getData(workRes);

  // Create a test comment for moderation
  const commentRes = await adminClient
    .from('comments')
    .insert({
      work_id: testWork.id,
      user_id: ownerUser.id,
      body: '[TEST_R16] Comentário de teste para validação de moderação e exclusão.',
      removed: false
    })
    .select();
  const testComment = getData(commentRes);

  console.log(`Baseline setup: work=${testWork?.slug}, chapter=${testChapter?.id}, comment=${testComment?.id}`);

  // -------------------------------------------------------------
  // TEST SUITE 1: REAL TICKET DELETION (ELIMINATING HTTP 500)
  // -------------------------------------------------------------
  console.log('\n--- 1. TESTING TICKET DELETION (NO HTTP 500, MODAL "EXCLUIR", SOFT-DELETE) ---');

  const runId = Date.now();
  const delReportTag = `[TEST_R16_DEL_REPORT_${runId}]`;
  const delScanTag = `[TEST_R16_DEL_SCAN_${runId}]`;
  const delModTag = `[TEST_R16_DEL_MOD_${runId}]`;
  const flowReportTag = `[TEST_R16_FLOW_REP_${runId}]`;
  const flowScanTag = `[TEST_R16_FLOW_SCAN_${runId}]`;
  const flowModTag = `[TEST_R16_FLOW_MOD_${runId}]`;

  // Seed 3 tickets for deletion
  const delReportSeed = getData(await adminClient
    .from('reports')
    .insert({
      reporter_id: ownerUser.id,
      target_type: 'CHAPTER',
      chapter_id: testChapter.id,
      work_id: testWork.id,
      reason: 'Páginas em branco',
      details: `${delReportTag} Teste de exclusão de relatório de conteúdo.`,
      status: 'NOVO'
    })
    .select());

  const delScanSeed = getData(await adminClient
    .from('scan_partner_requests')
    .insert({
      user_id: ownerUser.id,
      scan_name: `${delScanTag} Scan Deletion Test`,
      scan_slug: `del-scan-${runId}`,
      description: 'Scan criada exclusivamente para teste de exclusão.',
      status: 'PENDING'
    })
    .select());

  const delModSeed = getData(await adminClient
    .from('reports')
    .insert({
      reporter_id: ownerUser.id,
      target_type: 'COMMENT',
      comment_id: testComment.id,
      work_id: testWork.id,
      reason: 'Spam ou Conteúdo Irrelevante',
      details: `${delModTag} Teste de exclusão de moderação.`,
      status: 'NOVO'
    })
    .select());

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await context.addCookies([
    { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL },
    ...ownerCookiesList
  ]);
  const page = await context.newPage();

  // Test 1.1: Content Report Deletion
  try {
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=relatorios&status=NOVO`, { waitUntil: 'networkidle', timeout: 30000 });

    const card = page.locator('article.report-ticket-card', { hasText: delReportTag });
    await card.waitFor({ state: 'visible', timeout: 10000 });

    // Click Excluir Ticket
    const delBtn = card.locator('button.btn-ticket-delete');
    await delBtn.click();

    // Verify modal appears
    const modal = page.locator('.delete-dialog');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'r16_delete_modal_opened.png') });

    // Type EXCLUIR and submit
    const input = modal.locator('.confirm-input');
    await input.fill('EXCLUIR');

    // Intercept response to ensure 200 OK (not 500!)
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('?/deleteTicket')),
      modal.locator('button[type="submit"]').click()
    ]);

    const resStatus = response.status();
    const resText = await response.text();
    console.log('Delete Response Status:', resStatus, 'Body preview:', resText.slice(0, 100));

    if (resStatus !== 200) {
      throw new Error(`Delete action returned HTTP ${resStatus}: ${resText}`);
    }

    // Modal should close and feedback show
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
    await card.waitFor({ state: 'hidden', timeout: 5000 });

    // Reload page to verify persistence
    await page.reload({ waitUntil: 'networkidle' });
    const cardAfterReload = page.locator('article.report-ticket-card', { hasText: delReportTag });
    const countAfterReload = await cardAfterReload.count();

    // Check Postgres
    const { data: dbCheck } = await adminClient
      .from('reports')
      .select('deleted_at, deleted_by')
      .eq('id', delReportSeed.id)
      .single();

    const { data: auditCheck } = await adminClient
      .from('audit_log')
      .select('id, action, target_id')
      .eq('action', 'ticket_delete')
      .eq('target_id', delReportSeed.id)
      .maybeSingle();

    const passed = countAfterReload === 0 && dbCheck?.deleted_at && auditCheck?.id;
    record('exclusao_real_relatorios', passed, {
      httpStatus: resStatus,
      uiDisappeared: countAfterReload === 0,
      deleted_at: dbCheck?.deleted_at,
      auditLogCreated: Boolean(auditCheck?.id)
    });
  } catch (err) {
    record('exclusao_real_relatorios', false, { error: err.message });
  }

  // Test 1.2: Scan Application Deletion
  try {
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=scans&status=PENDING`, { waitUntil: 'networkidle', timeout: 30000 });

    const card = page.locator('article.partner-card', { hasText: delScanTag });
    await card.waitFor({ state: 'visible', timeout: 10000 });

    const delBtn = card.locator('button.btn-ticket-delete');
    await delBtn.click();

    const modal = page.locator('.delete-dialog');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    await modal.locator('.confirm-input').fill('EXCLUIR');

    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('?/deleteTicket')),
      modal.locator('button[type="submit"]').click()
    ]);

    const resStatus = response.status();
    if (resStatus !== 200) throw new Error(`HTTP ${resStatus}`);

    await modal.waitFor({ state: 'hidden', timeout: 5000 });
    await card.waitFor({ state: 'hidden', timeout: 5000 });

    await page.reload({ waitUntil: 'networkidle' });
    const cardAfterReload = page.locator('article.partner-card', { hasText: delScanTag });
    const countAfter = await cardAfterReload.count();

    const { data: dbCheck } = await adminClient
      .from('scan_partner_requests')
      .select('deleted_at, deleted_by')
      .eq('id', delScanSeed.id)
      .single();

    const passed = countAfter === 0 && Boolean(dbCheck?.deleted_at);
    record('exclusao_real_scans', passed, {
      httpStatus: resStatus,
      uiDisappeared: countAfter === 0,
      deleted_at: dbCheck?.deleted_at
    });
  } catch (err) {
    record('exclusao_real_scans', false, { error: err.message });
  }

  // Test 1.3: Moderation Ticket Deletion
  try {
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=moderacao&status=NOVO`, { waitUntil: 'networkidle', timeout: 30000 });

    const card = page.locator('article.mod-sentinel-card', { hasText: delModTag });
    await card.waitFor({ state: 'visible', timeout: 10000 });

    const delBtn = card.locator('button.btn-ticket-delete');
    await delBtn.click();

    const modal = page.locator('.delete-dialog');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    await modal.locator('.confirm-input').fill('EXCLUIR');

    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('?/deleteTicket')),
      modal.locator('button[type="submit"]').click()
    ]);

    const resStatus = response.status();
    if (resStatus !== 200) throw new Error(`HTTP ${resStatus}`);

    await modal.waitFor({ state: 'hidden', timeout: 5000 });
    await card.waitFor({ state: 'hidden', timeout: 5000 });

    await page.reload({ waitUntil: 'networkidle' });
    const cardAfterReload = page.locator('article.mod-sentinel-card', { hasText: delModTag });
    const countAfter = await cardAfterReload.count();

    const { data: dbCheck } = await adminClient
      .from('reports')
      .select('deleted_at, deleted_by')
      .eq('id', delModSeed.id)
      .single();

    const passed = countAfter === 0 && Boolean(dbCheck?.deleted_at);
    record('exclusao_real_moderacao', passed, {
      httpStatus: resStatus,
      uiDisappeared: countAfter === 0,
      deleted_at: dbCheck?.deleted_at
    });
  } catch (err) {
    record('exclusao_real_moderacao', false, { error: err.message });
  }

  // Test 1.4: Non-destructive verification (underlying work, chapter, comment intact)
  try {
    const { data: w } = await adminClient.from('works').select('id').eq('id', testWork.id).single();
    const { data: ch } = await adminClient.from('chapters').select('id').eq('id', testChapter.id).single();
    const { data: com } = await adminClient.from('comments').select('id').eq('id', testComment.id).single();
    const passed = Boolean(w?.id && ch?.id && com?.id);
    record('exclusao_garantia_nao_destrutiva', passed, {
      workIntact: Boolean(w?.id),
      chapterIntact: Boolean(ch?.id),
      commentIntact: Boolean(com?.id)
    });
  } catch (err) {
    record('exclusao_garantia_nao_destrutiva', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // TEST SUITE 2: MANDATORY WORKFLOW (CLAIM BEFORE VERDICT)
  // -------------------------------------------------------------
  console.log('\n--- 2. TESTING MANDATORY WORKFLOW (CLAIM BEFORE VERDICT) ---');

  // Seed fresh tickets for lifecycle testing
  const flowReportSeed = getData(await adminClient
    .from('reports')
    .insert({
      reporter_id: ownerUser.id,
      target_type: 'CHAPTER',
      chapter_id: testChapter.id,
      work_id: testWork.id,
      reason: 'Erro de Tradução',
      details: `${flowReportTag} Validação de fluxo obrigatório.`,
      status: 'NOVO',
      assigned_to: null
    })
    .select());

  const flowScanSeed = getData(await adminClient
    .from('scan_partner_requests')
    .insert({
      user_id: ownerUser.id,
      scan_name: `${flowScanTag} Scan Flow Test`,
      scan_slug: `flow-scan-${runId}`,
      description: 'Scan para teste de fluxo obrigatório de avaliação.',
      status: 'PENDING',
      assigned_to: null
    })
    .select());

  const flowModSeed = getData(await adminClient
    .from('reports')
    .insert({
      reporter_id: ownerUser.id,
      target_type: 'COMMENT',
      comment_id: testComment.id,
      work_id: testWork.id,
      reason: 'Ofensa ou Agressão',
      details: `${flowModTag} Validação de fluxo moderação.`,
      status: 'NOVO',
      assigned_to: null
    })
    .select());

  // Test 2.1: Relatórios Mandatory Workflow
  try {
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=relatorios&status=NOVO`, { waitUntil: 'networkidle', timeout: 30000 });

    const card = page.locator('article.report-ticket-card', { hasText: flowReportTag });
    await card.waitFor({ state: 'visible', timeout: 10000 });

    // Step A: In unassigned state, primary button MUST be "Assumir Atendimento"
    const claimBtn = card.locator('button.btn-primary-claim');
    const claimBtnVisible = await claimBtn.isVisible();
    const claimBtnText = await claimBtn.innerText();

    // Verdict buttons MUST NOT exist in unassigned state!
    const verdictSuccess = card.locator('.btn-verdict-success');
    const verdictDanger = card.locator('.btn-verdict-danger');
    const prematureVerdictVisible = (await verdictSuccess.isVisible().catch(() => false)) || (await verdictDanger.isVisible().catch(() => false));

    // Attempt direct server action verdict without claiming (should return 400)
    const directVerdictRes = await page.evaluate(async (id) => {
      const fd = new FormData();
      fd.append('reportId', id);
      fd.append('status', 'RESOLVIDO');
      const res = await fetch('?/updateReportStatus', { method: 'POST', body: fd });
      return { status: res.status, text: await res.text() };
    }, flowReportSeed.id);

    console.log('Unassigned direct verdict response:', directVerdictRes.status, directVerdictRes.text.slice(0, 80));
    const directVerdictBlocked = directVerdictRes.status === 400 || directVerdictRes.text.includes('assumir este ticket');

    // Step B: Now claim the ticket via UI
    await claimBtn.click();
    await page.waitForTimeout(1500);

    // Verify card moves from NOVO to EM_ANALISE
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=relatorios&status=EM_ANALISE`, { waitUntil: 'networkidle', timeout: 30000 });
    const inReviewCard = page.locator('article.report-ticket-card', { hasText: flowReportTag });
    await inReviewCard.waitFor({ state: 'visible', timeout: 10000 });

    const operatorPill = inReviewCard.locator('.active-operator-pill');
    await operatorPill.waitFor({ state: 'visible', timeout: 5000 });
    const operatorText = await operatorPill.innerText();

    // Now verdict buttons MUST be visible in EM_ANALISE
    const reviewVerdictSuccess = inReviewCard.locator('.btn-verdict-success');
    const reviewVerdictDanger = inReviewCard.locator('.btn-verdict-danger');
    await reviewVerdictSuccess.waitFor({ state: 'visible', timeout: 5000 });
    await reviewVerdictDanger.waitFor({ state: 'visible', timeout: 5000 });

    // Step C: Test "Liberar"
    const releaseBtn = inReviewCard.locator('.btn-release-subtle');
    await releaseBtn.click();
    await page.waitForTimeout(1500);

    // After release, navigate back to NOVO: ticket must have returned to NOVO
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=relatorios&status=NOVO`, { waitUntil: 'networkidle', timeout: 30000 });
    const returnedCard = page.locator('article.report-ticket-card', { hasText: flowReportTag });
    await returnedCard.waitFor({ state: 'visible', timeout: 10000 });
    const returnedClaimBtn = returnedCard.locator('button.btn-primary-claim');
    await returnedClaimBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Step D: Re-claim and issue final verdict
    await returnedClaimBtn.click();
    await page.waitForTimeout(1500);

    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=relatorios&status=EM_ANALISE`, { waitUntil: 'networkidle', timeout: 30000 });
    const finalCard = page.locator('article.report-ticket-card', { hasText: flowReportTag });
    await finalCard.waitFor({ state: 'visible', timeout: 10000 });

    const finalVerdictBtn = finalCard.locator('.btn-verdict-success');
    await finalVerdictBtn.click();

    // Fill resolve modal
    const resModal = page.locator('.modal-dialog', { hasText: 'Resolver Relatório' });
    await resModal.waitFor({ state: 'visible', timeout: 5000 });
    await resModal.locator('textarea').fill('Defeito corrigido com sucesso pela equipe.');
    await resModal.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    // Check DB status
    const { data: resolvedDb } = await adminClient
      .from('reports')
      .select('status, resolved_at, resolved_by')
      .eq('id', flowReportSeed.id)
      .single();

    const passed = claimBtnVisible && !prematureVerdictVisible && directVerdictBlocked && resolvedDb?.status === 'RESOLVIDO';
    record('fluxo_obrigatorio_relatorios', passed, {
      claimBtnVisible,
      claimBtnText,
      prematureVerdictVisible,
      directVerdictBlocked,
      resolvedStatus: resolvedDb?.status,
      resolved_by: resolvedDb?.resolved_by
    });
  } catch (err) {
    record('fluxo_obrigatorio_relatorios', false, { error: err.message });
  }

  // Test 2.2: Scans Mandatory Workflow
  try {
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=scans&status=PENDING`, { waitUntil: 'networkidle', timeout: 30000 });

    const card = page.locator('article.partner-card', { hasText: flowScanTag });
    await card.waitFor({ state: 'visible', timeout: 10000 });

    // Step A: In unassigned pending state, button must be "Assumir Avaliação"
    const claimBtn = card.locator('button.btn-primary-claim');
    const claimBtnVisible = await claimBtn.isVisible();

    // In preview modal, footer button MUST be "Assumir Avaliação", NOT "Aprovar Scan"
    const previewBtn = card.locator('button.btn-context-link', { hasText: 'Pré-Visualizar Página' });
    await previewBtn.click();

    const previewModal = page.locator('.preview-dialog');
    await previewModal.waitFor({ state: 'visible', timeout: 5000 });

    const modalClaimBtn = previewModal.locator('.btn-primary-claim');
    const modalClaimVisible = await modalClaimBtn.isVisible();
    const modalApproveBtn = previewModal.locator('.btn-action-success', { hasText: 'Aprovar Scan' });
    const modalApproveVisible = await modalApproveBtn.isVisible().catch(() => false);

    // Close preview modal
    await previewModal.locator('button.btn-close').click();
    await previewModal.waitFor({ state: 'hidden', timeout: 3000 });

    // Step B: Direct verdict call without claim must be rejected by backend
    const directVerdictRes = await page.evaluate(async (id) => {
      const fd = new FormData();
      fd.append('request_id', id);
      fd.append('action', 'APPROVE');
      const res = await fetch('?/reviewScanPartner', { method: 'POST', body: fd });
      return { status: res.status, text: await res.text() };
    }, flowScanSeed.id);

    console.log('Unassigned scan approve response:', directVerdictRes.status, directVerdictRes.text.slice(0, 80));
    const scanVerdictBlocked = directVerdictRes.status === 400 || directVerdictRes.text.includes('assumir esta candidatura');

    // Step C: Claim the scan application
    await claimBtn.click();
    await page.waitForTimeout(1500);

    // Navigate to Em Análise tab or verify active operator pill
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=scans&status=EM_ANALISE`, { waitUntil: 'networkidle', timeout: 30000 });
    const inReviewCard = page.locator('article.partner-card', { hasText: flowScanTag });
    await inReviewCard.waitFor({ state: 'visible', timeout: 10000 });

    const operatorPill = inReviewCard.locator('.active-operator-pill');
    const operatorPillVisible = await operatorPill.isVisible();

    // Now open preview modal and verify "Aprovar Scan" is available
    await inReviewCard.locator('button.btn-context-link').click();
    await previewModal.waitFor({ state: 'visible', timeout: 5000 });

    const approveInModal = previewModal.locator('button.btn-action-success', { hasText: 'Aprovar Scan' });
    const approveAvailable = await approveInModal.isVisible();

    // Approve scan
    page.once('dialog', d => d.accept());
    await approveInModal.click();
    await page.waitForTimeout(2000);

    // Check DB status
    const approvedDb = getData(await adminClient
      .from('scan_partner_requests')
      .select('status, reviewed_at, reviewed_by')
      .eq('id', flowScanSeed.id));

    const passed = claimBtnVisible && modalClaimVisible && !modalApproveVisible && scanVerdictBlocked && operatorPillVisible && approveAvailable && approvedDb?.status === 'APPROVED';
    record('fluxo_obrigatorio_scans', passed, {
      claimBtnVisible,
      modalClaimVisible,
      modalApproveVisible,
      scanVerdictBlocked,
      operatorPillVisible,
      approveAvailable,
      approvedStatus: approvedDb?.status
    });
  } catch (err) {
    record('fluxo_obrigatorio_scans', false, { error: err.message });
  }

  // Test 2.3: Moderation Mandatory Workflow
  try {
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=moderacao&status=NOVO`, { waitUntil: 'networkidle', timeout: 30000 });

    const card = page.locator('article.mod-sentinel-card', { hasText: flowModTag });
    await card.waitFor({ state: 'visible', timeout: 10000 });

    // Step A: Primary button is "Assumir Moderação"
    const claimBtn = card.locator('button.btn-primary-claim');
    const claimBtnVisible = await claimBtn.isVisible();

    // Comment mutation buttons must NOT exist in unassigned card
    const hideBtn = card.locator('.btn-mod-action.btn-hide');
    const deleteBtn = card.locator('.btn-mod-action.btn-delete');
    const prematureActionsVisible = (await hideBtn.isVisible().catch(() => false)) || (await deleteBtn.isVisible().catch(() => false));

    // Direct moderation action without claim must be rejected with 400
    const directModRes = await page.evaluate(async (args) => {
      const fd = new FormData();
      fd.append('action', 'hide');
      fd.append('report_id', args.repId);
      fd.append('comment_id', args.comId);
      const res = await fetch('?/moderateComment', { method: 'POST', body: fd });
      return { status: res.status, text: await res.text() };
    }, { repId: flowModSeed.id, comId: testComment.id });

    console.log('Unassigned moderation direct response:', directModRes.status, directModRes.text.slice(0, 80));
    const modBlocked = directModRes.status === 400 || directModRes.text.includes('assumir esta denúncia');

    // Step B: Claim ticket
    await claimBtn.click();
    await page.waitForTimeout(1500);

    // Navigate to Em Análise tab
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=moderacao&status=EM_ANALISE`, { waitUntil: 'networkidle', timeout: 30000 });
    const inReviewModCard = page.locator('article.mod-sentinel-card', { hasText: flowModTag });
    await inReviewModCard.waitFor({ state: 'visible', timeout: 10000 });

    // Operator pill and comment mutation buttons must now be available
    const operatorPill = inReviewModCard.locator('.active-operator-pill');
    await operatorPill.waitFor({ state: 'visible', timeout: 5000 });
    const reviewHideBtn = inReviewModCard.locator('.btn-mod-action.btn-hide');
    await reviewHideBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Perform Hide action
    await reviewHideBtn.click();
    await page.waitForTimeout(2000);

    // Verify comment is marked as hidden in DB and report is marked as RESOLVIDO
    const modDb = getData(await adminClient
      .from('reports')
      .select('status, resolved_at, resolved_by')
      .eq('id', flowModSeed.id));

    const comDb = getData(await adminClient
      .from('comments')
      .select('removed')
      .eq('id', testComment.id));

    const passed = claimBtnVisible && !prematureActionsVisible && modBlocked && (modDb?.status === 'RESOLVIDO' || modDb?.status === 'REJEITADO') && comDb?.removed;
    record('fluxo_obrigatorio_moderacao', passed, {
      claimBtnVisible,
      prematureActionsVisible,
      modBlocked,
      resolvedStatus: modDb?.status,
      commentRemoved: comDb?.removed
    });
  } catch (err) {
    record('fluxo_obrigatorio_moderacao', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // TEST SUITE 3: MOBILE REFINEMENT & MENU DRAWER
  // -------------------------------------------------------------
  console.log('\n--- 3. TESTING MOBILE REFINEMENT (DRAWER TOGGLE WITH "MENU", AUTO-CLOSE) ---');

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true
  });
  await mobileContext.addCookies([
    { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL },
    ...ownerCookiesList
  ]);
  const mobilePage = await mobileContext.newPage();

  try {
    await mobilePage.goto(`${PREVIEW_URL}/admin/tickets`, { waitUntil: 'networkidle', timeout: 30000 });

    const toggleBtn = mobilePage.locator('.mobile-drawer-toggle');
    await toggleBtn.waitFor({ state: 'visible', timeout: 10000 });

    const box = await toggleBtn.boundingBox();
    const btnTextInitial = await toggleBtn.innerText();
    console.log('Mobile menu button text initial:', btnTextInitial, 'Box:', box);

    const hasMenuLabel = btnTextInitial.includes('MENU') || btnTextInitial.includes('Menu');
    const touchTargetComfortable = box && box.height >= 36 && box.width >= 40;

    // Click toggle -> drawer opens -> text changes to FECHAR
    await toggleBtn.click();
    await mobilePage.waitForTimeout(600);

    const btnTextOpen = await toggleBtn.innerText();
    console.log('Mobile menu button text open:', btnTextOpen);
    const hasFecharLabel = btnTextOpen.includes('FECHAR') || btnTextOpen.includes('Fechar');

    await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'r16_mobile_drawer_open.png') });

    // Click navigation item inside drawer -> should navigate and auto-close via afterNavigate
    const navItem = mobilePage.locator('.admin-sidebar.open a.nav-link', { hasText: 'Início' });
    await Promise.all([
      mobilePage.waitForURL(url => url.pathname === '/admin', { timeout: 10000 }),
      navItem.click()
    ]);
    await mobilePage.waitForTimeout(1000);

    const drawerVisible = await mobilePage.locator('.admin-sidebar.open').isVisible().catch(() => false);
    const currentUrl = mobilePage.url();

    await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'r16_mobile_drawer_navigated.png') });

    const passed = hasMenuLabel && hasFecharLabel && touchTargetComfortable && !drawerVisible && currentUrl.endsWith('/admin');
    record('mobile_refinamento_menu', passed, {
      hasMenuLabel,
      hasFecharLabel,
      box,
      touchTargetComfortable,
      drawerAutoClosed: !drawerVisible,
      navigatedUrl: currentUrl
    });
  } catch (err) {
    record('mobile_refinamento_menu', false, { error: err.message });
  }

  // Capture final overview screenshots
  await page.goto(`${PREVIEW_URL}/admin/tickets?tab=relatorios&status=ALL`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'r16_desktop_relatorios_overview.png'), fullPage: true });

  await page.goto(`${PREVIEW_URL}/admin/tickets?tab=scans&status=ALL`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'r16_desktop_scans_overview.png'), fullPage: true });

  await page.goto(`${PREVIEW_URL}/admin/tickets?tab=moderacao&status=ALL`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'r16_desktop_moderacao_overview.png'), fullPage: true });

  // AUTOMATIC TEARDOWN / CLEANUP: Purge any temporary test scans, requests, reports, comments
  try {
    console.log('\n--- CLEANING UP TEMPORARY TEST DATA ---');
    // Find any scan created with flow-scan-runId or flowScanTag
    const { data: testScans } = await adminClient
      .from('scans')
      .select('id, name')
      .ilike('name', `%${flowScanTag}%`);
    if (testScans && testScans.length > 0) {
      for (const ts of testScans) {
        await client.rpc('global_admin_hard_delete_scan', {
          p_scan_id: ts.id,
          p_reason: 'Automated test suite cleanup',
          p_confirmation: ts.name
        });
        console.log(`Cleaned up test scan: ${ts.name} (${ts.id})`);
      }
    }
    // Clean up test requests
    await adminClient
      .from('scan_partner_requests')
      .delete()
      .or(`scan_slug.ilike.%${runId}%,scan_name.ilike.%TEST_R16%`);
    // Clean up test reports
    await adminClient
      .from('reports')
      .delete()
      .or(`details.ilike.%${runId}%,details.ilike.%TEST_R16%`);
    // Clean up test comment
    if (testComment?.id) {
      await adminClient.from('comments').delete().eq('id', testComment.id);
    }
    console.log('Automated cleanup completed.');
  } catch (cleanErr) {
    console.warn('Non-fatal cleanup warning:', cleanErr.message);
  }

  await browser.close();

  // Write json report
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'round16_verification_report.json'),
    JSON.stringify(testReport, null, 2),
    'utf8'
  );

  console.log('\n=== ROUND 16 VERIFICATION FINISHED ===');
  console.log(`Passed: ${testReport.summary.passed} / ${testReport.summary.passed + testReport.summary.failed}`);
  console.log('Report saved to:', path.join(ARTIFACT_DIR, 'round16_verification_report.json'));
}

run().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
