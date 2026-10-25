/**
 * scripts/verify_work_page_redesign.cjs
 * Comprehensive verification of the redesigned work page on Preview:
 * https://home-preview-manga.project-nox-awerkori.workers.dev
 */

const { chromium, firefox } = require('playwright');
const path = require('path');
const fs = require('fs');

const PREVIEW_BASE = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

const TEST_WORKS = [
  { slug: 'aparencias', desc: '546-chapters-many-tags' },
  { slug: 'shinkon-dakedo-captain-no-kanojo-to-wa-mada-yarenai', desc: 'long-title-adult' },
  { slug: 'the-mysterious-world-s-greatest-martial-artist-little-prince', desc: 'very-long-title' },
  { slug: 'o-restaurante-do-arquimago', desc: 'medium-158-caps' }
];

const VIEWPORTS = [
  { name: 'desktop_1920x1080', width: 1920, height: 1080, isMobile: false, hasTouch: false },
  { name: 'desktop_1366x768', width: 1366, height: 768, isMobile: false, hasTouch: false },
  { name: 'tablet_768x1024', width: 768, height: 1024, isMobile: true, hasTouch: true },
  { name: 'mobile_390x844', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'mobile_360x800', width: 360, height: 800, isMobile: true, hasTouch: true },
  { name: 'mobile_412x915', width: 412, height: 915, isMobile: true, hasTouch: true }
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
      await page.waitForTimeout(400);
    }
  } catch (e) {}
}

