import { chromium, firefox } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { writeFileSync } from 'node:fs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const workerVersion = 'b272b074-c7e2-456b-898c-cd7ec15191e3';

async function runHomologation() {
  console.log(`=== HOMOLOGATION V7.4.1 LIVE: ${workerVersion} ===`);
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

  const desktopVps = [
    { w: 1440, h: 900, name: '1440' },
    { w: 1920, h: 1080, name: '1920' },
    { w: 1792, h: 900, name: '1792' },
    { w: 1366, h: 768, name: '1366' },
    { w: 1280, h: 800, name: '1280' },
    { w: 1024, h: 768, name: '1024_tablet' }
  ];

  const desktopResults = {};

  for (const vp of desktopVps) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    await page.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
    await page.waitForTimeout(600); // allow fonts & images to settle

    const m = await page.evaluate(() => {
      const sidebar = document.querySelector('.workspace-sidebar');
      const content = document.querySelector('.workspace-view-content');
      const root = document.querySelector('.tasks-tab-root');
      const cardList = document.querySelector('.cards-vertical-list');
      const cards = Array.from(document.querySelectorAll('.task-compact-card'));
      const header = document.querySelector('.queue-header-bar');
      const navStrip = document.querySelector('.queue-nav-strip');

      const sRect = sidebar ? sidebar.getBoundingClientRect() : { width: 0, right: 0 };
      const rRect = root ? root.getBoundingClientRect() : { width: 0, left: 0, right: 0 };
      const lRect = cardList ? cardList.getBoundingClientRect() : { width: 0, left: 0, right: 0 };

      const cardDetails = cards.map((c, i) => {
        const rect = c.getBoundingClientRect();
        const titleEl = c.querySelector('.task-work-name');
        const coverEl = c.querySelector('.card-visual-col');
        const continueBtn = c.querySelector('.btn-action-continue');
        const filesBtn = c.querySelector('.btn-toggle-expand');
        const pills = Array.from(c.querySelectorAll('.meta-pill')).map(p => p.textContent.trim());

        return {
          index: i,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          title: titleEl ? titleEl.textContent.trim() : null,
          titleFontSize: titleEl ? window.getComputedStyle(titleEl).fontSize : null,
          titleFontWeight: titleEl ? window.getComputedStyle(titleEl).fontWeight : null,
          coverSize: coverEl ? `${coverEl.offsetWidth}x${coverEl.offsetHeight}` : null,
          continueBtnSize: continueBtn ? `${continueBtn.offsetWidth}x${continueBtn.offsetHeight}` : null,
          filesBtnSize: filesBtn ? `${filesBtn.offsetWidth}x${filesBtn.offsetHeight}` : null,
          pills
        };
      });

      return {
        viewportWidth: window.innerWidth,
        sidebarWidth: Math.round(sRect.width),
        availableAfterSidebar: Math.round(window.innerWidth - sRect.right),
        rootWidth: Math.round(rRect.width),
        rootLeft: Math.round(rRect.left),
        rootRight: Math.round(rRect.right),
        emptySpaceRight: Math.round(window.innerWidth - rRect.right),
        cardListDisplay: cardList ? window.getComputedStyle(cardList).display : null,
        cardListCols: cardList ? window.getComputedStyle(cardList).gridTemplateColumns : null,
        headerHeight: header ? Math.round(header.offsetHeight) : null,
        cardsCount: cards.length,
        cards: cardDetails
      };
    });

    desktopResults[vp.name] = m;
    console.log(`\n=== Viewport ${vp.name} ===`);
    console.log(JSON.stringify(m, null, 2));

    await page.screenshot({ path: `${artifactDir}/v7_4_1_desktop_minha_fila_${vp.name}.png` });

    // For 1440, also test toggling "Arquivos" to inspect expanded card in 2-col grid
    if (vp.name === '1440') {
      const firstExpandBtn = page.locator('.btn-toggle-expand').first();
      await firstExpandBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${artifactDir}/v7_4_1_desktop_expanded_1440.png` });

      // Check expanded card metrics
      const expMetrics = await page.evaluate(() => {
        const firstCard = document.querySelector('.task-compact-card');
        const panel = document.querySelector('.card-inline-panel');
        return {
          cardWidth: firstCard ? Math.round(firstCard.getBoundingClientRect().width) : 0,
          cardHeight: firstCard ? Math.round(firstCard.getBoundingClientRect().height) : 0,
          panelVisible: !!panel,
          panelHeight: panel ? Math.round(panel.getBoundingClientRect().height) : 0
        };
      });
      console.log('Expanded Card Metrics (1440):', expMetrics);

      // Collapse it back
      await firstExpandBtn.click();
      await page.waitForTimeout(300);

      // Test Category switches
      // 1. Available
      await page.locator('.queue-tab-btn').nth(1).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${artifactDir}/v7_4_1_category_available_1440.png` });

      // 2. Waiting
      await page.locator('.queue-tab-btn').nth(2).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${artifactDir}/v7_4_1_category_waiting_1440.png` });

      // 3. Done
      await page.locator('.queue-tab-btn').nth(3).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${artifactDir}/v7_4_1_category_done_1440.png` });

      // Return to Mine
      await page.locator('.queue-tab-btn').first().click();
      await page.waitForTimeout(400);
    }

    await ctx.close();
  }

  // ==========================================
  // MOBILE AUDIT (320, 360, 390, 430)
  // ==========================================
  console.log('\n--- Testing Mobile Viewports (Android) ---');
  const mobileVps = [
    { w: 320, h: 640, name: '320' },
    { w: 360, h: 800, name: '360' },
    { w: 390, h: 844, name: '390' },
    { w: 430, h: 932, name: '430' }
  ];

  const mobileResults = {};

  for (const mvp of mobileVps) {
    const ctx = await browser.newContext({
      viewport: { width: mvp.w, height: mvp.h },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
    });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    await page.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
    await page.waitForTimeout(600);

    const mMetrics = await page.evaluate(() => {
      const card = document.querySelector('.task-compact-card');
      const tabs = Array.from(document.querySelectorAll('.queue-tab-btn')).map(b => ({
        text: b.textContent.replace(/\s+/g, ' ').trim(),
        width: b.offsetWidth,
        height: b.offsetHeight
      }));
      const bottomBar = document.querySelector('.scan-mobile-bottom-bar');
      const continueBtn = document.querySelector('.btn-action-continue');
      const filesBtn = document.querySelector('.btn-toggle-expand');

      return {
        viewportWidth: window.innerWidth,
        cardWidth: card ? card.offsetWidth : 0,
        cardHeight: card ? card.offsetHeight : 0,
        tabsCount: tabs.length,
        tabs,
        hasBottomBar: !!bottomBar && window.getComputedStyle(bottomBar).display !== 'none',
        continueBtnHeight: continueBtn ? continueBtn.offsetHeight : 0,
        filesBtnHeight: filesBtn ? filesBtn.offsetHeight : 0
      };
    });

    mobileResults[mvp.name] = mMetrics;
    console.log(`Mobile ${mvp.name}:`, mMetrics);
    await page.screenshot({ path: `${artifactDir}/v7_4_1_mobile_android_${mvp.name}.png` });

    // Test CDP swipe touch to open sidebar on 390
    if (mvp.name === '390') {
      const client = await ctx.newCDPSession(page);
      try {
        console.log('Executing CDP touch swipe gesture right to open sidebar...');
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: 10, y: 350 }]
        });
        for (let s = 1; s <= 10; s++) {
          await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: Math.round(10 + (220 * s) / 10), y: 350 }]
          });
          await page.waitForTimeout(16);
        }
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(400);

        const sidebarOpened = await page.evaluate(() => {
          const sb = document.querySelector('.workspace-sidebar');
          return sb ? window.getComputedStyle(sb).transform !== 'none' || sb.classList.contains('mobile-open') : false;
        });
        console.log(`CDP swipe opened sidebar: ${sidebarOpened}`);
        await page.screenshot({ path: `${artifactDir}/v7_4_1_mobile_sidebar_swipe_opened_390.png` });

        // Swipe left to close
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: 230, y: 350 }]
        });
        for (let s = 1; s <= 10; s++) {
          await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: Math.round(230 - (200 * s) / 10), y: 350 }]
          });
          await page.waitForTimeout(16);
        }
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${artifactDir}/v7_4_1_mobile_sidebar_swipe_closed_390.png` });
      } finally {
        await client.detach().catch(() => {});
      }
    }

    await ctx.close();
  }

  // ==========================================
  // FIREFOX DESKTOP TEST (1440)
  // ==========================================
  console.log('\n--- Testing Firefox Desktop (1440) ---');
  const ffBrowser = await firefox.launch({ headless: true });
  const ffCtx = await ffBrowser.newContext({ viewport: { width: 1440, height: 900 } });
  await ffCtx.addCookies(cookies);
  const ffPage = await ffCtx.newPage();
  await ffPage.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await ffPage.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
  await ffPage.waitForTimeout(600);
  await ffPage.screenshot({ path: `${artifactDir}/v7_4_1_firefox_desktop_1440.png` });
  console.log('Firefox Desktop screenshot captured successfully.');
  await ffBrowser.close();

  await browser.close();

  writeFileSync(`${artifactDir}/v7_4_1_measurements.json`, JSON.stringify({
    timestamp: new Date().toISOString(),
    workerVersion,
    desktop: desktopResults,
    mobile: mobileResults
  }, null, 2));

  console.log('\n=== HOMOLOGATION V7.4.1 COMPLETE! ===');
}

runHomologation().catch(err => {
  console.error('Homologation failed:', err);
  process.exit(1);
});
