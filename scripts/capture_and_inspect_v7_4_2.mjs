import { chromium, firefox } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { writeFileSync } from 'node:fs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const workerVersion = '395be97d-a31b-4308-833b-9cc4488b9556';

async function runHomologationAndInspection() {
  console.log(`=== HOMOLOGATION V7.4.2 LIVE: ${workerVersion} ===`);
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

  // 1. CAPTURE OPÇÃO A (2 COLUNAS) NA RESOLUÇÃO 1440x900
  console.log('\n--- Capturing Opção A (1440x900) ---');
  const ctx1440 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx1440.addCookies(cookies);
  const page1440 = await ctx1440.newPage();
  await page1440.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page1440.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
  await page1440.waitForTimeout(600);

  // Measure Opção A
  const metrics1440 = await page1440.evaluate(() => {
    const root = document.querySelector('.tasks-tab-root');
    const header = document.querySelector('.queue-header-bar');
    const headerTitle = document.querySelector('.tab-title');
    const headerDesc = document.querySelector('.tab-desc');
    const headerBadge = document.querySelector('.header-badge');
    const activePill = document.querySelector('.active-tasks-pill');
    const tabs = Array.from(document.querySelectorAll('.queue-tab-btn'));
    const searchInput = document.querySelector('.filter-input');
    const selectFilter = document.querySelector('.filter-select');
    const cards = Array.from(document.querySelectorAll('.task-compact-card'));

    const cardDetails = cards.map((c, i) => {
      const rect = c.getBoundingClientRect();
      const titleEl = c.querySelector('.task-work-name');
      const coverEl = c.querySelector('.card-visual-col');
      const continueBtn = c.querySelector('.btn-action-continue');
      const filesBtn = c.querySelector('.btn-toggle-expand');
      const chapterPill = c.querySelector('.meta-pill.chapter');
      const stagePill = c.querySelector('.meta-pill.stage');
      const stalePill = c.querySelector('.meta-pill.stale-inactivity');

      return {
        index: i,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        title: titleEl ? titleEl.textContent.trim() : null,
        titleFontSize: titleEl ? window.getComputedStyle(titleEl).fontSize : null,
        titleLineHeight: titleEl ? window.getComputedStyle(titleEl).lineHeight : null,
        coverWidth: coverEl ? coverEl.offsetWidth : null,
        coverHeight: coverEl ? coverEl.offsetHeight : null,
        chapterPillFontSize: chapterPill ? window.getComputedStyle(chapterPill).fontSize : null,
        stagePillFontSize: stagePill ? window.getComputedStyle(stagePill).fontSize : null,
        stalePillFontSize: stalePill ? window.getComputedStyle(stalePill).fontSize : null,
        continueBtnWidth: continueBtn ? continueBtn.offsetWidth : null,
        continueBtnHeight: continueBtn ? continueBtn.offsetHeight : null,
        continueBtnFontSize: continueBtn ? window.getComputedStyle(continueBtn).fontSize : null,
        filesBtnWidth: filesBtn ? filesBtn.offsetWidth : null,
        filesBtnHeight: filesBtn ? filesBtn.offsetHeight : null,
        filesBtnFontSize: filesBtn ? window.getComputedStyle(filesBtn).fontSize : null
      };
    });

    return {
      viewportWidth: window.innerWidth,
      rootWidth: root ? root.offsetWidth : null,
      header: {
        height: header ? header.offsetHeight : null,
        titleFontSize: headerTitle ? window.getComputedStyle(headerTitle).fontSize : null,
        titleHeight: headerTitle ? headerTitle.offsetHeight : null,
        descFontSize: headerDesc ? window.getComputedStyle(headerDesc).fontSize : null,
        badgeFontSize: headerBadge ? window.getComputedStyle(headerBadge).fontSize : null,
        pillFontSize: activePill ? window.getComputedStyle(activePill).fontSize : null
      },
      tabs: tabs.map(t => ({
        label: t.textContent.replace(/\s+/g, ' ').trim(),
        fontSize: window.getComputedStyle(t).fontSize,
        height: t.offsetHeight
      })),
      controls: {
        searchInputHeight: searchInput ? searchInput.offsetHeight : null,
        searchInputFontSize: searchInput ? window.getComputedStyle(searchInput).fontSize : null,
        selectFilterHeight: selectFilter ? selectFilter.offsetHeight : null,
        selectFilterFontSize: selectFilter ? window.getComputedStyle(selectFilter).fontSize : null
      },
      cardsCount: cards.length,
      cards: cardDetails
    };
  });

  console.log('Metrics 1440 (Opção A):', JSON.stringify(metrics1440, null, 2));

  // Screenshot full 1440
  await page1440.screenshot({ path: `${artifactDir}/v7_4_2_desktop_minha_fila_1440_opcao_a.png` });

  // Native crops for Opção A:
  // 1. Header Crop
  const headerEl = page1440.locator('.queue-header-bar');
  await headerEl.screenshot({ path: `${artifactDir}/v7_4_2_crop_header_1440.png` });

  // 2. Categories Crop
  const navEl = page1440.locator('.queue-nav-strip');
  await navEl.screenshot({ path: `${artifactDir}/v7_4_2_crop_categories_1440.png` });

  // 3. Search and Filters Crop
  const filterRowEl = page1440.locator('.filter-controls-row');
  await filterRowEl.screenshot({ path: `${artifactDir}/v7_4_2_crop_filters_1440.png` });

  // 4. Two Cards Side by Side Crop
  const cardsListEl = page1440.locator('.cards-vertical-list');
  await cardsListEl.screenshot({ path: `${artifactDir}/v7_4_2_crop_two_cards_opcao_a_1440.png` });

  // 5. Individual Cards
  const card1El = page1440.locator('.task-compact-card').first();
  await card1El.screenshot({ path: `${artifactDir}/v7_4_2_crop_card1_typeset.png` });

  const card2El = page1440.locator('.task-compact-card').nth(1);
  await card2El.screenshot({ path: `${artifactDir}/v7_4_2_crop_card2_traducao.png` });

  // 6. Test and screenshot Expanded "Arquivos" in Opção A
  const expandBtn = card1El.locator('.btn-toggle-expand');
  await expandBtn.click();
  await page1440.waitForTimeout(400);
  await page1440.screenshot({ path: `${artifactDir}/v7_4_2_desktop_expanded_1440.png` });
  await expandBtn.click(); // close it
  await page1440.waitForTimeout(300);

  // 7. Test and screenshot 1920x1080 (Opção A)
  console.log('\n--- Capturing 1920x1080 ---');
  const ctx1920 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx1920.addCookies(cookies);
  const page1920 = await ctx1920.newPage();
  await page1920.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page1920.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
  await page1920.waitForTimeout(600);
  await page1920.screenshot({ path: `${artifactDir}/v7_4_2_desktop_minha_fila_1920.png` });
  await ctx1920.close();

  // 8. Test and screenshot 1280x800 (Opção A)
  console.log('\n--- Capturing 1280x800 ---');
  const ctx1280 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx1280.addCookies(cookies);
  const page1280 = await ctx1280.newPage();
  await page1280.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page1280.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
  await page1280.waitForTimeout(600);
  await page1280.screenshot({ path: `${artifactDir}/v7_4_2_desktop_minha_fila_1280.png` });
  await ctx1280.close();

  // ==========================================
  // OPÇÃO B: LINHA ÚNICA HORIZONTAL COM MESMA ESCALA
  // ==========================================
  console.log('\n--- Testing & Capturing Opção B (Linha única horizontal com grande escala) ---');
  // Inject style override for Opção B
  await page1440.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'opcao-b-override';
    style.innerHTML = `
      .cards-vertical-list {
        display: flex !important;
        flex-direction: column !important;
        gap: 14px !important;
        width: 100% !important;
      }
      .task-compact-card {
        width: 100% !important;
        max-width: 100% !important;
      }
      .card-main-content {
        flex-direction: row !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 20px !important;
        padding: 16px 22px !important;
        min-height: 126px !important;
      }
      .card-identity-region {
        display: flex !important;
        align-items: center !important;
        gap: 18px !important;
        flex: 1 1 0% !important;
        min-width: 0 !important;
      }
      .card-visual-col {
        width: 70px !important;
        height: 94px !important;
        flex-shrink: 0 !important;
      }
      .card-details-col {
        gap: 6px !important;
      }
      .task-work-name {
        font-size: 1.25rem !important; /* 20px */
      }
      .card-actions-col {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        gap: 12px !important;
        width: auto !important;
        border-top: none !important;
        padding-top: 0 !important;
        margin-top: 0 !important;
        flex-shrink: 0 !important;
      }
      .btn-action-continue {
        height: 46px !important;
        min-height: 46px !important;
        padding: 0 24px !important;
        width: auto !important;
      }
      .btn-toggle-expand {
        height: 46px !important;
        min-height: 46px !important;
        padding: 0 18px !important;
        width: auto !important;
      }
    `;
    document.head.appendChild(style);
  });
  await page1440.waitForTimeout(500);

  // Measure Opção B
  const metricsOpcaoB = await page1440.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.task-compact-card'));
    return cards.map((c, i) => {
      const r = c.getBoundingClientRect();
      const continueBtn = c.querySelector('.btn-action-continue');
      const filesBtn = c.querySelector('.btn-toggle-expand');
      return {
        cardIndex: i,
        width: Math.round(r.width),
        height: Math.round(r.height),
        continueBtnSize: continueBtn ? `${continueBtn.offsetWidth}x${continueBtn.offsetHeight}` : null,
        filesBtnSize: filesBtn ? `${filesBtn.offsetWidth}x${filesBtn.offsetHeight}` : null
      };
    });
  });
  console.log('Metrics Opção B (1440):', metricsOpcaoB);

  await page1440.screenshot({ path: `${artifactDir}/v7_4_2_desktop_minha_fila_1440_opcao_b.png` });
  await page1440.locator('.cards-vertical-list').screenshot({ path: `${artifactDir}/v7_4_2_crop_cards_opcao_b_1440.png` });

  // Remove Opção B override to restore pristine Opção A
  await page1440.evaluate(() => {
    const el = document.getElementById('opcao-b-override');
    if (el) el.remove();
  });
  await page1440.waitForTimeout(300);

  // ==========================================
  // MOBILE AUDIT (390px Android)
  // ==========================================
  console.log('\n--- Capturing Android (390px) ---');
  const ctxMobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
  });
  await ctxMobile.addCookies(cookies);
  const pageMobile = await ctxMobile.newPage();
  await pageMobile.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pageMobile.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
  await pageMobile.waitForTimeout(600);

  const mobileMetrics = await pageMobile.evaluate(() => {
    const card = document.querySelector('.task-compact-card');
    const tabs = Array.from(document.querySelectorAll('.queue-tab-btn')).map(b => ({
      text: b.textContent.replace(/\s+/g, ' ').trim(),
      width: b.offsetWidth,
      height: b.offsetHeight
    }));
    const continueBtn = document.querySelector('.btn-action-continue');
    const filesBtn = document.querySelector('.btn-toggle-expand');
    const bottomBar = document.querySelector('.scan-mobile-bottom-bar');

    return {
      viewportWidth: window.innerWidth,
      cardWidth: card ? card.offsetWidth : 0,
      cardHeight: card ? card.offsetHeight : 0,
      tabs,
      continueBtnHeight: continueBtn ? continueBtn.offsetHeight : 0,
      filesBtnHeight: filesBtn ? filesBtn.offsetHeight : 0,
      hasBottomBar: !!bottomBar && window.getComputedStyle(bottomBar).display !== 'none'
    };
  });
  console.log('Mobile Android (390) Metrics:', mobileMetrics);

  await pageMobile.screenshot({ path: `${artifactDir}/v7_4_2_mobile_android_390.png` });

  // Test CDP Swipe Touch on Mobile
  const client = await ctxMobile.newCDPSession(pageMobile);
  try {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 10, y: 350 }]
    });
    for (let s = 1; s <= 10; s++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: Math.round(10 + (220 * s) / 10), y: 350 }]
      });
      await pageMobile.waitForTimeout(16);
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await pageMobile.waitForTimeout(400);

    const sidebarOpened = await pageMobile.evaluate(() => {
      const sb = document.querySelector('.workspace-sidebar');
      return sb ? window.getComputedStyle(sb).transform !== 'none' || sb.classList.contains('mobile-open') : false;
    });
    console.log(`CDP swipe opened sidebar on Android: ${sidebarOpened}`);
    await pageMobile.screenshot({ path: `${artifactDir}/v7_4_2_mobile_sidebar_swipe_opened_390.png` });
  } finally {
    await client.detach().catch(() => {});
  }

  await ctxMobile.close();

  // ==========================================
  // FIREFOX TEST (1440)
  // ==========================================
  console.log('\n--- Capturing Firefox (1440x900) ---');
  const ffBrowser = await firefox.launch({ headless: true });
  const ffCtx = await ffBrowser.newContext({ viewport: { width: 1440, height: 900 } });
  await ffCtx.addCookies(cookies);
  const ffPage = await ffCtx.newPage();
  await ffPage.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await ffPage.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });
  await ffPage.waitForTimeout(600);
  await ffPage.screenshot({ path: `${artifactDir}/v7_4_2_firefox_desktop_1440.png` });
  await ffBrowser.close();

  await browser.close();

  writeFileSync(`${artifactDir}/v7_4_2_measurements.json`, JSON.stringify({
    timestamp: new Date().toISOString(),
    workerVersion,
    opcaoA_1440: metrics1440,
    opcaoB_1440: metricsOpcaoB,
    mobile_390: mobileMetrics
  }, null, 2));

  console.log('\n=== HOMOLOGATION V7.4.2 COMPLETE! ===');
}

runHomologationAndInspection().catch(err => {
  console.error(err);
  process.exit(1);
});
