const { chromium, firefox } = require('playwright');
const path = require('path');
const fs = require('fs');

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function bypassAgeGate(ctx, page) {
  try {
    await ctx.addCookies([
      {
        name: 'nox-age-status',
        value: 'ADULT',
        domain: 'home-preview-manga.project-nox-awerkori.workers.dev',
        path: '/'
      }
    ]);
  } catch (e) {}
}

async function dismissModals(page) {
  try {
    const ageBtn = await page.$('button:has-text("Sim"), button:has-text("Continuar"), button:has-text("Entrar"), .age-gate-btn-confirm');
    if (ageBtn) {
      await ageBtn.click({ force: true });
      await page.waitForTimeout(600);
    }
  } catch (e) {}
}

async function run() {
  console.log('=== STARTING ROUND 3 PLAYWRIGHT VALIDATION ===');
  console.log('Target URL:', PREVIEW_URL);

  const results = {
    desktopChromium: {},
    shelfAlignment: {},
    shelfDivisibility: {},
    mobileChromium: {},
    firefoxGecko: {}
  };

  // --- 1. CHROMIUM DESKTOP ---
  console.log('\n--- 1. Testing Chromium Desktop (1440x900) ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  });
  await bypassAgeGate(context);
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await dismissModals(page);
  await page.waitForTimeout(1000);

  // Check 3D Hero Carousel elements
  const deckActive = await page.$('.deck-card.deck-active');
  const deckPrev = await page.$('.deck-card.deck-prev');
  const deckNext = await page.$('.deck-card.deck-next');
  const btnHero = await page.$('.btn-primary-hero');

  results.desktopChromium.hasDeckActive = !!deckActive;
  results.desktopChromium.hasDeckPrev = !!deckPrev;
  results.desktopChromium.hasDeckNext = !!deckNext;
  results.desktopChromium.hasBtnHero = !!btnHero;

  if (btnHero) {
    const btnStyle = await btnHero.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        background: computed.backgroundImage || computed.background,
        color: computed.color
      };
    });
    results.desktopChromium.btnStyle = btnStyle;
  }

  // Capture Hero Desktop screenshot
  const heroScreenshotPath = path.join(ARTIFACTS_DIR, 'preview_home_desktop_3d_round3.png');
  await page.screenshot({ path: heroScreenshotPath, fullPage: false });
  console.log('Saved hero screenshot:', heroScreenshotPath);

  // Test Shelf Expansion & Card Sizes
  console.log('\n--- Testing Shelf Expansion and Card Sizes ---');
  const expandButtons = await page.$$('.shelf-header .expand-inline-btn');
  console.log(`Found ${expandButtons.length} shelf expand buttons`);

  if (expandButtons.length > 0) {
    // Click the first expand button ("Expandir novas obras")
    await expandButtons[0].click({ force: true });
    await page.waitForTimeout(2500);

    // Measure cards in the expanded shelf
    const cards = await page.$$('.shelf-track.is-expanded .shelf-card');
    console.log(`Expanded shelf contains ${cards.length} cards`);
    results.shelfDivisibility.totalCards = cards.length;
    results.shelfDivisibility.isDivisibleBy6 = (cards.length % 6 === 0);

    const cardMetrics = [];
    for (const card of cards) {
      const box = await card.boundingBox();
      const title = await card.$eval('.card-work-title', el => el.textContent.trim()).catch(() => 'unknown');
      if (box) {
        cardMetrics.push({ title, width: Math.round(box.width), height: Math.round(box.height) });
      }
    }

    // Check specific problematic works
    const specificWorks = ['Como Você Desejar', 'Os Esforços da Professora', 'Meu Sistema Dragão'];
    const matchedWorks = cardMetrics.filter(c => specificWorks.some(sw => c.title.includes(sw)));
    results.shelfAlignment.matchedProblematicWorks = matchedWorks;

    // Check width uniformity
    const widths = cardMetrics.map(c => c.width);
    const minWidth = Math.min(...widths);
    const maxWidth = Math.max(...widths);
    results.shelfAlignment.minWidth = minWidth;
    results.shelfAlignment.maxWidth = maxWidth;
    results.shelfAlignment.isUniform = (maxWidth - minWidth) <= 1; // allows 1px subpixel rounding

    console.log('Card widths: min =', minWidth, 'max =', maxWidth, 'uniform =', results.shelfAlignment.isUniform);
    console.log('Problematic works dimensions:', matchedWorks);

    // Scroll down to expanded grid and capture screenshot
    await page.evaluate(() => window.scrollBy(0, 650));
    await page.waitForTimeout(500);
    const expandedScreenshotPath = path.join(ARTIFACTS_DIR, 'preview_home_expanded_grid_round3.png');
    await page.screenshot({ path: expandedScreenshotPath, fullPage: false });
    console.log('Saved expanded grid screenshot:', expandedScreenshotPath);
  }

  await browser.close();

  // --- 2. CHROMIUM MOBILE ---
  console.log('\n--- 2. Testing Chromium Mobile (390x844 iPhone 12/13/14) ---');
  const mobileBrowser = await chromium.launch({ headless: true });
  const mobileContext = await mobileBrowser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
  });
  await bypassAgeGate(mobileContext);
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await dismissModals(mobilePage);
  await mobilePage.waitForTimeout(1000);

  const mobileDeckActive = await mobilePage.$('.deck-card.deck-active');
  const mobileDeckPrev = await mobilePage.$('.deck-card.deck-prev');
  const mobileDeckNext = await mobilePage.$('.deck-card.deck-next');

  // Check horizontal overflow
  const scrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await mobilePage.evaluate(() => document.documentElement.clientWidth);
  const hasHorizontalScroll = scrollWidth > clientWidth;

  results.mobileChromium = {
    hasDeckActive: !!mobileDeckActive,
    hasDeckPrev: !!mobileDeckPrev,
    hasDeckNext: !!mobileDeckNext,
    scrollWidth,
    clientWidth,
    hasHorizontalScroll
  };

  const mobileScreenshotPath = path.join(ARTIFACTS_DIR, 'preview_home_mobile_3d_round3.png');
  await mobilePage.screenshot({ path: mobileScreenshotPath, fullPage: false });
  console.log('Saved mobile screenshot:', mobileScreenshotPath);

  await mobileBrowser.close();

  // --- 3. FIREFOX (GECKO) DESKTOP ---
  console.log('\n--- 3. Testing Firefox (Gecko Engine) (1440x900) ---');
  const ffBrowser = await firefox.launch({ headless: true });
  const ffContext = await ffBrowser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await bypassAgeGate(ffContext);
  const ffPage = await ffContext.newPage();

  const ffConsoleErrors = [];
  ffPage.on('console', msg => {
    if (msg.type() === 'error') ffConsoleErrors.push(msg.text());
  });

  await ffPage.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await dismissModals(ffPage);
  await ffPage.waitForTimeout(1000);

  const ffDeckActive = await ffPage.$('.deck-card.deck-active');
  const ffDeckPrev = await ffPage.$('.deck-card.deck-prev');
  const ffDeckNext = await ffPage.$('.deck-card.deck-next');

  results.firefoxGecko = {
    hasDeckActive: !!ffDeckActive,
    hasDeckPrev: !!ffDeckPrev,
    hasDeckNext: !!ffDeckNext
  };

  const ffScreenshotPath = path.join(ARTIFACTS_DIR, 'preview_firefox_desktop_round3.png');
  await ffPage.screenshot({ path: ffScreenshotPath, fullPage: false });
  console.log('Saved Firefox screenshot:', ffScreenshotPath);

  await ffBrowser.close();

  console.log('\n=== FINAL VALIDATION SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));

  return results;
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
