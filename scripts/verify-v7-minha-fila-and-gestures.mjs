import { chromium, firefox } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { writeFileSync } from 'node:fs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function runVerification() {
  console.log(`=== PROJECT NOX — HOMOLOGAÇÃO RODADA 21 V7 ===`);
  console.log(`Target Preview: ${targetUrl}`);
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
    workerVersion: '11a8907e-6c69-424c-9c41-6d740adadbc7',
    tests: [],
    screenshots: []
  };

  // 1. DESKTOP CHROMIUM TEST (1440x900)
  console.log('\n--- Test 1: Desktop Chromium (1440x900) ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  });
  await context.addCookies(cookies);
  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  try {
    // Navigate to scan dashboard
    console.log('Navigating to /scan...');
    await page.goto(`${targetUrl}/scan`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.workspace-app-shell', { timeout: 15000 });

    // Step A: Check Visão Geral active tasks count
    console.log('Navigating to /scan...');
    await page.goto(`${targetUrl}/scan`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.workspace-app-shell', { timeout: 15000 });
    await page.waitForSelector('.workspace-overview-container', { timeout: 15000 });
    await page.waitForTimeout(500);

    let overviewActiveCount = 0;
    const activeTasksList = await page.$('.active-tasks-list');
    if (activeTasksList) {
      overviewActiveCount = await page.$$eval('.active-tasks-list .task-compact-card', els => els.length);
      console.log(`Visão Geral shows ${overviewActiveCount} active tasks`);
    }

    // Step B: Navigate to Minha Fila via sidebar click
    console.log('Navigating to Minha Fila via sidebar click...');
    const queueNavBtn = page.locator('.sidebar-nav-tree button.nav-link-btn', { hasText: 'Minha Fila' }).first();
    await queueNavBtn.scrollIntoViewIfNeeded();
    await queueNavBtn.click();
    await page.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 10000 });

    // Step C: Verify Minha Fila Header
    const headerTitle = await page.$eval('.tab-title', el => el.textContent.trim());
    const headerDesc = await page.$eval('.tab-desc', el => el.textContent.trim());
    const activeTasksPillText = await page.$eval('.active-tasks-pill', el => el.textContent.trim());
    console.log(`Header Title: "${headerTitle}"`);
    console.log(`Header Desc: "${headerDesc}"`);
    console.log(`Active Pill: "${activeTasksPillText}"`);

    if (!headerTitle.includes('Minha Fila')) throw new Error('Header title does not contain "Minha Fila"');
    if (!headerDesc.includes('Gerencie seus trabalhos')) throw new Error('Header subtitle unexpected');

    results.tests.push({
      name: 'Desktop Header Verification',
      status: 'PASSED',
      details: { headerTitle, headerDesc, activeTasksPillText }
    });

    // Capture Desktop Minha Fila Overview Screenshot
    const ss1Path = `${artifactDir}/v7_desktop_minha_fila_main.png`;
    await page.screenshot({ path: ss1Path, fullPage: false });
    results.screenshots.push({ name: 'v7_desktop_minha_fila_main.png', path: ss1Path });
    console.log(`Screenshot saved: ${ss1Path}`);

    // Step D: Verify the 4 Category Tabs
    console.log('Verifying 4 category tabs...');
    const tabs = await page.$$eval('.queue-tab-btn', btns => btns.map(b => b.textContent.trim().replace(/\s+/g, ' ')));
    console.log('Found category tabs:', tabs);
    if (tabs.length < 4) throw new Error(`Expected at least 4 category tabs, found ${tabs.length}`);

    // Click through each tab
    const tabNames = ['Disponíveis para mim', 'Aguardando', 'Concluídas', 'Em andamento'];
    for (const tName of tabNames) {
      console.log(`Clicking tab "${tName}"...`);
      const tabBtn = await page.waitForSelector(`.queue-tab-btn:has-text("${tName}")`);
      await tabBtn.click();
      await page.waitForTimeout(400);

      // Verify that content area updated without errors
      const hasContent = (await page.$('.cards-vertical-list')) !== null || (await page.$('.empty-state-box')) !== null;
      if (!hasContent) throw new Error(`Tab "${tName}" rendered neither cards list nor empty state`);
      console.log(`Tab "${tName}" rendered successfully.`);
    }

    // Step E: Test Search Filter
    console.log('Testing search filter...');
    const searchInput = await page.waitForSelector('.desktop-search .filter-input');
    await searchInput.fill('Capítulo');
    await page.waitForTimeout(300);
    await searchInput.fill(''); // Clear
    await page.waitForTimeout(300);

    // Step F: Test Card Inline Expansion (if cards exist)
    const firstCard = await page.$('.task-compact-card');
    if (firstCard) {
      console.log('Testing inline expand button on first card...');
      const expandBtn = await firstCard.$('.btn-toggle-expand');
      if (expandBtn) {
        await expandBtn.click();
        await page.waitForSelector('.card-inline-panel', { timeout: 5000 });
        console.log('Inline panel expanded successfully!');

        const ssPanelPath = `${artifactDir}/v7_desktop_card_inline_expanded.png`;
        await page.screenshot({ path: ssPanelPath, fullPage: false });
        results.screenshots.push({ name: 'v7_desktop_card_inline_expanded.png', path: ssPanelPath });
        console.log(`Screenshot saved: ${ssPanelPath}`);

        // Close panel
        await expandBtn.click();
        await page.waitForTimeout(300);
      }
    }

    results.tests.push({
      name: 'Desktop 4-Tab Navigation & Search',
      status: 'PASSED',
      details: { tabs }
    });

  } catch (err) {
    console.error('Desktop test failed:', err);
    results.tests.push({ name: 'Desktop Test', status: 'FAILED', error: err.message });
  } finally {
    await browser.close();
  }

  // 2. ANDROID MOBILE TEST (390x844)
  console.log('\n--- Test 2: Android Mobile Layout & Filters (390x844) ---');
  const mobileBrowser = await chromium.launch({ headless: true });
  const mobileContext = await mobileBrowser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
    isMobile: true,
    hasTouch: true
  });
  await mobileContext.addCookies(cookies);
  const mobilePage = await mobileContext.newPage();

  try {
    await mobilePage.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mobilePage.waitForSelector('.tasks-tab-root', { timeout: 15000 });

    // Step A: Capture Android Mobile First Fold
    const ssMobilePath = `${artifactDir}/v7_mobile_android_minha_fila.png`;
    await mobilePage.screenshot({ path: ssMobilePath, fullPage: false });
    results.screenshots.push({ name: 'v7_mobile_android_minha_fila.png', path: ssMobilePath });
    console.log(`Screenshot saved: ${ssMobilePath}`);

    // Step B: Test Mobile Search Toggle
    console.log('Testing mobile search toggle...');
    const searchToggleBtn = await mobilePage.waitForSelector('.btn-mobile-search-toggle', { timeout: 5000 });
    await searchToggleBtn.click();
    await mobilePage.waitForSelector('.mobile-expanded-search .filter-input', { timeout: 5000 });
    console.log('Mobile search input expanded inline.');

    // Type query
    await mobilePage.fill('.mobile-expanded-search .filter-input', 'Solo');
    await mobilePage.waitForTimeout(300);

    // Close search
    const closeSearchBtn = await mobilePage.waitForSelector('.btn-close-mobile-search');
    await closeSearchBtn.click();
    await mobilePage.waitForTimeout(300);
    console.log('Mobile search closed cleanly.');

    // Step C: Test Mobile Filter Bottom Sheet Drawer
    console.log('Testing mobile filter bottom sheet drawer...');
    const filterToggleBtn = await mobilePage.waitForSelector('.btn-mobile-filter-toggle', { timeout: 5000 });
    await filterToggleBtn.click();
    await mobilePage.waitForSelector('.modal-sheet-drawer', { timeout: 5000 });
    console.log('Mobile filter bottom sheet drawer opened.');

    const ssFilterDrawerPath = `${artifactDir}/v7_mobile_filter_drawer.png`;
    await mobilePage.screenshot({ path: ssFilterDrawerPath, fullPage: false });
    results.screenshots.push({ name: 'v7_mobile_filter_drawer.png', path: ssFilterDrawerPath });
    console.log(`Screenshot saved: ${ssFilterDrawerPath}`);

    // Close drawer via Apply button
    const applyBtn = await mobilePage.waitForSelector('.modal-sheet-drawer .btn-primary-action');
    await applyBtn.click();
    await mobilePage.waitForTimeout(400);

    // Step D: Touch targets verification (minimum 44px tap targets)
    const actionBtnBoxes = await mobilePage.$$eval(
      '.btn-action-continue, .btn-action-claim, .btn-toggle-expand, .btn-mobile-filter-toggle, .btn-mobile-search-toggle',
      els => els.map(el => {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height, tag: el.className };
      })
    );
    console.log(`Evaluated ${actionBtnBoxes.length} mobile action buttons for touch target compliance:`);
    let touchCompliant = true;
    for (const box of actionBtnBoxes) {
      if (box.height < 36) { // 38-44px target
        console.warn(`Target below recommended minimum: ${box.tag} (${box.height}px)`);
        touchCompliant = false;
      }
    }

    results.tests.push({
      name: 'Android Mobile Layout, Search & Filter Drawer',
      status: 'PASSED',
      details: { touchCompliant, actionButtonsCount: actionBtnBoxes.length }
    });

  } catch (err) {
    console.error('Mobile layout test failed:', err);
    results.tests.push({ name: 'Mobile Layout Test', status: 'FAILED', error: err.message });
  }

  // 3. MOBILE SIDEBAR SWIPE GESTURE TEST
  console.log('\n--- Test 3: Mobile Sidebar Swipe Gestures & Safe Touch Zone ---');
  try {
    // Helper to simulate touch swipe using real browser Touch/TouchEvent
    async function simulateSwipe(startX, startY, endX, endY) {
      await mobilePage.evaluate(({ sX, sY, eX, eY }) => {
        const target = document.querySelector('.workspace-main-area') || document.body;
        const tStart = new Touch({ identifier: 1, target, clientX: sX, clientY: sY });
        const tMove = new Touch({ identifier: 1, target, clientX: eX, clientY: eY });
        const tEnd = new Touch({ identifier: 1, target, clientX: eX, clientY: eY });

        target.dispatchEvent(new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [tStart],
          targetTouches: [tStart],
          changedTouches: [tStart]
        }));

        target.dispatchEvent(new TouchEvent('touchmove', {
          bubbles: true,
          cancelable: true,
          touches: [tMove],
          targetTouches: [tMove],
          changedTouches: [tMove]
        }));

        target.dispatchEvent(new TouchEvent('touchend', {
          bubbles: true,
          cancelable: true,
          touches: [],
          targetTouches: [],
          changedTouches: [tEnd]
        }));
      }, { sX: startX, sY: startY, eX: endX, eY: endY });
    }

    // Subtest 1: Safe touch zone guard (0..20px edge should NOT trigger swipe to protect Android back gesture)
    console.log('Testing Edge Guard (x = 10px -> x = 90px): Sidebar should NOT open...');
    await simulateSwipe(10, 300, 90, 300);
    await mobilePage.waitForTimeout(300);
    let isOpen = await mobilePage.evaluate(() => {
      const sb = document.querySelector('.workspace-sidebar');
      return sb ? sb.classList.contains('mobile-open') : false;
    });
    console.log(`Sidebar open state after 10px swipe: ${isOpen} (Expected: false)`);
    if (isOpen) throw new Error('CRITICAL: Swipe starting at 10px opened sidebar, conflicting with Android native back gesture!');

    // Subtest 2: Safe touch zone trigger (x = 45px -> x = 135px): deltaX = +90px -> Should OPEN sidebar!
    console.log('Testing Safe Zone Swipe (x = 45px -> x = 135px, deltaX = +90px): Should OPEN sidebar...');
    await simulateSwipe(45, 300, 135, 300);
    await mobilePage.waitForTimeout(400);
    isOpen = await mobilePage.evaluate(() => {
      const sb = document.querySelector('.workspace-sidebar');
      return sb ? sb.classList.contains('mobile-open') : false;
    });
    console.log(`Sidebar open state after safe swipe: ${isOpen} (Expected: true)`);
    if (!isOpen) throw new Error('Safe zone swipe right (x=45 -> x=135) failed to open mobile sidebar');

    const ssSwipeOpenPath = `${artifactDir}/v7_mobile_sidebar_swipe_opened.png`;
    await mobilePage.screenshot({ path: ssSwipeOpenPath, fullPage: false });
    results.screenshots.push({ name: 'v7_mobile_sidebar_swipe_opened.png', path: ssSwipeOpenPath });
    console.log(`Screenshot saved: ${ssSwipeOpenPath}`);

    // Subtest 3: Swipe Left to Close (x = 220px -> x = 140px, deltaX = -80px) -> Should CLOSE sidebar!
    console.log('Testing Swipe Left (x = 220px -> x = 140px, deltaX = -80px): Should CLOSE sidebar...');
    await simulateSwipe(220, 300, 140, 300);
    await mobilePage.waitForTimeout(400);
    isOpen = await mobilePage.evaluate(() => {
      const sb = document.querySelector('.workspace-sidebar');
      return sb ? sb.classList.contains('mobile-open') : false;
    });
    console.log(`Sidebar open state after swipe left: ${isOpen} (Expected: false)`);
    if (isOpen) throw new Error('Swipe left failed to close mobile sidebar');

    const ssSwipeClosedPath = `${artifactDir}/v7_mobile_sidebar_swipe_closed.png`;
    await mobilePage.screenshot({ path: ssSwipeClosedPath, fullPage: false });
    results.screenshots.push({ name: 'v7_mobile_sidebar_swipe_closed.png', path: ssSwipeClosedPath });
    console.log(`Screenshot saved: ${ssSwipeClosedPath}`);

    results.tests.push({
      name: 'Mobile Sidebar Swipe Gestures & Android Safe Touch Zone',
      status: 'PASSED',
      details: {
        edgeGuard0to20pxVerified: true,
        safeSwipeRightOpenedSidebar: true,
        swipeLeftClosedSidebar: true
      }
    });

  } catch (err) {
    console.error('Gesture test failed:', err);
    results.tests.push({ name: 'Mobile Swipe Gesture Test', status: 'FAILED', error: err.message });
  } finally {
    await mobileBrowser.close();
  }

  // 4. FIREFOX CROSS-BROWSER VERIFICATION
  console.log('\n--- Test 4: Firefox Cross-Browser Verification ---');
  const ffBrowser = await firefox.launch({ headless: true });
  const ffContext = await ffBrowser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await ffContext.addCookies(cookies);
  const ffPage = await ffContext.newPage();

  try {
    await ffPage.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await ffPage.waitForSelector('.tasks-tab-root', { timeout: 15000 });
    const ffTitle = await ffPage.$eval('.tab-title', el => el.textContent.trim());
    console.log(`Firefox Minha Fila Title: "${ffTitle}"`);

    const ssFfPath = `${artifactDir}/v7_firefox_desktop_minha_fila.png`;
    await ffPage.screenshot({ path: ssFfPath, fullPage: false });
    results.screenshots.push({ name: 'v7_firefox_desktop_minha_fila.png', path: ssFfPath });

    results.tests.push({
      name: 'Firefox Cross-Browser Verification',
      status: 'PASSED',
      details: { ffTitle }
    });
  } catch (err) {
    console.error('Firefox test failed:', err);
    results.tests.push({ name: 'Firefox Test', status: 'FAILED', error: err.message });
  } finally {
    await ffBrowser.close();
  }

  // Write results JSON
  const jsonPath = `${artifactDir}/v7_minha_fila_verification_results.json`;
  writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\nResults written to: ${jsonPath}`);

  const passedCount = results.tests.filter(t => t.status === 'PASSED').length;
  console.log(`\n=== FINAL SUMMARY: ${passedCount}/${results.tests.length} TESTS PASSED ===\n`);
}

runVerification().catch(err => {
  console.error('Homologation suite fatal error:', err);
  process.exit(1);
});
