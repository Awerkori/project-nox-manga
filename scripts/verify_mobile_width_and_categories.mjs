import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { writeFileSync } from 'node:fs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const workerVersion = '35a9ddc6-2715-460b-be99-ae44f2ac9cc5';

async function verifyAll() {
  console.log(`=== RUNNING MOBILE RESTORATION HOMOLOGATION: ${workerVersion} ===`);
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

  const mobileResults = {};

  // 1. TEST ALL MOBILE RESOLUTIONS (320, 360, 390, 430)
  for (const w of [320, 360, 390, 430]) {
    console.log(`\n--- Testing Mobile Viewport: ${w}px ---`);
    const ctx = await browser.newContext({
      viewport: { width: w, height: 844 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      isMobile: true,
      hasTouch: true
    });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    await page.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
    await page.waitForTimeout(600);

    const data = await page.evaluate((vpW) => {
      const root = document.querySelector('.tasks-tab-root');
      const list = document.querySelector('.cards-vertical-list');
      const cards = Array.from(document.querySelectorAll('.task-compact-card'));
      const c = cards[0];
      const b = el => el ? el.getBoundingClientRect() : null;

      const cardRect = b(c);
      const rootRect = b(root);
      const listRect = b(list);

      return {
        viewportWidth: vpW,
        rootWidth: rootRect ? Math.round(rootRect.width) : 0,
        listWidth: listRect ? Math.round(listRect.width) : 0,
        cardCount: cards.length,
        cardWidth: cardRect ? Math.round(cardRect.width) : 0,
        cardHeight: cardRect ? Math.round(cardRect.height) : 0,
        cardLeft: cardRect ? Math.round(cardRect.left) : 0,
        cardRight: cardRect ? Math.round(cardRect.right) : 0,
        spaceLeft: cardRect ? Math.round(cardRect.left) : 0,
        spaceRight: cardRect ? Math.round(vpW - cardRect.right) : 0,
        percentageOfAvailable: listRect && cardRect ? ((cardRect.width / listRect.width) * 100).toFixed(1) + '%' : 'N/A'
      };
    }, w);

    mobileResults[`mobile_${w}`] = data;
    console.log(`Metrics for ${w}px:`, JSON.stringify(data, null, 2));

    await page.screenshot({
      path: `${artifactDir}/mobile_restored_${w}.png`,
      fullPage: false
    });

    // On 390px, test expansion of Arquivos and swipe gesture
    if (w === 390) {
      console.log('\n--- Testing Arquivos Expansion on Mobile (390px) ---');
      const filesBtn = await page.locator('.btn-toggle-expand').first();
      await filesBtn.click();
      await page.waitForTimeout(500);

      const expData = await page.evaluate(() => {
        const c = document.querySelector('.task-compact-card');
        const panel = document.querySelector('.card-inline-panel');
        const b = el => el ? el.getBoundingClientRect() : null;
        return {
          cardWidthExpanded: c ? Math.round(c.getBoundingClientRect().width) : 0,
          cardHeightExpanded: c ? Math.round(c.getBoundingClientRect().height) : 0,
          panelWidth: panel ? Math.round(panel.getBoundingClientRect().width) : 0,
          panelHeight: panel ? Math.round(panel.getBoundingClientRect().height) : 0
        };
      });
      console.log('Mobile Arquivos Expansion:', JSON.stringify(expData, null, 2));
      mobileResults.mobile_expansion_390 = expData;

      await page.screenshot({
        path: `${artifactDir}/mobile_restored_expanded_390.png`,
        fullPage: false
      });

      // Collapse back
      await filesBtn.click();
      await page.waitForTimeout(300);

      // Test all 4 tabs on mobile
      const tabNames = [
        { id: 'MINE', name: 'Em Andamento' },
        { id: 'AVAILABLE', name: 'Disponíveis' },
        { id: 'WAITING', name: 'Aguardando' },
        { id: 'DONE', name: 'Concluídas' }
      ];

      for (let i = 0; i < tabNames.length; i++) {
        const tabBtn = page.locator('.queue-tab-btn').nth(i);
        await tabBtn.click();
        await page.waitForTimeout(400);

        const tabMetrics = await page.evaluate(() => {
          const activeBtn = document.querySelector('.queue-tab-btn.active');
          const cards = Array.from(document.querySelectorAll('.task-compact-card'));
          const emptyBox = document.querySelector('.empty-state-box');
          return {
            activeTabText: activeBtn?.innerText.replace(/\s+/g, ' ').trim(),
            cardsRendered: cards.length,
            hasEmptyState: !!emptyBox,
            firstCardWidth: cards[0] ? Math.round(cards[0].getBoundingClientRect().width) : null
          };
        });

        console.log(`Tab ${tabNames[i].name}:`, tabMetrics);
        mobileResults[`tab_${tabNames[i].id}`] = tabMetrics;

        await page.screenshot({
          path: `${artifactDir}/mobile_restored_tab_${tabNames[i].id.toLowerCase()}_390.png`,
          fullPage: false
        });
      }

      // Return to MINE tab
      await page.locator('.queue-tab-btn').first().click();
      await page.waitForTimeout(300);

      // Test touch swipe right
      console.log('\n--- Testing Mobile Touch Swipe Right ---');
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: 15, y: 300 }]
      });
      for (let s = 1; s <= 6; s++) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: 15 + s * 25, y: 300 }]
        });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: []
      });
      await page.waitForTimeout(500);

      const swipeOpened = await page.evaluate(() => {
        const aside = document.querySelector('.workspace-sidebar') || document.querySelector('aside');
        return aside ? aside.classList.contains('mobile-open') || window.getComputedStyle(aside).transform !== 'matrix(1, 0, 0, 1, -280, 0)' : false;
      });
      console.log('Swipe Opened Sidebar:', swipeOpened);
      mobileResults.swipeOpened = swipeOpened;

      await page.screenshot({
        path: `${artifactDir}/mobile_restored_sidebar_swipe_390.png`,
        fullPage: false
      });
    }

    await ctx.close();
  }

  // 2. TEST DESKTOP CONFIRMATION (1440 & 1920)
  console.log('\n--- Verifying Desktop Preservation (1440x900) ---');
  const ctx1440 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx1440.addCookies(cookies);
  const page1440 = await ctx1440.newPage();
  await page1440.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page1440.waitForSelector('.tasks-tab-root');
  await page1440.waitForTimeout(600);

  const desktop1440 = await page1440.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.task-compact-card'));
    const list = document.querySelector('.cards-vertical-list');
    const cs = window.getComputedStyle(list);
    return {
      viewportWidth: 1440,
      gridTemplateColumns: cs.gridTemplateColumns,
      cardsCount: cards.length,
      card1Width: cards[0] ? Math.round(cards[0].getBoundingClientRect().width) : 0,
      card2Width: cards[1] ? Math.round(cards[1].getBoundingClientRect().width) : 0,
      card1Height: cards[0] ? Math.round(cards[0].getBoundingClientRect().height) : 0,
      card2Height: cards[1] ? Math.round(cards[1].getBoundingClientRect().height) : 0,
      card1Top: cards[0] ? Math.round(cards[0].getBoundingClientRect().top) : 0,
      card2Top: cards[1] ? Math.round(cards[1].getBoundingClientRect().top) : 0
    };
  });
  console.log('Desktop 1440 Metrics:', desktop1440);
  mobileResults.desktop1440 = desktop1440;

  await page1440.screenshot({
    path: `${artifactDir}/mobile_restored_desktop_1440.png`,
    fullPage: false
  });
  await ctx1440.close();

  console.log('\n--- Verifying Desktop Preservation (1920x1080) ---');
  const ctx1920 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx1920.addCookies(cookies);
  const page1920 = await ctx1920.newPage();
  await page1920.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page1920.waitForSelector('.tasks-tab-root');
  await page1920.waitForTimeout(600);

  const desktop1920 = await page1920.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.task-compact-card'));
    const root = document.querySelector('.tasks-tab-root');
    return {
      viewportWidth: 1920,
      rootWidth: root ? Math.round(root.getBoundingClientRect().width) : 0,
      unoccupiedRightSpace: root ? Math.round(window.innerWidth - root.getBoundingClientRect().right) : 0,
      cardsCount: cards.length,
      card1Width: cards[0] ? Math.round(cards[0].getBoundingClientRect().width) : 0,
      card2Width: cards[1] ? Math.round(cards[1].getBoundingClientRect().width) : 0
    };
  });
  console.log('Desktop 1920 Metrics:', desktop1920);
  mobileResults.desktop1920 = desktop1920;

  await page1920.screenshot({
    path: `${artifactDir}/mobile_restored_desktop_1920.png`,
    fullPage: false
  });
  await ctx1920.close();

  // Save all json results
  writeFileSync(`${artifactDir}/mobile_restoration_measurements.json`, JSON.stringify(mobileResults, null, 2));

  await browser.close();
  console.log('\n=== HOMOLOGATION SCRIPT COMPLETE! ===');
}

verifyAll();
