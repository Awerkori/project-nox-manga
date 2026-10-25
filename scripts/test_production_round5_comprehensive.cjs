const { chromium, firefox } = require('playwright');
const path = require('path');

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function bypassAgeGate(ctx) {
  try {
    await ctx.addCookies([
      {
        name: 'nox-age-status',
        value: 'ADULT',
        domain: 'manga.project-nox-awerkori.workers.dev',
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
  console.log('=== STARTING PRODUCTION ROUND 5 PLAYWRIGHT VALIDATION ===');
  console.log('Target URL:', PROD_URL);

  const results = {
    carousel: {},
    background: {},
    releases: {},
    mobile: {},
    firefox: {}
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

  await page.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 35000 });
  await dismissModals(page);
  await page.waitForTimeout(1000);

  // A. Carousel Works Diversity & Count
  console.log('\n--- A. Carousel Works & Diversity Verification ---');
  const nextBtn = await page.$('.slider-nav-arrows .nav-arrow-btn:last-child');
  const collectedTitles = new Set();
  const titleList = [];

  for (let i = 0; i < 15; i++) {
    const title = await page.$eval('.hero-title a', el => el.textContent.trim()).catch(() => '');
    if (title && !collectedTitles.has(title)) {
      collectedTitles.add(title);
      titleList.push(title);
    }
    if (nextBtn) {
      await nextBtn.click();
      await page.waitForTimeout(250);
    }
  }

  results.carousel.totalUniqueWorks = collectedTitles.size;
  results.carousel.works = titleList;
  console.log(`Discovered ${collectedTitles.size} unique carousel works:`, titleList);

  // Collect Mais Lidos titles to prove diversity
  const maisLidosTitles = await page.$$eval('.section-header:has-text("Mais Lidos") + .shelf-layout .work-card .work-title', els => els.map(e => e.textContent.trim())).catch(() => []);
  console.log(`Mais Lidos titles sample (${maisLidosTitles.length} total):`, maisLidosTitles.slice(0, 5));

  // Count how many carousel works are NOT in Mais Lidos top 5
  const nonMaisLidosCount = titleList.filter(t => !maisLidosTitles.slice(0, 5).includes(t)).length;
  results.carousel.nonMaisLidosCount = nonMaisLidosCount;
  console.log(`Carousel items distinct from top 5 Mais Lidos: ${nonMaisLidosCount} / ${titleList.length} (Diversity passed: ${nonMaisLidosCount >= 4})`);

  // B. Single Minimalist Progress Bar & Absence of Numbers
  const slideCounter = await page.$('.slide-counter, .curr-num, .total-num');
  const progressTrack = await page.$('.progress-track');
  const progressFill = await page.$('.progress-fill');
  results.carousel.hasNumericalCounter = !!slideCounter;
  results.carousel.hasProgressTrack = !!progressTrack;
  results.carousel.hasProgressFill = !!progressFill;
  console.log('Numerical counter present:', !!slideCounter, '(expected: false)');
  console.log('Minimalist progress track present:', !!progressTrack, '(expected: true)');

  // C. Timing Measurement (~3.8s per slide)
  console.log('\n--- B. Carousel Auto-Advance Timing Verification ---');
  // Move mouse away so carousel is unpaused
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);

  const initialTitle = await page.$eval('.hero-title a', el => el.textContent.trim());
  const t0 = Date.now();
  let title1 = initialTitle;
  let tSwitch1 = 0;
  while (Date.now() - t0 < 8000) {
    await page.waitForTimeout(50);
    const curr = await page.$eval('.hero-title a', el => el.textContent.trim());
    if (curr !== initialTitle) {
      tSwitch1 = Date.now();
      title1 = curr;
      console.log('Detected switch 1 to:', title1, 'after', tSwitch1 - t0, 'ms');
      break;
    }
  }

  let tSwitch2 = 0;
  if (tSwitch1 > 0) {
    const tStart2 = Date.now();
    while (Date.now() - tStart2 < 8000) {
      await page.waitForTimeout(50);
      const curr = await page.$eval('.hero-title a', el => el.textContent.trim());
      if (curr !== title1) {
        tSwitch2 = Date.now();
        console.log('Detected switch 2 to:', curr, 'after', tSwitch2 - tSwitch1, 'ms');
        break;
      }
    }
  }

  const elapsedMs = (tSwitch1 > 0 && tSwitch2 > 0) ? (tSwitch2 - tSwitch1) : 0;
  console.log(`Auto-advance interval measured: ${elapsedMs}ms (Target: ~3800ms)`);
  results.carousel.measuredAutoAdvanceMs = elapsedMs;
  results.carousel.timingWithinBounds = (elapsedMs >= 3300 && elapsedMs <= 4300);

  // D. Hover Pause and Resume
  console.log('\n--- C. Hover Pause & Resume Verification ---');
  await page.waitForTimeout(600);
  const tf1 = await page.$eval('.progress-fill', el => el.style.transform);
  await page.hover('.hero-carousel');
  await page.waitForTimeout(1200);
  const tfDuringHover = await page.$eval('.progress-fill', el => el.style.transform);
  const pausedClass = await page.$eval('.progress-fill', el => el.classList.contains('paused'));
  console.log('Progress transform before hover:', tf1, 'during hover:', tfDuringHover, 'pausedClass:', pausedClass);

  await page.mouse.move(10, 10);
  await page.waitForTimeout(1000);
  const tfAfterResume = await page.$eval('.progress-fill', el => el.style.transform);
  console.log('Progress transform after resume:', tfAfterResume);
  results.carousel.hoverPauseWorking = (pausedClass || tf1 === tfDuringHover) && (tfAfterResume !== tfDuringHover);

  // E. Particle Background Canvas & Interactivity
  console.log('\n--- D. Interactive Cosmic Background Verification ---');
  const canvasExists = await page.$eval('.particle-canvas', el => !!el).catch(() => false);
  const canvasDpr = await page.$eval('.particle-canvas', el => ({ width: el.width, height: el.height }));
  console.log('Particle canvas present:', canvasExists, 'Dimensions:', canvasDpr);
  results.background.canvasPresent = canvasExists;

  // Test mouse aura / parallax interaction without console errors
  let consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  await page.mouse.move(720, 450);
  await page.waitForTimeout(300);
  await page.mouse.move(400, 200);
  await page.waitForTimeout(300);
  results.background.noConsoleErrors = consoleErrors.length === 0;
  console.log('Interaction console errors:', consoleErrors);

  // Capture Desktop Screenshot
  const desktopShot = path.join(ARTIFACTS_DIR, 'production_home_desktop_round5.png');
  await page.screenshot({ path: desktopShot, fullPage: false });
  console.log('Saved desktop screenshot to:', desktopShot);

  // Capture Releases section
  const releasesEl = await page.$('.releases-section');
  if (releasesEl) {
    await releasesEl.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const releasesShot = path.join(ARTIFACTS_DIR, 'production_home_releases_round5.png');
    await page.screenshot({ path: releasesShot, fullPage: false });
    console.log('Saved releases screenshot to:', releasesShot);
  }

  await browser.close();

  // --- 2. CHROMIUM MOBILE (Pixel 5: 393x851) ---
  console.log('\n--- 2. Testing Chromium Mobile (Pixel 5 - 393x851) ---');
  const mobileBrowser = await chromium.launch({ headless: true });
  const mobileContext = await mobileBrowser.newContext({
    viewport: { width: 393, height: 851 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
  });
  await bypassAgeGate(mobileContext);
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto(PROD_URL, { waitUntil: 'networkidle', timeout: 35000 });
  await dismissModals(mobilePage);
  await mobilePage.waitForTimeout(1000);

  const mobileCarousel = await mobilePage.$('.hero-carousel');
  const mobileProgress = await mobilePage.$('.progress-track');
  results.mobile.carouselVisible = !!mobileCarousel;
  results.mobile.progressVisible = !!mobileProgress;
  console.log('Mobile carousel visible:', !!mobileCarousel, 'progress visible:', !!mobileProgress);

  const mobileShot = path.join(ARTIFACTS_DIR, 'production_home_mobile_round5.png');
  await mobilePage.screenshot({ path: mobileShot, fullPage: false });
  console.log('Saved mobile screenshot to:', mobileShot);

  await mobileBrowser.close();

  // --- 3. FIREFOX GECKO DESKTOP ---
  console.log('\n--- 3. Testing Firefox Gecko Desktop (1440x900) ---');
  const ffBrowser = await firefox.launch({ headless: true });
  const ffContext = await ffBrowser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await bypassAgeGate(ffContext);
  const ffPage = await ffContext.newPage();

  await ffPage.goto(PROD_URL, { waitUntil: 'networkidle', timeout: 35000 });
  await dismissModals(ffPage);
  await ffPage.waitForTimeout(1000);

  const ffCarousel = await ffPage.$('.hero-carousel');
  const ffTrack = await ffPage.$('.progress-track');
  results.firefox.carouselVisible = !!ffCarousel;
  results.firefox.progressVisible = !!ffTrack;
  console.log('Firefox Gecko carousel visible:', !!ffCarousel, 'progress track visible:', !!ffTrack);

  const ffShot = path.join(ARTIFACTS_DIR, 'production_firefox_desktop_round5.png');
  await ffPage.screenshot({ path: ffShot, fullPage: false });
  console.log('Saved Firefox screenshot to:', ffShot);

  await ffBrowser.close();

  console.log('\n=== PRODUCTION ROUND 5 TEST SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
