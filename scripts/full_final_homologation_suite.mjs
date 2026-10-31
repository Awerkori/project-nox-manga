import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { writeFileSync } from 'node:fs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const workerVersion = 'ef2bf164-d68d-45a7-b6a8-b38d194adae0';

async function runFullSuite() {
  console.log(`=== FULL DEFINITIVE HOMOLOGATION SUITE: ${workerVersion} ===`);
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
  const suiteResults = {
    workerVersion,
    timestamp: new Date().toISOString(),
    tests: {},
    measurements: {}
  };

  // =========================================================================
  // 1. DESKTOP VIEWPORTS (1280x800, 1440x900, 1920x1080)
  // =========================================================================
  for (const vp of [{ w: 1280, h: 800 }, { w: 1440, h: 900 }, { w: 1920, h: 1080 }]) {
    console.log(`\n--- Desktop ${vp.w}x${vp.h} ---`);
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    const t0 = performance.now();
    await page.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
    const loadTimeMs = Math.round(performance.now() - t0);
    await page.waitForTimeout(600);

    const data = await page.evaluate((vpW) => {
      const root = document.querySelector('.tasks-tab-root');
      const header = document.querySelector('.queue-header-bar');
      const tabs = Array.from(document.querySelectorAll('.queue-tab-btn'));
      const cards = Array.from(document.querySelectorAll('.task-compact-card'));
      const b = el => el ? el.getBoundingClientRect() : null;
      const cs = el => el ? window.getComputedStyle(el) : null;

      const c1 = cards[0];
      const c2 = cards[1];
      const title1 = c1?.querySelector('.task-work-name');
      const ch1 = c1?.querySelector('.meta-pill.chapter');
      const st1 = c1?.querySelector('.meta-pill.stage');
      const inact1 = c1?.querySelector('.meta-pill.stale-inactivity');
      const cont1 = c1?.querySelector('.btn-action-continue');
      const files1 = c1?.querySelector('.btn-toggle-expand');

      return {
        viewportWidth: vpW,
        rootWidth: root ? Math.round(root.getBoundingClientRect().width) : 0,
        unoccupiedRightSpace: root ? Math.round(vpW - root.getBoundingClientRect().right) : 0,
        headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,
        cardsCount: cards.length,
        card1: {
          width: c1 ? Math.round(c1.getBoundingClientRect().width) : 0,
          height: c1 ? Math.round(c1.getBoundingClientRect().height) : 0,
          top: c1 ? Math.round(c1.getBoundingClientRect().top) : 0,
          titleText: title1?.textContent?.trim(),
          titleFontSize: cs(title1)?.fontSize,
          titleFontWeight: cs(title1)?.fontWeight,
          chapterText: ch1?.textContent?.trim(),
          chapterColor: cs(ch1)?.color,
          chapterWeight: cs(ch1)?.fontWeight,
          stageText: st1?.textContent?.trim(),
          stageWeight: cs(st1)?.fontWeight,
          inactivityText: inact1?.textContent?.trim(),
          inactivityFontSize: cs(inact1)?.fontSize,
          continueWidth: cont1 ? Math.round(cont1.getBoundingClientRect().width) : 0,
          filesWidth: files1 ? Math.round(files1.getBoundingClientRect().width) : 0,
          ratio: cont1 && files1 ? (cont1.getBoundingClientRect().width / files1.getBoundingClientRect().width).toFixed(2) : 'N/A'
        },
        card2: {
          width: c2 ? Math.round(c2.getBoundingClientRect().width) : 0,
          height: c2 ? Math.round(c2.getBoundingClientRect().height) : 0,
          top: c2 ? Math.round(c2.getBoundingClientRect().top) : 0,
          titleText: c2?.querySelector('.task-work-name')?.textContent?.trim()
        }
      };
    }, vp.w);

    suiteResults.measurements[`desktop_${vp.w}`] = { ...data, loadTimeMs };
    console.log(`Desktop ${vp.w} Data:`, JSON.stringify(data, null, 2));

    await page.screenshot({
      path: `${artifactDir}/def_desktop_${vp.w}.png`,
      fullPage: false
    });

    // Native crops on 1440
    if (vp.w === 1440) {
      const headerEl = await page.$('.queue-header-bar');
      if (headerEl) await headerEl.screenshot({ path: `${artifactDir}/def_crop_header_1440.png` });

      const navEl = await page.$('.queue-nav-strip');
      if (navEl) await navEl.screenshot({ path: `${artifactDir}/def_crop_categories_1440.png` });

      const filterEl = await page.$('.filter-controls-row');
      if (filterEl) await filterEl.screenshot({ path: `${artifactDir}/def_crop_filters_1440.png` });

      const cardsEl = await page.$('.cards-vertical-list');
      if (cardsEl) await cardsEl.screenshot({ path: `${artifactDir}/def_crop_two_cards_1440.png` });

      const card1El = await page.$('.task-compact-card:nth-child(1)');
      if (card1El) await card1El.screenshot({ path: `${artifactDir}/def_crop_card1_typeset_1440.png` });

      const card2El = await page.$('.task-compact-card:nth-child(2)');
      if (card2El) await card2El.screenshot({ path: `${artifactDir}/def_crop_card2_traducao_1440.png` });

      // TEST EXPANSION OF ARQUIVOS
      console.log('\n--- Testing Desktop Arquivos Expansion ---');
      // 1. Expand Card 1
      const card1FilesBtn = page.locator('.task-compact-card:nth-child(1) .btn-toggle-expand');
      await card1FilesBtn.click();
      await page.waitForTimeout(400);

      const exp1Metrics = await page.evaluate(() => {
        const c1 = document.querySelectorAll('.task-compact-card')[0];
        const c2 = document.querySelectorAll('.task-compact-card')[1];
        return {
          card1Height: Math.round(c1.getBoundingClientRect().height),
          card2Height: Math.round(c2.getBoundingClientRect().height),
          card2Top: Math.round(c2.getBoundingClientRect().top)
        };
      });
      console.log('Card 1 Expanded (Card 2 should remain top 368 and 211px height):', exp1Metrics);
      suiteResults.tests.desktop_card1_expansion = exp1Metrics;

      await page.screenshot({ path: `${artifactDir}/def_desktop_card1_expanded_1440.png` });

      // 2. Also Expand Card 2 (both expanded at different heights!)
      const card2FilesBtn = page.locator('.task-compact-card:nth-child(2) .btn-toggle-expand');
      await card2FilesBtn.click();
      await page.waitForTimeout(400);

      const expBothMetrics = await page.evaluate(() => {
        const c1 = document.querySelectorAll('.task-compact-card')[0];
        const c2 = document.querySelectorAll('.task-compact-card')[1];
        return {
          card1Height: Math.round(c1.getBoundingClientRect().height),
          card2Height: Math.round(c2.getBoundingClientRect().height),
          card1Width: Math.round(c1.getBoundingClientRect().width),
          card2Width: Math.round(c2.getBoundingClientRect().width),
          card1Top: Math.round(c1.getBoundingClientRect().top),
          card2Top: Math.round(c2.getBoundingClientRect().top)
        };
      });
      console.log('Both Cards Expanded simultaneously:', expBothMetrics);
      suiteResults.tests.desktop_both_expanded = expBothMetrics;

      await page.screenshot({ path: `${artifactDir}/def_desktop_both_cards_expanded_1440.png` });

      // 3. Collapse both back
      await card1FilesBtn.click();
      await card2FilesBtn.click();
      await page.waitForTimeout(300);

      const collapsedMetrics = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.task-compact-card'));
        return {
          card1Height: Math.round(cards[0].getBoundingClientRect().height),
          card2Height: Math.round(cards[1].getBoundingClientRect().height)
        };
      });
      console.log('Both Cards Collapsed back:', collapsedMetrics);
      suiteResults.tests.desktop_collapse_back = collapsedMetrics;

      // TEST SEARCH AND FILTERS
      console.log('\n--- Testing Search & Filters ---');
      const searchBox = page.locator('.desktop-search .filter-input');
      await searchBox.fill('Typeset');
      await page.waitForTimeout(300);
      let count = await page.locator('.task-compact-card').count();
      console.log('Filter search "Typeset" cards count:', count);
      suiteResults.tests.search_filter = { query: 'Typeset', count };

      // Clear search
      await page.locator('.btn-clear-search').click();
      await page.waitForTimeout(300);
      count = await page.locator('.task-compact-card').count();
      console.log('Cleared search cards count:', count);
      suiteResults.tests.search_clear = { count };

      // TEST CATEGORY TABS
      for (const tabIdx of [0, 1, 2, 3]) {
        const tabBtn = page.locator('.queue-tab-btn').nth(tabIdx);
        const label = await tabBtn.innerText();
        await tabBtn.click();
        await page.waitForTimeout(300);
        const activeCount = await page.locator('.task-compact-card').count();
        console.log(`Tab ${label.trim().replace(/\s+/g, ' ')}: cards count = ${activeCount}`);
      }
      // Return to MINE
      await page.locator('.queue-tab-btn').nth(0).click();
      await page.waitForTimeout(300);
    }

    await ctx.close();
  }

  // =========================================================================
  // 2. MOBILE VIEWPORTS (320px, 360px, 390px, 430px)
  // =========================================================================
  for (const mw of [320, 360, 390, 430]) {
    console.log(`\n--- Mobile ${mw}px ---`);
    const ctx = await browser.newContext({
      viewport: { width: mw, height: 844 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      isMobile: true,
      hasTouch: true
    });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    const t0 = performance.now();
    await page.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
    const loadTimeMs = Math.round(performance.now() - t0);
    await page.waitForTimeout(600);

    const mData = await page.evaluate((vpW) => {
      const root = document.querySelector('.tasks-tab-root');
      const list = document.querySelector('.cards-vertical-list');
      const cards = Array.from(document.querySelectorAll('.task-compact-card'));
      const c = cards[0];
      const b = el => el ? el.getBoundingClientRect() : null;

      const cardRect = b(c);
      const listRect = b(list);

      return {
        viewportWidth: vpW,
        rootWidth: root ? Math.round(root.getBoundingClientRect().width) : 0,
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
    }, mw);

    suiteResults.measurements[`mobile_${mw}`] = { ...mData, loadTimeMs };
    console.log(`Mobile ${mw} Data:`, JSON.stringify(mData, null, 2));

    await page.screenshot({
      path: `${artifactDir}/def_mobile_${mw}.png`,
      fullPage: false
    });

    if (mw === 390) {
      // Test mobile Arquivos expansion
      console.log('\n--- Mobile Arquivos Expansion on 390px ---');
      const mobFilesBtn = page.locator('.task-compact-card:nth-child(1) .btn-toggle-expand');
      await mobFilesBtn.click();
      await page.waitForTimeout(400);

      const mExp = await page.evaluate(() => {
        const c = document.querySelector('.task-compact-card');
        const p = document.querySelector('.card-inline-panel');
        return {
          cardWidth: Math.round(c.getBoundingClientRect().width),
          cardHeight: Math.round(c.getBoundingClientRect().height),
          panelWidth: Math.round(p.getBoundingClientRect().width)
        };
      });
      console.log('Mobile Card 1 Expanded:', mExp);
      suiteResults.tests.mobile_expansion_390 = mExp;

      await page.screenshot({ path: `${artifactDir}/def_mobile_expanded_390.png` });

      await mobFilesBtn.click();
      await page.waitForTimeout(300);

      // Test mobile swipe right (touch emulation via CDP)
      console.log('\n--- Mobile Swipe Right (CDP Touch Emulation) ---');
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
      suiteResults.tests.swipe_opened_sidebar = swipeOpened;

      await page.screenshot({ path: `${artifactDir}/def_mobile_sidebar_swipe_390.png` });

      // Test swipe left to close
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: 250, y: 300 }]
      });
      for (let s = 1; s <= 6; s++) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: 250 - s * 25, y: 300 }]
        });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: []
      });
      await page.waitForTimeout(500);

      const swipeClosed = await page.evaluate(() => {
        const aside = document.querySelector('.workspace-sidebar') || document.querySelector('aside');
        return aside ? !aside.classList.contains('mobile-open') || window.getComputedStyle(aside).transform === 'matrix(1, 0, 0, 1, -280, 0)' : true;
      });
      console.log('Swipe Closed Sidebar:', swipeClosed);
      suiteResults.tests.swipe_closed_sidebar = swipeClosed;
    }

    await ctx.close();
  }

  // Save all results
  writeFileSync(`${artifactDir}/definitive_homologation_results.json`, JSON.stringify(suiteResults, null, 2));

  console.log('\n=== FULL DEFINITIVE HOMOLOGATION SUITE COMPLETED SUCCESSFULLY! ===');
  await browser.close();
}

runFullSuite();
