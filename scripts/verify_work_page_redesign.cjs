/**
 * scripts/verify_work_page_redesign.cjs
 * Comprehensive Round 2 verification of the redesigned work page on Preview:
 * https://home-preview-manga.project-nox-awerkori.workers.dev
 */

const { chromium } = require('playwright');
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
  { name: 'mobile_412x915', width: 412, height: 915, isMobile: true, hasTouch: true },
  { name: 'mobile_390x844', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'mobile_360x800', width: 360, height: 800, isMobile: true, hasTouch: true }
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
  console.log('=== STARTING WORK PAGE ROUND 2 VERIFICATION ===');
  console.log('Target Preview URL:', PREVIEW_BASE);

  const report = {
    testedAt: new Date().toISOString(),
    previewUrl: PREVIEW_BASE,
    ratingsTest: {},
    mobileHierarchyTest: {},
    chapterViewsTest: {},
    works: []
  };

  const browser = await chromium.launch({ headless: true });

  // =========================================================================
  // 1. STAR RATING INTERACTIVITY TEST (Desktop: 0-5 Stars, Change, Remove)
  // =========================================================================
  console.log('\n--- 1. Testing Star Rating System on Desktop ---');
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

    const initialRating = await page.evaluate(() => {
      const widget = document.querySelector('.rating-widget');
      const score = document.querySelector('.rating-number')?.textContent?.trim() || null;
      const count = document.querySelector('.rating-count')?.textContent?.trim() || null;
      return { widgetPresent: !!widget, score, count };
    });
    console.log('Initial Rating Widget State:', initialRating);
    report.ratingsTest.desktopInitial = initialRating;

    // Test Vote 5 Stars
    console.log('Desktop: Clicking 5th star button...');
    const star5 = await page.$('.rating-interactive-row .star-btn:nth-child(5)');
    if (star5) {
      await star5.click();
      await page.waitForTimeout(1000);
    }

    const after5 = await page.evaluate(() => {
      const chip = document.querySelector('.user-score-chip');
      const removeBtn = document.querySelector('.btn-remove-rating');
      const count = document.querySelector('.rating-count')?.textContent?.trim();
      return {
        chipText: chip ? chip.textContent.trim() : null,
        hasRemoveBtn: !!removeBtn,
        count
      };
    });
    console.log('After Rating 5 Stars:', after5);
    report.ratingsTest.after5Stars = after5;

    // Test Change Vote to 0 Stars (distinguishing 0 from absence of vote)
    console.log('Desktop: Clicking 0★ button to rate 0 stars...');
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
    console.log('After Rating 0 Stars:', after0);
    report.ratingsTest.after0Stars = after0;

    // Test Remove Rating
    console.log('Desktop: Clicking "Remover" button...');
    const removeBtn = await page.$('.btn-remove-rating');
    if (removeBtn) {
      await removeBtn.click();
      await page.waitForTimeout(1000);
    }

    const afterRemove = await page.evaluate(() => {
      const chip = document.querySelector('.user-score-chip');
      return {
        chipPresent: !!chip,
        count: document.querySelector('.rating-count')?.textContent?.trim()
      };
    });
    console.log('After Removing Rating:', afterRemove);
    report.ratingsTest.afterRemove = afterRemove;

    // Screenshot of desktop rating widget
    const ratingEl = await page.$('.rating-widget');
    if (ratingEl) {
      await ratingEl.screenshot({ path: path.join(ARTIFACTS_DIR, 'round2_rating_desktop.png') });
    }

    await ctx.close();
  }

  // =========================================================================
  // 2. MOBILE TOUCH STAR RATING & BREAKDOWN MODAL TEST
  // =========================================================================
  console.log('\n--- 2. Testing Direct Mobile Star Rating (Touch Targets >= 44px) ---');
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

    // Check direct star visibility & hitboxes on mobile
    const mobileStarsInfo = await mPage.evaluate(() => {
      const starBtns = Array.from(document.querySelectorAll('.rating-interactive-row .star-btn'));
      const zeroBtn = document.querySelector('.btn-zero-star');
      const zRect = zeroBtn ? zeroBtn.getBoundingClientRect() : null;
      return {
        starsCount: starBtns.length,
        starButtonsSizes: starBtns.map(b => {
          const r = b.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 && r.height > 0 };
        }),
        zeroButtonSize: zRect ? { w: Math.round(zRect.width), h: Math.round(zRect.height) } : null
      };
    });
    console.log('Mobile Interactive Star Hitboxes:', mobileStarsInfo);
    report.ratingsTest.mobileStarsDirect = mobileStarsInfo;

    // Tap 4th star directly on mobile (no modal needed!)
    console.log('Mobile: Tapping 4th star directly from the page...');
    const star4 = await mPage.$('.rating-interactive-row .star-btn:nth-child(4)');
    if (star4) {
      await star4.tap();
      await mPage.waitForTimeout(1000);
    }

    const mobileAfter4 = await mPage.evaluate(() => {
      const chip = document.querySelector('.user-score-chip');
      return {
        chipText: chip ? chip.textContent.trim() : null
      };
    });
    console.log('Mobile After Direct Tap (4 Stars):', mobileAfter4);
    report.ratingsTest.mobileAfterDirectTap = mobileAfter4;

    // Test opening the breakdown distribution modal by clicking the score box
    console.log('Mobile: Tapping score box to open Distribution Modal...');
    const scoreBox = await mPage.$('.rating-score-box');
    if (scoreBox) {
      await scoreBox.tap();
      await mPage.waitForTimeout(500);
    }

    const modalState = await mPage.evaluate(() => {
      const sheet = document.querySelector('.rating-modal-sheet');
      const distRows = Array.from(document.querySelectorAll('.dist-row-btn')).map(r => ({
        score: r.querySelector('.dist-score-lbl')?.textContent?.trim(),
        pct: r.querySelector('.dist-pct')?.textContent?.trim(),
        count: r.querySelector('.dist-count')?.textContent?.trim(),
        isMyVote: r.classList.contains('is-my-vote')
      }));
      return {
        modalVisible: !!sheet,
        distRows
      };
    });
    console.log('Mobile Distribution Modal Info:', modalState);
    report.ratingsTest.distributionModal = modalState;

    await mPage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'round2_mobile_rating_modal.png'),
      clip: { x: 0, y: 250, width: 390, height: 594 }
    });

    // Close modal
    const closeBtn = await mPage.$('.btn-sheet-close');
    if (closeBtn) {
      await closeBtn.tap();
      await mPage.waitForTimeout(300);
    }

    // Clean up vote
    const mRemoveBtn = await mPage.$('.btn-remove-rating');
    if (mRemoveBtn) {
      await mRemoveBtn.tap();
      await mPage.waitForTimeout(800);
    }

    await mobileCtx.close();
  }

  // =========================================================================
  // 3. MULTI-WORK & MULTI-VIEWPORT AUDIT (Position, Views, Overflow, Screenshots)
  // =========================================================================
  console.log('\n--- 3. Multi-Viewport & Multi-Work Validation ---');
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
        await page.waitForTimeout(500);

        // Screenshots
        const fullImg = `round2_${work.slug}_${vp.name}_full.png`;
        const heroImg = `round2_${work.slug}_${vp.name}_hero.png`;
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, fullImg), fullPage: true });
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, heroImg),
          clip: { x: 0, y: 0, width: vp.width, height: Math.min(850, vp.height) }
        });

        // Metrics, Hierarchy and Chapter Views evaluation
        const evaluation = await page.evaluate(() => {
          const docW = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;
          const cover = document.querySelector('.work-cover-wrapper, .work-cover-img');
          const coverRect = cover ? cover.getBoundingClientRect() : null;
          const title = document.querySelector('#work-title, h1');
          const titleRect = title ? title.getBoundingClientRect() : null;

          // Hierarchy inspection: verify Ficha Técnica position relative to Chapter List
          const sidebar = document.querySelector('.work-sidebar');
          const chapters = document.querySelector('.work-chapters-section');
          let sidebarY = sidebar ? sidebar.getBoundingClientRect().top + window.scrollY : null;
          let chaptersY = chapters ? chapters.getBoundingClientRect().top + window.scrollY : null;
          let isFichaTecnicaAboveChapters = sidebarY !== null && chaptersY !== null ? sidebarY < chaptersY : null;

          // Chapter items inspection (views count and date)
          const firstChapter = document.querySelector('.chapter-card');
          const viewsPill = firstChapter ? firstChapter.querySelector('.chapter-meta-views') : null;
          const datePill = firstChapter ? firstChapter.querySelector('.chapter-meta-date') : null;
          const allChapters = document.querySelectorAll('.chapter-card');

          return {
            clientWidth: docW,
            scrollWidth: scrollW,
            noOverflow: scrollW <= docW,
            cover: coverRect ? { width: Math.round(coverRect.width), height: Math.round(coverRect.height) } : null,
            title: titleRect ? { width: Math.round(titleRect.width), height: Math.round(titleRect.height), text: title?.textContent?.trim() } : null,
            sidebarY: Math.round(sidebarY || 0),
            chaptersY: Math.round(chaptersY || 0),
            isFichaTecnicaAboveChapters,
            chapterCardsCount: allChapters.length,
            firstChapterViewsText: viewsPill ? viewsPill.textContent.trim() : null,
            firstChapterDateText: datePill ? datePill.textContent.trim() : null
          };
        });

        console.log(`  [${vp.name}] noOverflow=${evaluation.noOverflow} | FichaTecnicaAboveChapters=${evaluation.isFichaTecnicaAboveChapters} (sidebarY: ${evaluation.sidebarY} vs chaptersY: ${evaluation.chaptersY}) | 1stCapViews: "${evaluation.firstChapterViewsText}"`);

        workData.viewports[vp.name] = {
          fullImg,
          heroImg,
          evaluation
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
    path.join(ARTIFACTS_DIR, 'round2_work_page_audit.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n=== ROUND 2 VERIFICATION COMPLETE ===');
  console.log(`Audit report saved to: ${path.join(ARTIFACTS_DIR, 'round2_work_page_audit.json')}`);
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
