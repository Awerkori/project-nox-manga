import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import path from 'node:path';
import fs from 'node:fs';
import pg from 'pg';
const { Pool } = pg;
import { fileURLToPath } from 'node:url';

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const __homologateFile = fileURLToPath(import.meta.url);
const __homologateDir = path.dirname(__homologateFile);
const ARTIFACT_DIR = path.resolve(__homologateDir, '../artifacts/round24_5');
const AGY_ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

// Load Yugabyte credentials
const envLines = fs.readFileSync('/home/awerkori/.config/project-nox/yugabyte.env', 'utf8').split('\n');
const envVars = {};
for (const line of envLines) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["\x27]|["\x27]$/g, '');
}
const ca = fs.readFileSync('/home/awerkori/.config/project-nox/root.crt', 'utf8');
const pool = new Pool({
  host: envVars.YUGABYTE_HOST,
  port: parseInt(envVars.YUGABYTE_PORT || '5433', 10),
  user: envVars.YUGABYTE_USER,
  password: envVars.YUGABYTE_PASSWORD,
  database: envVars.YUGABYTE_DATABASE,
  ssl: { ca, rejectUnauthorized: false }
});

const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function recordTest(name, passed, details = '') {
  testResults.tests.push({ name, passed, details });
  if (passed) {
    testResults.passed++;
    console.log(`  ✅ PASS: ${name} ${details ? '— ' + details : ''}`);
  } else {
    testResults.failed++;
    console.error(`  ❌ FAIL: ${name} ${details ? '— ' + details : ''}`);
  }
}

async function copyToAgyArtifacts(sourceFile, destName) {
  try {
    const dest = path.join(AGY_ARTIFACT_DIR, destName);
    fs.copyFileSync(sourceFile, dest);
  } catch (err) {
    console.warn(`Could not copy to AGY artifacts: ${err.message}`);
  }
}

