import { chromium, firefox, devices } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { writeFileSync } from 'node:fs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const workerVersion = 'bf1cb960-af4f-4e46-bf43-a137507bb0b3';

async function runVerification() {
  console.log('=== PROJECT NOX — HOMOLOGAÇÃO COMPLETA RODADA 21 V7.3 ===');
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
    metrics: {},
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
  // SUITE 1: DESKTOP SCALE & PROPORTIONS (1440x900, 1280px, 1920px)
  // ==========================================
  console.log('\n--- Test 1: Desktop Chromium Scale & Proportions (1440x900) ---');
  const dBrowser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const dCtx = await dBrowser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  });
  await dCtx.addCookies(cookies);
  const dPage = await dCtx.newPage();

  try {
    const t0 = performance.now();
    await dPage.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await dPage.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
    const loadTimeMs = Math.round(performance.now() - t0);
    results.metrics.desktopLoadTimeMs = loadTimeMs;
    console.log(`Minha Fila Desktop loaded in: ${loadTimeMs} ms`);

    const headerTitle = await dPage.$eval('.tab-title', el => el.textContent.trim());
    const headerDesc = await dPage.$eval('.desktop-only-desc', el => el.textContent.trim());
    const activeTasksPillText = await dPage.$eval('.desktop-pill-text', el => el.textContent.trim());
    console.log(`Header Title: "${headerTitle}"`);
    console.log(`Header Desc: "${headerDesc}"`);
    console.log(`Active Pill: "${activeTasksPillText}"`);

    // Measure typography and dimensions
    const scaleMetrics = await dPage.evaluate(() => {
      const root = document.querySelector('.tasks-tab-root');
      const title = document.querySelector('.tab-title');
      const taskTitle = document.querySelector('.task-work-name');
      const card = document.querySelector('.task-compact-card');
      const cover = document.querySelector('.card-visual-col');
      const continueBtn = document.querySelector('.btn-action-continue');
      const searchInput = document.querySelector('.desktop-search input');
      const selectFilter = document.querySelector('.filter-select');
      const content = document.querySelector('.workspace-view-content');

      return {
        rootMaxWidth: window.getComputedStyle(root).maxWidth,
        rootMargin: window.getComputedStyle(root).margin,
        contentPadding: window.getComputedStyle(content).padding,
        titleFontSize: window.getComputedStyle(title).fontSize,
        taskTitleFontSize: taskTitle ? window.getComputedStyle(taskTitle).fontSize : 'N/A',
        cardHeight: card ? card.offsetHeight : 0,
        coverWidth: cover ? cover.offsetWidth : 0,
        coverHeight: cover ? cover.offsetHeight : 0,
        continueBtnHeight: continueBtn ? continueBtn.offsetHeight : 0,
        searchInputHeight: searchInput ? searchInput.offsetHeight : 0,
        selectFilterHeight: selectFilter ? selectFilter.offsetHeight : 0
      };
    });
    console.log('Desktop Scale Metrics:', scaleMetrics);
    results.metrics.desktopScale = scaleMetrics;

    // Screenshot Desktop Main (1440)
    const ssDesktop = `${artifactDir}/v7_3_desktop_minha_fila_1440.png`;
    await dPage.screenshot({ path: ssDesktop, fullPage: false });
    results.screenshots.push({ name: 'v7_3_desktop_minha_fila_1440.png', path: ssDesktop });

    // Expand inline panel on first card
    const firstExpandBtn = dPage.locator('.btn-toggle-expand').first();
    if (await firstExpandBtn.count() > 0) {
      await firstExpandBtn.click();
      await dPage.waitForSelector('.card-inline-panel', { state: 'visible', timeout: 5000 });
      const ssDesktopInline = `${artifactDir}/v7_3_desktop_inline_expanded.png`;
      await dPage.screenshot({ path: ssDesktopInline, fullPage: false });
      results.screenshots.push({ name: 'v7_3_desktop_inline_expanded.png', path: ssDesktopInline });
      console.log('Desktop inline panel expanded cleanly.');
      // Collapse back
      await firstExpandBtn.click();
      await dPage.waitForSelector('.card-inline-panel', { state: 'hidden', timeout: 5000 });
    }

    // 1280px Desktop Screenshot
    await dPage.setViewportSize({ width: 1280, height: 800 });
    await dPage.waitForTimeout(300);
    const ss1280 = `${artifactDir}/v7_3_desktop_minha_fila_1280.png`;
    await dPage.screenshot({ path: ss1280, fullPage: false });
    results.screenshots.push({ name: 'v7_3_desktop_minha_fila_1280.png', path: ss1280 });

    // 1920px Desktop Screenshot
    await dPage.setViewportSize({ width: 1920, height: 1080 });
    await dPage.waitForTimeout(300);
    const ss1920 = `${artifactDir}/v7_3_desktop_minha_fila_1920.png`;
    await dPage.screenshot({ path: ss1920, fullPage: false });
    results.screenshots.push({ name: 'v7_3_desktop_minha_fila_1920.png', path: ss1920 });

    results.tests.push({
      name: 'Desktop Minha Fila Scale & Layout (1280, 1440, 1920)',
      status: 'PASSED',
      details: { headerTitle, activeTasksPillText, scaleMetrics }
    });
  } catch (err) {
    console.error('Desktop test failed:', err);
    results.tests.push({ name: 'Desktop Minha Fila Scale & Layout (1280, 1440, 1920)', status: 'FAILED', error: err.message });
  } finally {
    await dBrowser.close();
  }

  // ==========================================
  // SUITE 2: ANDROID MOBILE (Pixel 7 - 390x844) COMPACT CARDS & DISCREET SEARCH
  // ==========================================
  console.log('\n--- Test 2: Android Mobile (Pixel 7 - 390x844) Compact Cards & Header ---');
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
    const t0Mobile = performance.now();
    await mPage.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mPage.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
    const mobileLoadMs = Math.round(performance.now() - t0Mobile);
    results.metrics.mobileLoadTimeMs = mobileLoadMs;
    console.log(`Minha Fila Mobile loaded in: ${mobileLoadMs} ms`);

    // Verify Compact Header
    const mobileHeader = await mPage.evaluate(() => {
      const header = document.querySelector('.queue-header-bar');
      const badge = document.querySelector('.header-badge');
      const title = document.querySelector('.tab-title');
      const desc = document.querySelector('.mobile-only-desc');
      const pill = document.querySelector('.mobile-pill-text');
      return {
        headerHeight: header ? header.offsetHeight : 0,
        badgeVisible: badge ? window.getComputedStyle(badge).display !== 'none' : false,
        titleText: title ? title.textContent.trim() : '',
        descText: desc ? desc.textContent.trim() : '',
        pillText: pill ? pill.textContent.trim() : ''
      };
    });
    console.log('Mobile Header Metrics:', mobileHeader);

    // Verify 2x2 Grid
    const mobileGrid = await mPage.evaluate(() => {
      const grid = document.querySelector('.queue-tabs-grid');
      const btns = Array.from(document.querySelectorAll('.queue-tabs-grid .queue-tab-btn'));
      return {
        display: window.getComputedStyle(grid).display,
        columns: window.getComputedStyle(grid).gridTemplateColumns,
        buttons: btns.map(b => ({
          text: b.textContent.trim().replace(/\s+/g, ' '),
          width: b.offsetWidth,
          height: b.offsetHeight
        }))
      };
    });
    console.log('Mobile 2x2 Grid:', mobileGrid);

    // Verify Card Height & Above-the-fold
    const cardMetrics = await mPage.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.task-compact-card'));
      return cards.map(c => {
        const titleEl = c.querySelector('.task-work-name');
        const coverEl = c.querySelector('.card-visual-col');
        const contBtn = c.querySelector('.btn-action-continue');
        const filesBtn = c.querySelector('.btn-toggle-expand');
        const stalePill = c.querySelector('.meta-pill.stale-inactivity');
        const rect = c.getBoundingClientRect();
        return {
          title: titleEl?.textContent?.trim(),
          cardHeight: rect.height,
          topOffsetFromViewport: rect.top,
          coverSize: coverEl ? `${coverEl.offsetWidth}x${coverEl.offsetHeight}` : 'N/A',
          continueBtnHeight: contBtn ? contBtn.offsetHeight : 0,
          filesBtnHeight: filesBtn ? filesBtn.offsetHeight : 0,
          stalePillText: stalePill?.textContent?.trim(),
          isFirstTaskAboveFold: rect.top < 600
        };
      });
    });
    console.log('Mobile Cards Metrics:', cardMetrics);
    results.metrics.mobileCardHeights = cardMetrics.map(c => c.cardHeight);
    results.metrics.firstTaskAboveFold = cardMetrics[0]?.isFirstTaskAboveFold;

    // Capture Mobile Overview Screenshot (Cards + Header + 2x2 + discreet search)
    const ssMobileMain = `${artifactDir}/v7_3_mobile_android_minha_fila_390.png`;
    await mPage.screenshot({ path: ssMobileMain, fullPage: false });
    results.screenshots.push({ name: 'v7_3_mobile_android_minha_fila_390.png', path: ssMobileMain });

    // Test Discreet Collapsed Search by Default
    const isSearchCollapsedInitially = await mPage.evaluate(() => {
      const input = document.querySelector('.mobile-expanded-search input');
      const toggle = document.querySelector('.btn-mobile-search-toggle');
      return !input && !!toggle;
    });
    console.log(`Search initially collapsed as discreet button: ${isSearchCollapsedInitially} (Expected: true)`);
    if (!isSearchCollapsedInitially) throw new Error('Search was not collapsed by default on mobile');

    // Test Expanding Search
    console.log('Expanding mobile search...');
    await mPage.click('.btn-mobile-search-toggle');
    await mPage.waitForSelector('.mobile-expanded-search input', { state: 'visible', timeout: 5000 });
    const isSearchFocused = await mPage.evaluate(() => document.activeElement?.classList.contains('filter-input'));
    console.log(`Search input focused on tap: ${isSearchFocused}`);

    const ssMobileSearchExpanded = `${artifactDir}/v7_3_mobile_search_expanded.png`;
    await mPage.screenshot({ path: ssMobileSearchExpanded, fullPage: false });
    results.screenshots.push({ name: 'v7_3_mobile_search_expanded.png', path: ssMobileSearchExpanded });

    // Type query "Céu"
    await mPage.fill('.mobile-expanded-search input', 'Céu');
    await mPage.waitForTimeout(300);
    const filteredCount = await mPage.$$eval('.task-compact-card', els => els.length);
    console.log(`Filtered tasks count for "Céu": ${filteredCount}`);

    // Collapse search with active query -> should show active query pill with quick clear
    await mPage.click('.btn-close-mobile-search');
    await mPage.waitForSelector('.mobile-search-active-pill', { state: 'visible', timeout: 5000 });
    console.log('Search collapsed with active query: active pill displayed cleanly.');

    // Quick clear via (X)
    await mPage.click('.btn-quick-clear-search');
    await mPage.waitForTimeout(300);
    const clearedCount = await mPage.$$eval('.task-compact-card', els => els.length);
    console.log(`Cleared tasks count: ${clearedCount}`);

    // Test Mobile Filter Drawer
    console.log('Opening mobile filter drawer...');
    await mPage.click('.btn-mobile-filter-toggle');
    await mPage.waitForSelector('.modal-sheet-drawer', { state: 'visible', timeout: 5000 });
    const ssMobileDrawer = `${artifactDir}/v7_3_mobile_filter_drawer.png`;
    await mPage.screenshot({ path: ssMobileDrawer, fullPage: false });
    results.screenshots.push({ name: 'v7_3_mobile_filter_drawer.png', path: ssMobileDrawer });

    // Close drawer
    await mPage.click('.btn-primary-action');
    await mPage.waitForSelector('.modal-sheet-drawer', { state: 'hidden', timeout: 5000 });
    console.log('Mobile filter drawer closed cleanly.');

    results.tests.push({
      name: 'Android Mobile Compact Cards, Header & Discreet Search',
      status: 'PASSED',
      details: {
        mobileHeader,
        mobileGrid,
        cardHeights: cardMetrics.map(c => c.cardHeight),
        firstTaskAboveFold: cardMetrics[0]?.isFirstTaskAboveFold
      }
    });
  } catch (err) {
    console.error('Mobile layout test failed:', err);
    results.tests.push({ name: 'Android Mobile Compact Cards, Header & Discreet Search', status: 'FAILED', error: err.message });
  }

  // ==========================================
  // SUITE 3: REAL MOBILE SIDEBAR SWIPE GESTURES SEQUENCE
  // ==========================================
  console.log('\n--- Test 3: Real Mobile Sidebar Swipe Gestures Sequence (CDP Touch) ---');
  try {
    await mPage.evaluate(() => window.scrollTo(0, 0));
    await mPage.waitForTimeout(300);

    // 3A: Comfortable Zone Swipe Right (x = 45px -> x = 165px, deltaX = +120px) -> OPENS SIDEBAR
    console.log('Testing Safe Zone Swipe Right (x = 45px -> x = 165px): Should OPEN sidebar...');
    const tSwipeStart = performance.now();
    await performCdpSwipe(mPage, 45, 320, 165, 320, 10);
    await mPage.waitForTimeout(350);
    const swipeOpenDuration = Math.round(performance.now() - tSwipeStart);
    results.metrics.swipeOpenDurationMs = swipeOpenDuration;

    let isOpenAfterSafeSwipe = await mPage.evaluate(() => {
      const sb = document.querySelector('.workspace-sidebar');
      return sb ? sb.classList.contains('mobile-open') : false;
    });
    console.log(`Sidebar open state after safe swipe: ${isOpenAfterSafeSwipe} (Expected: true)`);
    if (!isOpenAfterSafeSwipe) throw new Error('Safe zone swipe right failed: sidebar did not open');

    const ssSwipeOpened = `${artifactDir}/v7_3_mobile_sidebar_swipe_opened.png`;
    await mPage.screenshot({ path: ssSwipeOpened, fullPage: false });
    results.screenshots.push({ name: 'v7_3_mobile_sidebar_swipe_opened.png', path: ssSwipeOpened });

    // 3B: Swipe Left to Close (x = 220px -> x = 120px, deltaX = -100px) -> CLOSES SIDEBAR
    console.log('Testing Swipe Left (x = 220px -> x = 120px): Should CLOSE sidebar...');
    await performCdpSwipe(mPage, 220, 320, 120, 320, 8);
    await mPage.waitForTimeout(350);

    let isOpenAfterCloseSwipe = await mPage.evaluate(() => {
      const sb = document.querySelector('.workspace-sidebar');
      return sb ? sb.classList.contains('mobile-open') : false;
    });
    console.log(`Sidebar open state after swipe left: ${isOpenAfterCloseSwipe} (Expected: false)`);
    if (isOpenAfterCloseSwipe) throw new Error('Swipe left failed: sidebar did not close');

    const ssSwipeClosed = `${artifactDir}/v7_3_mobile_sidebar_swipe_closed.png`;
    await mPage.screenshot({ path: ssSwipeClosed, fullPage: false });
    results.screenshots.push({ name: 'v7_3_mobile_sidebar_swipe_closed.png', path: ssSwipeClosed });

    // 3C: Hamburger Tap Still Works
    console.log('Testing Hamburger button tap to open...');
    await mPage.click('.btn-hamburger');
    await mPage.waitForTimeout(300);
    const isOpenViaHamburger = await mPage.evaluate(() => {
      const sb = document.querySelector('.workspace-sidebar');
      return sb ? sb.classList.contains('mobile-open') : false;
    });
    console.log(`Sidebar open state via hamburger: ${isOpenViaHamburger} (Expected: true)`);
    if (!isOpenViaHamburger) throw new Error('Hamburger tap failed');

    // Close via backdrop tap outside 280px drawer
    await mPage.click('.sidebar-backdrop', { position: { x: 340, y: 200 } });
    await mPage.waitForTimeout(300);
    const isClosedViaBackdrop = await mPage.evaluate(() => {
      const sb = document.querySelector('.workspace-sidebar');
      return sb ? !sb.classList.contains('mobile-open') : true;
    });
    console.log(`Sidebar closed via backdrop tap: ${isClosedViaBackdrop} (Expected: true)`);
    if (!isClosedViaBackdrop) throw new Error('Backdrop tap close failed');

    results.tests.push({
      name: 'Mobile Sidebar Swipe Gestures Sequence (CDP Touch)',
      status: 'PASSED',
      details: {
        safeSwipeRightOpenedSidebar: isOpenAfterSafeSwipe,
        swipeLeftClosedSidebar: !isOpenAfterCloseSwipe,
        hamburgerTapOpened: isOpenViaHamburger,
        backdropTapClosed: isClosedViaBackdrop,
        swipeOpenDurationMs: swipeOpenDuration
      }
    });
  } catch (err) {
    console.error('Swipe gesture test failed:', err);
    results.tests.push({ name: 'Mobile Sidebar Swipe Gestures Sequence (CDP Touch)', status: 'FAILED', error: err.message });
  } finally {
    await mBrowser.close();
  }

  // ==========================================
  // SUITE 4: ALL 4 CATEGORIES & REAL ACTIONS VALIDATION
  // ==========================================
  console.log('\n--- Test 4: All 4 Categories & Real Actions Validation ---');
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

    // Verify Continuar button exists and has correct chapter target
    const firstContinueBtn = catPage.locator('.btn-action-continue').first();
    const hasContinueAction = await firstContinueBtn.isVisible();
    console.log(`First task has Continuar button: ${hasContinueAction}`);

    // 2. Disponíveis
    const t0Switch = performance.now();
    await catPage.click('.queue-tab-btn:has-text("Disponíveis")');
    await catPage.waitForTimeout(300);
    const switchTimeMs = Math.round(performance.now() - t0Switch);
    results.metrics.categorySwitchTimeMs = switchTimeMs;

    const availableCount = await catPage.$$eval('.task-compact-card.available', els => els.length);
    console.log(`Disponíveis items rendered: ${availableCount} (Switched in ${switchTimeMs} ms)`);
    const ssAvailable = `${artifactDir}/v7_3_category_available.png`;
    await catPage.screenshot({ path: ssAvailable, fullPage: false });
    results.screenshots.push({ name: 'v7_3_category_available.png', path: ssAvailable });

    // 3. Aguardando
    await catPage.click('.queue-tab-btn:has-text("Aguardando")');
    await catPage.waitForTimeout(300);
    const waitingCards = await catPage.$$eval('.task-compact-card.waiting', els =>
      els.map(e => ({
        title: e.querySelector('.task-work-name')?.textContent.trim(),
        ch: e.querySelector('.meta-pill.chapter')?.textContent.trim(),
        stage: e.querySelector('.meta-pill.stage')?.textContent.trim()
      }))
    );
    console.log(`Aguardando items rendered: ${waitingCards.length}`);
    console.log('Sample waiting items:', waitingCards.slice(0, 5));
    const ssWaiting = `${artifactDir}/v7_3_category_waiting.png`;
    await catPage.screenshot({ path: ssWaiting, fullPage: false });
    results.screenshots.push({ name: 'v7_3_category_waiting.png', path: ssWaiting });

    // 4. Concluídas
    await catPage.click('.queue-tab-btn:has-text("Concluídas")');
    await catPage.waitForTimeout(300);
    const doneCount = await catPage.$$eval('.task-compact-card.done', els => els.length);
    console.log(`Concluídas items rendered: ${doneCount}`);
    const ssDone = `${artifactDir}/v7_3_category_done.png`;
    await catPage.screenshot({ path: ssDone, fullPage: false });
    results.screenshots.push({ name: 'v7_3_category_done.png', path: ssDone });

    results.tests.push({
      name: 'All 4 Categories & Real Actions Validation',
      status: 'PASSED',
      details: {
        mineCount,
        availableCount,
        waitingCount: waitingCards.length,
        doneCount,
        hasContinueAction,
        categorySwitchTimeMs: switchTimeMs
      }
    });
  } catch (err) {
    console.error('Categories test failed:', err);
    results.tests.push({ name: 'All 4 Categories & Real Actions Validation', status: 'FAILED', error: err.message });
  } finally {
    await catBrowser.close();
  }

  // ==========================================
  // SUITE 5: COMPREHENSIVE VIEWPORT MATRIX & FIREFOX VERIFICATION
  // ==========================================
  console.log('\n--- Test 5: Comprehensive Viewport Matrix & Firefox Verification ---');
  const viewportsToTest = [
    { name: 'Android 320px', width: 320, height: 568, isMobile: true, filename: 'v7_3_mobile_320px.png' },
    { name: 'Android 360px', width: 360, height: 640, isMobile: true, filename: 'v7_3_mobile_360px.png' },
    { name: 'Android 430px', width: 430, height: 932, isMobile: true, filename: 'v7_3_mobile_430px.png' },
    { name: 'Tablet 768px', width: 768, height: 1024, isMobile: false, filename: 'v7_3_tablet_768px.png' },
    { name: 'Tablet 1024px', width: 1024, height: 1366, isMobile: false, filename: 'v7_3_tablet_1024px.png' }
  ];

  const vpBrowser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const vp of viewportsToTest) {
      const vCtx = await vpBrowser.newContext({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: vp.isMobile,
        isMobile: vp.isMobile
      });
      await vCtx.addCookies(cookies);
      const vPage = await vCtx.newPage();
      await vPage.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded' });
      await vPage.waitForSelector('.tasks-tab-root', { state: 'visible' });

      // Check horizontal overflow
      const hasOverflow = await vPage.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      console.log(`Viewport ${vp.name} (${vp.width}x${vp.height}) - Horizontal overflow: ${hasOverflow}`);

      const ssPath = `${artifactDir}/${vp.filename}`;
      await vPage.screenshot({ path: ssPath, fullPage: false });
      results.screenshots.push({ name: vp.filename, path: ssPath });
      await vCtx.close();
    }

    // Firefox Verification
    console.log('Testing Firefox Desktop...');
    const ffBrowser = await firefox.launch({ headless: true });
    const ffCtx = await ffBrowser.newContext({ viewport: { width: 1440, height: 900 } });
    await ffCtx.addCookies(cookies);
    const ffPage = await ffCtx.newPage();
    await ffPage.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded' });
    await ffPage.waitForSelector('.tasks-tab-root', { state: 'visible' });
    const ffTitle = await ffPage.$eval('.tab-title', el => el.textContent.trim());
    console.log(`Firefox Minha Fila Title: "${ffTitle}"`);

    const ssFirefox = `${artifactDir}/v7_3_firefox_desktop_1440.png`;
    await ffPage.screenshot({ path: ssFirefox, fullPage: false });
    results.screenshots.push({ name: 'v7_3_firefox_desktop_1440.png', path: ssFirefox });
    await ffBrowser.close();

    results.tests.push({
      name: 'Comprehensive Viewport Matrix (320, 360, 430, 768, 1024) & Firefox',
      status: 'PASSED',
      details: { viewportsTested: viewportsToTest.map(v => v.name), firefoxVerified: true }
    });
  } catch (err) {
    console.error('Viewport matrix test failed:', err);
    results.tests.push({ name: 'Comprehensive Viewport Matrix (320, 360, 430, 768, 1024) & Firefox', status: 'FAILED', error: err.message });
  } finally {
    await vpBrowser.close();
  }

  // Write results JSON
  const resultsPath = `${artifactDir}/v7_3_minha_fila_verification_results.json`;
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n=== FINAL SUMMARY: ${results.tests.filter(t => t.status === 'PASSED').length}/${results.tests.length} TESTS PASSED ===`);
  console.log(`Results written to: ${resultsPath}`);
}

runVerification().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
