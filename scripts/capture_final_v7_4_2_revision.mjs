import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { writeFileSync } from 'node:fs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const workerVersion = '2ef6289c-d6f0-4f66-8616-d376e95dbfcf';

async function runCapture() {
  console.log(`=== RUNNING FINAL REVISION CAPTURE: ${workerVersion} ===`);
  const cookies = await ownerCookies(targetUrl);
  cookies.push({
    name: 'nox-age-status',
    value: 'ADULT',
    url: targetUrl,
    httpOnly: false,
    sameSite: 'Lax',
    secure: targetUrl.startsWith('https:')
  });

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // 1. CAPTURE 1440x900
  console.log('\n--- 1. Capturing Desktop 1440x900 ---');
  const ctx1440 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx1440.addCookies(cookies);
  const page1440 = await ctx1440.newPage();
  await page1440.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page1440.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
  await page1440.waitForTimeout(600);

  // Measure 1440
  const metrics1440 = await page1440.evaluate(() => {
    const root = document.querySelector('.tasks-tab-root');
    const header = document.querySelector('.queue-header-bar');
    const tabs = Array.from(document.querySelectorAll('.queue-tab-btn'));
    const searchInput = document.querySelector('.filter-input');
    const selectFilter = document.querySelector('.filter-select');
    const cards = Array.from(document.querySelectorAll('.task-compact-card'));

    const b = el => el ? el.getBoundingClientRect() : null;
    const cs = el => el ? window.getComputedStyle(el) : null;

    return {
      viewportWidth: window.innerWidth,
      rootRect: b(root),
      headerRect: b(header),
      headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,
      tabButtons: tabs.map(t => ({
        text: t.innerText.replace(/\s+/g, ' ').trim(),
        width: Math.round(t.getBoundingClientRect().width),
        height: Math.round(t.getBoundingClientRect().height),
        color: cs(t).color,
        background: cs(t).background
      })),
      searchHeight: searchInput ? Math.round(searchInput.getBoundingClientRect().height) : 0,
      selectHeight: selectFilter ? Math.round(selectFilter.getBoundingClientRect().height) : 0,
      cardsCount: cards.length,
      cards: cards.map((c, i) => {
        const rect = c.getBoundingClientRect();
        const continueBtn = c.querySelector('.btn-action-continue, .btn-action-claim');
        const filesBtn = c.querySelector('.btn-toggle-expand, .btn-timeline-ghost');
        const cover = c.querySelector('.card-visual-col');
        const titleEl = c.querySelector('.task-work-name');
        return {
          index: i,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          title: titleEl?.textContent?.trim(),
          coverWidth: cover ? Math.round(cover.getBoundingClientRect().width) : 0,
          coverHeight: cover ? Math.round(cover.getBoundingClientRect().height) : 0,
          continueBtnWidth: continueBtn ? Math.round(continueBtn.getBoundingClientRect().width) : 0,
          continueBtnHeight: continueBtn ? Math.round(continueBtn.getBoundingClientRect().height) : 0,
          filesBtnWidth: filesBtn ? Math.round(filesBtn.getBoundingClientRect().width) : 0,
          filesBtnHeight: filesBtn ? Math.round(filesBtn.getBoundingClientRect().height) : 0,
          ratio: continueBtn && filesBtn ? (continueBtn.getBoundingClientRect().width / filesBtn.getBoundingClientRect().width).toFixed(2) : 'N/A'
        };
      })
    };
  });

  console.log('Metrics 1440:', JSON.stringify(metrics1440, null, 2));

  // Screenshot 1440 full
  await page1440.screenshot({
    path: `${artifactDir}/final_rev_desktop_1440.png`,
    fullPage: false
  });

  // Dedicated crops 1440
  const headerEl = await page1440.$('.queue-header-bar');
  if (headerEl) await headerEl.screenshot({ path: `${artifactDir}/final_rev_crop_header_1440.png` });

  const navEl = await page1440.$('.queue-nav-strip');
  if (navEl) await navEl.screenshot({ path: `${artifactDir}/final_rev_crop_categories_1440.png` });

  const filterEl = await page1440.$('.filter-controls-row');
  if (filterEl) await filterEl.screenshot({ path: `${artifactDir}/final_rev_crop_filters_1440.png` });

  const cardsListEl = await page1440.$('.cards-vertical-list');
  if (cardsListEl) await cardsListEl.screenshot({ path: `${artifactDir}/final_rev_crop_two_cards_1440.png` });

  const card1El = await page1440.$('.task-compact-card:nth-child(1)');
  if (card1El) await card1El.screenshot({ path: `${artifactDir}/final_rev_crop_card1_1440.png` });

  const card2El = await page1440.$('.task-compact-card:nth-child(2)');
  if (card2El) await card2El.screenshot({ path: `${artifactDir}/final_rev_crop_card2_1440.png` });

  // 2. TEST EXPANSION OF ARQUIVOS (IN-COLUMN) AT 1440
  console.log('\n--- 2. Testing Expansion of Arquivos in 2-column layout ---');
  const filesBtn = await page1440.locator('.btn-toggle-expand').first();
  await filesBtn.click();
  await page1440.waitForTimeout(500);

  const expansionMetrics = await page1440.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.task-compact-card'));
    const panel = document.querySelector('.card-inline-panel');
    const b = el => el ? el.getBoundingClientRect() : null;
    return {
      card1: b(cards[0]),
      card2: b(cards[1]),
      panel: b(panel),
      card2MaintainedTop: cards[1] ? Math.round(cards[1].getBoundingClientRect().top) : null
    };
  });
  console.log('Expansion Metrics:', JSON.stringify(expansionMetrics, null, 2));

  await page1440.screenshot({
    path: `${artifactDir}/final_rev_desktop_expanded_1440.png`,
    fullPage: false
  });

  const cardsListExpandedEl = await page1440.$('.cards-vertical-list');
  if (cardsListExpandedEl) {
    await cardsListExpandedEl.screenshot({ path: `${artifactDir}/final_rev_crop_expansion_in_column_1440.png` });
  }

  await ctx1440.close();

  // 3. CAPTURE 1920x1080 FULL HD
  console.log('\n--- 3. Capturing Desktop 1920x1080 Full HD ---');
  const ctx1920 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx1920.addCookies(cookies);
  const page1920 = await ctx1920.newPage();
  await page1920.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page1920.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
  await page1920.waitForTimeout(600);

  const metrics1920 = await page1920.evaluate(() => {
    const root = document.querySelector('.tasks-tab-root');
    const sidebar = document.querySelector('.workspace-sidebar') || document.querySelector('aside');
    const cards = Array.from(document.querySelectorAll('.task-compact-card'));
    const b = el => el ? el.getBoundingClientRect() : null;
    return {
      viewportWidth: window.innerWidth,
      sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0,
      rootWidth: root ? Math.round(root.getBoundingClientRect().width) : 0,
      rootRight: root ? Math.round(root.getBoundingClientRect().right) : 0,
      unoccupiedRightSpace: root ? Math.round(window.innerWidth - root.getBoundingClientRect().right) : 0,
      cardWidths: cards.map(c => Math.round(c.getBoundingClientRect().width))
    };
  });
  console.log('Metrics 1920:', JSON.stringify(metrics1920, null, 2));

  await page1920.screenshot({
    path: `${artifactDir}/final_rev_desktop_1920.png`,
    fullPage: false
  });
  await ctx1920.close();

  // 4. CAPTURE MOBILE ANDROID (390x844) & VERIFY SWIPE
  console.log('\n--- 4. Capturing Mobile Android (390x844) & Swipe ---');
  const ctxMobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    isMobile: true,
    hasTouch: true
  });
  await ctxMobile.addCookies(cookies);
  const pageMobile = await ctxMobile.newPage();
  await pageMobile.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pageMobile.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
  await pageMobile.waitForTimeout(600);

  await pageMobile.screenshot({
    path: `${artifactDir}/final_rev_mobile_android_390.png`,
    fullPage: false
  });

  // Test swipe right to open sidebar
  const cdp = await pageMobile.context().newCDPSession(pageMobile);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 15, y: 300 }]
  });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 15 + i * 25, y: 300 }]
    });
    await pageMobile.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: []
  });
  await pageMobile.waitForTimeout(500);

  const sidebarOpened = await pageMobile.evaluate(() => {
    const aside = document.querySelector('.workspace-sidebar') || document.querySelector('aside');
    return aside ? aside.classList.contains('mobile-open') || window.getComputedStyle(aside).transform !== 'matrix(1, 0, 0, 1, -280, 0)' : false;
  });
  console.log('Mobile swipe opened sidebar:', sidebarOpened);

  await pageMobile.screenshot({
    path: `${artifactDir}/final_rev_mobile_sidebar_swipe_390.png`,
    fullPage: false
  });
  await ctxMobile.close();

  // Save all measurements
  writeFileSync(`${artifactDir}/final_rev_measurements.json`, JSON.stringify({
    timestamp: new Date().toISOString(),
    workerVersion,
    metrics1440,
    expansionMetrics,
    metrics1920,
    mobileSwipeOpened: sidebarOpened
  }, null, 2));

  console.log('\n=== FINAL REVISION CAPTURE COMPLETE! ===');
  await browser.close();
}

runCapture();
