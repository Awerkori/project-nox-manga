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
const ARTIFACT_DIR = path.resolve(__homologateDir, '../artifacts/round24_4');
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
  console.log('🚀 HOMOLOGATION & TESTING SUITE — PROJECT NOX RODADA 24.4');
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
    recordTest('Chapter #88 has available editorial stages intact', ch88Available.length >= 2, `Available count: ${ch88Available.length}`);

    const ch92Res = await client.query(`
      SELECT cs.id, cs.status, cs.due_at, cs.extension_count, ws.slug
      FROM public.scan_production_chapters spc
      JOIN public.works w ON w.id = spc.work_id
      JOIN public.scan_chapter_stages cs ON cs.production_chapter_id = spc.id
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE w.title ILIKE '%Céu%' AND spc.chapter_number = '92' AND ws.slug = 'traducao'
    `);
    recordTest('Chapter #92 Tradução intact', ch92Res.rows.length === 1 && ch92Res.rows[0].status === 'IN_PROGRESS', `Due: ${ch92Res.rows[0]?.due_at}`);

    const ch93Res = await client.query(`
      SELECT cs.id, cs.status, cs.due_at, cs.extension_count, ws.slug
      FROM public.scan_production_chapters spc
      JOIN public.works w ON w.id = spc.work_id
      JOIN public.scan_chapter_stages cs ON cs.production_chapter_id = spc.id
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE w.title ILIKE '%Céu%' AND spc.chapter_number = '93' AND ws.slug = 'traducao'
    `);
    recordTest('Chapter #93 Tradução intact with extension', ch93Res.rows.length === 1 && ch93Res.rows[0].extension_count === 1, `Extension count: ${ch93Res.rows[0]?.extension_count}`);

    // -------------------------------------------------------------------------
    // SECTION 2: INDEPENDENT SCHEDULED DEVOLUTION AUDIT (WITHOUT OPENING SITE)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 2] Independent Scheduled Devolution Audit (Cron / API Execution)');

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

    // Create synthetic chapter #997 with expired stage
    const synChapter = await client.query(`
      INSERT INTO public.scan_production_chapters (
        scan_id, work_id, chapter_number, chapter_title, status, created_at, updated_at
      ) VALUES ($1, $2, '997', 'Capítulo Sintético Cron Audit R24.4', 'IN_PROGRESS', now(), now())
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

    // Execute internal endpoint via HTTP without opening the user frontend
    console.log('  Invoking /api/internal/email-processor (Cloudflare Worker cron target)...');
    const cronFetchRes = await fetch(`${PREVIEW_URL}/api/internal/email-processor`, {
      method: 'GET',
      headers: {
        'x-internal-cron': 'true'
      }
    });
    const cronJson = await cronFetchRes.json();
    console.log('  Cron response:', JSON.stringify(cronJson?.expiredStages || cronJson));
    recordTest('Internal cron email-processor returned 200 OK', cronFetchRes.status === 200);
    recordTest('Internal cron executed expired stages devolution', cronJson.ok === true && cronJson.expiredStages?.success === true, `Devolved count: ${cronJson.expiredStages?.devolved_count}`);

    // Also verify dedicated endpoint
    const cronDedicatedRes = await fetch(`${PREVIEW_URL}/api/internal/cron/process-expired-stages`, {
      method: 'GET',
      headers: {
        'x-internal-cron': 'true'
      }
    });
    const cronDedicatedJson = await cronDedicatedRes.json();
    recordTest('Dedicated cron endpoint /api/internal/cron/process-expired-stages returned 200 OK', cronDedicatedRes.status === 200 && cronDedicatedJson.ok === true);

    // Check database state of synthetic stage #997
    const stageAfterDev = await client.query(`
      SELECT status, assigned_to, claimed_at, due_at
      FROM public.scan_chapter_stages
      WHERE id = $1
    `, [synStageId]);
    const rowAfter = stageAfterDev.rows[0];

    recordTest('Expired stage automatically devolved to AVAILABLE without user visiting site', rowAfter?.status === 'AVAILABLE', `Status: ${rowAfter?.status}`);
    recordTest('Expired stage assigned_to cleared (NULL)', rowAfter?.assigned_to === null, `Assigned: ${rowAfter?.assigned_to}`);
    recordTest('Expired stage claimed_at cleared (NULL)', rowAfter?.claimed_at === null, `Claimed: ${rowAfter?.claimed_at}`);
    recordTest('Expired stage due_at cleared (NULL)', rowAfter?.due_at === null, `Due: ${rowAfter?.due_at}`);

    // Verify timeline audit event
    const eventCheck = await client.query(`
      SELECT event_type, details
      FROM public.scan_chapter_timeline
      WHERE production_chapter_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [synChapterId]);
    recordTest('Timeline EXPIRED_DEVOLUTION audit event recorded', eventCheck.rows.length === 1 && eventCheck.rows[0].event_type === 'EXPIRED_DEVOLUTION', `Event: ${eventCheck.rows[0]?.event_type}`);

    // Clean up synthetic #997
    await client.query(`DELETE FROM public.scan_chapter_timeline WHERE production_chapter_id = $1`, [synChapterId]);
    await client.query(`DELETE FROM public.scan_chapter_stages WHERE id = $1`, [synStageId]);
    await client.query(`DELETE FROM public.scan_production_chapters WHERE id = $1`, [synChapterId]);
    console.log('  ✓ Cleaned up synthetic devolution test chapter #997.');

    // -------------------------------------------------------------------------
    // BROWSER INITIALIZATION
    // -------------------------------------------------------------------------
    const cookies = await ownerCookies(PREVIEW_URL);
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

    // -------------------------------------------------------------------------
    // SECTION 3: ANDROID CLAIM STAGE MODAL FOOTER & VIEWPORT SUITE (320px - 430px)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 3] Android ClaimStageModal Viewport Suite (320px, 360px, 390px, 430px)');

    const MOBILE_VIEWPORTS = [
      { name: 'android_320px', width: 320, height: 640 },
      { name: 'android_360px', width: 360, height: 740 },
      { name: 'android_390px', width: 390, height: 844 },
      { name: 'android_430px', width: 430, height: 932 }
    ];

    let shotIndex = 1;
    for (const vp of MOBILE_VIEWPORTS) {
      console.log(`\nTesting ClaimStageModal on ${vp.name}...`);
      const vCtx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
      });
      await vCtx.addCookies([
        ...cookies,
        { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
      ]);
      const vPage = await vCtx.newPage();
      await vPage.goto(`${PREVIEW_URL}/scan?tab=pipeline&stage=revisor_qc`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await vPage.waitForTimeout(2500);

      // Open QC Available tab
      const dispTab = vPage.locator('button, .tab-btn').filter({ hasText: 'Disponíveis' }).first();
      if (await dispTab.count() > 0) {
        await dispTab.click({ force: true });
        await vPage.waitForTimeout(600);
      }

      // Open Claim Modal
      const claimTriggerBtn = vPage.locator('.btn-action-claim-prominent, button:has-text("Assumir")').first();
      if (await claimTriggerBtn.count() > 0) {
        await claimTriggerBtn.click({ force: true });
        await vPage.waitForTimeout(800);

        // Verify Modal Card
        const modalCard = vPage.locator('.modal-card');
        recordTest(`Modal card visible on ${vp.name}`, await modalCard.count() === 1);

        // Verify Red Warning Box
        const warningBox = vPage.locator('.deadline-obligation-warning');
        recordTest(`Red warning box visible on ${vp.name}`, await warningBox.count() === 1);

        // Scroll form to reveal textarea and verify visibility & breathing room
        await vPage.evaluate(() => {
          const scrollable = document.querySelector('.claim-form-scrollable');
          if (scrollable) scrollable.scrollTop = scrollable.scrollHeight;
        });
        await vPage.waitForTimeout(300);

        // Verify Textarea is accessible and has proper spacing above sticky footer
        const textarea = vPage.locator('textarea.notes-input, #claim-notes');
        const textareaVisible = await textarea.count() === 1 && await textarea.isVisible();
        recordTest(`Notes textarea visible and accessible on ${vp.name}`, textareaVisible);

        // Verify Sticky Footer Buttons
        const confirmBtn = vPage.locator('.btn-confirm-stage');
        const cancelBtn = vPage.locator('.btn-cancel-claim');
        recordTest(`Footer Confirmar button visible and enabled on ${vp.name}`, await confirmBtn.count() === 1 && await confirmBtn.isEnabled());
        recordTest(`Footer Cancelar button visible on ${vp.name}`, await cancelBtn.count() === 1);

        // Capture screenshot
        const shotName = `0${shotIndex}_claim_modal_${vp.name}.png`;
        const pShot = path.join(ARTIFACT_DIR, shotName);
        await vPage.screenshot({ path: pShot, fullPage: false });
        console.log(`  ✓ Saved: ${pShot}`);
        shotIndex++;

        // Close modal
        const closeBtn = vPage.locator('.btn-close-modal').first();
        if (await closeBtn.count() > 0) {
          await closeBtn.click({ force: true });
          await vPage.waitForTimeout(400);
        }
      }

      await vCtx.close();
    }

    // -------------------------------------------------------------------------
    // SECTION 4: DUPLICATE INFORMATION SUPPRESSION IN DETAILS VIEW
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 4] Duplicate Information Suppression in Completed Stages Details');

    // Desktop Contextual Drawer: Click completed stage (Day 2 has completed stages)
    const dCompCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });
    await dCompCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const dCompPage = await dCompCtx.newPage();
    await dCompPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dCompPage.waitForTimeout(2500);

    // Click on Day 2 in current month matrix
    const dDay2Cell = dCompPage.locator('.matrix-day-cell:not(.is-other-month)').filter({ has: dCompPage.locator('.cell-day-num', { hasText: '2' }) }).first();
    if (await dDay2Cell.count() > 0) {
      await dDay2Cell.click();
      await dCompPage.waitForTimeout(600);
    } else {
      const anyHasDeliveries = dCompPage.locator('.matrix-day-cell.has-deliveries').first();
      if (await anyHasDeliveries.count() > 0) {
        await anyHasDeliveries.click();
        await dCompPage.waitForTimeout(600);
      }
    }

    // If accordion bars exist in contextual panel, click first one to ensure expansion
    const accordionBar = dCompPage.locator('.context-accordion-bar').first();
    if (await accordionBar.count() > 0) {
      await accordionBar.click();
      await dCompPage.waitForTimeout(500);
    }

    // Check primary delivery display vs history box
    const primaryDueLabel = await dCompPage.locator('.ctx-deadline-row .ctx-label').first().innerText().catch(() => '');
    recordTest('Desktop drawer shows primary "Entrega concluída"', primaryDueLabel.toLowerCase().includes('concluída') || primaryDueLabel.toLowerCase().includes('prazo'), `Label: "${primaryDueLabel}"`);

    // Verify "Concluído em:" does NOT appear duplicated in Histórico e Metadados
    const historyBoxText = await dCompPage.locator('.ctx-history-meta-box').innerText().catch(() => '');
    recordTest('Desktop drawer does NOT duplicate "Concluído em" in Histórico e Metadados', !historyBoxText.includes('Concluído em:'), `History text: "${historyBoxText}"`);

    const pDDrawer = path.join(ARTIFACT_DIR, '05_desktop_contextual_drawer_no_duplicate.png');
    await dCompPage.screenshot({ path: pDDrawer, fullPage: false });
    console.log(`  ✓ Saved: ${pDDrawer}`);
    await dCompCtx.close();

    // Android Bottom Sheet: Click completed stage
    const mCompCtx = await browser.newContext({
      viewport: { width: 360, height: 740 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    await mCompCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const mCompPage = await mCompCtx.newPage();
    await mCompPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await mCompPage.waitForTimeout(2500);

    // Tap day 2 (or day with deliveries)
    const mDay2Cell = mCompPage.locator('.matrix-day-cell:not(.is-other-month)').filter({ has: mCompPage.locator('.cell-day-num', { hasText: '2' }) }).first();
    if (await mDay2Cell.count() > 0) {
      await mDay2Cell.click();
      await mCompPage.waitForTimeout(600);
    } else {
      const mAnyHasDeliveries = mCompPage.locator('.matrix-day-cell.has-deliveries').first();
      if (await mAnyHasDeliveries.count() > 0) {
        await mAnyHasDeliveries.click();
        await mCompPage.waitForTimeout(600);
      }
    }

    const mMiniCard = mCompPage.locator('.preview-mini-card').first();
    if (await mMiniCard.count() > 0) {
      await mMiniCard.click();
      await mCompPage.waitForTimeout(600);

      // Check primary completion row vs bottom sheet history
      const mPrimaryLabel = await mCompPage.locator('.sheet-concluded-simple-row .sheet-label').innerText().catch(() => '');
      recordTest('Android bottom sheet shows primary "Data de conclusão"', mPrimaryLabel.toLowerCase().includes('conclusão') || mPrimaryLabel.toLowerCase().includes('prazo'), `Label: "${mPrimaryLabel}"`);

      const mHistoryText = await mCompPage.locator('.sheet-history-box').innerText().catch(() => '');
      recordTest('Android bottom sheet does NOT duplicate "Concluído em" in Histórico e Metadados', !mHistoryText.includes('Concluído em:'), `History: "${mHistoryText}"`);

      const pMSheet = path.join(ARTIFACT_DIR, '06_android_bottom_sheet_no_duplicate.png');
      await mCompPage.screenshot({ path: pMSheet, fullPage: false });
      console.log(`  ✓ Saved: ${pMSheet}`);
    } else {
      console.warn('  ⚠️ No preview-mini-card visible on mobile day 2');
    }
    await mCompCtx.close();

    // -------------------------------------------------------------------------
    // SECTION 5: DATE & REMAINING COUNTDOWN ACCURACY (CH #92 TRADUÇÃO)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 5] Date & Remaining Countdown Accuracy (Céu Distante #92 Tradução)');

    const countCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });
    await countCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const countPage = await countCtx.newPage();
    await countPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await countPage.waitForTimeout(2500);

    // Find Céu Distante #92 on day 7 of current month
    const day7Cell = countPage.locator('.matrix-day-cell:not(.is-other-month)').filter({ has: countPage.locator('.cell-day-num', { hasText: '7' }) }).first();
    if (await day7Cell.count() > 0) {
      await day7Cell.click();
      await countPage.waitForTimeout(600);

      const accBar7 = countPage.locator('.context-accordion-bar').first();
      if (await accBar7.count() > 0) {
        await accBar7.click();
        await countPage.waitForTimeout(500);
      }
    }

    const drawerDeadlineText = await countPage.locator('.ctx-deadline-row').innerText().catch(() => '');
    console.log('  Drawer deadline text for #92:', drawerDeadlineText);
    recordTest('Deadline correctly displays 07/11 às 18:00 (due_at unchanged)', drawerDeadlineText.includes('07/11 às 18:00'));
    recordTest('Accurate countdown text used (NEVER false "4 dias")', !drawerDeadlineText.includes('Vence em 4 dias'), `Drawer text: "${drawerDeadlineText}"`);

    const pAccurateCount = path.join(ARTIFACT_DIR, '07_ceu_distante_92_accurate_countdown.png');
    await countPage.screenshot({ path: pAccurateCount, fullPage: false });
    console.log(`  ✓ Saved: ${pAccurateCount}`);
    await countCtx.close();

    // -------------------------------------------------------------------------
    // SECTION 6: REAL EXTENSION FUNCTIONALITY (+2 DAYS AUDIT)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 6] Extension Business Rules (+2 Days Extension Audit)');

    // Test Chapter 92: Currently >24h remaining -> State A (Locked)
    const extCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });
    await extCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const extPage = await extCtx.newPage();
    await extPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await extPage.waitForTimeout(2500);

    const day7 = extPage.locator('.matrix-day-cell:not(.is-other-month)').filter({ has: extPage.locator('.cell-day-num', { hasText: '7' }) }).first();
    if (await day7.count() > 0) {
      await day7.click();
      await extPage.waitForTimeout(600);
      const acc7 = extPage.locator('.context-accordion-bar').first();
      if (await acc7.count() > 0) {
        await acc7.click();
        await extPage.waitForTimeout(500);
      }
    }

    const lockedBtn = extPage.locator('.btn-extension-action.locked');
    const lockedNote = extPage.locator('.ext-helper-note');
    recordTest('State A: Extension is locked when >24h remaining', await lockedBtn.count() === 1 && await lockedBtn.isDisabled());
    recordTest('State A: Explanatory note shows unlock date/time', await lockedNote.count() === 1 && (await lockedNote.innerText()).includes('Disponível a partir de'));

    const pStateA = path.join(ARTIFACT_DIR, '08_extension_locked_state_a.png');
    await extPage.screenshot({ path: pStateA, fullPage: false });
    console.log(`  ✓ Saved: ${pStateA}`);

    // Now test State B & C using a dedicated test chapter #996
    console.log('\n  Setting up synthetic test chapter #996 for State B & C extension test...');
    await client.query(`
      DELETE FROM public.scan_chapter_timeline
      WHERE production_chapter_id IN (
        SELECT id FROM public.scan_production_chapters WHERE chapter_number = '996' AND scan_id = $1
      )
    `, [scanId]);
    await client.query(`
      DELETE FROM public.scan_chapter_stages
      WHERE production_chapter_id IN (
        SELECT id FROM public.scan_production_chapters WHERE chapter_number = '996' AND scan_id = $1
      )
    `, [scanId]);
    await client.query(`
      DELETE FROM public.scan_production_chapters WHERE chapter_number = '996' AND scan_id = $1
    `, [scanId]);

    // Create synthetic chapter #996 with due_at in 12 hours (within 24h window -> State B)
    const syn996 = await client.query(`
      INSERT INTO public.scan_production_chapters (
        scan_id, work_id, chapter_number, chapter_title, status, created_at, updated_at
      ) VALUES ($1, $2, '996', 'Capítulo Sintético Extensão R24.4', 'IN_PROGRESS', now(), now())
      RETURNING id
    `, [scanId, workId]);
    const syn996Id = syn996.rows[0].id;

    const syn996Stage = await client.query(`
      INSERT INTO public.scan_chapter_stages (
        scan_id, chapter_id, production_chapter_id, stage_id, status, assigned_to,
        claimed_at, due_at, extension_count, created_at, updated_at
      ) VALUES (
        $1, $2, $2, $3, 'IN_PROGRESS', $4, now() - interval '12 hours', now() + interval '4 hours', 0, now(), now()
      ) RETURNING id, due_at
    `, [scanId, syn996Id, tradStageId, testActorId]);
    const syn996StageId = syn996Stage.rows[0].id;

    // Reload calendar to view #996
    await extPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await extPage.waitForTimeout(2500);

    // Click today or day cell with #996
    const cellToday = extPage.locator('.matrix-day-cell.is-today').first();
    if (await cellToday.count() > 0) {
      await cellToday.click();
      await extPage.waitForTimeout(600);
      const acc996 = extPage.locator('.context-accordion-bar').filter({ hasText: '996' }).first();
      if (await acc996.count() > 0) {
        await acc996.click();
        await extPage.waitForTimeout(500);
      }
    }

    // State B: Extension available
    const availBtn = extPage.locator('.btn-extension-action.available');
    recordTest('State B: Extension button is active (⚡ Prorrogar +2 dias) when <=24h remaining', await availBtn.count() === 1 && await availBtn.isEnabled());

    // Click extension button to open confirmation modal
    if (await availBtn.count() > 0) {
      await availBtn.click();
      await extPage.waitForTimeout(600);

      const extModal = extPage.locator('.extension-modal-card');
      recordTest('State B: Extension confirmation modal opens cleanly', await extModal.count() === 1);

      const pStateB = path.join(ARTIFACT_DIR, '09_extension_available_modal_state_b.png');
      await extPage.screenshot({ path: pStateB, fullPage: false });
      console.log(`  ✓ Saved: ${pStateB}`);

      // Confirm extension
      const confirmExtBtn = extPage.locator('.btn-confirm-extend');
      if (await confirmExtBtn.count() > 0) {
        await confirmExtBtn.click();
        await extPage.waitForTimeout(2000);
      }

      // Check State C in database
      const stageAfterExt = await client.query(`
        SELECT due_at, extension_count, extended_at
        FROM public.scan_chapter_stages
        WHERE id = $1
      `, [syn996StageId]);
      const extRow = stageAfterExt.rows[0];
      recordTest('State C: extension_count incremented to 1 in database', extRow?.extension_count === 1, `extension_count: ${extRow?.extension_count}`);
      recordTest('State C: extended_at timestamp recorded', extRow?.extended_at !== null, `extended_at: ${extRow?.extended_at}`);

      // Check State C in UI: Discreet confirmation note, second extension blocked
      // Since deadline was extended by +2 days, navigate to the newly extended day cell
      const extDayNum = new Date(extRow.due_at).toLocaleDateString('pt-BR', { day: 'numeric', timeZone: 'America/Sao_Paulo' });
      console.log(`  Stage #996 moved to extended date: day ${extDayNum}`);
      await extPage.waitForTimeout(1000);

      const cellExt = extPage.locator('.matrix-day-cell:not(.is-other-month)').filter({ has: extPage.locator('.cell-day-num', { hasText: extDayNum }) }).first();
      if (await cellExt.count() > 0) {
        await cellExt.click();
        await extPage.waitForTimeout(600);
        const accExt = extPage.locator('.context-accordion-bar').filter({ hasText: '996' }).first();
        if (await accExt.count() > 0) {
          await accExt.click();
          await extPage.waitForTimeout(500);
        }
      }

      const discNote = extPage.locator('.ext-discreet-confirmation');
      recordTest('State C: UI displays discreet confirmation note (second extension blocked)', await discNote.count() === 1 && (await discNote.innerText()).includes('Prazo prorrogado até'));

      const pStateC = path.join(ARTIFACT_DIR, '10_extension_applied_state_c.png');
      await extPage.screenshot({ path: pStateC, fullPage: false });
      console.log(`  ✓ Saved: ${pStateC}`);
    }

    // Clean up synthetic #996
    await client.query(`DELETE FROM public.scan_chapter_timeline WHERE production_chapter_id = $1`, [syn996Id]);
    await client.query(`DELETE FROM public.scan_chapter_stages WHERE id = $1`, [syn996StageId]);
    await client.query(`DELETE FROM public.scan_production_chapters WHERE id = $1`, [syn996Id]);
    console.log('  ✓ Cleaned up synthetic extension test chapter #996.');
    await extCtx.close();

    // -------------------------------------------------------------------------
    // SECTION 7: REAL CONTINUOUS NAVIGATION STABILITY (32 TRANSITIONS)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 7] Continuous Navigation Stability Suite (32 Transitions)');

    const navCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });
    await navCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const navPage = await navCtx.newPage();
    await navPage.goto(`${PREVIEW_URL}/scan?tab=home`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await navPage.waitForTimeout(2000);

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

      const currentUrl = navPage.url();
      const tabMatch = target.stage ? currentUrl.includes(target.stage) : currentUrl.includes(`tab=${target.tab}`);
      const targetElementCount = await navPage.locator(target.selector).count();

      if (!tabMatch || targetElementCount === 0) {
        transitionFailures++;
        console.error(`  ❌ Transition ${i + 1}/${navigationTargets.length} FAILED: target ${target.tab}${target.stage ? '/' + target.stage : ''}, URL: ${currentUrl}, rendered: ${targetElementCount > 0}`);
      }
    }

    recordTest('32 Consecutive Scan Navigation Transitions (No Bounce-back / No Reload)', transitionFailures === 0, `Failures: ${transitionFailures} / 32`);

    const pNavSuite = path.join(ARTIFACT_DIR, '11_navigation_stability_suite.png');
    await navPage.screenshot({ path: pNavSuite, fullPage: false });
    console.log(`  ✓ Saved: ${pNavSuite}`);
    await navCtx.close();

    // -------------------------------------------------------------------------
    // SECTION 8: CALENDAR OVERVIEW & INVARIANTS ARTIFACT
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 8] Invariants and Calendar Overview Artifact');

    const oCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });
    await oCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const oPage = await oCtx.newPage();
    await oPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await oPage.waitForTimeout(2500);

    const pOverview = path.join(ARTIFACT_DIR, '12_invariants_and_calendar_overview.png');
    await oPage.screenshot({ path: pOverview, fullPage: false });
    console.log(`  ✓ Saved: ${pOverview}`);
    await oCtx.close();

    await browser.close();

    // Write test summary json
    const summaryPath = path.join(ARTIFACT_DIR, 'test_summary_round24_4.json');
    fs.writeFileSync(summaryPath, JSON.stringify(testResults, null, 2), 'utf8');
    console.log(`\n  ✓ Saved: ${summaryPath}`);

    console.log('\n========================================================================');
    console.log(`🏁 SUITE COMPLETE: ${testResults.passed} PASSED / ${testResults.failed} FAILED`);
    console.log('========================================================================');

    if (testResults.failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('FATAL in homologate_round24_4:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