async function run() {
  console.log('=== STARTING WORK PAGE REDESIGN & RATING VERIFICATION ===');
  console.log('Target URL:', PREVIEW_BASE);

  const report = {
    testedAt: new Date().toISOString(),
    previewUrl: PREVIEW_BASE,
    ratingsTest: {},
    works: []
  };

  const browser = await chromium.launch({ headless: true });

  // =========================================================================
  // 1. STAR RATING INTERACTIVITY TEST (Desktop & Mobile)
  // =========================================================================
  console.log('\n--- 1. Testing Star Rating System (0 to 5 Stars, Change, Remove) ---');
  {
    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      isMobile: false,
      hasTouch: false
    });
    await bypassAgeGate(ctx);
    const page = await ctx.newPage();
    const testUrl = `${PREVIEW_BASE}/obra/conta-morta`;
    await page.goto(testUrl, { waitUntil: 'networkidle' });
    await dismissModals(page);
    await page.waitForTimeout(600);

    // Initial state check
    const initialRating = await page.evaluate(() => {
      const ratingWidget = document.querySelector('.rating-widget');
      const scoreBox = document.querySelector('.rating-number');
      const countEl = document.querySelector('.rating-count');
      return {
        widgetPresent: !!ratingWidget,
        scoreText: scoreBox ? scoreBox.textContent.trim() : null,
        countText: countEl ? countEl.textContent.trim() : null
      };
    });
    console.log('Initial Rating Widget State:', initialRating);
    report.ratingsTest.initial = initialRating;

    // Test Vote 5 Stars via Star Button
    console.log('Clicking 5th star to rate 5...');
    const star5 = await page.$('.interactive-stars .star-btn:nth-child(5)');
    if (star5) {
      await star5.click();
      await page.waitForTimeout(1000);
    }

    const after5 = await page.evaluate(() => {
      const chip = document.querySelector('.user-score-chip');
      const countEl = document.querySelector('.rating-count');
      const removeBtn = document.querySelector('.btn-remove-rating');
      return {
        chipText: chip ? chip.textContent.trim() : null,
        countText: countEl ? countEl.textContent.trim() : null,
        hasRemoveBtn: !!removeBtn
      };
    });
    console.log('After Rating 5 Stars:', after5);
    report.ratingsTest.after5Stars = after5;

    // Capture screenshot of desktop rated state
    const ratingEl = await page.$('.rating-widget');
    if (ratingEl) {
      await ratingEl.screenshot({ path: path.join(ARTIFACTS_DIR, 'redesign_star_rating_desktop_5stars.png') });
    }

    // Test Change Vote to 0 Stars
    console.log('Clicking 0★ button to rate 0 stars...');
    const zeroBtn = await page.$('.btn-zero-star');
    if (zeroBtn) {
      await zeroBtn.click();
      await page.waitForTimeout(1000);
    }

    const after0 = await page.evaluate(() => {
      const chip = document.querySelector('.user-score-chip');
      return {
        chipText: chip ? chip.textContent.trim() : null,
        isZeroScore: chip ? chip.classList.contains('zero-score') : false
      };
    });
    console.log('After Rating 0 Stars (distinguishing zero):', after0);
    report.ratingsTest.after0Stars = after0;

    // Test Remove Rating
    console.log('Clicking "Remover" to clear rating...');
    const removeBtn = await page.$('.btn-remove-rating');
    if (removeBtn) {
      await removeBtn.click();
      await page.waitForTimeout(1000);
    }

    const afterRemove = await page.evaluate(() => {
      const chip = document.querySelector('.user-score-chip');
      return {
        chipPresent: !!chip,
        countText: document.querySelector('.rating-count')?.textContent?.trim()
      };
    });
    console.log('After Removing Rating:', afterRemove);
    report.ratingsTest.afterRemove = afterRemove;

    await ctx.close();
  }

  // =========================================================================
  // 2. MOBILE TOUCH RATING SHEET TEST
  // =========================================================================
  console.log('\n--- 2. Testing Mobile Touch Rating Modal / Sheet ---');
  {
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0'
    });
    await bypassAgeGate(mobileCtx);
    const mPage = await mobileCtx.newPage();
    await mPage.goto(`${PREVIEW_BASE}/obra/conta-morta`, { waitUntil: 'networkidle' });
    await dismissModals(mPage);
    await mPage.waitForTimeout(600);

    const mobileRateBtn = await mPage.$('.btn-mobile-rate');
    console.log('Mobile "Avaliar esta obra" button present:', !!mobileRateBtn);

    if (mobileRateBtn) {
      await mobileRateBtn.click();
      await mPage.waitForTimeout(500);

      const modalInfo = await mPage.evaluate(() => {
        const sheet = document.querySelector('.rating-modal-sheet');
        const rows = Array.from(document.querySelectorAll('.sheet-score-row')).map(r => ({
          label: r.querySelector('.sheet-score-label')?.textContent?.trim(),
          height: Math.round(r.getBoundingClientRect().height)
        }));
        return {
          sheetOpen: !!sheet,
          scoreRows: rows
        };
      });
      console.log('Mobile Rating Sheet Info (Touch targets):', modalInfo);
      report.ratingsTest.mobileSheet = modalInfo;

      await mPage.screenshot({
        path: path.join(ARTIFACTS_DIR, 'redesign_star_rating_mobile_modal.png'),
        clip: { x: 0, y: 300, width: 390, height: 544 }
      });

      // Vote 5 in mobile sheet
      const row5 = await mPage.$('.sheet-score-row:first-child');
      if (row5) {
        await row5.click();
        await mPage.waitForTimeout(800);
      }
    }

    await mobileCtx.close();
  }

  // =========================================================================
  // 3. MULTI-WORK & MULTI-VIEWPORT VISUAL INSPECTION
  // =========================================================================
  console.log('\n--- 3. Capturing Multi-Viewport Screenshots & Inspecting Metrics ---');
  for (const work of TEST_WORKS) {
    const workUrl = `${PREVIEW_BASE}/obra/${work.slug}`;
    console.log(`\nAuditing Work: ${work.slug} (${work.desc})`);
    const workData = {
      slug: work.slug,
      desc: work.desc,
      viewports: {}
    };

    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
        userAgent: vp.isMobile
          ? 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
          : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      });
      await bypassAgeGate(ctx);
      const page = await ctx.newPage();

      try {
        await page.goto(workUrl, { waitUntil: 'networkidle', timeout: 35000 });
        await dismissModals(page);
        await page.waitForTimeout(600);

        // Screenshots
        const fullImg = `redesign_${work.slug}_${vp.name}_full.png`;
        const heroImg = `redesign_${work.slug}_${vp.name}_hero.png`;
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, fullImg), fullPage: true });
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, heroImg),
          clip: { x: 0, y: 0, width: vp.width, height: Math.min(850, vp.height) }
        });

        // Metrics inspection
        const metrics = await page.evaluate(() => {
          const docW = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;
          const cover = document.querySelector('.work-cover-wrapper, .work-cover-img');
          const coverRect = cover ? cover.getBoundingClientRect() : null;
          const title = document.querySelector('#work-title, h1');
          const titleRect = title ? title.getBoundingClientRect() : null;
          const ratingWidget = document.querySelector('.rating-widget');
          const metricsChips = Array.from(document.querySelectorAll('.metric-chip')).map(c => c.textContent.replace(/\s+/g, ' ').trim());
          const actionButtons = Array.from(document.querySelectorAll('.btn-read-primary, .btn-action-pill')).map(b => ({
            text: b.textContent.trim(),
            w: Math.round(b.getBoundingClientRect().width),
            h: Math.round(b.getBoundingClientRect().height)
          }));
          const chapterRows = document.querySelectorAll('.chapter-card');

          return {
            clientWidth: docW,
            scrollWidth: scrollW,
            noOverflow: scrollW <= docW,
            cover: coverRect ? { width: Math.round(coverRect.width), height: Math.round(coverRect.height) } : null,
            title: titleRect ? { width: Math.round(titleRect.width), height: Math.round(titleRect.height), text: title?.textContent?.trim() } : null,
            hasRatingWidget: !!ratingWidget,
            metricsChips,
            actionButtons,
            chapterCardsCount: chapterRows.length
          };
        });

        console.log(`  [${vp.name}] noOverflow=${metrics.noOverflow} cover=${metrics.cover?.width}x${metrics.cover?.height} titleW=${metrics.title?.width} (btnRead: ${metrics.actionButtons[0]?.w}x${metrics.actionButtons[0]?.h}px)`);

        workData.viewports[vp.name] = {
          fullImg,
          heroImg,
          metrics
        };
      } catch (e) {
        console.error(`  Error on ${vp.name}:`, e.message);
      } finally {
        await ctx.close();
      }
    }

    report.works.push(workData);
  }

  await browser.close();

  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'redesign_work_page_audit.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n=== WORK PAGE REDESIGN VERIFICATION COMPLETE ===');
  console.log(`Report saved to: ${path.join(ARTIFACTS_DIR, 'redesign_work_page_audit.json')}`);
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
