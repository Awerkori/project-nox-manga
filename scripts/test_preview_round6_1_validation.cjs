const { chromium, firefox } = require('playwright');
const path = require('path');
const fs = require('fs');
const { decode } = require('fast-png');

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
  console.log('=== STARTING ROUND 6.1 VALIDATION (NOX BOOK REDESIGN & MOBILE FIX) ===');
  console.log('Target Preview URL:', PREVIEW_URL);

  const report = {
    mobile: {},
    desktop: {},
    flipAnimation: {},
    firefoxGecko: {}
  };

  // =========================================================================
  // 1. MOBILE VERIFICATION (THE TOP PRIORITY)
  // =========================================================================
  console.log('\n--- 1. Testing Mobile Viewport (Pixel 5 - 393x851) ---');
  const mobileBrowser = await chromium.launch({ headless: true });
  const mobileCtx = await mobileBrowser.newContext({
    viewport: { width: 393, height: 851 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
  });
  await bypassAgeGate(mobileCtx);
  const mobilePage = await mobileCtx.newPage();

  await mobilePage.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 35000 });
  await dismissModals(mobilePage);
  await mobilePage.waitForTimeout(1000);

  // Check mobile elements
  const mobileStage = await mobilePage.$('.mobile-stage');
  const mobileCard = await mobilePage.$('.mobile-card');
  const mobileCover = await mobilePage.$('.mobile-cover-image');
  const mobileTitle = await mobilePage.$('.mobile-title a');
  const mobileCta = await mobilePage.$('.mobile-actions .btn-solid');

  const cardRect = await mobileCard ? await mobileCard.boundingBox() : null;
  const coverRect = await mobileCover ? await mobileCover.boundingBox() : null;
  const titleText = await mobileTitle ? await mobileTitle.textContent() : '';

  report.mobile.stageVisible = !!mobileStage;
  report.mobile.cardVisible = !!mobileCard;
  report.mobile.cardRect = cardRect;
  report.mobile.coverRect = coverRect;
  report.mobile.title = titleText.trim();
  console.log('Mobile Card BoundingBox:', cardRect);
  console.log('Mobile Cover BoundingBox:', coverRect);
  console.log('Mobile Title rendered:', titleText.trim());

  // Save Mobile Screenshot
  const mobileShot = path.join(ARTIFACTS_DIR, 'preview_round6_1_mobile_redesigned.png');
  await mobilePage.screenshot({ path: mobileShot, fullPage: false });
  console.log('Saved mobile screenshot to:', mobileShot);

  // Analyze pixels of mobile screenshot to verify non-blank presentation
  const mobileBuf = fs.readFileSync(mobileShot);
  const decodedMobile = decode(mobileBuf);
  let coloredPixels = 0;
  for (let y = Math.floor(cardRect.y); y < Math.floor(cardRect.y + cardRect.height); y += 4) {
    for (let x = Math.floor(cardRect.x); x < Math.floor(cardRect.x + cardRect.width); x += 4) {
      const idx = (y * decodedMobile.width + x) * 4;
      const r = decodedMobile.data[idx];
      const g = decodedMobile.data[idx+1];
      const b = decodedMobile.data[idx+2];
      // Check if pixel is illuminated / has distinct color (not pitch black background)
      if (r > 35 || g > 35 || b > 45) coloredPixels++;
    }
  }
  report.mobile.illuminatedPixelsInCard = coloredPixels;
  report.mobile.isNotBlank = coloredPixels > 250;
  console.log(`Mobile card pixel analysis: ${coloredPixels} illuminated pixels found (isNotBlank: ${report.mobile.isNotBlank})`);

  // Test Mobile Navigation (Cover Arrow & Touch Swipe)
  const mobileNextBtn = await mobilePage.$('.mobile-cover-arrow.cover-arrow-next');
  if (mobileNextBtn) {
    await mobileNextBtn.click();
    await mobilePage.waitForTimeout(600);
    const newTitle = await mobilePage.$eval('.mobile-title a', el => el.textContent.trim()).catch(() => '');
    report.mobile.clickedNextArrow = (newTitle !== titleText.trim());
    console.log(`Mobile cover arrow next test: Changed work to "${newTitle}" (Success: ${report.mobile.clickedNextArrow})`);
  }

  // Also test touch gesture
  const startX = 320, startY = 380;
  await mobilePage.mouse.move(startX, startY);
  await mobilePage.mouse.down();
  await mobilePage.mouse.move(startX - 180, startY, { steps: 8 });
  await mobilePage.mouse.up();
  await mobilePage.waitForTimeout(600);
  const swipeTitle = await mobilePage.$eval('.mobile-title a', el => el.textContent.trim()).catch(() => '');
  report.mobile.swipedWork = swipeTitle;
  console.log(`Mobile swipe test executed, current title: "${swipeTitle}"`);

  await mobileBrowser.close();

  // =========================================================================
  // 2. DESKTOP REDESIGNED NOX BOOK & FLIP MOTION SEQUENCE
  // =========================================================================
  console.log('\n--- 2. Testing Desktop Nox Book (1440x900) ---');
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

  const desktopStage = await page.$('.desktop-stage');
  const leftPage = await page.$('.left-page');
  const rightPage = await page.$('.right-page');
  report.desktop.stageVisible = !!desktopStage;
  report.desktop.leftPageVisible = !!leftPage;
  report.desktop.rightPageVisible = !!rightPage;
  console.log('Desktop stage visible:', !!desktopStage, 'Left page:', !!leftPage, 'Right page:', !!rightPage);

  // Capture Resting Desktop Screenshot
  const desktopShot = path.join(ARTIFACTS_DIR, 'preview_round6_1_desktop_redesigned.png');
  await page.screenshot({ path: desktopShot, fullPage: false });
  console.log('Saved redesigned desktop screenshot to:', desktopShot);

  // Capture Multi-Frame Page Flip Sequence
  console.log('\n--- 3. Capturing Multi-Frame Flip Sequence ---');
  const nextBtn = await page.$('.book-nav-btn.next-btn');

  // Frame 1: Resting state
  const f1 = path.join(ARTIFACTS_DIR, 'round6_flip_frame1_rest.png');
  await page.screenshot({ path: f1, fullPage: false });
  console.log('Frame 1 (Rest) captured');

  // Trigger flip
  if (nextBtn) {
    await nextBtn.click();
    // Frame 2: Page lift beginning (150ms)
    await page.waitForTimeout(150);
    const f2 = path.join(ARTIFACTS_DIR, 'round6_flip_frame2_lift.png');
    await page.screenshot({ path: f2, fullPage: false });
    console.log('Frame 2 (Lift 150ms) captured');

    // Frame 3: Apex vertical flex (350ms, ~90deg)
    await page.waitForTimeout(200);
    const f3 = path.join(ARTIFACTS_DIR, 'round6_flip_frame3_apex.png');
    await page.screenshot({ path: f3, fullPage: false });
    console.log('Frame 3 (Apex 350ms) captured');

    // Frame 4: Descending and landing on left stack (550ms)
    await page.waitForTimeout(200);
    const f4 = path.join(ARTIFACTS_DIR, 'round6_flip_frame4_descend.png');
    await page.screenshot({ path: f4, fullPage: false });
    console.log('Frame 4 (Descend 550ms) captured');

    // Frame 5: Fully settled (750ms)
    await page.waitForTimeout(250);
    const f5 = path.join(ARTIFACTS_DIR, 'round6_flip_frame5_settled.png');
    await page.screenshot({ path: f5, fullPage: false });
    console.log('Frame 5 (Settled 750ms) captured');
  }

  // Hover Pause & Resume Test
  console.log('\n--- 4. Testing Hover Pause / Resume ---');
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  const pausedBefore = await page.$eval('.status-indicator', el => el.classList.contains('paused'));
  await page.hover('.nox-book-section');
  await page.waitForTimeout(500);
  const pausedDuring = await page.$eval('.status-indicator', el => el.classList.contains('paused'));
  await page.mouse.move(10, 10);
  await page.waitForTimeout(500);
  const pausedAfter = await page.$eval('.status-indicator', el => el.classList.contains('paused'));

  report.desktop.hoverPause = (!pausedBefore && pausedDuring && !pausedAfter);
  console.log(`Hover pause/resume test: Before=${pausedBefore}, During=${pausedDuring}, After=${pausedAfter} (Working: ${report.desktop.hoverPause})`);

  // Discover all 10 works via pips
  const pips = await page.$$('.footer-pips .pip-button');
  const discoveredTitles = new Set();
  for (let i = 0; i < pips.length; i++) {
    await pips[i].click();
    await page.waitForTimeout(750);
    const t = await page.$eval('.chronicle-main-title a', el => el.textContent.trim()).catch(() => '');
    if (t) discoveredTitles.add(t);
  }
  report.desktop.discoveredWorksCount = discoveredTitles.size;
  report.desktop.works = Array.from(discoveredTitles);
  console.log(`Discovered ${discoveredTitles.size} works in Nox Book:`, Array.from(discoveredTitles));

  await browser.close();

  // =========================================================================
  // 5. FIREFOX GECKO VALIDATION
  // =========================================================================
  console.log('\n--- 5. Testing Firefox Gecko Desktop (1440x900) ---');
  const ffBrowser = await firefox.launch({ headless: true });
  const ffCtx = await ffBrowser.newContext({ viewport: { width: 1440, height: 900 } });
  await bypassAgeGate(ffCtx);
  const ffPage = await ffCtx.newPage();

  await ffPage.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 35000 });
  await dismissModals(ffPage);
  await ffPage.waitForTimeout(1000);

  const ffStage = await ffPage.$('.desktop-stage');
  const ffBook = await ffPage.$('.nox-book');
  report.firefoxGecko.stageVisible = !!ffStage;
  report.firefoxGecko.bookVisible = !!ffBook;
  console.log('Firefox Gecko stage visible:', !!ffStage, 'Book visible:', !!ffBook);

  const ffShot = path.join(ARTIFACTS_DIR, 'preview_round6_1_firefox_redesigned.png');
  await ffPage.screenshot({ path: ffShot, fullPage: false });
  console.log('Saved Firefox screenshot to:', ffShot);

  await ffBrowser.close();

  console.log('\n=== ROUND 6.1 VALIDATION SUMMARY ===');
  console.log(JSON.stringify(report, null, 2));
}

run().catch(err => {
  console.error('Validation script failed:', err);
  process.exit(1);
});
