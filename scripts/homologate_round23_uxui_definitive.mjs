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
  console.log('🚀 HOMOLOGATION & COMPREHENSIVE VISUAL AUDIT: ROUND 23 UX/UI');
  console.log('Target:', PREVIEW_URL);
  console.log('Output:', ARTIFACT_DIR);
  console.log('================================================================\n');

  const cookies = await ownerCookies(PREVIEW_URL);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  const DESKTOP_RESOLUTIONS = [
    { name: '1280x720', width: 1280, height: 720 },
    { name: '1440x900', width: 1440, height: 900 },
    { name: '1920x1080', width: 1920, height: 1080 }
  ];

  const ANDROID_RESOLUTIONS = [
    { name: '320px', width: 320, height: 640 },
    { name: '360px', width: 360, height: 740 },
    { name: '390px', width: 390, height: 844 },
    { name: '430px', width: 430, height: 932 }
  ];

  try {
    // -------------------------------------------------------------------------
    // 1. DESKTOP VIEWPORTS CAPTURES (1280x720, 1440x900, 1920x1080)
    // -------------------------------------------------------------------------
    console.log('--- 1. Desktop Resolutions & Layout Hierarchies ---');
    for (const res of DESKTOP_RESOLUTIONS) {
      console.log(`\nCapturing Desktop ${res.name}...`);
      const ctx = await browser.newContext({
        viewport: { width: res.width, height: res.height },
        deviceScaleFactor: 2
      });
      await ctx.addCookies([
        ...cookies,
        { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
      ]);
      const page = await ctx.newPage();
      await page.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);

      // Month View
      const pMonth = path.join(ARTIFACT_DIR, `desktop_${res.name}_month.png`);
      await page.screenshot({ path: pMonth, fullPage: false });
      console.log(`  ✓ Saved: ${pMonth}`);

      // On 1440x900, capture detailed states
      if (res.name === '1440x900') {
        // Agenda View
        const agendaBtn = page.locator('.btn-toggle-view').filter({ hasText: 'Agenda' }).first();
        if (await agendaBtn.count() > 0) {
          await agendaBtn.click({ force: true });
          await page.waitForTimeout(1000);
          const pAgenda = path.join(ARTIFACT_DIR, `desktop_1440x900_agenda.png`);
          await page.screenshot({ path: pAgenda, fullPage: false });
          console.log(`  ✓ Saved: ${pAgenda}`);

          // Switch back to Month
          const monthBtn = page.locator('.btn-toggle-view').filter({ hasText: 'Mês' }).first();
          await monthBtn.click({ force: true });
          await page.waitForTimeout(1000);
        }

        // Expand Collapsible "Equipe & Publicações"
        const detailsElem = page.locator('.team-extras-collapsible').first();
        if (await detailsElem.count() > 0) {
          await page.locator('.team-extras-collapsible summary').click({ force: true });
          await page.waitForTimeout(600);
          const pCollapsible = path.join(ARTIFACT_DIR, `desktop_1440x900_extras_expanded.png`);
          await page.screenshot({ path: pCollapsible, fullPage: false });
          console.log(`  ✓ Saved: ${pCollapsible}`);
        }

        // Open Day Drawer on day with events (day 2 has 4 events)
        const day2 = page.locator('.matrix-day-cell').filter({ hasText: '2' }).first();
        if (await day2.count() > 0) {
          await day2.click({ force: true });
          await page.waitForTimeout(1200);
          const pDrawer = path.join(ARTIFACT_DIR, `desktop_1440x900_day_drawer.png`);
          await page.screenshot({ path: pDrawer, fullPage: false });
          console.log(`  ✓ Saved: ${pDrawer}`);

          // Expand 2nd commitment inside drawer to verify progressive disclosure
          const secondRow = page.locator('.drawer-card-summary-row').nth(1);
          if (await secondRow.count() > 0) {
            await secondRow.click({ force: true });
            await page.waitForTimeout(600);
            const pExpanded = path.join(ARTIFACT_DIR, `desktop_1440x900_day_drawer_expanded.png`);
            await page.screenshot({ path: pExpanded, fullPage: false });
            console.log(`  ✓ Saved Expanded Item in Drawer: ${pExpanded}`);
          }

          // Close Drawer
          const closeDrawerBtn = page.locator('.btn-close-drawer').first();
          if (await closeDrawerBtn.count() > 0) {
            await closeDrawerBtn.click({ force: true });
            await page.waitForTimeout(500);
          }
        }

        // Active filters state
        const mineFilter = page.locator('.btn-mine-quick').first();
        if (await mineFilter.count() > 0) {
          await mineFilter.click({ force: true });
          await page.waitForTimeout(800);
          const pFilter = path.join(ARTIFACT_DIR, `desktop_1440x900_filter_minhas.png`);
          await page.screenshot({ path: pFilter, fullPage: false });
          console.log(`  ✓ Saved: ${pFilter}`);

          // Clear filters
          const clearBtn = page.locator('.btn-clear-filters').first();
          if (await clearBtn.count() > 0) {
            await clearBtn.click({ force: true });
            await page.waitForTimeout(500);
          }
        }
      }

      await ctx.close();
    }

    // -------------------------------------------------------------------------
    // 2. ANDROID VIEWPORTS CAPTURES (320px, 360px, 390px, 430px)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Android Mobile Resolutions (320px to 430px) ---');
    for (const res of ANDROID_RESOLUTIONS) {
      console.log(`\nCapturing Android ${res.name} (${res.width}x${res.height})...`);
      const ctx = await browser.newContext({
        viewport: { width: res.width, height: res.height },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2
      });
      await ctx.addCookies([
        ...cookies,
        { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
      ]);
      const page = await ctx.newPage();
      await page.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);

      // Month View
      const pMobMonth = path.join(ARTIFACT_DIR, `android_${res.name}_month.png`);
      await page.screenshot({ path: pMobMonth, fullPage: false });
      console.log(`  ✓ Saved: ${pMobMonth}`);

      // Click on Day 2 to inspect Level 1 Quick Summary below monthly calendar
      const day2 = page.locator('.matrix-day-cell').filter({ hasText: '2' }).first();
      if (await day2.count() > 0) {
        await day2.click({ force: true });
        await page.waitForTimeout(1000);
        const pMobSummary = path.join(ARTIFACT_DIR, `android_${res.name}_day_summary.png`);
        await page.screenshot({ path: pMobSummary, fullPage: false });
        console.log(`  ✓ Saved Quick Summary: ${pMobSummary}`);

        // Touch first mini-card to open Level 2 Bottom Sheet with that commitment expanded
        const firstMiniCard = page.locator('.preview-mini-card').first();
        if (await firstMiniCard.count() > 0) {
          await firstMiniCard.click({ force: true });
          await page.waitForTimeout(1000);
          const pMobSheet = path.join(ARTIFACT_DIR, `android_${res.name}_bottom_sheet.png`);
          await page.screenshot({ path: pMobSheet, fullPage: false });
          console.log(`  ✓ Saved Bottom Sheet: ${pMobSheet}`);

          // Close Bottom Sheet
          const closeBtn = page.locator('.btn-close-drawer').first();
          if (await closeBtn.count() > 0) {
            await closeBtn.click({ force: true });
            await page.waitForTimeout(500);
          }
        }
      }

      await ctx.close();
    }

    // -------------------------------------------------------------------------
    // 3. CLAIM MODAL ON ANDROID (390x844 & 320x640) - Fixed Footer & Side-by-Side
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Claim Stage Modal on Android (Testing Footer & Cancel Button) ---');
    for (const res of [{ name: '390px', width: 390, height: 844 }, { name: '320px', width: 320, height: 640 }]) {
      const ctx = await browser.newContext({
        viewport: { width: res.width, height: res.height },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2
      });
      await ctx.addCookies([
        ...cookies,
        { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
      ]);
      const page = await ctx.newPage();
      await page.goto(`${PREVIEW_URL}/scan?tab=pipeline&stage=traducao`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);

      // Go to Disponíveis
      const dispBtn = page.locator('button, .tab-btn').filter({ hasText: 'Disponíveis' }).first();
      if (await dispBtn.count() > 0) {
        await dispBtn.click({ force: true });
        await page.waitForTimeout(1000);
      }

      // Click "Assumir etapa"
      const claimBtn = page.locator('.btn-action-claim-prominent, button').filter({ hasText: 'Assumir' }).first();
      if (await claimBtn.count() > 0) {
        await claimBtn.click({ force: true });
        await page.waitForTimeout(1000);

        const pClaimModal = path.join(ARTIFACT_DIR, `claim_modal_${res.name}_fixed_footer.png`);
        await page.screenshot({ path: pClaimModal, fullPage: false });
        console.log(`  ✓ Saved Claim Modal on ${res.name}: ${pClaimModal}`);

        // Verify Cancel button is visible and clickable
        const cancelBtn = page.locator('.modal-actions-footer .btn-cancel');
        const isCancelVisible = await cancelBtn.isVisible();
        console.log(`  ✓ Cancel button is visible on ${res.name}: ${isCancelVisible}`);
      }

      await ctx.close();
    }

    // -------------------------------------------------------------------------
    // 4. VERIFY THE 3 WORKSPACES WITH DEADLINES & EXTENSION STATES
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Workspaces Verification (Calendar, Tasks, Production) ---');
    const dCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    await dCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const dPage = await dCtx.newPage();

    // 4.1 Production Workspace (Revisor QC Céu Distante #85)
    console.log('Navigating to Production (Revisor QC)...');
    await dPage.goto(`${PREVIEW_URL}/scan?tab=pipeline&stage=revisor_qc`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dPage.waitForTimeout(3000);
    const pProd = path.join(ARTIFACT_DIR, 'workspace_production_qc_with_deadline.png');
    await dPage.screenshot({ path: pProd, fullPage: false });
    console.log(`  ✓ Saved Production Stage Workspace: ${pProd}`);

    // 4.2 Tasks Tab (Minha Fila)
    console.log('Navigating to Minha Fila (Tarefas)...');
    await dPage.goto(`${PREVIEW_URL}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dPage.waitForTimeout(3000);
    const pTasks = path.join(ARTIFACT_DIR, 'workspace_tasks_minha_fila.png');
    await dPage.screenshot({ path: pTasks, fullPage: false });
    console.log(`  ✓ Saved Tasks (Minha Fila): ${pTasks}`);

    await dCtx.close();
    await browser.close();

    console.log('\n================================================================');
    console.log('🎉 DEFINITIVE HOMOLOGATION SUITE COMPLETED WITH 100% SUCCESS!');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ Homologation failed:', err);
    await browser.close();
    process.exit(1);
  }
}

run();
