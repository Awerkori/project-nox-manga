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
  console.log('=== STARTING INITIAL MOBILE BASELINE AUDIT (ROUND 5 STATE) ===');
  console.log('Target URL:', PREVIEW_URL);

  const baselineFindings = {
    viewports: {},
    firefoxGecko: {},
    chromium: {}
  };

  // 1. CAPTURE WITH FIREFOX (GECKO MOTOR)
  console.log('\n--- 1. Testing with Firefox (Gecko Engine) ---');
  const ffBrowser = await firefox.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    console.log(`Testing Gecko viewport: ${vp.name} (${vp.width}x${vp.height})...`);
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
    const fullShotPath = path.join(ARTIFACTS_DIR, `baseline_${vp.name}_gecko_full.png`);
    await page.screenshot({ path: fullShotPath, fullPage: true });

    // Section inspection
    if (vp.name === 'android_390x844' || vp.name === 'android_360x800') {
      // Carousel section
      const carouselEl = await page.$('.hero-carousel, .hero-showcase, .hero-stage, .carousel-3d-stage');
      if (carouselEl) {
        await carouselEl.screenshot({ path: path.join(ARTIFACTS_DIR, `baseline_${vp.name}_gecko_carousel.png`) });
      }

      // Shelves: Novas Obras
      const shelves = await page.$$('.shelf-section, .work-shelf-section');
      if (shelves.length > 0) {
        await shelves[0].screenshot({ path: path.join(ARTIFACTS_DIR, `baseline_${vp.name}_gecko_novas_obras.png`) });
      }
      if (shelves.length > 1) {
        await shelves[1].screenshot({ path: path.join(ARTIFACTS_DIR, `baseline_${vp.name}_gecko_mais_lidos.png`) });
      }

      // Lançamentos
      const releasesEl = await page.$('.recent-releases-section, .releases-section, .releases-feed');
      if (releasesEl) {
        await releasesEl.screenshot({ path: path.join(ARTIFACTS_DIR, `baseline_${vp.name}_gecko_lancamentos.png`) });
      }

      // Detailed measurements for Lançamentos
      const releasesMetrics = await page.evaluate(() => {
        const section = document.querySelector('.recent-releases-section, .releases-section, .releases-feed');
        const cards = Array.from(document.querySelectorAll('.release-card, .release-item, .recent-release-card'));
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;

        const cardDetails = cards.slice(0, 3).map((card, idx) => {
          const cover = card.querySelector('img, .release-cover');
          const title = card.querySelector('.release-title, h3, h4');
          const chips = Array.from(card.querySelectorAll('.chapter-chip, .ch-chip, a[href*="/ler/"]'));
          const time = card.querySelector('.release-time, time, .time-badge');
          
          return {
            cardWidth: card.clientWidth,
            cardBoundingWidth: card.getBoundingClientRect().width,
            coverWidth: cover ? cover.clientWidth : null,
            coverHeight: cover ? cover.clientHeight : null,
            titleText: title ? title.textContent.trim() : null,
            titleFontSize: title ? window.getComputedStyle(title).fontSize : null,
            timeText: time ? time.textContent.trim() : null,
            chipsCount: chips.length,
            chipsInfo: chips.map(c => ({
              text: c.textContent.trim(),
              width: c.clientWidth,
              height: c.clientHeight,
              fontSize: window.getComputedStyle(c).fontSize
            }))
          };
        });

        return {
          docWidth,
          scrollWidth,
          hasHorizontalOverflow: scrollWidth > docWidth,
          totalCards: cards.length,
          cardsSample: cardDetails
        };
      });

      baselineFindings.firefoxGecko[vp.name] = releasesMetrics;
      console.log(`Gecko ${vp.name} Lançamentos metrics:`, JSON.stringify(releasesMetrics, null, 2));
    }

    await ctx.close();
  }
  await ffBrowser.close();

  // 2. CAPTURE WITH CHROMIUM MOBILE (Pixel 5 & 390x844)
  console.log('\n--- 2. Testing with Chromium Mobile ---');
  const crBrowser = await chromium.launch({ headless: true });
  for (const vp of [VIEWPORTS[0], VIEWPORTS[1], VIEWPORTS[2]]) {
    const ctx = await crBrowser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
    });
    await bypassAgeGate(ctx);
    const page = await ctx.newPage();

    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 35000 });
    await dismissModals(page);
    await page.waitForTimeout(1500);

    const fullShotPath = path.join(ARTIFACTS_DIR, `baseline_${vp.name}_chromium_full.png`);
    await page.screenshot({ path: fullShotPath, fullPage: true });

    if (vp.name === 'android_390x844') {
      const releasesEl = await page.$('.recent-releases-section, .releases-section, .releases-feed');
      if (releasesEl) {
        await releasesEl.screenshot({ path: path.join(ARTIFACTS_DIR, `baseline_${vp.name}_chromium_lancamentos.png`) });
      }
    }

    await ctx.close();
  }
  await crBrowser.close();

  console.log('\n=== BASELINE AUDIT COMPLETE ===');
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'baseline_findings.json'), JSON.stringify(baselineFindings, null, 2));
}

run().catch(err => {
  console.error('Audit failure:', err);
  process.exit(1);
});