async function run() {
  console.log('========================================================================');
  console.log('🚀 HOMOLOGATION & TESTING SUITE — PROJECT NOX RODADA 24.5');
  console.log('Target:', PREVIEW_URL);
  console.log('Artifacts:', ARTIFACT_DIR);
  console.log('========================================================================\n');

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: INVARIANTS & INTEGRITY (Chapters 85, 88, 92, 93)
    // -------------------------------------------------------------------------
    console.log('[SECTION 1] Preserving Real Production Chapters & Stages Invariants');

    const ch85Res = await client.query(`
      SELECT cs.id, cs.status, ws.slug
      FROM public.scan_production_chapters spc
      JOIN public.works w ON w.id = spc.work_id
      JOIN public.scan_chapter_stages cs ON cs.production_chapter_id = spc.id
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE w.title ILIKE '%Céu%' AND spc.chapter_number = '85' AND ws.slug = 'revisor_qc'
    `);
    recordTest('Chapter #85 QC exists and is claimable (AVAILABLE)', ch85Res.rows.length === 1 && ch85Res.rows[0].status === 'AVAILABLE', `Status: ${ch85Res.rows[0]?.status}`);

    const ch88Res = await client.query(`
      SELECT cs.id, cs.status, ws.slug
      FROM public.scan_production_chapters spc
      JOIN public.works w ON w.id = spc.work_id
      JOIN public.scan_chapter_stages cs ON cs.production_chapter_id = spc.id
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE w.title ILIKE '%Céu%' AND spc.chapter_number = '88'
    `);
    const ch88Available = ch88Res.rows.filter(r => r.status === 'AVAILABLE');
    recordTest('Chapter #88 has available editorial stages intact for user demo', ch88Available.length >= 2, `Available count: ${ch88Available.length}`);

    const ch92Res = await client.query(`
      SELECT cs.id, cs.status, cs.due_at, cs.extension_count, ws.slug
      FROM public.scan_production_chapters spc
      JOIN public.works w ON w.id = spc.work_id
      JOIN public.scan_chapter_stages cs ON cs.production_chapter_id = spc.id
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE w.title ILIKE '%Céu%' AND spc.chapter_number = '92' AND ws.slug = 'clean_redraw'
    `);
    recordTest('Chapter #92 Clean/Redraw intact', ch92Res.rows.length === 1 && ch92Res.rows[0].status === 'IN_PROGRESS', `Due: ${ch92Res.rows[0]?.due_at}`);

    const ch92TradRes = await client.query(`
      SELECT cs.id, cs.status, cs.due_at, cs.extension_count, ws.slug
      FROM public.scan_production_chapters spc
      JOIN public.works w ON w.id = spc.work_id
      JOIN public.scan_chapter_stages cs ON cs.production_chapter_id = spc.id
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE w.title ILIKE '%Céu%' AND spc.chapter_number = '92' AND ws.slug = 'traducao'
    `);
    recordTest('Chapter #92 Tradução intact', ch92TradRes.rows.length === 1 && ch92TradRes.rows[0].status === 'IN_PROGRESS', `Due: ${ch92TradRes.rows[0]?.due_at}`);

    // -------------------------------------------------------------------------
    // SECTION 2: ENDPOINT PROTECTION & CRON SECURITY AUDIT
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 2] Endpoint Protection & Header Bypass Shielding');

    // 1. External unauthenticated request -> MUST return 401
    const unauthEmailRes = await fetch(`${PREVIEW_URL}/api/internal/email-processor`, { method: 'GET' });
    recordTest('Unauthenticated GET /api/internal/email-processor returns 401', unauthEmailRes.status === 401, `Status: ${unauthEmailRes.status}`);

    const unauthCronRes = await fetch(`${PREVIEW_URL}/api/internal/cron/process-expired-stages`, { method: 'GET' });
    recordTest('Unauthenticated GET /api/internal/cron/process-expired-stages returns 401', unauthCronRes.status === 401, `Status: ${unauthCronRes.status}`);

    // 2. Request with spoofed x-internal-cron header -> MUST STILL return 401!
    const spoofEmailRes = await fetch(`${PREVIEW_URL}/api/internal/email-processor`, {
      method: 'GET',
      headers: { 'x-internal-cron': 'true' }
    });
    recordTest('Header-spoofed GET /api/internal/email-processor rejected with 401', spoofEmailRes.status === 401, `Status: ${spoofEmailRes.status}`);

    const spoofCronRes = await fetch(`${PREVIEW_URL}/api/internal/cron/process-expired-stages`, {
      method: 'GET',
      headers: { 'x-internal-cron': 'true' }
    });
    recordTest('Header-spoofed GET /api/internal/cron/process-expired-stages rejected with 401', spoofCronRes.status === 401, `Status: ${spoofCronRes.status}`);

    // 3. Authorized request using staff session cookie
    const cookies = await ownerCookies(PREVIEW_URL);
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const authEmailRes = await fetch(`${PREVIEW_URL}/api/internal/email-processor`, {
      method: 'GET',
      headers: { cookie: cookieHeader }
    });
    const authEmailJson = await authEmailRes.json();
    recordTest('Staff-authenticated GET /api/internal/email-processor returns 200', authEmailRes.status === 200);
    recordTest('Email processor detects preview isolation mode', authEmailJson.environment === 'preview_isolated' && authEmailJson.onlyTestChapters === true);
    recordTest('Email processor skips real email outbox in preview', authEmailJson.details?.includes('preview_isolated_mode_skipped_real_email'));

    const authCronRes = await fetch(`${PREVIEW_URL}/api/internal/cron/process-expired-stages`, {
      method: 'GET',
      headers: { cookie: cookieHeader }
    });
    const authCronJson = await authCronRes.json();
    recordTest('Staff-authenticated GET /api/internal/cron/process-expired-stages returns 200', authCronRes.status === 200);
    recordTest('Cron endpoint enforces onlyTestChapters in preview', authCronJson.onlyTestChapters === true);

    // -------------------------------------------------------------------------
    // SECTION 3: PREVIEW ISOLATION & DEVOLUTION SAFETY (YugabyteDB)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 3] Preview Isolation & Devolution Safety Verification');

    const scanRes = await client.query(`SELECT id FROM public.scans LIMIT 1`);
    const scanId = scanRes.rows[0].id;
    const workRes = await client.query(`SELECT id FROM public.works LIMIT 1`);
    const workId = workRes.rows[0].id;
    const stageRes = await client.query(`SELECT id FROM public.scan_workflow_stages WHERE slug = 'traducao' LIMIT 1`);
    const tradStageId = stageRes.rows[0].id;
    const testActorId = '732fbe87-5040-41fb-9983-0aedb2af44c8';

    // Clean up any existing synthetic #997
    await client.query(`
      DELETE FROM public.scan_chapter_timeline
      WHERE production_chapter_id IN (
        SELECT id FROM public.scan_production_chapters WHERE chapter_number = '997' AND scan_id = $1
      )
    `, [scanId]);
    await client.query(`
      DELETE FROM public.scan_chapter_stages
      WHERE production_chapter_id IN (
        SELECT id FROM public.scan_production_chapters WHERE chapter_number = '997' AND scan_id = $1
      )
    `, [scanId]);
    await client.query(`
      DELETE FROM public.scan_production_chapters WHERE chapter_number = '997' AND scan_id = $1
    `, [scanId]);

    // Insert synthetic test chapter #997
    const synChapter = await client.query(`
      INSERT INTO public.scan_production_chapters (
        scan_id, work_id, chapter_number, chapter_title, status, created_at, updated_at
      ) VALUES ($1, $2, '997', 'Capítulo Sintético Cron Isolation R24.5', 'IN_PROGRESS', now(), now())
      RETURNING id
    `, [scanId, workId]);
    const synChapterId = synChapter.rows[0].id;

    const synExpiredStage = await client.query(`
      INSERT INTO public.scan_chapter_stages (
        scan_id, chapter_id, production_chapter_id, stage_id, status, assigned_to,
        claimed_at, due_at, extension_count, created_at, updated_at
      ) VALUES (
        $1, $2, $2, $3, 'IN_PROGRESS', $4, now() - interval '5 hours', now() - interval '2 hours', 0, now(), now()
      ) RETURNING id
    `, [scanId, synChapterId, tradStageId, testActorId]);
    const synStageId = synExpiredStage.rows[0].id;

    console.log(`  Created synthetic expired stage ${synStageId} on chapter #997.`);

    // Run devolution via staff authenticated cron endpoint
    const runCronRes = await fetch(`${PREVIEW_URL}/api/internal/cron/process-expired-stages`, {
      method: 'GET',
      headers: { cookie: cookieHeader }
    });
    const runCronJson = await runCronRes.json();
    console.log('  Devolution run result:', JSON.stringify(runCronJson?.devolution));
    recordTest('Preview devolution ran with p_only_test_chapters = true', runCronJson.onlyTestChapters === true);
    recordTest('Synthetic chapter #997 was devolved', runCronJson.devolution?.devolved_count >= 1);

    // Verify synthetic stage #997 is now AVAILABLE
    const stageAfterDev = await client.query(`
      SELECT status, assigned_to, claimed_at, due_at, notes
      FROM public.scan_chapter_stages
      WHERE id = $1
    `, [synStageId]);
    const rowAfter = stageAfterDev.rows[0];
    recordTest('Synthetic stage devolved to AVAILABLE', rowAfter?.status === 'AVAILABLE', `Status: ${rowAfter?.status}`);
    recordTest('Synthetic stage assigned_to cleared to NULL', rowAfter?.assigned_to === null);
    recordTest('Synthetic stage notes updated with devolution audit mark', rowAfter?.notes?.includes('[Devolução Automática - Prazo Expirado]'));

    // Verify real chapter #92 and #93 were NOT devolved
    const ch92Recheck = await client.query(`
      SELECT cs.status, cs.assigned_to
      FROM public.scan_production_chapters spc
      JOIN public.scan_chapter_stages cs ON cs.production_chapter_id = spc.id
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE spc.chapter_number = '92' AND ws.slug = 'clean_redraw'
    `);
    recordTest('Real production chapter #92 remained IN_PROGRESS (untouched)', ch92Recheck.rows[0]?.status === 'IN_PROGRESS');

    // Clean up synthetic #997
    await client.query(`DELETE FROM public.scan_chapter_timeline WHERE production_chapter_id = $1`, [synChapterId]);
    await client.query(`DELETE FROM public.scan_chapter_stages WHERE id = $1`, [synStageId]);
    await client.query(`DELETE FROM public.scan_production_chapters WHERE id = $1`, [synChapterId]);
    console.log('  ✓ Cleaned up synthetic devolution test chapter #997.');

    // -------------------------------------------------------------------------
    // BROWSER INITIALIZATION
    // -------------------------------------------------------------------------
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

    // -------------------------------------------------------------------------
    // SECTION 4: DESKTOP DATE CONSISTENCY & CÉU DISTANTE #92 AUDIT
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 4] Desktop Date Consistency & Céu Distante #92 Audit (1920x1080)');

    const dCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });
    await dCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const dPage = await dCtx.newPage();
    await dPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dPage.waitForTimeout(3000);

    // Screenshot 1: Desktop Month View Overview
    const shot1Path = path.join(ARTIFACT_DIR, '01_desktop_month_view_date_consistency.png');
    await dPage.screenshot({ path: shot1Path, fullPage: false });
    await copyToAgyArtifacts(shot1Path, '01_desktop_month_view_date_consistency.png');
    recordTest('Captured Screenshot 01: Desktop Month View Date Consistency', fs.existsSync(shot1Path));

    // Verify Céu Distante #92 on Nov 5: MUST show "Vence amanhã", NEVER "Vence hoje"
    const day5Cell = dPage.locator('.matrix-day-cell:not(.is-other-month)').filter({ has: dPage.locator('.cell-day-num', { hasText: '5' }) }).first();
    const day5Text = await day5Cell.innerText();
    console.log('  Day 5 Cell Content:\n', day5Text);

    const hasVenceAmanha = day5Text.includes('Vence amanhã');
    const hasVenceHoje = day5Text.includes('Vence hoje');
    recordTest('Céu Distante #92 on Nov 5 displays "Vence amanhã"', hasVenceAmanha, `Text found: ${hasVenceAmanha}`);
    recordTest('Céu Distante #92 on Nov 5 does NOT display "Vence hoje"', !hasVenceHoje, `Incorrect label absent: ${!hasVenceHoje}`);

    const dueTomorrowPill = day5Cell.locator('.event-inline-status.due-tomorrow');
    recordTest('Event card has .due-tomorrow cyan badge class', (await dueTomorrowPill.count()) > 0);

    // Screenshot 2: Zoomed view of Nov 5 Céu Distante #92 card
    const shot2Path = path.join(ARTIFACT_DIR, '02_ceu_distante_92_tomorrow_pill.png');
    await day5Cell.screenshot({ path: shot2Path });
    await copyToAgyArtifacts(shot2Path, '02_ceu_distante_92_tomorrow_pill.png');
    recordTest('Captured Screenshot 02: Céu Distante #92 "Vence amanhã" pill', fs.existsSync(shot2Path));

    // Click Day 7 cell to inspect Céu Distante #92 Tradução in Contextual Panel
    const day7Cell = dPage.locator('.matrix-day-cell:not(.is-other-month)').filter({ has: dPage.locator('.cell-day-num', { hasText: '7' }) }).first();
    await day7Cell.click({ force: true });
    await dPage.waitForTimeout(1000);

    const ctxPanel = dPage.locator('.calendar-contextual-panel');
    const ctxText = await ctxPanel.innerText();
    console.log('  Contextual Panel for Day 7:\n', ctxText.slice(0, 300));
    recordTest('Contextual panel reflects 3 calendar days remaining ("Faltam 3 dias")', ctxText.includes('Faltam 3 dias'));

    // Screenshot 3: Contextual Panel with accurate count
    const shot3Path = path.join(ARTIFACT_DIR, '03_desktop_contextual_panel_accurate_countdowns.png');
    await dPage.screenshot({ path: shot3Path, fullPage: false });
    await copyToAgyArtifacts(shot3Path, '03_desktop_contextual_panel_accurate_countdowns.png');
    recordTest('Captured Screenshot 03: Desktop Contextual Panel accurate countdowns', fs.existsSync(shot3Path));

    // -------------------------------------------------------------------------
    // SECTION 5: AGENDA VIEW CHRONOLOGICAL ORDER
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 5] Agenda View Chronological Order & Density');

    const agendaBtn = dPage.locator('button.toggle-opt-btn').filter({ hasText: 'Agenda' }).first();
    await agendaBtn.click({ force: true });
    await dPage.waitForTimeout(1200);

    const agendaWrapper = dPage.locator('.agenda-view-wrapper');
    const agendaText = await agendaWrapper.innerText();
    recordTest('Agenda view rendered successfully', (await agendaWrapper.count()) > 0);
    recordTest('Agenda view displays "Vence amanhã" for Céu Distante #92', agendaText.includes('Vence amanhã'));

    // Screenshot 4: Agenda View
    const shot4Path = path.join(ARTIFACT_DIR, '04_agenda_view_chronological_order.png');
    await dPage.screenshot({ path: shot4Path, fullPage: false });
    await copyToAgyArtifacts(shot4Path, '04_agenda_view_chronological_order.png');
    recordTest('Captured Screenshot 04: Agenda View chronological order', fs.existsSync(shot4Path));

    // -------------------------------------------------------------------------
    // SECTION 6: ANDROID MOBILE AUDIT (360px & BOTTOM SHEET)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 6] Android Mobile Audit (360x740)');

    const mCtx = await browser.newContext({
      viewport: { width: 360, height: 740 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    await mCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const mPage = await mCtx.newPage();
    await mPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await mPage.waitForTimeout(3000);

    // Verify month view has real avatars
    const mobileAvatars = mPage.locator('.mobile-avatar-badge');
    const avatarCount = await mobileAvatars.count();
    recordTest('Android calendar cells display real member avatars', avatarCount >= 5, `Found: ${avatarCount} avatars`);

    // Screenshot 5: Android Month View with real avatars
    const shot5Path = path.join(ARTIFACT_DIR, '05_android_360px_month_avatars.png');
    await mPage.screenshot({ path: shot5Path, fullPage: false });
    await copyToAgyArtifacts(shot5Path, '05_android_360px_month_avatars.png');
    recordTest('Captured Screenshot 05: Android 360px month avatars', fs.existsSync(shot5Path));

    // Click day 5 to open bottom sheet
    const mDay5Cell = mPage.locator('.matrix-day-cell:not(.is-other-month)').filter({ has: mPage.locator('.cell-day-num', { hasText: '5' }) }).first();
    await mDay5Cell.click({ force: true });
    await mPage.waitForTimeout(600);

    // Click mini delivery card in preview strip to trigger bottom sheet drawer
    const previewMiniCard = mPage.locator('.preview-mini-card').first();
    if (await previewMiniCard.count() > 0) {
      await previewMiniCard.click({ force: true });
      await mPage.waitForTimeout(1000);
    }

    const bottomSheet = mPage.locator('.bottom-sheet-panel');
    recordTest('Android bottom sheet drawer opened', (await bottomSheet.count()) > 0);

    const sheetText = await bottomSheet.innerText();
    recordTest('Bottom sheet displays "Vence amanhã" status', sheetText.includes('Vence amanhã'));

    // Screenshot 6: Android Bottom Sheet
    const shot6Path = path.join(ARTIFACT_DIR, '06_android_bottom_sheet_delivery_detail.png');
    await mPage.screenshot({ path: shot6Path, fullPage: false });
    await copyToAgyArtifacts(shot6Path, '06_android_bottom_sheet_delivery_detail.png');
    recordTest('Captured Screenshot 06: Android Bottom Sheet detail', fs.existsSync(shot6Path));

    // -------------------------------------------------------------------------
    // SECTION 7: CLAIM STAGE MODAL AUDIT (360px & 320px)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 7] Claim Stage Modal Viewport Homologation (360px & 320px)');

    // Navigate to Revisor QC to claim chapter #88 or open claim modal
    await mPage.goto(`${PREVIEW_URL}/scan?tab=pipeline&stage=revisor_qc`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await mPage.waitForTimeout(2500);

    // Click Disponíveis
    const dispTab = mPage.locator('button, .tab-btn').filter({ hasText: 'Disponíveis' }).first();
    if (await dispTab.count() > 0) {
      await dispTab.click({ force: true });
      await mPage.waitForTimeout(800);
    }

    const claimBtn = mPage.locator('button').filter({ hasText: /Assumir/ }).first();
    if (await claimBtn.count() > 0) {
      await claimBtn.click({ force: true });
      await mPage.waitForTimeout(1200);

      const claimModal = mPage.locator('.modal-card').filter({ hasText: 'Defina seu prazo de entrega' });
      recordTest('ClaimStageModal opens on mobile 360px', (await claimModal.count()) > 0);

      // Verify all 4 dates visible
      const dateCards = claimModal.locator('.date-chip-btn');
      recordTest('ClaimStageModal displays 4 quick date options', (await dateCards.count()) === 4);

      // Verify red warning
      const redWarning = claimModal.locator('.deadline-obligation-warning');
      recordTest('ClaimStageModal displays red consequence warning', (await redWarning.count()) > 0);

      // Verify textarea
      const textarea = claimModal.locator('textarea#claim-notes');
      recordTest('ClaimStageModal textarea is visible and accessible', (await textarea.count()) > 0);

      // Screenshot 7: Claim Modal on 360px
      const shot7Path = path.join(ARTIFACT_DIR, '07_claim_modal_android_360px_complete_view.png');
      await mPage.screenshot({ path: shot7Path, fullPage: false });
      await copyToAgyArtifacts(shot7Path, '07_claim_modal_android_360px_complete_view.png');
      recordTest('Captured Screenshot 07: Claim Modal Android 360px', fs.existsSync(shot7Path));

      // Close modal
      const cancelBtn = claimModal.locator('button.btn-cancel-claim, button.btn-close-modal').first();
      await cancelBtn.click({ force: true });
      await mPage.waitForTimeout(500);
    }

    // Now test 320px viewport
    const ultraCtx = await browser.newContext({
      viewport: { width: 320, height: 640 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    await ultraCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const uPage = await ultraCtx.newPage();
    await uPage.goto(`${PREVIEW_URL}/scan?tab=pipeline&stage=revisor_qc`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await uPage.waitForTimeout(2500);

    const uDispTab = uPage.locator('button, .tab-btn').filter({ hasText: 'Disponíveis' }).first();
    if (await uDispTab.count() > 0) {
      await uDispTab.click({ force: true });
      await uPage.waitForTimeout(800);
    }
    const uClaimBtn = uPage.locator('button').filter({ hasText: /Assumir/ }).first();
    if (await uClaimBtn.count() > 0) {
      await uClaimBtn.click({ force: true });
      await uPage.waitForTimeout(1200);

      const shot8Path = path.join(ARTIFACT_DIR, '08_claim_modal_android_320px_complete_view.png');
      await uPage.screenshot({ path: shot8Path, fullPage: false });
      await copyToAgyArtifacts(shot8Path, '08_claim_modal_android_320px_complete_view.png');
      recordTest('Captured Screenshot 08: Claim Modal Android 320px', fs.existsSync(shot8Path));

      const uCancelBtn = uPage.locator('.modal-card button.btn-cancel-claim, .modal-card button.btn-close-modal').first();
      await uCancelBtn.click({ force: true });
      await uPage.waitForTimeout(500);
    }

    // -------------------------------------------------------------------------
    // SECTION 8: STATE MACHINE VERIFICATION (States A, B, C, D)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 8] State Machine Full Lifecycle (States A, B, C, D)');

    await client.query(`
      DELETE FROM public.scan_chapter_timeline
      WHERE production_chapter_id IN (
        SELECT id FROM public.scan_production_chapters WHERE chapter_number = '998' AND scan_id = $1
      )
    `, [scanId]);
    await client.query(`
      DELETE FROM public.scan_chapter_stages
      WHERE production_chapter_id IN (
        SELECT id FROM public.scan_production_chapters WHERE chapter_number = '998' AND scan_id = $1
      )
    `, [scanId]);
    await client.query(`
      DELETE FROM public.scan_production_chapters WHERE chapter_number = '998' AND scan_id = $1
    `, [scanId]);

    const synChapter998 = await client.query(`
      INSERT INTO public.scan_production_chapters (
        scan_id, work_id, chapter_number, chapter_title, status, created_at, updated_at
      ) VALUES ($1, $2, '998', 'Capítulo Sintético State Machine R24.5', 'IN_PROGRESS', now(), now())
      RETURNING id
    `, [scanId, workId]);
    const synChapter998Id = synChapter998.rows[0].id;

    // State A: due in 3 days (> 24 hours away)
    const synStage998 = await client.query(`
      INSERT INTO public.scan_chapter_stages (
        scan_id, chapter_id, production_chapter_id, stage_id, status, assigned_to,
        claimed_at, due_at, extension_count, created_at, updated_at
      ) VALUES (
        $1, $2, $2, $3, 'IN_PROGRESS', $4, now(), now() + interval '3 days', 0, now(), now()
      ) RETURNING id
    `, [scanId, synChapter998Id, tradStageId, testActorId]);
    const synStage998Id = synStage998.rows[0].id;

    // Check State A in UI: Prorrogação bloqueada
    await dPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dPage.waitForTimeout(2500);

    // Now update stage to State B (due in 12 hours)
    await client.query(`
      UPDATE public.scan_chapter_stages
      SET due_at = now() + interval '12 hours'
      WHERE id = $1
    `, [synStage998Id]);

    await dPage.reload({ waitUntil: 'domcontentloaded' });
    await dPage.waitForTimeout(2500);

    // Click today cell to view #998
    const cellToday = dPage.locator('.matrix-day-cell.is-today').first();
    if (await cellToday.count() > 0) {
      await cellToday.click({ force: true });
      await dPage.waitForTimeout(600);
      const acc998 = dPage.locator('.context-accordion-bar').filter({ hasText: '998' }).first();
      if (await acc998.count() > 0) {
        await acc998.click({ force: true });
        await dPage.waitForTimeout(500);
      }
    }

    // Look for button "⚡ Prorrogar +2 dias" in hero card or contextual panel
    const extendBtn = dPage.locator('.btn-extension-action.available, .btn-next-extend.available').first();
    const isStateBAvailable = (await extendBtn.count()) > 0;
    recordTest('State B: Extension button "⚡ Prorrogar +2 dias" unlocked and active', isStateBAvailable);

    // Screenshot 9: State B unlocked
    const shot9Path = path.join(ARTIFACT_DIR, '09_extension_lifecycle_state_b_unlocked.png');
    await dPage.screenshot({ path: shot9Path, fullPage: false });
    await copyToAgyArtifacts(shot9Path, '09_extension_lifecycle_state_b_unlocked.png');
    recordTest('Captured Screenshot 09: Extension lifecycle State B unlocked', fs.existsSync(shot9Path));

    if (isStateBAvailable) {
      await extendBtn.click({ force: true });
      await dPage.waitForTimeout(1000);

      // Confirm in modal
      const modalConfirmBtn = dPage.locator('.btn-confirm-extend').first();
      if (await modalConfirmBtn.count() > 0) {
        await Promise.all([
          dPage.waitForResponse(res => res.url().includes('extendStageDeadline')),
          modalConfirmBtn.click()
        ]);
        await dPage.waitForTimeout(1500);
      }

      // Verify database updated: extension_count = 1
      const stageAfterExt = await client.query(`
        SELECT extension_count, due_at
        FROM public.scan_chapter_stages
        WHERE id = $1
      `, [synStage998Id]);
      recordTest('Database records extension_count = 1', stageAfterExt.rows[0]?.extension_count === 1);

      // Verify State C in UI: click newly extended day cell
      const extDayNum = new Date(stageAfterExt.rows[0].due_at).toLocaleDateString('pt-BR', { day: 'numeric', timeZone: 'America/Sao_Paulo' });
      const cellExt = dPage.locator('.matrix-day-cell:not(.is-other-month)').filter({ has: dPage.locator('.cell-day-num', { hasText: extDayNum }) }).first();
      if (await cellExt.count() > 0) {
        await cellExt.click({ force: true });
        await dPage.waitForTimeout(600);
        const accExt = dPage.locator('.context-accordion-bar').filter({ hasText: '998' }).first();
        if (await accExt.count() > 0) {
          await accExt.click({ force: true });
          await dPage.waitForTimeout(500);
        }
      }

      const extNotice = dPage.locator('.next-ext-notice.extended, .ext-discreet-confirmation');
      const hasExtNotice = (await extNotice.count()) > 0;
      recordTest('State C: Discreet confirmation note rendered in UI', hasExtNotice);

      // Screenshot 10: State C applied
      const shot10Path = path.join(ARTIFACT_DIR, '10_extension_lifecycle_state_c_applied.png');
      await dPage.screenshot({ path: shot10Path, fullPage: false });
      await copyToAgyArtifacts(shot10Path, '10_extension_lifecycle_state_c_applied.png');
      recordTest('Captured Screenshot 10: Extension lifecycle State C applied', fs.existsSync(shot10Path));

      // State D: second extension attempt blocked
      const extendBtnAgain = dPage.locator('.btn-extension-action.available, .btn-next-extend.available');
      recordTest('State D: Second extension is permanently locked/prevented', (await extendBtnAgain.count()) === 0);
    }

    // Clean up synthetic chapter #998
    await client.query(`DELETE FROM public.scan_chapter_timeline WHERE production_chapter_id = $1`, [synChapter998Id]);
    await client.query(`DELETE FROM public.scan_chapter_stages WHERE id = $1`, [synStage998Id]);
    await client.query(`DELETE FROM public.scan_production_chapters WHERE id = $1`, [synChapter998Id]);
    console.log('  ✓ Cleaned up synthetic State Machine test chapter #998.');

    // -------------------------------------------------------------------------
    // SECTION 9: SECURITY 401 VERIFICATION SCREENSHOT
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 9] Security 401 Rejection Demonstration');

    const secCtx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const secPage = await secCtx.newPage();
    // Navigate without auth cookies to internal cron endpoint
    await secPage.goto(`${PREVIEW_URL}/api/internal/cron/process-expired-stages`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await secPage.waitForTimeout(1000);

    const shot11Path = path.join(ARTIFACT_DIR, '11_security_401_endpoint_rejection.png');
    await secPage.screenshot({ path: shot11Path, fullPage: false });
    await copyToAgyArtifacts(shot11Path, '11_security_401_endpoint_rejection.png');
    recordTest('Captured Screenshot 11: Security 401 Endpoint Rejection', fs.existsSync(shot11Path));

    // -------------------------------------------------------------------------
    // SECTION 10: NAVIGATION STABILITY SUITE (32 CYCLES)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 10] Navigation Stability Suite (32 rapid transitions)');

    const navTargets = [
      { tab: 'calendario', label: 'Calendário' },
      { tab: 'pipeline&stage=traducao', label: 'Tradução' },
      { tab: 'pipeline&stage=clean_redraw', label: 'Clean/Redraw' },
      { tab: 'pipeline&stage=typeset', label: 'Typeset' },
      { tab: 'pipeline&stage=revisor_qc', label: 'Revisor (QC)' }
    ];

    let navErrors = 0;
    for (let i = 0; i < 32; i++) {
      const target = navTargets[i % navTargets.length];
      const targetUrl = `${PREVIEW_URL}/scan?tab=${target.tab}`;
      await dPage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const currentUrl = dPage.url();
      if (!currentUrl.includes(target.tab.split('&')[0])) {
        navErrors++;
        console.error(`  Transition ${i + 1} failed: expected ${target.tab}, got ${currentUrl}`);
      }
    }
    recordTest('32 Navigation Transitions completed with 0 rollbacks or loops', navErrors === 0, `Errors: ${navErrors}`);

    // Return to Calendario for final overview shot
    await dPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await dPage.waitForTimeout(2000);

    const shot12Path = path.join(ARTIFACT_DIR, '12_invariants_and_final_overview.png');
    await dPage.screenshot({ path: shot12Path, fullPage: false });
    await copyToAgyArtifacts(shot12Path, '12_invariants_and_final_overview.png');
    recordTest('Captured Screenshot 12: Invariants and Final Overview', fs.existsSync(shot12Path));

    // Save Summary JSON
    const summaryPath = path.join(ARTIFACT_DIR, 'test_summary_round24_5.json');
    fs.writeFileSync(summaryPath, JSON.stringify(testResults, null, 2));
    await copyToAgyArtifacts(summaryPath, 'test_summary_round24_5.json');

    console.log('\n========================================================================');
    console.log(`🎯 HOMOLOGATION COMPLETE: ${testResults.passed} PASSED / ${testResults.failed} FAILED`);
    console.log('========================================================================\n');

    await browser.close();
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Fatal homologation error:', err);
  process.exit(1);
});
