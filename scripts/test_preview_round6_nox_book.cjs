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
  console.log('=== STARTING NOX BOOK (ROUND 6) PLAYWRIGHT VALIDATION ===');
  console.log('Target Preview URL:', PREVIEW_URL);

  const results = {
    noxBook: {},
    background: {},
    mobile: {},
    firefox: {}
  };

  // --- 1. CHROMIUM DESKTOP (1440x900) ---
  console.log('\n--- 1. Testing Chromium Desktop (1440x900) ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  });
  await bypassAgeGate(context);
  const page = await context.newPage();

  // Listen for console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 35000 });
  await dismissModals(page);
  await page.waitForTimeout(1000);

  // A. Check Nox Book Elements
  const bookSection = await page.$('.nox-book-section');
  const bookSpread = await page.$('.book-spread.desktop-only');
  const leftPage = await page.$('.left-page');
  const rightPage = await page.$('.right-page');
  const primaryCta = await page.$('.chronicle-actions .btn-primary');

  results.noxBook.sectionExists = !!bookSection;
  results.noxBook.spreadExists = !!bookSpread;
  results.noxBook.leftPageExists = !!leftPage;
  results.noxBook.rightPageExists = !!rightPage;
  results.noxBook.primaryCtaExists = !!primaryCta;

  console.log('Nox Book section present:', !!bookSection);
  console.log('Book spread (2-pages) present:', !!bookSpread);
  console.log('CTA button present:', !!primaryCta);

  // B. Collect and Verify the 10 Diversified Works
  console.log('\n--- B. Discovering 10 Works in Nox Book ---');
  const pips = await page.$$('.folio-pips .pip-btn');
  results.noxBook.pipsCount = pips.length;
  console.log(`Found ${pips.length} navigation pips (expected: 10)`);

  const collectedTitles = new Set();
  const titleList = [];

  for (let i = 0; i < pips.length; i++) {
    await pips[i].click();
    await page.waitForTimeout(850); // wait for flip transition
    const title = await page.$eval('.right-page .chronicle-title a', el => el.textContent.trim()).catch(() => '');
    if (title && !collectedTitles.has(title)) {
      collectedTitles.add(title);
      titleList.push(title);
    }
  }

  results.noxBook.totalUniqueWorks = collectedTitles.size;
  results.noxBook.works = titleList;
  console.log(`Discovered ${collectedTitles.size} unique works in Nox Book:`, titleList);

  // C. Test Page Flip in Action & Capture Transition Screenshot
  console.log('\n--- C. Testing 3D Page Flip Mechanics ---');
  const nextBtn = await page.$('.book-nav-btn.next-btn');
  if (nextBtn) {
    // Click next and capture mid-flip snapshot
    await nextBtn.click();
    await page.waitForTimeout(300); // 300ms is right around 45% of 750ms flip
    const midFlipShot = path.join(ARTIFACTS_DIR, 'preview_round6_nox_book_flip_in_action.png');
    await page.screenshot({ path: midFlipShot, fullPage: false });
    console.log('Captured mid-flip 3D screenshot to:', midFlipShot);
    await page.waitForTimeout(500); // wait for finish
  }

  // D. Test Hover Pause & Resume
  console.log('\n--- D. Testing Hover Pause / Resume ---');
  await page.mouse.move(0, 0); // ensure outside
  await page.waitForTimeout(500);
  const indBeforeHover = await page.$eval('.auto-advance-indicator', el => el.classList.contains('paused'));
  console.log('Indicator paused before hover:', indBeforeHover, '(expected: false)');

  // Hover over book
  await page.hover('.nox-book-section');
  await page.waitForTimeout(600);
  const indDuringHover = await page.$eval('.auto-advance-indicator', el => el.classList.contains('paused'));
  console.log('Indicator paused during hover:', indDuringHover, '(expected: true)');
  results.noxBook.hoverPauseWorking = indDuringHover && !indBeforeHover;

  // Move away
  await page.mouse.move(10, 10);
  await page.waitForTimeout(600);
  const indAfterHover = await page.$eval('.auto-advance-indicator', el => el.classList.contains('paused'));
  console.log('Indicator paused after mouse leave:', indAfterHover, '(expected: false)');
  results.noxBook.hoverResumeWorking = !indAfterHover;

  // E. Measure Reading Duration (~3000ms)
  console.log('\n--- E. Measuring Auto-Advance Timing ---');
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  const startFolio = await page.$eval('.current-folio', el => el.textContent.trim());
  let switchDetected = false;
  let elapsedAutoAdvance = 0;

  const waitStart = Date.now();
  while (Date.now() - waitStart < 9000) {
    await page.waitForTimeout(50);
    const currFolio = await page.$eval('.current-folio', el => el.textContent.trim());
    if (currFolio !== startFolio) {
      elapsedAutoAdvance = Date.now() - waitStart;
      switchDetected = true;
      console.log(`Auto-advance detected: Folio changed from ${startFolio} to ${currFolio} in ${elapsedAutoAdvance}ms`);
      break;
    }
  }

  results.noxBook.measuredAutoAdvanceMs = elapsedAutoAdvance;
  results.noxBook.timingCompliant = (elapsedAutoAdvance >= 2200 && elapsedAutoAdvance <= 4500);

  // F. Particle Background & Cosmic Aura
  console.log('\n--- F. Verifying Background & Particle Scaling ---');
  const canvasExists = await page.$eval('.particle-canvas', el => !!el).catch(() => false);
  results.background.canvasPresent = canvasExists;
  results.background.noConsoleErrors = consoleErrors.length === 0;
  console.log('Particle background present:', canvasExists, 'Console errors:', consoleErrors);

  // Capture Desktop Steady Screenshot
  const desktopShot = path.join(ARTIFACTS_DIR, 'preview_round6_nox_book_desktop.png');
  await page.screenshot({ path: desktopShot, fullPage: false });
  console.log('Saved Nox Book desktop screenshot to:', desktopShot);

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

  await mobilePage.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 35000 });
  await dismissModals(mobilePage);
  await mobilePage.waitForTimeout(1000);

  const mobileFolio = await mobilePage.$('.book-folio.mobile-only');
  const mobileTitle = await mobilePage.$('.mobile-chronicle-wrapper .chronicle-title');
  const mobileCta = await mobilePage.$('.mobile-chronicle-wrapper .action-btn.btn-primary');

  results.mobile.folioVisible = !!mobileFolio;
  results.mobile.titleVisible = !!mobileTitle;
  results.mobile.ctaVisible = !!mobileCta;
  console.log('Mobile folio visible:', !!mobileFolio, 'Title:', !!mobileTitle, 'CTA:', !!mobileCta);

  // Test mobile touch swipe
  const startX = 300, startY = 400;
  await mobilePage.mouse.move(startX, startY);
  await mobilePage.mouse.down();
  await mobilePage.mouse.move(startX - 150, startY, { steps: 5 });
  await mobilePage.mouse.up();
  await mobilePage.waitForTimeout(800);
  console.log('Executed touch swipe gesture on mobile');

  const mobileShot = path.join(ARTIFACTS_DIR, 'preview_round6_nox_book_mobile.png');
  await mobilePage.screenshot({ path: mobileShot, fullPage: false });
  console.log('Saved mobile screenshot to:', mobileShot);

  await mobileBrowser.close();

  // --- 3. FIREFOX GECKO DESKTOP (1440x900) ---
  console.log('\n--- 3. Testing Firefox Gecko Desktop (1440x900) ---');
  const ffBrowser = await firefox.launch({ headless: true });
  const ffContext = await ffBrowser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await bypassAgeGate(ffContext);
  const ffPage = await ffContext.newPage();

  await ffPage.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 35000 });
  await dismissModals(ffPage);
  await ffPage.waitForTimeout(1000);

  const ffBook = await ffPage.$('.nox-book');
  const ffSpread = await ffPage.$('.book-spread.desktop-only');
  results.firefox.bookVisible = !!ffBook;
  results.firefox.spreadVisible = !!ffSpread;
  console.log('Firefox Gecko Nox Book visible:', !!ffBook, 'Spread visible:', !!ffSpread);

  const ffShot = path.join(ARTIFACTS_DIR, 'preview_round6_nox_book_firefox.png');
  await ffPage.screenshot({ path: ffShot, fullPage: false });
  console.log('Saved Firefox screenshot to:', ffShot);

  await ffBrowser.close();

  console.log('\n=== ROUND 6 NOX BOOK TEST SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
