const { chromium, firefox } = require('playwright');
const path = require('path');

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function bypassAgeGate(ctx) {
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
  console.log('=== STARTING ROUND 4 PLAYWRIGHT VALIDATION ===');
  console.log('Target URL:', PREVIEW_URL);

  const results = {
    carousel: {},
    releases: {},
    shelves: {},
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

  await page.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await dismissModals(page);
  await page.waitForTimeout(1000);

  // A. Check Numerical Counter Removal
  const slideCounter = await page.$('.slide-counter, .curr-num, .total-num');
  results.carousel.hasNumericalCounter = !!slideCounter;
  console.log('Numerical counter present:', !!slideCounter, '(expected: false)');

  // B. Check Single Minimalist Progress Bar
  const progressTrack = await page.$('.progress-track');
  const progressFill = await page.$('.progress-fill');
  results.carousel.hasProgressTrack = !!progressTrack;
  results.carousel.hasProgressFill = !!progressFill;
  console.log('Single progress track present:', !!progressTrack);
  console.log('Progress fill line present:', !!progressFill);

  // C. Test Progress Bar Hover Pause & Resume
  console.log('\nTesting Hover Pause/Resume Behavior...');
  await page.waitForTimeout(800); // let it tick a bit
  const transform1 = await page.$eval('.progress-fill', el => el.style.transform);
  console.log('Progress transform before hover:', transform1);

  // Hover over the hero carousel
  await page.hover('.hero-carousel');
  await page.waitForTimeout(1200); // wait while hovered
  const transformDuringHover = await page.$eval('.progress-fill', el => el.style.transform);
  const isPausedClass = await page.$eval('.progress-fill', el => el.classList.contains('paused'));
  console.log('Progress transform during hover:', transformDuringHover, 'paused class:', isPausedClass);
  results.carousel.pausedDuringHover = isPausedClass || (transform1 === transformDuringHover);

  // Unhover by moving mouse outside
  await page.mouse.move(0, 0);
  await page.waitForTimeout(1000); // let it resume ticking
  const transformAfterResume = await page.$eval('.progress-fill', el => el.style.transform);
  console.log('Progress transform after resume:', transformAfterResume);
  results.carousel.resumedAfterHover = (transformAfterResume !== transformDuringHover);

  // D. Count Carousel Works by stepping through next button
  console.log('\nCollecting carousel works count...');
  const nextBtn = await page.$('.slider-nav-arrows .nav-arrow-btn:last-child');
  const collectedTitles = new Set();
  for (let i = 0; i < 15; i++) {
    const title = await page.$eval('.hero-title a', el => el.textContent.trim()).catch(() => '');
    if (title) collectedTitles.add(title);
    if (nextBtn) {
      await nextBtn.click();
      await page.waitForTimeout(200);
    }
  }
  console.log(`Found ${collectedTitles.size} unique carousel works:`, Array.from(collectedTitles));
  results.carousel.totalWorksCount = collectedTitles.size;

  // Screenshot Desktop Hero
  const heroScreenshot = path.join(ARTIFACTS_DIR, 'preview_home_desktop_round4.png');
  await page.screenshot({ path: heroScreenshot, fullPage: false });
  console.log('Saved hero screenshot:', heroScreenshot);

  // E. Check Shelves (Novas Obras & Mais Lidos) — Author Removal
  console.log('\n--- Checking Author Removal from Home Shelves ---');
  const authorSpans = await page.$$('.shelf-card .card-author');
  console.log('Author spans count in shelf cards:', authorSpans.length, '(expected: 0)');
  results.shelves.authorSpansCount = authorSpans.length;

  const cardTitles = await page.$$eval('.shelf-card .card-work-title', els => els.slice(0, 5).map(e => e.textContent.trim()));
  console.log('Sample shelf titles:', cardTitles);
  results.shelves.sampleTitles = cardTitles;

  // F. Check Releases (Lançamentos) — Max 3 Chapters & Zero +X Caps
  console.log('\n--- Checking Releases Cards (Max 3 Chapters, Zero +X Caps) ---');
  await page.evaluate(() => {
    const el = document.getElementById('lancamentos');
    if (el) el.scrollIntoView();
  });
  await page.waitForTimeout(800);

  const releaseCards = await page.$$('.release-row-card');
  console.log(`Found ${releaseCards.length} releases cards`);
  results.releases.totalCards = releaseCards.length;

  let maxChaptersPerCard = 0;
  let hasAnyExpandPill = false;
  let hasAnyCollapsePill = false;

  for (const card of releaseCards) {
    const pills = await card.$$('.chapter-pill');
    if (pills.length > maxChaptersPerCard) maxChaptersPerCard = pills.length;
    const expandPill = await card.$('.expand-pill');
    const collapsePill = await card.$('.collapse-pill');
    if (expandPill) hasAnyExpandPill = true;
    if (collapsePill) hasAnyCollapsePill = true;
  }

  results.releases.maxChaptersPerCard = maxChaptersPerCard;
  results.releases.hasAnyExpandPill = hasAnyExpandPill;
  results.releases.hasAnyCollapsePill = hasAnyCollapsePill;

  console.log('Max chapters per release card:', maxChaptersPerCard, '(expected <= 3)');
  console.log('Has "+X caps" expand pill:', hasAnyExpandPill, '(expected: false)');
  console.log('Has "Recolher" pill:', hasAnyCollapsePill, '(expected: false)');

  // Screenshot Releases Section
  const releasesScreenshot = path.join(ARTIFACTS_DIR, 'preview_home_releases_round4.png');
  await page.screenshot({ path: releasesScreenshot, fullPage: false });
  console.log('Saved releases screenshot:', releasesScreenshot);

  await browser.close();

  // --- 2. CHROMIUM MOBILE ---
  console.log('\n--- 2. Testing Chromium Mobile (390x844) ---');
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

  const scrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await mobilePage.evaluate(() => document.documentElement.clientWidth);
  const hasOverflow = scrollWidth > clientWidth;

  const mobileProgress = await mobilePage.$('.progress-track');
  results.mobile = {
    scrollWidth,
    clientWidth,
    hasOverflow,
    hasProgressTrack: !!mobileProgress
  };

  const mobileScreenshot = path.join(ARTIFACTS_DIR, 'preview_home_mobile_round4.png');
  await mobilePage.screenshot({ path: mobileScreenshot, fullPage: false });
  console.log('Saved mobile screenshot:', mobileScreenshot);

  await mobileBrowser.close();

  // --- 3. FIREFOX GECKO ---
  console.log('\n--- 3. Testing Firefox Gecko Desktop (1440x900) ---');
  const ffBrowser = await firefox.launch({ headless: true });
  const ffContext = await ffBrowser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await bypassAgeGate(ffContext);
  const ffPage = await ffContext.newPage();

  await ffPage.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await dismissModals(ffPage);
  await ffPage.waitForTimeout(1000);

  const ffHeroTitle = await ffPage.$eval('.hero-title a', el => el.textContent.trim()).catch(() => '');
  const ffProgress = await ffPage.$('.progress-track');

  results.firefox = {
    heroTitle: ffHeroTitle,
    hasProgressTrack: !!ffProgress
  };

  const ffScreenshot = path.join(ARTIFACTS_DIR, 'preview_firefox_desktop_round4.png');
  await ffPage.screenshot({ path: ffScreenshot, fullPage: false });
  console.log('Saved Firefox screenshot:', ffScreenshot);

  await ffBrowser.close();

  console.log('\n=== FINAL ROUND 4 VALIDATION SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));

  return results;
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
