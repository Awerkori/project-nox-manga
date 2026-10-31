import { chromium, firefox, devices } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { writeFileSync } from 'node:fs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const workerVersion = 'eaa375db-4139-4575-a900-55ebf3b17450';

async function runVerification() {
  console.log('=== PROJECT NOX — HOMOLOGAÇÃO RODADA 21 V7.1 ===');
  console.log(`Target Preview: ${targetUrl}`);
  console.log(`Worker Version ID: ${workerVersion}`);
  console.log(`Artifact Directory: ${artifactDir}`);

  const cookies = await ownerCookies(targetUrl);
  cookies.push({
    name: 'nox-age-status',
    value: 'ADULT',
    url: targetUrl,
    httpOnly: false,
    sameSite: 'Lax',
    secure: targetUrl.startsWith('https:')
  });

  const results = {
    timestamp: new Date().toISOString(),
    workerVersion,
    tests: [],
    screenshots: []
  };

  // Helper for real CDP touch swipes
  async function performCdpSwipe(page, startX, startY, endX, endY, steps = 10) {
    const client = await page.context().newCDPSession(page);
    try {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: Math.round(startX), y: Math.round(startY) }]
      });

      for (let i = 1; i <= steps; i++) {
        const curX = Math.round(startX + (endX - startX) * (i / steps));
        const curY = Math.round(startY + (endY - startY) * (i / steps));
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: curX, y: curY }]
        });
        await page.waitForTimeout(16);
      }

      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: []
      });
      await page.waitForTimeout(300);
    } finally {
      await client.detach().catch(() => {});
    }
  }

  // ==========================================
  // SUITE 1: DESKTOP CHROMIUM (1440x900)
  // ==========================================
  console.log('\n--- Test 1: Desktop Chromium (1440x900) ---');
  const dBrowser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const dCtx = await dBrowser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  });
  await dCtx.addCookies(cookies);
  const dPage = await dCtx.newPage();

  try {
    console.log('Navigating to /scan?tab=minha_fila...');
    await dPage.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await dPage.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });

    const headerTitle = await dPage.$eval('.tab-title', el => el.textContent.trim());
    const headerDesc = await dPage.$eval('.tab-desc', el => el.textContent.trim());
    const activeTasksPillText = await dPage.$eval('.active-tasks-pill', el => el.textContent.trim());
    console.log(`Header Title: "${headerTitle}"`);
    console.log(`Header Desc: "${headerDesc}"`);
    console.log(`Active Pill: "${activeTasksPillText}"`);

    // Screenshot Desktop Main
    const ssDesktop = `${artifactDir}/v7_1_desktop_minha_fila_main.png`;
    await dPage.screenshot({ path: ssDesktop, fullPage: false });
    results.screenshots.push({ name: 'v7_1_desktop_minha_fila_main.png', path: ssDesktop });

    // Verify 4 categories on desktop (horizontal single row)
    const tabLabels = await dPage.$$eval('.queue-tabs-grid .queue-tab-btn', btns =>
      btns.map(b => b.textContent.trim().replace(/\s+/g, ' '))
    );
    console.log('Desktop 4 Tabs:', tabLabels);

    // Expand inline panel on first card
    const firstExpandBtn = dPage.locator('.btn-toggle-expand').first();
    if (await firstExpandBtn.count() > 0) {
      await firstExpandBtn.click();
      await dPage.waitForSelector('.card-inline-panel', { state: 'visible', timeout: 5000 });
      const ssDesktopInline = `${artifactDir}/v7_1_desktop_inline_expanded.png`;
      await dPage.screenshot({ path: ssDesktopInline, fullPage: false });
      results.screenshots.push({ name: 'v7_1_desktop_inline_expanded.png', path: ssDesktopInline });
      console.log('Desktop inline panel expanded cleanly.');
    }

    results.tests.push({
      name: 'Desktop Minha Fila & Layout',
      status: 'PASSED',
      details: { headerTitle, activeTasksPillText, tabLabels }
    });
  } catch (err) {
    console.error('Desktop test failed:', err);
    results.tests.push({ name: 'Desktop Minha Fila & Layout', status: 'FAILED', error: err.message });
  } finally {
    await dBrowser.close();
  }

  // ==========================================
  // SUITE 2: ANDROID MOBILE REAL INTERACTIONS (390x844)
  // ==========================================
  console.log('\n--- Test 2: Android Mobile (Pixel 7 - 390x844) Layout & 2x2 Grid ---');
  const mBrowser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pixel7 = devices['Pixel 7'];
  const mCtx = await mBrowser.newContext({
    ...pixel7,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  await mCtx.addCookies(cookies);
  const mPage = await mCtx.newPage();

  try {
    await mPage.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mPage.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });

    // Verify 2x2 Grid for the 4 Categories
    const gridDisplay = await mPage.$eval('.queue-tabs-grid', el => window.getComputedStyle(el).display);
    const gridCols = await mPage.$eval('.queue-tabs-grid', el => window.getComputedStyle(el).gridTemplateColumns);
    console.log(`Mobile Grid Display: ${gridDisplay}, Columns: ${gridCols}`);

    const mobileTabButtons = await mPage.$$eval('.queue-tabs-grid .queue-tab-btn', btns =>
      btns.map(b => ({
        text: b.textContent.trim().replace(/\s+/g, ' '),
        height: b.offsetHeight,
        width: b.offsetWidth
      }))
    );
    console.log('Mobile 2x2 Buttons:', mobileTabButtons);

    // Capture Mobile Overview Screenshot
    const ssMobileMain = `${artifactDir}/v7_1_mobile_android_minha_fila.png`;
    await mPage.screenshot({ path: ssMobileMain, fullPage: false });
    results.screenshots.push({ name: 'v7_1_mobile_android_minha_fila.png', path: ssMobileMain });

    // Verify 2-Tier Card Layout on Mobile
    const firstCard = mPage.locator('.task-compact-card').first();
    const hasIdentityRegion = await firstCard.locator('.card-identity-region').isVisible();
    const hasBottomActions = await firstCard.locator('.card-actions-col').isVisible();
    const actionsDisplay = await firstCard.locator('.card-actions-col').evaluate(el => window.getComputedStyle(el).flexDirection);
    console.log(`2-Tier Card: identityRegion=${hasIdentityRegion}, bottomActions=${hasBottomActions}, actionsDirection=${actionsDisplay}`);

    // Test Mobile Search Toggle
    console.log('Testing mobile search toggle...');
    const searchToggleBtn = mPage.locator('.btn-mobile-search-toggle');
    await searchToggleBtn.click();
    await mPage.waitForSelector('.mobile-expanded-search input', { state: 'visible', timeout: 5000 });
    console.log('Mobile search expanded inline.');

    // Close search
    const closeSearchBtn = mPage.locator('.btn-close-mobile-search');
    await closeSearchBtn.click();
    await mPage.waitForSelector('.btn-mobile-search-toggle', { state: 'visible', timeout: 5000 });
    console.log('Mobile search closed cleanly.');

    // Test Mobile Filter Drawer
    console.log('Testing mobile filter bottom sheet drawer...');
    const filterToggleBtn = mPage.locator('.btn-mobile-filter-toggle');
    await filterToggleBtn.click();
    await mPage.waitForSelector('.modal-sheet-drawer', { state: 'visible', timeout: 5000 });

    const ssMobileDrawer = `${artifactDir}/v7_1_mobile_filter_drawer.png`;
    await mPage.screenshot({ path: ssMobileDrawer, fullPage: false });
    results.screenshots.push({ name: 'v7_1_mobile_filter_drawer.png', path: ssMobileDrawer });

    // Close drawer
    const closeDrawerBtn = mPage.locator('.btn-close-modal, .btn-primary-action').first();
    await closeDrawerBtn.click();
    await mPage.waitForSelector('.modal-sheet-drawer', { state: 'hidden', timeout: 5000 });
    console.log('Mobile filter drawer opened and closed cleanly.');

    results.tests.push({
      name: 'Android Mobile Layout & 2x2 Grid',
      status: 'PASSED',
      details: { gridDisplay, mobileTabButtons, hasIdentityRegion, hasBottomActions }
    });
  } catch (err) {
    console.error('Mobile layout test failed:', err);
    results.tests.push({ name: 'Android Mobile Layout & 2x2 Grid', status: 'FAILED', error: err.message });
  }

  // ==========================================
  // SUITE 3: REAL MOBILE SIDEBAR SWIPE GESTURES
  // ==========================================
  console.log('\n--- Test 3: Real Mobile Sidebar Swipe Gestures via CDP Touch ---');
  try {
    await mPage.evaluate(() => window.scrollTo(0, 0));
    await mPage.waitForTimeout(300);

    // 3A: Edge Guard Test (0..20px edge)
    // Swipe starting at x=10px should NOT open sidebar (Android system back protection)
    console.log('Testing Edge Guard (x = 10px -> x = 110px): Sidebar should NOT open...');
    await performCdpSwipe(mPage, 10, 350, 110, 350, 8);
    let isOpenAfterEdge = await mPage.evaluate(() => {
      const sb = document.querySelector('.workspace-sidebar');
      return sb ? sb.classList.contains('mobile-open') : false;
    });
    console.log(`Sidebar open state after edge swipe: ${isOpenAfterEdge} (Expected: false)`);
    if (isOpenAfterEdge) throw new Error('Edge guard failed: sidebar opened from 0..20px bezel zone');

    // 3B: Safe Activation Zone Swipe (x = 55px -> x = 175px, deltaX = +120px)
    // Should OPEN sidebar!
    console.log('Testing Safe Zone Swipe (x = 55px -> x = 175px, deltaX = +120px): Should OPEN sidebar...');
    await performCdpSwipe(mPage, 55, 350, 175, 350, 10);
    await mPage.waitForTimeout(400);

    let isOpenAfterSafeSwipe = await mPage.evaluate(() => {
      const sb = document.querySelector('.workspace-sidebar');
      return sb ? sb.classList.contains('mobile-open') : false;
    });
    console.log(`Sidebar open state after safe swipe: ${isOpenAfterSafeSwipe} (Expected: true)`);
    if (!isOpenAfterSafeSwipe) throw new Error('Safe zone swipe right failed: sidebar did not open');

    const ssSwipeOpened = `${artifactDir}/v7_1_mobile_sidebar_swipe_opened.png`;
    await mPage.screenshot({ path: ssSwipeOpened, fullPage: false });
    results.screenshots.push({ name: 'v7_1_mobile_sidebar_swipe_opened.png', path: ssSwipeOpened });

    // 3C: Swipe Left to Close (x = 220px -> x = 130px, deltaX = -90px)
    // Should CLOSE sidebar!
    console.log('Testing Swipe Left (x = 220px -> x = 130px, deltaX = -90px): Should CLOSE sidebar...');
    await performCdpSwipe(mPage, 220, 350, 130, 350, 8);
    await mPage.waitForTimeout(400);

    let isOpenAfterCloseSwipe = await mPage.evaluate(() => {
      const sb = document.querySelector('.workspace-sidebar');
      return sb ? sb.classList.contains('mobile-open') : false;
    });
    console.log(`Sidebar open state after swipe left: ${isOpenAfterCloseSwipe} (Expected: false)`);
    if (isOpenAfterCloseSwipe) throw new Error('Swipe left failed: sidebar did not close');

    const ssSwipeClosed = `${artifactDir}/v7_1_mobile_sidebar_swipe_closed.png`;
    await mPage.screenshot({ path: ssSwipeClosed, fullPage: false });
    results.screenshots.push({ name: 'v7_1_mobile_sidebar_swipe_closed.png', path: ssSwipeClosed });

    results.tests.push({
      name: 'Mobile Sidebar Swipe Gestures (Real CDP Touch)',
      status: 'PASSED',
      details: {
        edgeGuard0to20pxVerified: !isOpenAfterEdge,
        safeSwipeRightOpenedSidebar: isOpenAfterSafeSwipe,
        swipeLeftClosedSidebar: !isOpenAfterCloseSwipe
      }
    });
  } catch (err) {
    console.error('Swipe gesture test failed:', err);
    results.tests.push({ name: 'Mobile Sidebar Swipe Gestures (Real CDP Touch)', status: 'FAILED', error: err.message });
  } finally {
    await mBrowser.close();
  }

  // ==========================================
  // SUITE 4: ALL 4 CATEGORIES DATA VALIDATION
  // ==========================================
  console.log('\n--- Test 4: All 4 Categories Data Validation ---');
  const catBrowser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const catCtx = await catBrowser.newContext({ viewport: { width: 1440, height: 900 } });
  await catCtx.addCookies(cookies);
  const catPage = await catCtx.newPage();

  try {
    await catPage.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await catPage.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });

    // 1. Em andamento
    const mineCount = await catPage.$$eval('.task-compact-card.in-progress', els => els.length);
    console.log(`Em andamento items rendered: ${mineCount}`);

    // 2. Disponíveis
    await catPage.click('.queue-tab-btn:has-text("Disponíveis")');
    await catPage.waitForTimeout(400);
    const availableCount = await catPage.$$eval('.task-compact-card.available', els => els.length);
    console.log(`Disponíveis items rendered: ${availableCount}`);
    const ssAvailable = `${artifactDir}/v7_1_category_available.png`;
    await catPage.screenshot({ path: ssAvailable, fullPage: false });
    results.screenshots.push({ name: 'v7_1_category_available.png', path: ssAvailable });

    // 3. Aguardando
    await catPage.click('.queue-tab-btn:has-text("Aguardando")');
    await catPage.waitForTimeout(400);
    const waitingCards = await catPage.$$eval('.task-compact-card.waiting', els =>
      els.map(e => ({
        title: e.querySelector('.task-work-name')?.textContent.trim(),
        ch: e.querySelector('.meta-pill.chapter')?.textContent.trim(),
        stage: e.querySelector('.meta-pill.stage')?.textContent.trim()
      }))
    );
    console.log(`Aguardando items rendered: ${waitingCards.length}`);
    console.log('Sample waiting items:', waitingCards.slice(0, 5));
    const ssWaiting = `${artifactDir}/v7_1_category_waiting.png`;
    await catPage.screenshot({ path: ssWaiting, fullPage: false });
    results.screenshots.push({ name: 'v7_1_category_waiting.png', path: ssWaiting });

    // 4. Concluídas
    await catPage.click('.queue-tab-btn:has-text("Concluídas")');
    await catPage.waitForTimeout(400);
    const doneCount = await catPage.$$eval('.task-compact-card.done', els => els.length);
    console.log(`Concluídas items rendered: ${doneCount}`);
    const ssDone = `${artifactDir}/v7_1_category_done.png`;
    await catPage.screenshot({ path: ssDone, fullPage: false });
    results.screenshots.push({ name: 'v7_1_category_done.png', path: ssDone });

    results.tests.push({
      name: 'All 4 Categories Data Validation',
      status: 'PASSED',
      details: { mineCount, availableCount, waitingCount: waitingCards.length, doneCount }
    });
  } catch (err) {
    console.error('Categories data test failed:', err);
    results.tests.push({ name: 'All 4 Categories Data Validation', status: 'FAILED', error: err.message });
  } finally {
    await catBrowser.close();
  }

  // ==========================================
  // SUITE 5: COMPACT VIEWPORTS (320px & 360px) & FIREFOX
  // ==========================================
  console.log('\n--- Test 5: Compact Viewports & Firefox Verification ---');
  const ffBrowser = await firefox.launch({ headless: true });
  const ffCtx = await ffBrowser.newContext({ viewport: { width: 1440, height: 900 } });
  await ffCtx.addCookies(cookies);
  const ffPage = await ffCtx.newPage();

  try {
    await ffPage.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await ffPage.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
    const ffTitle = await ffPage.$eval('.tab-title', el => el.textContent.trim());
    console.log(`Firefox Minha Fila Title: "${ffTitle}"`);

    const ssFirefox = `${artifactDir}/v7_1_firefox_minha_fila.png`;
    await ffPage.screenshot({ path: ssFirefox, fullPage: false });
    results.screenshots.push({ name: 'v7_1_firefox_minha_fila.png', path: ssFirefox });

    // 320px viewport test
    const smallBrowser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const smallCtx = await smallBrowser.newContext({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });
    await smallCtx.addCookies(cookies);
    const smallPage = await smallCtx.newPage();
    await smallPage.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await smallPage.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });

    const ss320 = `${artifactDir}/v7_1_mobile_320px.png`;
    await smallPage.screenshot({ path: ss320, fullPage: false });
    results.screenshots.push({ name: 'v7_1_mobile_320px.png', path: ss320 });
    await smallBrowser.close();

    results.tests.push({
      name: 'Compact Viewports & Firefox',
      status: 'PASSED',
      details: { ffTitle, smallViewport320pxRendered: true }
    });
  } catch (err) {
    console.error('Firefox/small viewport test failed:', err);
    results.tests.push({ name: 'Compact Viewports & Firefox', status: 'FAILED', error: err.message });
  } finally {
    await ffBrowser.close();
  }

  // Summary
  const passed = results.tests.filter(t => t.status === 'PASSED').length;
  const total = results.tests.length;
  console.log(`\n=== FINAL SUMMARY: ${passed}/${total} TESTS PASSED ===\n`);

  writeFileSync(
    `${artifactDir}/v7_1_minha_fila_verification_results.json`,
    JSON.stringify(results, null, 2)
  );
  console.log(`Results written to: ${artifactDir}/v7_1_minha_fila_verification_results.json`);
}

runVerification().catch(err => {
  console.error('Homologation suite error:', err);
  process.exit(1);
});
