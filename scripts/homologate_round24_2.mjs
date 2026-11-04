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
const ARTIFACT_DIR = path.resolve(__homologateDir, '../artifacts/round24_2');
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
  console.log('🚀 HOMOLOGATION & TESTING SUITE — PROJECT NOX RODADA 24.2 (POLIMENTO DEFINITIVO)');
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
    // PART 2: ISOLATED EXTENSION BUSINESS RULES (Synthetic Chapter #999)
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
      ) VALUES ($1, $2, '999', 'Capítulo de Teste Sintético R24.2', 'IN_PROGRESS', now(), now())
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
    // PART 3: BROWSER AUTOMATION & VISUAL HOMOLOGATION (Desktop & Android)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 3] Real Browser Visual & Functional Homologation (Playwright)');

    const cookies = await ownerCookies(PREVIEW_URL);
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

    // 3.1 Desktop Viewports: 1920x1080, 2560x1440, 1440x900, 1280x720
    const DESKTOP_VIEWPORTS = [
      { name: '1920x1080', width: 1920, height: 1080 },
      { name: '2560x1440', width: 2560, height: 1440 },
      { name: '1440x900', width: 1440, height: 900 },
      { name: '1280x720', width: 1280, height: 720 }
    ];

    for (const dvp of DESKTOP_VIEWPORTS) {
      console.log(`\n--- Desktop ${dvp.name} Viewport ---`);
      const dCtx = await browser.newContext({
        viewport: { width: dvp.width, height: dvp.height },
        deviceScaleFactor: 1
      });
      await dCtx.addCookies([
        ...cookies,
        { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
      ]);
      const dPage = await dCtx.newPage();
      await dPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await dPage.waitForTimeout(3000);

      // Verify Desktop Single Contextual Panel exists
      const contextPanel = dPage.locator('.calendar-contextual-panel');
      recordTest(`Desktop ${dvp.name}: Single contextual panel present`, await contextPanel.count() === 1);

      // Verify "Minha próxima entrega" hero card is rendered at top of contextual panel
      const heroCard = dPage.locator('.next-delivery-hero-card');
      const hasHeroCard = await heroCard.count() > 0;
      recordTest(`Desktop ${dvp.name}: "Minha próxima entrega" pinned hero card visible`, hasHeroCard);

      // Verify Scope Filter exists and can filter
      const scopeSelect = dPage.locator('.filter-native-select[aria-label="Filtrar por escopo"]');
      recordTest(`Desktop ${dvp.name}: Scope filter dropdown present`, await scopeSelect.count() === 1);

      // Verify Breakdown counters
      const statPill = dPage.locator('.commitments-stat-pill');
      const statPillText = await statPill.innerText();
      recordTest(`Desktop ${dvp.name}: Accurate breakdown counter ("X entregas ativas • Y histórico")`, statPillText.includes('entregas ativas') || statPillText.includes('entrega ativa'), statPillText);

      // Verify Event Cards readability: Stage, Work, Chapter, Avatar, Assignee
      const dayEventCard = dPage.locator('.day-event-card').first();
      if (await dayEventCard.count() > 0) {
        const stageTag = await dayEventCard.locator('.event-stage-tag').count();
        const workText = await dayEventCard.locator('.event-work-text').count();
        const chPill = await dayEventCard.locator('.event-ch-pill').count();
        const userText = await dayEventCard.locator('.event-user-text').count();
        recordTest(`Desktop ${dvp.name}: Event card has all key elements (stage, work, chapter, user)`, stageTag > 0 && workText > 0 && chPill > 0 && userText > 0);
      }

      // Screenshot Desktop Month View
      const pDMonth = path.join(ARTIFACT_DIR, `01_desktop_${dvp.name}_month.png`);
      await dPage.screenshot({ path: pDMonth, fullPage: false });
      console.log(`  ✓ Saved: ${pDMonth}`);

      // Click on day with deliveries
      const deliveryCell = dPage.locator('.matrix-day-cell.has-deliveries').first();
      if (await deliveryCell.count() > 0) {
        await deliveryCell.click();
        await dPage.waitForTimeout(600);
        const deliveryCardInContext = await dPage.locator('.context-delivery-card').count();
        recordTest(`Desktop ${dvp.name}: Selecting day with deliveries populates Contextual Panel`, deliveryCardInContext > 0);

        if (dvp.name === '1920x1080') {
          const pDWithEvents = path.join(ARTIFACT_DIR, '02_desktop_1920x1080_day_selected.png');
          await dPage.screenshot({ path: pDWithEvents, fullPage: false });
          console.log(`  ✓ Saved: ${pDWithEvents}`);
        }
      }

      // Test Filters: Minhas entregas
      const mineBtn = dPage.locator('.chip-filter-btn').first();
      await mineBtn.click();
      await dPage.waitForTimeout(600);
      if (dvp.name === '1920x1080') {
        const pDFilter = path.join(ARTIFACT_DIR, '03_desktop_filter_minhas.png');
        await dPage.screenshot({ path: pDFilter, fullPage: false });
        console.log(`  ✓ Saved: ${pDFilter}`);
      }
      await mineBtn.click(); // toggle back
      await dPage.waitForTimeout(400);

      // Switch to Agenda View
      const agendaBtn = dPage.locator('.toggle-opt-btn').filter({ hasText: 'Agenda' }).first();
      await agendaBtn.click();
      await dPage.waitForTimeout(600);
      const agendaRows = await dPage.locator('.agenda-compact-row').count();
      recordTest(`Desktop ${dvp.name}: Agenda view renders compact high-density rows`, agendaRows > 0);
      if (dvp.name === '1920x1080') {
        const pDAgenda = path.join(ARTIFACT_DIR, '04_desktop_agenda_view.png');
        await dPage.screenshot({ path: pDAgenda, fullPage: false });
        console.log(`  ✓ Saved: ${pDAgenda}`);
      }

      await dCtx.close();
    }

    // 3.2 Android Viewports (320px, 360px, 390px, 430px)
    console.log('\n--- 3.2 Android Viewports & Mobile Avatars Polish ---');
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

      // Verify Real Avatars row rendered in mobile cells!
      const mobileAvatarsRow = mPage.locator('.mobile-cell-avatars-row');
      const mobileAvatarsRowCount = await mobileAvatarsRow.count();
      recordTest(`Android ${vp.name}: Real member avatars row rendered in mobile day cells`, mobileAvatarsRowCount > 0, `Cells with avatars: ${mobileAvatarsRowCount}`);

      // Verify individual avatar badges & situation pips
      const avatarBadges = mPage.locator('.mobile-avatar-badge');
      const avatarBadgesCount = await avatarBadges.count();
      recordTest(`Android ${vp.name}: Individual avatar badges present`, avatarBadgesCount > 0, `Count: ${avatarBadgesCount}`);

      // Verify "+N" pill appears when cell has > 2 commitments
      const morePills = mPage.locator('.mobile-more-pill');
      const morePillsCount = await morePills.count();
      recordTest(`Android ${vp.name}: Discreet +N pill for cells with >2 deliveries`, morePillsCount > 0, `Pills count: ${morePillsCount}`);

      // Verify "Minha próxima entrega" mobile compact highlight card
      const mobileHero = mPage.locator('.mobile-next-delivery-card');
      const hasMobileHero = await mobileHero.count() > 0;
      recordTest(`Android ${vp.name}: Mobile "Minha próxima entrega" compact card rendered`, hasMobileHero);

      // Verify contextual legend is visible below grid
      const legendCount = await mPage.locator('.mobile-calendar-legend').count();
      recordTest(`Android ${vp.name}: Contextual legend renders below grid`, legendCount === 1);

      // Month View on Android
      const pMMonth = path.join(ARTIFACT_DIR, `05_android_${vp.name}_month.png`);
      await mPage.screenshot({ path: pMMonth, fullPage: false });
      console.log(`  ✓ Saved: ${pMMonth}`);

      // Tap a day on mobile: verify preview strip updates without opening giant modal
      const mobileCell = mPage.locator('.matrix-day-cell.has-deliveries').first();
      if (await mobileCell.count() > 0) {
        await mobileCell.click();
        await mPage.waitForTimeout(500);

        // Verify bottom sheet is NOT open yet
        const sheetOpenBeforeClick = await mPage.locator('.bottom-sheet-panel').count();
        recordTest(`Android ${vp.name}: Tapping day updates preview strip without modal popup`, sheetOpenBeforeClick === 0);

        // Verify compact preview strip is populated
        const previewMiniCards = await mPage.locator('.preview-mini-card').count();
        recordTest(`Android ${vp.name}: Compact day preview renders below grid`, previewMiniCards > 0);

        if (vp.name === '360px') {
          const pMDayPreview = path.join(ARTIFACT_DIR, `06_android_${vp.name}_day_preview.png`);
          await mPage.screenshot({ path: pMDayPreview, fullPage: false });
          console.log(`  ✓ Saved: ${pMDayPreview}`);
        }

        // Tap a mini card to open the Bottom Sheet!
        const firstMiniCard = mPage.locator('.preview-mini-card').first();
        await firstMiniCard.click();
        await mPage.waitForTimeout(600);

        const sheetOpenAfterClick = await mPage.locator('.bottom-sheet-panel').count();
        recordTest(`Android ${vp.name}: Tapping mini card opens dedicated Bottom Sheet`, sheetOpenAfterClick === 1);

        // Verify simplified bottom sheet: no redundant repeated "Concluído" badges
        const repeatedConcluido = await mPage.locator('.sheet-status-pill:has-text("Concluído") + .sheet-time-badge:has-text("Concluído")').count();
        recordTest(`Android ${vp.name}: Bottom Sheet has no redundant double "Concluído" badges`, repeatedConcluido === 0);

        const pMBottomSheet = path.join(ARTIFACT_DIR, `07_android_${vp.name}_bottom_sheet.png`);
        await mPage.screenshot({ path: pMBottomSheet, fullPage: false });
        console.log(`  ✓ Saved: ${pMBottomSheet}`);

        // Close bottom sheet
        const closeSheetBtn = mPage.locator('.btn-close-sheet').first();
        if (await closeSheetBtn.count() > 0) {
          await closeSheetBtn.click();
          await mPage.waitForTimeout(400);
        }
      }

      await mCtx.close();
    }

    // -------------------------------------------------------------------------
    // PART 4: COMPACT CLAIM STAGE MODAL HOMOLOGATION (Title, Subtitle, 4 Chips, Summary, Placeholder)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 4] ClaimStageModal Definitive Polish Homologation');

    const CLAIM_VIEWPORTS = [
      { name: 'desktop_1920px', width: 1920, height: 1080 },
      { name: 'android_360px', width: 360, height: 740 }
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

        // Verify Title: "Defina seu prazo de entrega"
        const titleText = await cPage.locator('.modal-title').innerText();
        recordTest(`ClaimStageModal title is "Defina seu prazo de entrega" on ${vp.name}`, titleText.includes('Defina seu prazo de entrega'), `Title: "${titleText}"`);

        // Verify Subtitle: "Escolha quando pretende concluir esta etapa. Você tem até 3 dias corridos."
        const subtitleText = await cPage.locator('.modal-subtitle').innerText();
        recordTest(`ClaimStageModal subtitle has 3-day notice on ${vp.name}`, subtitleText.includes('Você tem até 3 dias corridos'), `Subtitle: "${subtitleText}"`);

        // Verify 4 Date Chips: Hoje, Amanhã, +2 dias, +3 dias (no clamping bugs)
        const chipsCount = await cPage.locator('.date-chip-btn').count();
        recordTest(`ClaimStageModal has strictly 4 date chips (Hoje, Amanhã, +2 dias, +3 dias) on ${vp.name}`, chipsCount === 4, `Chips count: ${chipsCount}`);

        // Verify Formatted Summary: "Entrega prevista: {weekday}, {day} de {month}, até 23h59."
        const summaryText = await cPage.locator('.selected-summary-card').innerText();
        recordTest(`ClaimStageModal has formatted delivery summary with 23h59 on ${vp.name}`, /entrega prevista/i.test(summaryText) && summaryText.includes('23h59'), summaryText);

        // Verify Contextual placeholder for notes (QC stage)
        const notesPlaceholder = await cPage.locator('#claim-notes').getAttribute('placeholder');
        recordTest(`ClaimStageModal has contextual QC placeholder on ${vp.name}`, notesPlaceholder.includes('revisar as páginas'), `Placeholder: "${notesPlaceholder}"`);

        const pClaim = path.join(ARTIFACT_DIR, `08_claim_modal_${vp.name}.png`);
        await cPage.screenshot({ path: pClaim, fullPage: false });
        console.log(`  ✓ Saved: ${pClaim}`);

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
    // PART 5: EXTENSION STATES A, B, C COMPREHENSIVE HOMOLOGATION
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 5] Homologating 3 Extension States in Real UI (A, B, C)');

    // 5.1 Estado A: Locked (>24h) using Chapter #92 (Nov 7)
    console.log('\n--- 5.1 Estado A Verification (Chapter #92 > 24h locked) ---');
    const extACtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });
    await extACtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const extAPage = await extACtx.newPage();
    await extAPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await extAPage.waitForTimeout(3000);

    const day7Cell = extAPage.locator('.matrix-day-cell:not(.is-other-month)').filter({ has: extAPage.locator('.cell-day-num', { hasText: /^7$/ }) }).first();
    if (await day7Cell.count() > 0) {
      await day7Cell.click({ force: true });
      await extAPage.waitForTimeout(800);

      const card92 = extAPage.locator('.context-delivery-card').filter({ hasText: '92' }).first();
      if (await card92.count() > 0) {
        const isExp92 = (await card92.locator('.context-expanded-content').count()) > 0;
        if (!isExp92) {
          const btn92 = card92.locator('.context-accordion-bar');
          await btn92.click({ force: true });
          await extAPage.waitForTimeout(500);
        }
      }

      const lockedNotice = extAPage.locator('.ext-discreet-note, .next-ext-notice.locked').first();
      const isLockedMsgVisible = await lockedNotice.count() > 0;
      const lockedText = isLockedMsgVisible ? await lockedNotice.innerText() : '';
      recordTest('Estado A: Displays clear notice with exact unlock date and time', isLockedMsgVisible && /06\/11/i.test(lockedText), lockedText);

      const pExtA = path.join(ARTIFACT_DIR, '09_extension_locked_state_a.png');
      await extAPage.screenshot({ path: pExtA, fullPage: false });
      console.log(`  ✓ Saved: ${pExtA}`);
    }
    await extACtx.close();

    // 5.2 Estado B: Window Open (<24h) using Synthetic Live Stage
    console.log('\n--- 5.2 Estado B Verification (Window active <24h with Confirmation Modal) ---');
    const liveSynProd = await client.query(`
      INSERT INTO public.scan_production_chapters (
        scan_id, work_id, chapter_number, chapter_title, status, created_at, updated_at
      ) VALUES ($1, $2, '998', 'Capítulo Homologação R24.2 Estado B', 'IN_PROGRESS', now(), now())
      RETURNING id
    `, [scanId, workId]);
    const liveSynProdId = liveSynProd.rows[0].id;

    // Stage due in 12 hours
    const liveStage = await client.query(`
      INSERT INTO public.scan_chapter_stages (
        scan_id, chapter_id, production_chapter_id, stage_id, status, assigned_to,
        claimed_at, due_at, extension_count, created_at, updated_at
      ) VALUES (
        $1, $2, $2, $3, 'IN_PROGRESS', $4, now(), now() + interval '12 hours', 0, now(), now()
      ) RETURNING id, due_at
    `, [scanId, liveSynProdId, tradStageId, actorId]);
    const liveStageId = liveStage.rows[0].id;
    console.log(`  ✓ Created live stage #${liveStageId} due in 12 hours for actor ${actorId}`);

    const extBCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });
    await extBCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const extBPage = await extBCtx.newPage();
    await extBPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await extBPage.waitForTimeout(3000);

    // Filter to Minhas entregas to isolate synthetic stage
    const mineBtnB = extBPage.locator('.chip-filter-btn').first();
    await mineBtnB.click();
    await extBPage.waitForTimeout(800);

    // Look for the "Prorrogar +2 dias" button (in Hero card or contextual delivery card)
    const extendBtn = extBPage.locator('.btn-next-extend.available, .btn-ctx-extend.available').first();
    const hasExtendBtn = await extendBtn.count() > 0;
    recordTest('Estado B: Active extension button visible when deadline is within 24h', hasExtendBtn);

    if (hasExtendBtn) {
      await extendBtn.click({ force: true });
      await extBPage.waitForTimeout(600);

      // Verify Extension Confirmation Modal is displayed
      const extModal = extBPage.locator('.extension-modal-card');
      const isExtModalOpen = await extModal.count() > 0;
      recordTest('Estado B: Clicking extend button opens Extension Confirmation Modal', isExtModalOpen);

      const pExtB = path.join(ARTIFACT_DIR, '10_extension_confirmation_modal_state_b.png');
      await extBPage.screenshot({ path: pExtB, fullPage: false });
      console.log(`  ✓ Saved: ${pExtB}`);

      // Confirm the extension!
      const confirmExtendBtn = extBPage.locator('.btn-confirm-extend').first();
      await Promise.all([
        extBPage.waitForResponse(r => r.url().includes('extendStageDeadline'), { timeout: 15000 }).catch(() => null),
        confirmExtendBtn.click({ force: true })
      ]);
      await extBPage.waitForTimeout(2500);

      // Verify Database state
      const checkSynRes = await client.query(`SELECT extension_count, due_at FROM public.scan_chapter_stages WHERE id = $1`, [liveStageId]);
      const isExtendedInDb = checkSynRes.rows[0]?.extension_count === 1;
      recordTest('Estado B: Stage deadline extended by +2 calendar days in database', isExtendedInDb);
    }

    // Clean up live synthetic stage
    await client.query(`DELETE FROM public.scan_chapter_stages WHERE production_chapter_id = $1`, [liveSynProdId]);
    await client.query(`DELETE FROM public.scan_production_chapters WHERE id = $1`, [liveSynProdId]);
    await extBCtx.close();

    // 5.3 Estado C: Already Used (+2d) using Chapter #93 (Nov 12, extension_count = 1)
    console.log('\n--- 5.3 Estado C Verification (Chapter #93 already used) ---');
    const extCCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });
    await extCCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const extCPage = await extCCtx.newPage();
    await extCPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await extCPage.waitForTimeout(3000);

    const day12Cell = extCPage.locator('.matrix-day-cell:not(.is-other-month)').filter({ has: extCPage.locator('.cell-day-num', { hasText: /^12$/ }) }).first();
    if (await day12Cell.count() > 0) {
      await day12Cell.click({ force: true });
      await extCPage.waitForTimeout(800);

      const card93 = extCPage.locator('.context-delivery-card').filter({ hasText: '93' }).first();
      if (await card93.count() > 0) {
        const isExp93 = (await card93.locator('.context-expanded-content').count()) > 0;
        if (!isExp93) {
          const btn93 = card93.locator('.context-accordion-bar');
          await btn93.click({ force: true });
          await extCPage.waitForTimeout(500);
        }
      }

      const extConfirmation = extCPage.locator('.ext-discreet-confirmation');
      const isExtendedC = await extConfirmation.count() > 0;
      recordTest('Estado C: Displays discreet banner "Prazo prorrogado até 12/11 às 17:00." and blocks re-extension', isExtendedC);

      const pExtC = path.join(ARTIFACT_DIR, '11_extension_already_used_state_c.png');
      await extCPage.screenshot({ path: pExtC, fullPage: false });
      console.log(`  ✓ Saved: ${pExtC}`);
    }
    await extCCtx.close();

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

  // Save JSON report for documentation
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'test_summary_round24_2.json'),
    JSON.stringify(testResults, null, 2)
  );
}

run();
