const { firefox, chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

const VIEWPORTS = [
  { name: 'android_360x800', width: 360, height: 800 },
  { name: 'android_390x844', width: 390, height: 844 },
  { name: 'android_412x915', width: 412, height: 915 },
  { name: 'android_428x926', width: 428, height: 926 },
  { name: 'tablet_768x1024', width: 768, height: 1024 }
];

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
  console.log('=== STARTING ROUND 7 MOBILE REDESIGN V1 VERIFICATION ===');
  console.log('Target URL:', PREVIEW_URL);

  const results = {
    viewports: {},
    desktopCheck: {},
    interactions: {}
  };

  // 1. FIREFOX GECKO VERIFICATION ACROSS VIEWPORTS
  console.log('\n--- 1. Testing Firefox (Gecko Engine) Across Viewports ---');
  const ffBrowser = await firefox.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    console.log(`Checking Gecko viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    const ctx = await ffBrowser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0'
    });
    await bypassAgeGate(ctx);
    const page = await ctx.newPage();

    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 35000 });
    await dismissModals(page);
    await page.waitForTimeout(1500);

    // Full page screenshot
    const fullShotPath = path.join(ARTIFACTS_DIR, `v1_${vp.name}_gecko_full.png`);
    await page.screenshot({ path: fullShotPath, fullPage: true });

    // Section Screenshots
    const carouselEl = await page.$('.hero-carousel');
    if (carouselEl) {
      await carouselEl.screenshot({ path: path.join(ARTIFACTS_DIR, `v1_${vp.name}_gecko_carousel.png`) });
    }

    const shelves = await page.$$('.shelf-section');
    if (shelves.length > 0) {
      await shelves[0].screenshot({ path: path.join(ARTIFACTS_DIR, `v1_${vp.name}_gecko_novas_obras.png`) });
    }
    if (shelves.length > 1) {
      await shelves[1].screenshot({ path: path.join(ARTIFACTS_DIR, `v1_${vp.name}_gecko_mais_lidos.png`) });
    }

    const releasesEl = await page.$('.releases-section');
    if (releasesEl) {
      await releasesEl.screenshot({ path: path.join(ARTIFACTS_DIR, `v1_${vp.name}_gecko_lancamentos.png`) });
    }

    // Measure geometry and overflow
    const metrics = await page.evaluate(() => {
      const docWidth = document.documentElement.clientWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      const bodyScrollWidth = document.body.scrollWidth;
      
      const card = document.querySelector('.release-row-card');
      const cardRect = card ? card.getBoundingClientRect() : null;
      const thumb = card ? card.querySelector('.thumb-wrap') : null;
      const thumbRect = thumb ? thumb.getBoundingClientRect() : null;
      const title = card ? card.querySelector('.work-link') : null;
      const titleRect = title ? title.getBoundingClientRect() : null;
      const pills = card ? Array.from(card.querySelectorAll('.chapter-pill')) : [];
      
      const shelfCard = document.querySelector('.shelf-card');
      const shelfCardRect = shelfCard ? shelfCard.getBoundingClientRect() : null;

      return {
        docWidth,
        scrollWidth,
        bodyScrollWidth,
        noHorizontalOverflow: scrollWidth <= docWidth && bodyScrollWidth <= docWidth + 2,
        cardWidth: cardRect ? cardRect.width : null,
        thumbWidth: thumbRect ? thumbRect.width : null,
        thumbHeight: thumbRect ? thumbRect.height : null,
        titleText: title ? title.textContent.trim() : null,
        titleWidth: titleRect ? titleRect.width : null,
        pillsCount: pills.length,
        pillSample: pills.length > 0 ? {
          height: pills[0].getBoundingClientRect().height,
          width: pills[0].getBoundingClientRect().width,
          text: pills[0].textContent.trim(),
          touchTargetAdequate: pills[0].getBoundingClientRect().height >= 36
        } : null,
        shelfCardWidth: shelfCardRect ? shelfCardRect.width : null
      };
    });

    results.viewports[vp.name] = metrics;
    console.log(`Gecko ${vp.name} metrics:`, metrics);

    await ctx.close();
  }
  await ffBrowser.close();

  // 2. INTERACTION & SHELF EXPANSION TEST (Chromium Mobile 390x844)
  console.log('\n--- 2. Testing Interactions & Shelf Expansion ---');
  const crBrowser = await chromium.launch({ headless: true });
  const crCtx = await crBrowser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
  });
  await bypassAgeGate(crCtx);
  const crPage = await crCtx.newPage();

  await crPage.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 35000 });
  await dismissModals(crPage);
  await crPage.waitForTimeout(1000);

  // Test Shelf Expansion (Novas Obras)
  console.log('Testing Novas Obras expand button...');
  const expandBtn = await crPage.$('.expand-inline-btn');
  if (expandBtn) {
    await expandBtn.click();
    await crPage.waitForTimeout(1000);
    const isExpanded = await crPage.$('.shelf-scroll-container.is-expanded');
    results.interactions.shelfExpanded = !!isExpanded;
    console.log('Shelf expanded successfully:', !!isExpanded);
    
    // Screenshot expanded shelf
    const shelfEl = await crPage.$('.shelf-section');
    if (shelfEl) {
      await shelfEl.screenshot({ path: path.join(ARTIFACTS_DIR, 'v1_android_390x844_shelf_expanded.png') });
    }
  }

  // Test Chapter Pill Navigation
  console.log('Testing Chapter Pill click...');
  const chapterPill = await crPage.$('.chapter-pill');
  if (chapterPill) {
    const href = await chapterPill.getAttribute('href');
    results.interactions.firstChapterPillHref = href;
    console.log('First chapter pill destination:', href);
  }

  await crCtx.close();
  await crBrowser.close();

  // 3. DESKTOP PRESERVATION CHECK (1440x900)
  console.log('\n--- 3. Testing Desktop Preservation (1440x900) ---');
  const deskBrowser = await chromium.launch({ headless: true });
  const deskCtx = await deskBrowser.newContext({ viewport: { width: 1440, height: 900 } });
  await bypassAgeGate(deskCtx);
  const deskPage = await deskCtx.newPage();

  await deskPage.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 35000 });
  await dismissModals(deskPage);
  await deskPage.waitForTimeout(1500);

  // Desktop Carousel 3D check
  const deskCarousel = await deskPage.$('.hero-carousel');
  const deskPrevCard = await deskPage.$('.deck-prev');
  const deskNextCard = await deskPage.$('.deck-next');
  const deskActiveCard = await deskPage.$('.deck-active');

  results.desktopCheck = {
    carouselPresent: !!deskCarousel,
    deckPrevPresent: !!deskPrevCard,
    deckNextPresent: !!deskNextCard,
    deckActivePresent: !!deskActiveCard,
    desktop3DDeckPreserved: !!(deskPrevCard && deskNextCard && deskActiveCard)
  };

  console.log('Desktop 3D Deck Check:', results.desktopCheck);

  await deskPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v1_desktop_1440x900_preserved.png'),
    fullPage: false
  });

  await deskCtx.close();
  await deskBrowser.close();

  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'v1_verification_results.json'), JSON.stringify(results, null, 2));
  console.log('\n=== VERIFICATION V1 FINISHED ===');
}

run().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
