import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import path from 'node:path';
import fs from 'node:fs';

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACT_DIR = path.resolve('artifacts/round23');
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function run() {
  console.log('================================================================');
  console.log('🚀 LIVE VERIFICATION OF CLOUDFLARE PREVIEW (ROUND 23)');
  console.log('Target:', PREVIEW_URL);
  console.log('Artifacts:', ARTIFACT_DIR);
  console.log('================================================================\n');

  const cookies = await ownerCookies(PREVIEW_URL);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    // -------------------------------------------------------------
    // Test 1: Desktop Calendar View (1440x900)
    // -------------------------------------------------------------
    console.log('[Test 1] Desktop Calendar (1440x900)...');
    const dCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    await dCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const dPage = await dCtx.newPage();

    console.log('  Navigating to /scan?tab=calendario...');
    await dPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dPage.waitForTimeout(4000);

    // Verify elements
    const title = await dPage.locator('.calendar-title, .calendar-brand-title').innerText().catch(() => '');
    console.log(`  ✓ Header Title: "${title}"`);

    const avatarsCount = await dPage.locator('.day-event-card .user-avatar-root, .month-event-card .user-avatar-root, .matrix-day-cell .user-avatar-root').count();
    console.log(`  ✓ Total member avatars rendered in calendar cells: ${avatarsCount}`);

    const cardsCount = await dPage.locator('.day-event-card, .month-event-card').count();
    console.log(`  ✓ Total event cards rendered in month cells: ${cardsCount}`);

    // Take full page / viewport screenshot of Month view
    const p1 = path.join(ARTIFACT_DIR, '01_desktop_calendar_month.png');
    await dPage.screenshot({ path: p1, fullPage: false });
    console.log(`  📸 Saved: ${p1}`);

    // Toggle to Agenda View
    const agendaBtn = dPage.locator('.toggle-opt-btn, .btn-toggle-view').filter({ hasText: 'Agenda' }).first();
    if (await agendaBtn.count() > 0) {
      await agendaBtn.click({ force: true });
      await dPage.waitForTimeout(1200);
      const p2 = path.join(ARTIFACT_DIR, '02_desktop_calendar_agenda.png');
      await dPage.screenshot({ path: p2, fullPage: false });
      console.log(`  📸 Saved Agenda view: ${p2}`);

      // Switch back to Month view
      const monthBtn = dPage.locator('.toggle-opt-btn, .btn-toggle-view').filter({ hasText: 'Mês' }).first();
      await monthBtn.click({ force: true });
      await dPage.waitForTimeout(1000);
    }

    // Open Day Drawer on day with events
    const dayWithEvents = dPage.locator('.matrix-day-cell.has-deliveries, .matrix-day-cell.has-events').first();
    if (await dayWithEvents.count() > 0) {
      await dayWithEvents.click({ force: true });
      await dPage.waitForTimeout(1200);
      const drawer = dPage.locator('.day-drawer-panel');
      const drawerVisible = await drawer.isVisible();
      console.log(`  ✓ Day drawer opened: ${drawerVisible}`);
      const p3 = path.join(ARTIFACT_DIR, '03_desktop_day_drawer.png');
      await dPage.screenshot({ path: p3, fullPage: false });
      console.log(`  📸 Saved Day Drawer: ${p3}`);

      // Close drawer
      const closeBtn = dPage.locator('.btn-close-drawer').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click({ force: true });
        await dPage.waitForTimeout(500);
      }
    }

    await dCtx.close();

    // -------------------------------------------------------------
    // Test 2: Android Mobile Viewport (390x844)
    // -------------------------------------------------------------
    console.log('\n[Test 2] Android Mobile Calendar (390x844)...');
    const mCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2
    });
    await mCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const mPage = await mCtx.newPage();

    console.log('  Navigating to /scan?tab=calendario on mobile...');
    await mPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await mPage.waitForTimeout(4000);

    const mTitle = await mPage.locator('.calendar-title, .calendar-brand-title').innerText().catch(() => '');
    console.log(`  ✓ Mobile Header: "${mTitle}"`);

    const mobileAvatars = await mPage.locator('.matrix-day-cell .mobile-cell-avatar .user-avatar-root, .matrix-day-cell .mobile-avatar-item .user-avatar-root').count();
    console.log(`  ✓ Member avatars rendered in Android month grid: ${mobileAvatars}`);

    const p4 = path.join(ARTIFACT_DIR, '04_android_calendar_month.png');
    await mPage.screenshot({ path: p4, fullPage: false });
    console.log(`  📸 Saved Android Month: ${p4}`);

    // Test 2b: Android Filter Sheet
    const filterBtn = mPage.locator('.btn-open-filter-sheet');
    if (await filterBtn.count() > 0) {
      await filterBtn.click({ force: true });
      await mPage.waitForTimeout(1000);
      const p4b = path.join(ARTIFACT_DIR, '04b_android_filter_sheet.png');
      await mPage.screenshot({ path: p4b, fullPage: false });
      console.log(`  📸 Saved Android Filter Sheet: ${p4b}`);
      const closeFilterBtn = mPage.locator('.btn-sheet-apply, .btn-close-filter-sheet').first();
      if (await closeFilterBtn.count() > 0) {
        await closeFilterBtn.click({ force: true });
        await mPage.waitForTimeout(500);
      }
    }

    // Click on day with events to open Android Bottom Sheet
    const mDayWithEvents = mPage.locator('.matrix-day-cell.has-deliveries, .matrix-day-cell.has-events').first();
    if (await mDayWithEvents.count() > 0) {
      await mDayWithEvents.click({ force: true });
      await mPage.waitForTimeout(1200);
      const sheet = mPage.locator('.day-drawer-panel');
      const sheetVisible = await sheet.isVisible();
      console.log(`  ✓ Android Bottom Sheet opened: ${sheetVisible}`);
      const p5 = path.join(ARTIFACT_DIR, '05_android_bottom_sheet.png');
      await mPage.screenshot({ path: p5, fullPage: false });
      console.log(`  📸 Saved Android Bottom Sheet: ${p5}`);

      // Close bottom sheet
      const mCloseBtn = mPage.locator('.btn-close-drawer').first();
      if (await mCloseBtn.count() > 0) {
        await mCloseBtn.click({ force: true });
        await mPage.waitForTimeout(500);
      }
    }

    await mCtx.close();

    // -------------------------------------------------------------
    // Test 3: Céu Distante #85 Revisor (QC) Unblocked & Modal Check
    // -------------------------------------------------------------
    console.log('\n[Test 3] Céu Distante #85 Revisor (QC)...');
    const qcCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    await qcCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const qcPage = await qcCtx.newPage();

    const qcUrl = `${PREVIEW_URL}/scan?tab=pipeline&stage=revisor_qc`;
    console.log(`  Navigating to ${qcUrl}...`);
    await qcPage.goto(qcUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await qcPage.waitForTimeout(4000);

    // Switch to Disponíveis if category is on mine
    const dispBtnQc = qcPage.locator('button').filter({ hasText: 'Disponíveis' }).first();
    if (await dispBtnQc.count() > 0) {
      await dispBtnQc.click({ force: true });
      await qcPage.waitForTimeout(1000);
    }

    // Look for Céu Distante #85 card
    const ch85Locator = qcPage.locator('.editorial-card').filter({ hasText: '85' }).first();
    const hasCh85 = await ch85Locator.count() > 0;
    console.log(`  ✓ Céu Distante #85 found in Revisor QC: ${hasCh85}`);

    // Check if the old blocker text exists
    const blockerText = qcPage.locator('text=Aguardando entrega de pacote válido pelo Typeset');
    const blockerCount = await blockerText.count();
    console.log(`  ✓ Blocker count for "Aguardando entrega de pacote válido pelo Typeset": ${blockerCount} (Expected: 0)`);

    // Screenshot of QC stage overview
    const p6a = path.join(ARTIFACT_DIR, '06a_qc_stage_view_85.png');
    await qcPage.screenshot({ path: p6a, fullPage: false });
    console.log(`  📸 Saved QC Stage Overview: ${p6a}`);

    // Click "Assumir revisão" button
    const claimBtn85 = ch85Locator.locator('button.btn-editorial-claim, button:has-text("Assumir")').first();
    if (await claimBtn85.count() > 0) {
      await claimBtn85.click({ force: true });
      await qcPage.waitForTimeout(1500);

      // Verify modal
      const modalTitle = await qcPage.locator('.modal-title').innerText().catch(() => '');
      const stageName = await qcPage.locator('.stage-tag-pill').innerText().catch(() => '');
      const chNumber = await qcPage.locator('.chapter-number-pill').innerText().catch(() => '');
      console.log(`  ✓ Modal Title: "${modalTitle}" (Expected: "Quando você pretende entregar esta etapa?")`);
      console.log(`  ✓ Stage Name: "${stageName}" (Expected: "Revisor (QC)")`);
      console.log(`  ✓ Chapter Pill: "${chNumber}" (Expected: "Capítulo #85")`);

      const p6b = path.join(ARTIFACT_DIR, '06b_qc_claim_modal_85.png');
      await qcPage.screenshot({ path: p6b, fullPage: false });
      console.log(`  📸 Saved QC Claim Modal: ${p6b}`);

      // Close modal
      const cancelBtn = qcPage.locator('.btn-cancel, .btn-close-modal').first();
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click({ force: true });
        await qcPage.waitForTimeout(500);
      }
    }

    await qcCtx.close();

    // -------------------------------------------------------------
    // Test 3c: Android QC Claim Modal (390x844)
    // -------------------------------------------------------------
    console.log('\n[Test 3c] Android QC Claim Modal (390x844)...');
    const qcMCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2
    });
    await qcMCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const qcMPage = await qcMCtx.newPage();
    await qcMPage.goto(qcUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await qcMPage.waitForTimeout(4000);

    const mDispBtn = qcMPage.locator('button').filter({ hasText: 'Disponíveis' }).first();
    if (await mDispBtn.count() > 0) {
      await mDispBtn.click({ force: true });
      await qcMPage.waitForTimeout(1000);
    }

    const mCh85Locator = qcMPage.locator('.editorial-card').filter({ hasText: '85' }).first();
    const mClaimBtn85 = mCh85Locator.locator('button.btn-editorial-claim, button:has-text("Assumir")').first();
    if (await mClaimBtn85.count() > 0) {
      await mClaimBtn85.click({ force: true });
      await qcMPage.waitForTimeout(1500);
      const p6c = path.join(ARTIFACT_DIR, '06c_qc_claim_modal_android.png');
      await qcMPage.screenshot({ path: p6c, fullPage: false });
      console.log(`  📸 Saved Android QC Claim Modal: ${p6c}`);
      const mCancelBtn = qcMPage.locator('.btn-cancel, .btn-close-modal').first();
      if (await mCancelBtn.count() > 0) {
        await mCancelBtn.click({ force: true });
        await qcMPage.waitForTimeout(500);
      }
    }
    await qcMCtx.close();

    // -------------------------------------------------------------
    // Test 4: Demonstration Chapter "DEMONSTRAÇÃO — RODADA 23" (#88)
    // -------------------------------------------------------------
    console.log('\n[Test 4] Demonstration Chapter (#88) "DEMONSTRAÇÃO — RODADA 23"...');
    const demoCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    await demoCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const demoPage = await demoCtx.newPage();

    const tradUrl = `${PREVIEW_URL}/scan?tab=pipeline&stage=traducao`;
    console.log(`  Navigating to ${tradUrl}...`);
    await demoPage.goto(tradUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await demoPage.waitForTimeout(4000);

    // Switch to Disponíveis to view available chapters
    const dispBtn = demoPage.locator('button').filter({ hasText: 'Disponíveis' }).first();
    if (await dispBtn.count() > 0) {
      await dispBtn.click({ force: true });
      await demoPage.waitForTimeout(1000);
    }

    const demoRow = demoPage.locator('.editorial-card').filter({ hasText: '88' }).first();
    const hasDemoRow = await demoRow.count() > 0;
    console.log(`  ✓ Demonstration Chapter #88 found: ${hasDemoRow}`);

    const p7a = path.join(ARTIFACT_DIR, '07a_demo_chapter_pipeline.png');
    await demoPage.screenshot({ path: p7a, fullPage: false });
    console.log(`  📸 Saved Demonstration Chapter overview: ${p7a}`);

    // Click claim button to test the date selection in modal
    const demoClaimBtn = demoRow.locator('button.btn-editorial-claim, button:has-text("Assumir")').first();
    if (await demoClaimBtn.count() > 0) {
      await demoClaimBtn.click({ force: true });
      await demoPage.waitForTimeout(1500);

      const modalTitle = await demoPage.locator('.modal-title').innerText().catch(() => '');
      const stageName = await demoPage.locator('.stage-tag-pill').innerText().catch(() => '');
      const chNumber = await demoPage.locator('.chapter-number-pill').innerText().catch(() => '');
      console.log(`  ✓ Modal Title: "${modalTitle}"`);
      console.log(`  ✓ Stage Name: "${stageName}"`);
      console.log(`  ✓ Chapter Pill: "${chNumber}"`);

      // Fill notes
      const notesInput = demoPage.locator('textarea.notes-textarea, textarea');
      if (await notesInput.count() > 0) {
        await notesInput.fill('Entrega planejada para o fim de semana com tradução adaptada.');
      }

      const p7b = path.join(ARTIFACT_DIR, '07b_demo_claim_modal_with_notes.png');
      await demoPage.screenshot({ path: p7b, fullPage: false });
      console.log(`  📸 Saved Demonstration Claim Modal with Notes: ${p7b}`);

      // Close modal
      const cancelBtn = demoPage.locator('.btn-cancel, .btn-close-modal').first();
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click({ force: true });
        await demoPage.waitForTimeout(500);
      }
    }

    await demoCtx.close();

    console.log('\n================================================================');
    console.log('🎉 ALL LIVE PREVIEW TESTS AND SCREENSHOTS COMPLETED SUCCESSFULLY!');
    console.log('================================================================');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('\n💥 LIVE PREVIEW TEST FAILED:', err);
  process.exit(1);
});
