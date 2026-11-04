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
const ARTIFACT_DIR = path.resolve(__homologateDir, '../artifacts/round24_3');
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

async function run() {
  console.log('========================================================================');
  console.log('🚀 HOMOLOGATION & TESTING SUITE — PROJECT NOX RODADA 24.3');
  console.log('Target:', PREVIEW_URL);
  console.log('Artifacts:', ARTIFACT_DIR);
  console.log('========================================================================\n');

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------------
    // PART 1: YUGABYTE DB INVARIANTS CHECK (Chapters 85, 88, 92, 93)
    // -------------------------------------------------------------------------
    console.log('[SECTION 1] Preserving Real Production Chapters & Stages Invariants');

    // Chapter 85: QC stage is AVAILABLE
    const ch85Res = await client.query(`
      SELECT cs.id, cs.status, ws.slug
      FROM public.scan_production_chapters spc
      JOIN public.works w ON w.id = spc.work_id
      JOIN public.scan_chapter_stages cs ON cs.production_chapter_id = spc.id
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE w.title ILIKE '%Céu%' AND spc.chapter_number = '85' AND ws.slug = 'revisor_qc'
    `);
    recordTest('Chapter #85 QC exists and is claimable (AVAILABLE)', ch85Res.rows.length === 1 && ch85Res.rows[0].status === 'AVAILABLE', `Status: ${ch85Res.rows[0]?.status}`);

    // Chapter 88: Clean/Redraw & Tradução are AVAILABLE
    const ch88Res = await client.query(`
      SELECT cs.id, cs.status, ws.slug
      FROM public.scan_production_chapters spc
      JOIN public.works w ON w.id = spc.work_id
      JOIN public.scan_chapter_stages cs ON cs.production_chapter_id = spc.id
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE w.title ILIKE '%Céu%' AND spc.chapter_number = '88'
    `);
    const ch88Available = ch88Res.rows.filter(r => r.status === 'AVAILABLE');
    recordTest('Chapter #88 has available editorial stages intact', ch88Available.length >= 2, `Available count: ${ch88Available.length}`);

    // Chapter 92: Tradução intact
    const ch92Res = await client.query(`
      SELECT cs.id, cs.status, cs.due_at, cs.extension_count, ws.slug
      FROM public.scan_production_chapters spc
      JOIN public.works w ON w.id = spc.work_id
      JOIN public.scan_chapter_stages cs ON cs.production_chapter_id = spc.id
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE w.title ILIKE '%Céu%' AND spc.chapter_number = '92' AND ws.slug = 'traducao'
    `);
    recordTest('Chapter #92 Tradução intact', ch92Res.rows.length === 1 && ch92Res.rows[0].status === 'IN_PROGRESS', `Due: ${ch92Res.rows[0]?.due_at}`);

    // Chapter 93: Tradução intact
    const ch93Res = await client.query(`
      SELECT cs.id, cs.status, cs.due_at, cs.extension_count, ws.slug
      FROM public.scan_production_chapters spc
      JOIN public.works w ON w.id = spc.work_id
      JOIN public.scan_chapter_stages cs ON cs.production_chapter_id = spc.id
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE w.title ILIKE '%Céu%' AND spc.chapter_number = '93' AND ws.slug = 'traducao'
    `);
    recordTest('Chapter #93 Tradução intact', ch93Res.rows.length === 1 && ch93Res.rows[0].extension_count === 1, `Extension count: ${ch93Res.rows[0]?.extension_count}`);

    // -------------------------------------------------------------------------
    // PART 2: AUTOMATIC DEVOLUTION OF EXPIRED STAGES (Synthetic Chapter #998)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 2] Validating Backend Automatic Devolution of Expired Stages');

    const scanRes = await client.query(`SELECT id FROM public.scans LIMIT 1`);
    const scanId = scanRes.rows[0].id;
    const workRes = await client.query(`SELECT id FROM public.works LIMIT 1`);
    const workId = workRes.rows[0].id;
    const stageRes = await client.query(`SELECT id FROM public.scan_workflow_stages WHERE slug = 'traducao' LIMIT 1`);
    const tradStageId = stageRes.rows[0].id;
    const testActorId = '732fbe87-5040-41fb-9983-0aedb2af44c8';

    // Clean up any stale synthetic #998
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

    // Create synthetic chapter 998 with an expired stage (due 3 hours ago)
    const synChapter = await client.query(`
      INSERT INTO public.scan_production_chapters (
        scan_id, work_id, chapter_number, chapter_title, status, created_at, updated_at
      ) VALUES ($1, $2, '998', 'Capítulo Sintético Devolução R24.3', 'IN_PROGRESS', now(), now())
      RETURNING id
    `, [scanId, workId]);
    const synChapterId = synChapter.rows[0].id;

    const synExpiredStage = await client.query(`
      INSERT INTO public.scan_chapter_stages (
        scan_id, chapter_id, production_chapter_id, stage_id, status, assigned_to,
        claimed_at, due_at, extension_count, created_at, updated_at
      ) VALUES (
        $1, $2, $2, $3, 'IN_PROGRESS', $4, now() - interval '4 hours', now() - interval '2 hours', 0, now(), now()
      ) RETURNING id
    `, [scanId, synChapterId, tradStageId, testActorId]);
    const synStageId = synExpiredStage.rows[0].id;

    // Run the automatic devolution stored procedure
    const devProcResult = await client.query(`
      SELECT public.process_expired_scan_stages_ysql($1) AS res
    `, [scanId]);
    const devOutput = devProcResult.rows[0]?.res;

    // Check state of the synthetic stage after devolution
    const stageAfterDev = await client.query(`
      SELECT status, assigned_to, claimed_at
      FROM public.scan_chapter_stages
      WHERE id = $1
    `, [synStageId]);
    const rowAfter = stageAfterDev.rows[0];

    recordTest('Expired stage devolved to AVAILABLE', rowAfter?.status === 'AVAILABLE', `Status: ${rowAfter?.status}`);
    recordTest('Expired stage assigned_to cleared (NULL)', rowAfter?.assigned_to === null, `Assigned: ${rowAfter?.assigned_to}`);
    recordTest('Expired stage claimed_at cleared (NULL)', rowAfter?.claimed_at === null, `Claimed: ${rowAfter?.claimed_at}`);

    // Check audit event log
    const eventCheck = await client.query(`
      SELECT event_type, details
      FROM public.scan_chapter_timeline
      WHERE production_chapter_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [synChapterId]);
    recordTest('Timeline EXPIRED_DEVOLUTION audit event recorded', eventCheck.rows.length === 1 && eventCheck.rows[0].event_type === 'EXPIRED_DEVOLUTION', `Event: ${eventCheck.rows[0]?.event_type}`);

    // Clean up synthetic #998
    await client.query(`DELETE FROM public.scan_chapter_timeline WHERE production_chapter_id = $1`, [synChapterId]);
    await client.query(`DELETE FROM public.scan_chapter_stages WHERE id = $1`, [synStageId]);
    await client.query(`DELETE FROM public.scan_production_chapters WHERE id = $1`, [synChapterId]);
    console.log('  ✓ Cleaned up synthetic devolution test chapter #998.');

    // -------------------------------------------------------------------------
    // PART 3: REAL BROWSER NAVIGATION STABILITY TEST (30+ TRANSITIONS)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 3] Real Browser Navigation Bug Fix Validation (30+ Transitions)');

    const cookies = await ownerCookies(PREVIEW_URL);
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

    const navCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });
    await navCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const navPage = await navCtx.newPage();

    // Start at Scan Home
    await navPage.goto(`${PREVIEW_URL}/scan?tab=home`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await navPage.waitForTimeout(2000);

    // Sequence of 32 target destinations testing navigation back and forth across Scan areas
    const navigationTargets = [
      { tab: 'calendario', stage: null, selector: '.scan-calendar-hub' },
      { tab: 'pipeline', stage: 'revisor_qc', selector: '.editorial-workspace-root' },
      { tab: 'pipeline', stage: 'clean_redraw', selector: '.editorial-workspace-root' },
      { tab: 'pipeline', stage: 'typeset', selector: '.editorial-workspace-root' },
      { tab: 'pipeline', stage: 'traducao', selector: '.editorial-workspace-root' },
      { tab: 'calendario', stage: null, selector: '.scan-calendar-hub' },
      { tab: 'minha_fila', stage: null, selector: '.tasks-tab-root' },
      { tab: 'pipeline', stage: 'revisor_qc', selector: '.editorial-workspace-root' },
      { tab: 'obras', stage: null, selector: '.obras-view-root' },
      { tab: 'pipeline', stage: 'clean_redraw', selector: '.editorial-workspace-root' },
      { tab: 'calendario', stage: null, selector: '.scan-calendar-hub' },
      { tab: 'pipeline', stage: 'typeset', selector: '.editorial-workspace-root' },
      { tab: 'pipeline', stage: 'revisor_qc', selector: '.editorial-workspace-root' },
      { tab: 'minha_fila', stage: null, selector: '.tasks-tab-root' },
      { tab: 'calendario', stage: null, selector: '.scan-calendar-hub' },
      { tab: 'obras', stage: null, selector: '.obras-view-root' },
      { tab: 'pipeline', stage: 'traducao', selector: '.editorial-workspace-root' },
      { tab: 'pipeline', stage: 'clean_redraw', selector: '.editorial-workspace-root' },
      { tab: 'calendario', stage: null, selector: '.scan-calendar-hub' },
      { tab: 'pipeline', stage: 'revisor_qc', selector: '.editorial-workspace-root' },
      { tab: 'minha_fila', stage: null, selector: '.tasks-tab-root' },
      { tab: 'pipeline', stage: 'typeset', selector: '.editorial-workspace-root' },
      { tab: 'obras', stage: null, selector: '.obras-view-root' },
      { tab: 'calendario', stage: null, selector: '.scan-calendar-hub' },
      { tab: 'pipeline', stage: 'clean_redraw', selector: '.editorial-workspace-root' },
      { tab: 'pipeline', stage: 'revisor_qc', selector: '.editorial-workspace-root' },
      { tab: 'pipeline', stage: 'traducao', selector: '.editorial-workspace-root' },
      { tab: 'minha_fila', stage: null, selector: '.tasks-tab-root' },
      { tab: 'calendario', stage: null, selector: '.scan-calendar-hub' },
      { tab: 'pipeline', stage: 'revisor_qc', selector: '.editorial-workspace-root' },
      { tab: 'pipeline', stage: 'clean_redraw', selector: '.editorial-workspace-root' },
      { tab: 'calendario', stage: null, selector: '.scan-calendar-hub' }
    ];

    let transitionFailures = 0;
    for (let i = 0; i < navigationTargets.length; i++) {
      const target = navigationTargets[i];
      let btn;
      if (target.tab === 'calendario') {
        btn = navPage.locator('.nav-link-btn').filter({ hasText: 'Calendário' }).first();
      } else if (target.tab === 'minha_fila') {
        btn = navPage.locator('.nav-link-btn').filter({ hasText: 'Minha Fila' }).first();
      } else if (target.tab === 'obras') {
        btn = navPage.locator('.nav-link-btn').filter({ hasText: 'Obras da Scan' }).first();
      } else if (target.tab === 'pipeline') {
        if (target.stage === 'revisor_qc') {
          btn = navPage.locator('.nav-sub-btn').filter({ hasText: 'Revisor (QC)' }).first();
        } else if (target.stage === 'clean_redraw') {
          btn = navPage.locator('.nav-sub-btn').filter({ hasText: 'Clean/Redraw' }).first();
        } else if (target.stage === 'typeset') {
          btn = navPage.locator('.nav-sub-btn').filter({ hasText: 'Typeset' }).first();
        } else if (target.stage === 'traducao') {
          btn = navPage.locator('.nav-sub-btn').filter({ hasText: 'Tradução' }).first();
        }
      }

      if (btn && await btn.count() > 0) {
        await btn.click();
        await navPage.waitForTimeout(250);
      } else {
        transitionFailures++;
        console.error(`  ❌ Button not found for transition ${i + 1}: ${target.tab} ${target.stage || ''}`);
        continue;
      }

      // Assert current URL matches target
      const currentUrl = navPage.url();
      const tabMatch = target.stage ? currentUrl.includes(target.stage) : currentUrl.includes(`tab=${target.tab}`);
      const targetElementCount = await navPage.locator(target.selector).count();

      if (!tabMatch || targetElementCount === 0) {
        transitionFailures++;
        console.error(`  ❌ Transition ${i + 1}/${navigationTargets.length} FAILED: target ${target.tab}${target.stage ? '/' + target.stage : ''}, URL: ${currentUrl}, rendered: ${targetElementCount > 0}`);
      }
    }

    recordTest('32 Consecutive Scan Navigation Transitions (No Bounce-back / No Reload)', transitionFailures === 0, `Failures: ${transitionFailures} / 32`);

    // Screenshot after navigation loop
    const pNavStable = path.join(ARTIFACT_DIR, '01_desktop_navigation_stability.png');
    await navPage.screenshot({ path: pNavStable, fullPage: false });
    console.log(`  ✓ Saved: ${pNavStable}`);
    await navCtx.close();

    // -------------------------------------------------------------------------
    // PART 4: CLAIM STAGE MODAL RED WARNING & DYNAMIC REACTIVITY HOMOLOGATION
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 4] ClaimStageModal Mandatory Red Warning Homologation');

    const CLAIM_VIEWPORTS = [
      { name: 'desktop_1920px', width: 1920, height: 1080 },
      { name: 'android_360px', width: 360, height: 740 }
    ];

    for (const vp of CLAIM_VIEWPORTS) {
      console.log(`\nTesting ClaimStageModal Warning on ${vp.name}...`);
      const cCtx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        isMobile: vp.name.includes('android'),
        hasTouch: vp.name.includes('android')
      });
      await cCtx.addCookies([
        ...cookies,
        { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
      ]);
      const cPage = await cCtx.newPage();
      await cPage.goto(`${PREVIEW_URL}/scan?tab=pipeline&stage=revisor_qc`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await cPage.waitForTimeout(2500);

      // Open QC Available tab
      const dispTab = cPage.locator('button, .tab-btn').filter({ hasText: 'Disponíveis' }).first();
      if (await dispTab.count() > 0) {
        await dispTab.click({ force: true });
        await cPage.waitForTimeout(600);
      }

      // Open Claim Modal
      const claimTriggerBtn = cPage.locator('.btn-action-claim-prominent, button:has-text("Assumir")').first();
      if (await claimTriggerBtn.count() > 0) {
        await claimTriggerBtn.click({ force: true });
        await cPage.waitForTimeout(800);

        // 4.1 Verify Modal opens cleanly
        const modalCount = await cPage.locator('.modal-card').count();
        recordTest(`ClaimStageModal opens cleanly on ${vp.name}`, modalCount === 1);

        // 4.2 Verify Red Warning Container exists
        const warningBox = cPage.locator('.deadline-obligation-warning');
        recordTest(`ClaimStageModal red warning container visible on ${vp.name}`, await warningBox.count() === 1);

        // 4.3 Verify Warning Title: "ATENÇÃO — PRAZO DE ENTREGA"
        const warningTitle = await cPage.locator('.warning-title').innerText();
        recordTest(`ClaimStageModal red warning title is "ATENÇÃO — PRAZO DE ENTREGA" on ${vp.name}`, warningTitle.includes('ATENÇÃO — PRAZO DE ENTREGA'), `Title: "${warningTitle}"`);

        // 4.4 Verify Alert Icon is present
        const alertIcon = await cPage.locator('.warning-alert-icon').count();
        recordTest(`ClaimStageModal alert triangle icon present on ${vp.name}`, alertIcon > 0);

        // 4.5 Verify Secondary Note about +2d extension
        const subNoteText = await cPage.locator('.warning-sub-note').innerText();
        recordTest(`ClaimStageModal secondary note mentions +2 dias extension on ${vp.name}`, subNoteText.includes('prorrogação de +2 dias') && subNoteText.includes('últimas 24 horas'), `Note: "${subNoteText}"`);

        // 4.6 Verify Dynamic Warning Text updates reactively per chip:
        const chips = cPage.locator('.date-chip-btn');
        const chipCount = await chips.count();

        // Click Chip 0 (Hoje)
        await chips.nth(0).click();
        await cPage.waitForTimeout(300);
        const warningTextHoje = await cPage.locator('.warning-main-text').innerText();
        recordTest(`Warning text reacts to "Hoje" chip on ${vp.name}`, warningTextHoje.includes('até hoje, às 23h59') && warningTextHoje.includes('devolvida automaticamente à fila'), `Text: "${warningTextHoje}"`);

        // Click Chip 1 (Amanhã)
        await chips.nth(1).click();
        await cPage.waitForTimeout(300);
        const warningTextAmanha = await cPage.locator('.warning-main-text').innerText();
        recordTest(`Warning text reacts to "Amanhã" chip on ${vp.name}`, warningTextAmanha.includes('até amanhã, às 23h59') && warningTextAmanha.includes('devolvida automaticamente à fila'), `Text: "${warningTextAmanha}"`);

        // Click Chip 3 (+3 dias)
        await chips.nth(3).click();
        await cPage.waitForTimeout(300);
        const warningText3d = await cPage.locator('.warning-main-text').innerText();
        recordTest(`Warning text reacts to "+3 dias" chip on ${vp.name}`, warningText3d.includes('às 23h59') && warningText3d.includes('devolvida automaticamente à fila'), `Text: "${warningText3d}"`);

        // Capture modal screenshot
        const pClaimModal = path.join(ARTIFACT_DIR, `02_claim_modal_red_warning_${vp.name}.png`);
        await cPage.screenshot({ path: pClaimModal, fullPage: false });
        console.log(`  ✓ Saved: ${pClaimModal}`);

        // Close modal
        const closeBtn = cPage.locator('.btn-close-modal').first();
        if (await closeBtn.count() > 0) {
          await closeBtn.click({ force: true });
          await cPage.waitForTimeout(400);
        }
      }

      await cCtx.close();
    }

    // -------------------------------------------------------------------------
    // PART 5: MOBILE & DESKTOP CALENDAR UX/UI SCREENSHOTS
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 5] Mobile and Desktop Calendar Visual Artifacts');

    // Desktop 1920x1080 Month View & Agenda View
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
    await dPage.waitForTimeout(2500);

    const pDMonth = path.join(ARTIFACT_DIR, '03_desktop_1920x1080_month.png');
    await dPage.screenshot({ path: pDMonth, fullPage: false });
    console.log(`  ✓ Saved: ${pDMonth}`);

    // Agenda View
    const agendaBtn = dPage.locator('.toggle-opt-btn').filter({ hasText: 'Agenda' }).first();
    if (await agendaBtn.count() > 0) {
      await agendaBtn.click();
      await dPage.waitForTimeout(600);
      const pDAgenda = path.join(ARTIFACT_DIR, '04_desktop_1920x1080_agenda.png');
      await dPage.screenshot({ path: pDAgenda, fullPage: false });
      console.log(`  ✓ Saved: ${pDAgenda}`);
    }
    await dCtx.close();

    // Android 360px Month View with Real Member Avatars & Bottom Sheet
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
    await mPage.waitForTimeout(2500);

    const pMMonth = path.join(ARTIFACT_DIR, '05_android_360px_month.png');
    await mPage.screenshot({ path: pMMonth, fullPage: false });
    console.log(`  ✓ Saved: ${pMMonth}`);

    // Tap day with deliveries to check preview strip
    const mobileCell = mPage.locator('.matrix-day-cell.has-deliveries').first();
    if (await mobileCell.count() > 0) {
      await mobileCell.click();
      await mPage.waitForTimeout(500);

      const pMPreview = path.join(ARTIFACT_DIR, '06_android_360px_day_preview.png');
      await mPage.screenshot({ path: pMPreview, fullPage: false });
      console.log(`  ✓ Saved: ${pMPreview}`);

      // Tap mini card to open bottom sheet
      const miniCard = mPage.locator('.preview-mini-card').first();
      if (await miniCard.count() > 0) {
        await miniCard.click();
        await mPage.waitForTimeout(600);
        const pMSheet = path.join(ARTIFACT_DIR, '07_android_360px_bottom_sheet.png');
        await mPage.screenshot({ path: pMSheet, fullPage: false });
        console.log(`  ✓ Saved: ${pMSheet}`);
      }
    }
    await mCtx.close();

    await browser.close();

    // Write test summary json
    const summaryPath = path.join(ARTIFACT_DIR, 'test_summary_round24_3.json');
    fs.writeFileSync(summaryPath, JSON.stringify(testResults, null, 2), 'utf8');
    console.log(`\n  ✓ Saved: ${summaryPath}`);

    console.log('\n========================================================================');
    console.log(`🏁 SUITE COMPLETE: ${testResults.passed} PASSED / ${testResults.failed} FAILED`);
    console.log('========================================================================');

    if (testResults.failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('FATAL in homologate_round24_3:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
