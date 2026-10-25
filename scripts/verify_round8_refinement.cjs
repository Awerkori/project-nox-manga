const { firefox, chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

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
      await page.waitForTimeout(500);
    }
  } catch (e) {}
}

async function run() {
  console.log('=== STARTING ROUND 8 MOBILE & CAROUSEL VERIFICATION ===');
  console.log('Target URL:', PREVIEW_URL);

  const report = {
    navigation: {},
    carouselSync: [],
    authorRemoved: false,
    viewports: {},
    desktopPreserved: false
  };

  const browser = await firefox.launch({ headless: true });

  // 1. TEST NAVIGATION & BOTTOM BAR ON 390x844
  console.log('\n--- 1. Testing Mobile Navigation & Header ---');
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0'
  });
  await bypassAgeGate(mobileCtx);
  const page = await mobileCtx.newPage();
  await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
  await dismissModals(page);
  await page.waitForTimeout(1000);

  // Inspect bottom bar links
  const bottomLinks = await page.$$eval('.mobile-bottom a', els =>
    els.map(el => ({
      text: el.innerText.trim(),
      href: el.getAttribute('href'),
      isActive: el.classList.contains('active')
    }))
  );
  console.log('Bottom Nav Links:', bottomLinks);
  report.navigation.bottomLinks = bottomLinks;

  // Check expected 5 destinations
  const expectedLabels = ['Início', 'Catálogo', 'Ranking', 'Scans', 'Loja'];
  const hasAll5 = expectedLabels.every(label => bottomLinks.some(l => l.text === label));
  const hasEntrar = bottomLinks.some(l => l.text === 'Entrar' || l.text === 'Espaço');
  console.log('Has exact 5 labels (Início, Catálogo, Ranking, Scans, Loja):', hasAll5);
  console.log('Entrar removed from bottom bar:', !hasEntrar);
  report.navigation.hasAll5ExpectedDestinations = hasAll5;
  report.navigation.entrarRemovedFromBottom = !hasEntrar;

  // Check Header Login button
  const headerLoginBtn = await page.$('.btn-login-nav');
  const headerLoginText = headerLoginBtn ? await page.evaluate(el => el.innerText.trim(), headerLoginBtn) : null;
  console.log('Header Login Button present:', !!headerLoginBtn, `("${headerLoginText}")`);
  report.navigation.headerLoginPresent = !!headerLoginBtn;

  // Capture Header & Bottom Nav screenshots
  const headerEl = await page.$('.site-header');
  if (headerEl) {
    await headerEl.screenshot({ path: path.join(ARTIFACTS_DIR, 'round8_header_390.png') });
  }
  const bottomNavEl = await page.$('.mobile-bottom');
  if (bottomNavEl) {
    await bottomNavEl.screenshot({ path: path.join(ARTIFACTS_DIR, 'round8_bottom_nav_390.png') });
  }

  // 2. TEST CAROUSEL AUTHOR REMOVAL & ATOMIC SLIDE SYNCHRONIZATION
  console.log('\n--- 2. Testing Carousel Slide Synchronization & Author Removal ---');
  const authorEl = await page.$('.hero-authors');
  report.authorRemoved = (authorEl === null);
  console.log('Author/Artist section completely removed from DOM:', report.authorRemoved);

  // Capture initial carousel shot
  const carouselEl = await page.$('.hero-carousel');
  if (carouselEl) {
    await carouselEl.screenshot({ path: path.join(ARTIFACTS_DIR, 'round8_carousel_active_390.png') });
  }

  // Step through 10 slides and verify slide identity integrity
  console.log('Stepping through 10 slides to verify slide identity synchronization...');
  for (let s = 0; s < 10; s++) {
    const slideInfo = await page.evaluate(() => {
      const titleLink = document.querySelector('.hero-title a');
      const coverLink = document.querySelector('.active-card-inner');
      const coverImg = document.querySelector('.cover-img');
      const ctaLink = document.querySelector('.btn-primary-hero');
      const detailsLink = document.querySelector('.btn-secondary-hero');
      const synopsis = document.querySelector('.hero-synopsis');

      const title = titleLink ? titleLink.textContent?.trim() : '';
      const titleSlug = titleLink ? titleLink.getAttribute('href') : '';
      const coverSlug = coverLink ? coverLink.getAttribute('href') : '';
      const coverSrc = coverImg ? coverImg.getAttribute('src') : '';
      const ctaHref = ctaLink ? ctaLink.getAttribute('href') : '';
      const detailsHref = detailsLink ? detailsLink.getAttribute('href') : '';
      const synopsisText = synopsis ? synopsis.textContent?.trim().substring(0, 40) : '';

      return {
        title,
        titleSlug,
        coverSlug,
        coverSrc,
        ctaHref,
        detailsHref,
        synopsisPreview: synopsisText
      };
    });

    // Check slug alignment
    const isSynced = slideInfo.titleSlug === slideInfo.coverSlug && slideInfo.titleSlug === slideInfo.detailsHref;
    console.log(`Slide ${s + 1}: Title="${slideInfo.title.substring(0, 25)}..." | TitleSlug=${slideInfo.titleSlug} | CoverSlug=${slideInfo.coverSlug} | Synced=${isSynced}`);

    report.carouselSync.push({
      slideIndex: s,
      ...slideInfo,
      isSynced
    });

    if (!isSynced) {
      console.error(`DESYNCHRONIZATION DETECTED on slide ${s + 1}!`);
    }

    // Advance to next slide
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Próxima obra em destaque"]');
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
  }

  // Test Rapid clicks (stress test)
  console.log('Stress testing rapid slide navigation...');
  for (let r = 0; r < 5; r++) {
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Próxima obra em destaque"]');
      if (btn) btn.click();
    });
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(400);

  const rapidCheck = await page.evaluate(() => {
    const titleLink = document.querySelector('.hero-title a');
    const coverLink = document.querySelector('.active-card-inner');
    return {
      title: titleLink?.textContent?.trim(),
      titleSlug: titleLink?.getAttribute('href'),
      coverSlug: coverLink?.getAttribute('href'),
      matched: titleLink?.getAttribute('href') === coverLink?.getAttribute('href')
    };
  });
  console.log('After rapid clicks, Title and Cover matched:', rapidCheck.matched, `(${rapidCheck.titleSlug})`);
  report.rapidClicksSynced = rapidCheck.matched;

  // 3. CAPTURE SECTION & FULL VIEWPORT SCREENSHOTS
  console.log('\n--- 3. Capturing Multi-Viewport Screenshots ---');
  const VIEWPORTS = [
    { name: '360x800', width: 360, height: 800 },
    { name: '390x844', width: 390, height: 844 },
    { name: '412x915', width: 412, height: 915 }
  ];

  for (const vp of VIEWPORTS) {
    const vpCtx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0'
    });
    await bypassAgeGate(vpCtx);
    const vpPage = await vpCtx.newPage();
    await vpPage.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
    await dismissModals(vpPage);
    await vpPage.waitForTimeout(1000);

    const fullShotPath = path.join(ARTIFACTS_DIR, `round8_home_full_${vp.name}.png`);
    await vpPage.screenshot({ path: fullShotPath, fullPage: true });

    if (vp.name === '390x844') {
      const lancamentosEl = await vpPage.$('.releases-section');
      if (lancamentosEl) {
        await lancamentosEl.screenshot({ path: path.join(ARTIFACTS_DIR, 'round8_lancamentos_390.png') });
      }
    }

    // Metrics check
    const metrics = await vpPage.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const card = document.querySelector('.release-row-card');
      const cardW = card ? card.getBoundingClientRect().width : 0;
      return { docW, scrollW, cardW, noOverflow: scrollW <= docW };
    });
    console.log(`Viewport ${vp.name} metrics: cardW=${metrics.cardW}px, noOverflow=${metrics.noOverflow}`);
    report.viewports[vp.name] = metrics;
    await vpCtx.close();
  }

  // 4. TEST DESKTOP PRESERVATION (1440x900)
  console.log('\n--- 4. Testing Desktop 1440x900 Preservation ---');
  const dtCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await bypassAgeGate(dtCtx);
  const dtPage = await dtCtx.newPage();
  await dtPage.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
  await dismissModals(dtPage);
  await dtPage.waitForTimeout(1200);

  const desktopChecks = await dtPage.evaluate(() => {
    const deckPrev = document.querySelector('.deck-prev');
    const deckNext = document.querySelector('.deck-next');
    const deckActive = document.querySelector('.deck-active');
    const desktopNav = document.querySelector('.desktop-nav');
    const authors = document.querySelector('.hero-authors');

    return {
      desktopNavVisible: !!desktopNav && window.getComputedStyle(desktopNav).display !== 'none',
      deckPrevVisible: !!deckPrev && window.getComputedStyle(deckPrev).display !== 'none',
      deckNextVisible: !!deckNext && window.getComputedStyle(deckNext).display !== 'none',
      deckActiveVisible: !!deckActive && window.getComputedStyle(deckActive).display !== 'none',
      authorRemovedOnDesktopToo: !authors
    };
  });
  console.log('Desktop 3D Deck Checks:', desktopChecks);
  report.desktopPreserved = desktopChecks.deckPrevVisible && desktopChecks.deckNextVisible && desktopChecks.deckActiveVisible;

  await dtPage.screenshot({ path: path.join(ARTIFACTS_DIR, 'round8_desktop_1440_preserved.png'), fullPage: true });

  await browser.close();

  // Save report to artifacts
  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'round8_verification_results.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n=== ROUND 8 VERIFICATION COMPLETE ===');
  console.log('All slides synced:', report.carouselSync.every(s => s.isSynced));
  console.log('Author removed:', report.authorRemoved);
  console.log('Bottom nav updated:', report.navigation.hasAll5ExpectedDestinations && report.navigation.entrarRemovedFromBottom);
  console.log('Desktop preserved:', report.desktopPreserved);
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
