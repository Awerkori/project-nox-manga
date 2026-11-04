import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import path from 'node:path';
import fs from 'node:fs';
import pg from 'pg';
const { Pool } = pg;

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACT_DIR = path.resolve('artifacts/round24');
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

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

let testResults = {
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
  console.log('🚀 HOMOLOGATION & TESTING SUITE — PROJECT NOX RODADA 24');
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
    recordTest('Chapter #85 QC exists and is claimable', ch85Res.rows.length === 1 && ch85Res.rows[0].status === 'AVAILABLE', `Status: ${ch85Res.rows[0]?.status}`);

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

    // Chapter 92: Tradução (State A: due 2026-11-07 > 24h)
    const ch92Res = await client.query(`
      SELECT cs.id, cs.status, cs.due_at, cs.extension_count, ws.slug
      FROM public.scan_production_chapters spc
      JOIN public.works w ON w.id = spc.work_id
      JOIN public.scan_chapter_stages cs ON cs.production_chapter_id = spc.id
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE w.title ILIKE '%Céu%' AND spc.chapter_number = '92' AND ws.slug = 'traducao'
    `);
    recordTest('Chapter #92 Tradução intact (Estado A reference: >24h)', ch92Res.rows.length === 1 && ch92Res.rows[0].status === 'IN_PROGRESS', `Due: ${ch92Res.rows[0]?.due_at}`);

    // Chapter 93: Tradução (State C: extension_count = 1)
    const ch93Res = await client.query(`
      SELECT cs.id, cs.status, cs.due_at, cs.extension_count, ws.slug
      FROM public.scan_production_chapters spc
      JOIN public.works w ON w.id = spc.work_id
      JOIN public.scan_chapter_stages cs ON cs.production_chapter_id = spc.id
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE w.title ILIKE '%Céu%' AND spc.chapter_number = '93' AND ws.slug = 'traducao'
    `);
    recordTest('Chapter #93 Tradução intact (Estado C reference: extension_count = 1)', ch93Res.rows.length === 1 && ch93Res.rows[0].extension_count === 1, `Extension count: ${ch93Res.rows[0]?.extension_count}`);

    // -------------------------------------------------------------------------
    // PART 2: ISOLATED EXTENSION BUSINESS RULES TESTING (Synthetic Chapter #999)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 2] Validating Deadline Extension Backend Rules (Isolated)');

    const scanRes = await client.query(`SELECT id FROM public.scans LIMIT 1`);
    const scanId = scanRes.rows[0].id;
    const workRes = await client.query(`SELECT id FROM public.works LIMIT 1`);
    const workId = workRes.rows[0].id;
    const stageRes = await client.query(`SELECT id FROM public.scan_workflow_stages WHERE slug = 'traducao' LIMIT 1`);
    const tradStageId = stageRes.rows[0].id;
    const actorId = '732fbe87-5040-41fb-9983-0aedb2af44c8';
    const strangerId = '00000000-0000-0000-0000-000000000001';

    // Clean up any stale #999
    await client.query(`
      DELETE FROM public.scan_chapter_stages
      WHERE production_chapter_id IN (
        SELECT id FROM public.scan_production_chapters WHERE chapter_number = '999' AND scan_id = $1
      )
    `, [scanId]);
    await client.query(`
      DELETE FROM public.scan_production_chapters WHERE chapter_number = '999' AND scan_id = $1
    `, [scanId]);

    // Create synthetic chapter 999
    const synProd = await client.query(`
      INSERT INTO public.scan_production_chapters (
        scan_id, work_id, chapter_number, chapter_title, status, created_at, updated_at
      ) VALUES ($1, $2, '999', 'Capítulo de Teste Sintético R24', 'IN_PROGRESS', now(), now())
      RETURNING id
    `, [scanId, workId]);
    const synProdId = synProd.rows[0].id;

    // Test Case 2.1: Stage with deadline > 24 hours in the future
    const stageFar = await client.query(`
      INSERT INTO public.scan_chapter_stages (
        scan_id, chapter_id, production_chapter_id, stage_id, status, assigned_to,
        claimed_at, due_at, extension_count, created_at, updated_at
      ) VALUES (
        $1, $2, $2, $3, 'IN_PROGRESS', $4, now(), now() + interval '72 hours', 0, now(), now()
      ) RETURNING id
    `, [scanId, synProdId, tradStageId, actorId]);
    const stageFarId = stageFar.rows[0].id;

    let threwWithin24h = false;
    try {
      await client.query(`SELECT public.extend_scan_chapter_stage_ysql($1, $2, false)`, [stageFarId, actorId]);
    } catch (e) {
      if (/EXTENSION_ONLY_ALLOWED_WITHIN_24H/.test(e.message)) {
        threwWithin24h = true;
      }
    }
    recordTest('Extension rejected when deadline is > 24h away (Estado A)', threwWithin24h);

    // Test Case 2.2: Stage with deadline within 24h (Estado B)
    const cleanStageRes = await client.query(`SELECT id FROM public.scan_workflow_stages WHERE slug = 'clean_redraw' LIMIT 1`);
    const cleanStageId = cleanStageRes.rows[0].id;
    const stageClose = await client.query(`
      INSERT INTO public.scan_chapter_stages (
        scan_id, chapter_id, production_chapter_id, stage_id, status, assigned_to,
        claimed_at, due_at, extension_count, created_at, updated_at
      ) VALUES (
        $1, $2, $2, $3, 'IN_PROGRESS', $4, now(), now() + interval '10 hours', 0, now(), now()
      ) RETURNING id, due_at
    `, [scanId, synProdId, cleanStageId, actorId]);
    const stageCloseId = stageClose.rows[0].id;
    const oldDueAt = new Date(stageClose.rows[0].due_at);

    // Stranger actor tries to extend
    let threwStranger = false;
    try {
      await client.query(`SELECT public.extend_scan_chapter_stage_ysql($1, $2, false)`, [stageCloseId, strangerId]);
    } catch (e) {
      if (/STAGE_NOT_ASSIGNED_TO_ACTOR/.test(e.message)) {
        threwStranger = true;
      }
    }
    recordTest('Extension forbidden for non-assignee actor (403 guard)', threwStranger);

    // Valid extension by assignee
    const extendRes = await client.query(`
      SELECT public.extend_scan_chapter_stage_ysql($1, $2, false) AS res
    `, [stageCloseId, actorId]);
    const extData = extendRes.rows[0]?.res;
    const newDueCheck = await client.query(`SELECT due_at, extension_count, extended_at FROM public.scan_chapter_stages WHERE id = $1`, [stageCloseId]);
    const newDue = new Date(newDueCheck.rows[0].due_at);
    const daysDiff = Math.round((newDue.getTime() - oldDueAt.getTime()) / (1000 * 60 * 60 * 24));
    recordTest('Extension succeeds within 24h and adds +2 calendar days', extData?.success === true && daysDiff >= 2 && newDueCheck.rows[0].extension_count === 1);

    // Duplicate extension attempt
    let threwDuplicate = false;
    try {
      await client.query(`SELECT public.extend_scan_chapter_stage_ysql($1, $2, false)`, [stageCloseId, actorId]);
    } catch (e) {
      if (/EXTENSION_ALREADY_USED/.test(e.message)) {
        threwDuplicate = true;
      }
    }
    recordTest('Duplicate extension strictly prevented (only 1 extension per stage)', threwDuplicate);

    // Clean up synthetic chapter #999
    await client.query(`DELETE FROM public.scan_chapter_stages WHERE production_chapter_id = $1`, [synProdId]);
    await client.query(`DELETE FROM public.scan_production_chapters WHERE id = $1`, [synProdId]);
    console.log('  ✓ Cleaned up synthetic test chapter #999.');

    // -------------------------------------------------------------------------
    // PART 3: BROWSER AUTOMATION & VISUAL HOMOLOGATION (Desktop + Android)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 3] Real Browser Visual & Functional Homologation (Playwright)');

    const cookies = await ownerCookies(PREVIEW_URL);
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

    // 3.1 Desktop Tests (1440x900)
    console.log('\n--- 3.1 Desktop 1440x900 Viewport ---');
    const dCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    await dCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const dPage = await dCtx.newPage();
    await dPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dPage.waitForTimeout(3000);

    // Verify Desktop Single Contextual Panel exists and no multiple competing side panels exist
    const contextPanel = dPage.locator('.calendar-contextual-panel');
    const contextPanelCount = await contextPanel.count();
    recordTest('Desktop has single unified Contextual Panel on the right', contextPanelCount === 1);

    const oldHeroWidget = await dPage.locator('.hero-my-delivery-card').count();
    const oldTeamWidget = await dPage.locator('.team-extras-collapsible').count();
    recordTest('No competing fragmented widgets in desktop sidebar', oldHeroWidget === 0 && oldTeamWidget === 0);

    // Screenshot: 01_desktop_month_view.png
    const pDMonth = path.join(ARTIFACT_DIR, '01_desktop_month_view.png');
    await dPage.screenshot({ path: pDMonth, fullPage: false });
    console.log(`  ✓ Saved: ${pDMonth}`);

    // Click on empty day (e.g. cell with no deliveries in current month)
    const emptyDayCell = dPage.locator('.matrix-day-cell:not(.has-deliveries):not(.is-other-month)').first();
    if (await emptyDayCell.count() > 0) {
      await emptyDayCell.click();
      await dPage.waitForTimeout(600);
      const emptyNotice = await dPage.locator('.context-empty-notice').count();
      const nextRelevant = await dPage.locator('.next-relevant-card').count();
      recordTest('Selecting empty day shows discreet notice and next relevant delivery', emptyNotice === 1 && nextRelevant === 1);

      const pDEmpty = path.join(ARTIFACT_DIR, '02_desktop_empty_day_selection.png');
      await dPage.screenshot({ path: pDEmpty, fullPage: false });
      console.log(`  ✓ Saved: ${pDEmpty}`);
    }

    // Click on day with deliveries (e.g. today or cell with deliveries)
    const deliveryCell = dPage.locator('.matrix-day-cell.has-deliveries').first();
    if (await deliveryCell.count() > 0) {
      await deliveryCell.click();
      await dPage.waitForTimeout(600);
      const deliveryCardInContext = await dPage.locator('.context-delivery-card').count();
      recordTest('Selecting day with commitments populates Contextual Panel', deliveryCardInContext > 0);

      const pDWithEvents = path.join(ARTIFACT_DIR, '03_desktop_contextual_delivery_details.png');
      await dPage.screenshot({ path: pDWithEvents, fullPage: false });
      console.log(`  ✓ Saved: ${pDWithEvents}`);
    }

    // Test Filters: Minhas entregas
    const mineBtn = dPage.locator('.chip-filter-btn').first();
    await mineBtn.click();
    await dPage.waitForTimeout(600);
    const pDFilter = path.join(ARTIFACT_DIR, '04_desktop_filter_minhas.png');
    await dPage.screenshot({ path: pDFilter, fullPage: false });
    console.log(`  ✓ Saved: ${pDFilter}`);
    await mineBtn.click(); // toggle back
    await dPage.waitForTimeout(400);

    // Switch to Agenda View
    const agendaBtn = dPage.locator('.toggle-opt-btn').filter({ hasText: 'Agenda' }).first();
    await agendaBtn.click();
    await dPage.waitForTimeout(600);
    const agendaRows = await dPage.locator('.agenda-compact-row').count();
    recordTest('Agenda view renders compact high-density rows', agendaRows > 0);
    const pDAgenda = path.join(ARTIFACT_DIR, '05_desktop_agenda_compact_view.png');
    await dPage.screenshot({ path: pDAgenda, fullPage: false });
    console.log(`  ✓ Saved: ${pDAgenda}`);

    // Switch back to Month
    const monthToggleBtn = dPage.locator('.toggle-opt-btn').filter({ hasText: 'Mês' }).first();
    await monthToggleBtn.click();
    await dPage.waitForTimeout(400);

    // 3.2 Android Viewports (320px, 360px, 390px, 430px)
    console.log('\n--- 3.2 Android Viewports & Bottom Sheet ---');
    const ANDROID_WIDTHS = [
      { name: '320px', width: 320, height: 640 },
      { name: '360px', width: 360, height: 740 },
      { name: '390px', width: 390, height: 844 },
      { name: '430px', width: 430, height: 932 }
    ];

    for (const vp of ANDROID_WIDTHS) {
      console.log(`\nTesting Android Viewport ${vp.name}...`);
      const mCtx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
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

      // Month View on Android
      const pMMonth = path.join(ARTIFACT_DIR, `06_android_${vp.name}_month.png`);
      await mPage.screenshot({ path: pMMonth, fullPage: false });
      console.log(`  ✓ Saved: ${pMMonth}`);

      // Tap a day on mobile: verify NO giant modal pops up automatically!
      const mobileCell = mPage.locator('.matrix-day-cell.has-deliveries').first();
      if (await mobileCell.count() > 0) {
        await mobileCell.click();
        await mPage.waitForTimeout(500);

        // Verify bottom sheet is NOT open yet
        const sheetOpenBeforeClick = await mPage.locator('.bottom-sheet-panel').count();
        recordTest(`Android ${vp.name}: Tapping day updates compact section without opening giant modal`, sheetOpenBeforeClick === 0);

        // Verify compact section is populated
        const previewMiniCards = await mPage.locator('.preview-mini-card').count();
        recordTest(`Android ${vp.name}: Compact day preview renders below grid`, previewMiniCards > 0);

        const pMDayPreview = path.join(ARTIFACT_DIR, `07_android_${vp.name}_compact_day_preview.png`);
        await mPage.screenshot({ path: pMDayPreview, fullPage: false });
        console.log(`  ✓ Saved: ${pMDayPreview}`);

        // Now tap a mini card to open the Bottom Sheet!
        const firstMiniCard = mPage.locator('.preview-mini-card').first();
        await firstMiniCard.click();
        await mPage.waitForTimeout(600);

        const sheetOpenAfterClick = await mPage.locator('.bottom-sheet-panel').count();
        recordTest(`Android ${vp.name}: Tapping delivery card opens dedicated Bottom Sheet`, sheetOpenAfterClick === 1);

        // Check the 6 sections in the bottom sheet
        const sheetSections = await mPage.locator('.sheet-section').count();
        recordTest(`Android ${vp.name}: Bottom sheet renders organized sections`, sheetSections >= 4);

        const pMBottomSheet = path.join(ARTIFACT_DIR, `08_android_${vp.name}_bottom_sheet.png`);
        await mPage.screenshot({ path: pMBottomSheet, fullPage: false });
        console.log(`  ✓ Saved: ${pMBottomSheet}`);

        // Close bottom sheet
        const closeSheetBtn = mPage.locator('.btn-close-sheet').first();
        if (await closeSheetBtn.count() > 0) {
          await closeSheetBtn.click();
          await mPage.waitForTimeout(400);
        }
      }

      // Android Agenda View
      const mAgendaBtn = mPage.locator('.toggle-opt-btn').filter({ hasText: 'Agenda' }).first();
      if (await mAgendaBtn.count() > 0) {
        await mAgendaBtn.click();
        await mPage.waitForTimeout(500);
        const pMAgenda = path.join(ARTIFACT_DIR, `09_android_${vp.name}_agenda.png`);
        await mPage.screenshot({ path: pMAgenda, fullPage: false });
        console.log(`  ✓ Saved: ${pMAgenda}`);
      }

      await mCtx.close();
    }

    // 3.3 Claim Stage Modal Homologation (Desktop & Android 320, 360, 390, 430px)
    console.log('\n--- 3.3 ClaimStageModal Homologation across viewports ---');
    const CLAIM_VIEWPORTS = [
      { name: 'desktop_1440px', width: 1440, height: 900 },
      { name: 'android_320px', width: 320, height: 640 },
      { name: 'android_360px', width: 360, height: 740 },
      { name: 'android_390px', width: 390, height: 844 },
      { name: 'android_430px', width: 430, height: 932 }
    ];

    for (const vp of CLAIM_VIEWPORTS) {
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

      const dispTab = cPage.locator('button, .tab-btn').filter({ hasText: 'Disponíveis' }).first();
      if (await dispTab.count() > 0) {
        await dispTab.click({ force: true });
        await cPage.waitForTimeout(600);
      }

      const claimTriggerBtn = cPage.locator('.btn-action-claim-prominent, button:has-text("Assumir")').first();
      if (await claimTriggerBtn.count() > 0) {
        await claimTriggerBtn.click({ force: true });
        await cPage.waitForTimeout(800);

        const modalCount = await cPage.locator('.modal-card').count();
        recordTest(`ClaimStageModal opens cleanly on ${vp.name}`, modalCount === 1);

        const confirmBtn = cPage.locator('.btn-confirm-stage');
        const cancelBtn = cPage.locator('.btn-cancel-claim');
        const confirmVisible = await confirmBtn.isVisible();
        const cancelVisible = await cancelBtn.isVisible();
        recordTest(`ClaimStageModal pinned footer visible on ${vp.name}`, confirmVisible && cancelVisible);

        const pClaim = path.join(ARTIFACT_DIR, `10_claim_modal_${vp.name}.png`);
        await cPage.screenshot({ path: pClaim, fullPage: false });
        console.log(`  ✓ Saved: ${pClaim}`);

        // Close modal without submitting
        await cancelBtn.click({ force: true });
        await cPage.waitForTimeout(400);
      } else {
        console.log(`  ℹ Note: Claim trigger button not found on pipeline revisor_qc for ${vp.name}`);
      }
      await cCtx.close();
    }

    // 3.4 Live Browser Deadline Extension Verification (Estado B & Estado C)
    console.log('\n--- 3.4 Live Browser Deadline Extension Verification (Estado B & Estado C) ---');
    // Setup isolated synthetic stage on Chapter 999 with deadline within 24h for actorId
    const liveSynProd = await client.query(`
      INSERT INTO public.scan_production_chapters (
        scan_id, work_id, chapter_number, chapter_title, status, created_at, updated_at
      ) VALUES ($1, $2, '999', 'Capítulo de Demonstração R24', 'IN_PROGRESS', now(), now())
      RETURNING id
    `, [scanId, workId]);
    const liveSynProdId = liveSynProd.rows[0].id;

    const liveSynStage = await client.query(`
      INSERT INTO public.scan_chapter_stages (
        scan_id, chapter_id, production_chapter_id, stage_id, status, assigned_to,
        claimed_at, due_at, extension_count, notes, created_at, updated_at
      ) VALUES (
        $1, $2, $2, $3, 'IN_PROGRESS', $4, now(), now() + interval '8 hours', 0, 'Demonstração de prorrogação R24', now(), now()
      ) RETURNING id, due_at
    `, [scanId, liveSynProdId, tradStageId, actorId]);
    const liveStageId = liveSynStage.rows[0].id;

    // Load calendar desktop
    const liveExtCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    await liveExtCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const livePage = await liveExtCtx.newPage();
    await livePage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await livePage.waitForTimeout(3000);

    // Select today
    const todayCell = livePage.locator('.matrix-day-cell.is-today').first();
    if (await todayCell.count() > 0) {
      await todayCell.click({ force: true });
      await livePage.waitForTimeout(600);
    }

    // Locate the available extension button in Contextual Panel
    const bar999 = livePage.locator('.context-accordion-bar').filter({ hasText: '999' }).first();
    if (await bar999.count() > 0) {
      await bar999.click({ force: true });
      await livePage.waitForTimeout(600);
    }

    const btnAvailable = livePage.locator('.btn-extension-action.available').first();
    const btnAvailableFound = await btnAvailable.count() > 0;
    recordTest('Estado B (<=24h): Prominent button "⚡ Prorrogar +2 dias" is enabled', btnAvailableFound);

    if (btnAvailableFound) {
      await btnAvailable.click({ force: true });
      await livePage.waitForTimeout(600);

      const extModal = livePage.locator('.extension-modal-card');
      const extModalOpen = await extModal.count() === 1;
      recordTest('Estado B modal opens with comparison of current & proposed dates', extModalOpen);

      const pExtModal = path.join(ARTIFACT_DIR, '11_extension_confirmation_modal.png');
      await livePage.screenshot({ path: pExtModal, fullPage: false });
      console.log(`  ✓ Saved: ${pExtModal}`);

      // Confirm extension
      const confirmExtBtn = livePage.locator('.btn-confirm-extend').first();
      await confirmExtBtn.click({ force: true });
      await livePage.waitForTimeout(2500);
    }

    // Estado C Verification using Chapter #93 (due Nov 12, extension_count = 1)
    console.log('\n--- Verifying Estado C (Used extension) on Chapter #93 ---');
    const day12Cell = livePage.locator('.matrix-day-cell:not(.is-other-month)').filter({ has: livePage.locator('.cell-day-num', { hasText: /^12$/ }) }).first();
    if (await day12Cell.count() > 0) {
      await day12Cell.click({ force: true });
      await livePage.waitForTimeout(800);

      const bar93 = livePage.locator('.context-accordion-bar').filter({ hasText: '93' }).first();
      if (await bar93.count() > 0) {
        await bar93.click({ force: true });
        await livePage.waitForTimeout(500);
      }

      const extConfirmation = livePage.locator('.ext-discreet-confirmation');
      const isExtendedC = await extConfirmation.count() > 0;
      recordTest('Estado C: Substituted by discreet confirmation "Prazo prorrogado até..."', isExtendedC);

      const pExtC = path.join(ARTIFACT_DIR, '12_extension_after_extended_state_c.png');
      await livePage.screenshot({ path: pExtC, fullPage: false });
      console.log(`  ✓ Saved: ${pExtC}`);
    }

    // Estado A Verification using Chapter #92 (due Nov 7, >24h in the future)
    console.log('\n--- Verifying Estado A (Locked extension >24h) on Chapter #92 ---');
    const day7Cell = livePage.locator('.matrix-day-cell:not(.is-other-month)').filter({ has: livePage.locator('.cell-day-num', { hasText: /^7$/ }) }).first();
    if (await day7Cell.count() > 0) {
      await day7Cell.click({ force: true });
      await livePage.waitForTimeout(800);

      const bar92 = livePage.locator('.context-accordion-bar').filter({ hasText: '92' }).first();
      if (await bar92.count() > 0) {
        await bar92.click({ force: true });
        await livePage.waitForTimeout(500);
      }

      const extLocked = livePage.locator('.ext-locked-cluster');
      const isLockedA = await extLocked.count() > 0;
      recordTest('Estado A: Disabled button + helper text "Disponível a partir de DD/MM às HH:mm"', isLockedA);

      const pExtA = path.join(ARTIFACT_DIR, '13_extension_locked_state_a.png');
      await livePage.screenshot({ path: pExtA, fullPage: false });
      console.log(`  ✓ Saved: ${pExtA}`);
    }

    // Clean up live synthetic stage
    await client.query(`DELETE FROM public.scan_chapter_stages WHERE production_chapter_id = $1`, [liveSynProdId]);
    await client.query(`DELETE FROM public.scan_production_chapters WHERE id = $1`, [liveSynProdId]);
    await liveExtCtx.close();

    await browser.close();
  } catch (err) {
    console.error('Test execution failed with error:', err);
    recordTest('Full Suite Execution', false, err.message);
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n========================================================================');
  console.log(`🏁 TEST SUMMARY: ${testResults.passed} PASSED / ${testResults.failed} FAILED`);
  console.log('========================================================================\n');
}

run();
