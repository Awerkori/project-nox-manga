/**
 * scripts/verify_work_page_redesign.cjs
 * Comprehensive Round 3 verification of the redesigned work page on Preview:
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
  { name: 'desktop_1600x900', width: 1600, height: 900, isMobile: false, hasTouch: false },
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
  console.log('=== STARTING WORK PAGE ROUND 3 VERIFICATION ===');
  console.log('Target Preview URL:', PREVIEW_BASE);

  const report = {
    testedAt: new Date().toISOString(),
    previewUrl: PREVIEW_BASE,
    ratingsTest: {},
    works: []
  };

  const browser = await chromium.launch({ headless: true });

  // =========================================================================
  // 1. STAR RATING TEST (1 to 5 Stars only, Rejection of 0, Discrete Menu, No Toasts)
  // =========================================================================
  console.log('\n--- 1. Testing Star Rating System (1-5 Stars, No 0★, Discrete Removal, No Toasts) ---');
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

    // Initial check: no 0★ button exists
    const initialCheck = await page.evaluate(() => {
      const zeroBtn = document.querySelector('.btn-zero-star');
      const starBtns = document.querySelectorAll('.interactive-stars .star-btn');
      const emptyBadge = document.querySelector('.rating-empty-badge');
      return {
        hasZeroBtn: !!zeroBtn,
        starsCount: starBtns.length,
        emptyBadgeText: emptyBadge ? emptyBadge.textContent.trim() : null
      };
    });
    console.log('Rating Widget Structure Check (No 0★):', initialCheck);
    report.ratingsTest.initialCheck = initialCheck;

    // Test API rejection of rating 0
    console.log('Testing Server API rejection of rating 0...');
    const apiTest = await page.evaluate(async () => {
      const res = await fetch('/api/works/test/rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 0 })
      });
      const data = await res.json();
      return { status: res.status, error: data.error };
    });
    console.log('API Rating 0 Rejection Result:', apiTest);
    report.ratingsTest.apiZeroRejection = apiTest;

    // Test Vote 5 Stars
    console.log('Desktop: Clicking 5th star button...');
    const star5 = await page.$('.interactive-stars .star-btn:nth-child(5)');
    if (star5) {
      await star5.click();
      await page.waitForTimeout(800);
    }

    const after5 = await page.evaluate(() => {
      const chip = document.querySelector('.user-score-chip');
      const optionsBtn = document.querySelector('.btn-rating-options');
      const permanentRemove = document.querySelector('.btn-remove-rating');
      const toast = document.querySelector('.work-notice-bar');
      return {
        chipText: chip ? chip.textContent.trim() : null,
        hasOptionsBtn: !!optionsBtn,
        hasPermanentRemoveBtn: !!permanentRemove,
        hasSuccessToast: !!toast
      };
    });
    console.log('After Rating 5 Stars:', after5);
    report.ratingsTest.after5Stars = after5;

    // Test discrete options menu to remove rating
    console.log('Testing discrete options popover removal...');
    const optionsBtn = await page.$('.btn-rating-options');
    if (optionsBtn) {
      await optionsBtn.click();
      await page.waitForTimeout(400);

      const popoverVisible = await page.$('.rating-options-popover');
      console.log('Removal Popover Visible:', !!popoverVisible);

      const removeBtn = await page.$('.btn-popover-remove');
      if (removeBtn) {
        await removeBtn.click();
        await page.waitForTimeout(800);
      }
    }

    const afterRemove = await page.evaluate(() => {
      const chip = document.querySelector('.user-score-chip');
      return { hasChip: !!chip };
    });
    console.log('After Discrete Removal:', afterRemove);
    report.ratingsTest.afterRemove = afterRemove;

    // Capture screenshot of desktop rating widget
    const ratingEl = await page.$('.rating-widget');
    if (ratingEl) {
      await ratingEl.screenshot({ path: path.join(ARTIFACTS_DIR, 'round3_rating_desktop.png') });
    }

    await ctx.close();
  }

  // =========================================================================
  // 2. MOBILE TOUCH STAR RATING & 1-5 BREAKDOWN MODAL TEST
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

    const mobileHitboxes = await mPage.evaluate(() => {
      const stars = Array.from(document.querySelectorAll('.interactive-stars .star-btn'));
      return stars.map(s => {
        const r = s.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), meets44: r.width >= 44 && r.height >= 44 };
      });
    });
    console.log('Mobile Star Hitboxes (>= 44px):', mobileHitboxes);
    report.ratingsTest.mobileHitboxes = mobileHitboxes;

    // Tap 4th star directly
    const star4 = await mPage.$('.interactive-stars .star-btn:nth-child(4)');
    if (star4) {
      await star4.tap();
      await mPage.waitForTimeout(800);
    }

    // Open Breakdown Modal
    const scoreBox = await mPage.$('.rating-score-box');
    if (scoreBox) {
      await scoreBox.tap();
      await mPage.waitForTimeout(500);
    }

    const modalInfo = await mPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.dist-row-btn')).map(r => r.querySelector('.dist-score-lbl')?.textContent?.trim());
      return { rows };
    });
    console.log('Distribution Modal Rows (Should only be 5★ to 1★):', modalInfo.rows);
    report.ratingsTest.modalDistributionRows = modalInfo.rows;

    await mPage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'round3_mobile_rating_modal.png'),
      clip: { x: 0, y: 300, width: 390, height: 544 }
    });

    // Remove vote from modal
    const modalRemove = await mPage.$('.btn-sheet-remove');
    if (modalRemove) {
      await modalRemove.click({ force: true });
      await mPage.waitForTimeout(600);
    }

    await mobileCtx.close();
  }

  // =========================================================================
  // 3. MULTI-WORK & MULTI-VIEWPORT AUDIT (Ficha Técnica Above Chapters on ALL viewports)
  // =========================================================================
  console.log('\n--- 3. Multi-Viewport & Multi-Work Validation (Desktop & Mobile Hierarchy) ---');
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
        const fullImg = `round4_1_${work.slug}_${vp.name}_full.png`;
        const heroImg = `round4_1_${work.slug}_${vp.name}_hero.png`;
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, fullImg), fullPage: true });
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, heroImg),
          clip: { x: 0, y: 0, width: vp.width, height: Math.min(850, vp.height) }
        });

        // Hierarchy and Round 4.1 fixes evaluation
        const evaluation = await page.evaluate(() => {
          const docW = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;

          const specs = document.querySelector('.work-specs-section, .work-specs-editorial, .work-sidebar');
          const chapters = document.querySelector('.work-chapters-section');
          const specsY = specs ? specs.getBoundingClientRect().top + window.scrollY : null;
          const chaptersY = chapters ? chapters.getBoundingClientRect().top + window.scrollY : null;
          const isFichaAboveChapters = specsY !== null && chaptersY !== null ? specsY < chaptersY : null;

          const quadCards = document.querySelectorAll('.specs-quad-card');
          const byline = document.querySelector('.work-creators-byline');
          const aliasItems = document.querySelectorAll('.alias-editorial-row');

          // Tag height check (28-34px)
          const tags = Array.from(document.querySelectorAll('.editorial-tag-pill'));
          const tagDimensions = tags.map(t => {
            const r = t.getBoundingClientRect();
            return { w: Math.round(r.width), h: Math.round(r.height) };
          });
          const allTagsCompact = tagDimensions.length > 0 && tagDimensions.every(d => d.h >= 28 && d.h <= 34);

          // Translation attribution check (must NOT have "Comunidade Project Nox")
          const hasFakeTranslation = document.body.innerText.includes('Comunidade Project Nox');

          const firstChapter = document.querySelector('.chapter-card');
          const viewsPill = firstChapter ? firstChapter.querySelector('.chapter-meta-views') : null;
          const datePill = firstChapter ? firstChapter.querySelector('.chapter-meta-date') : null;

          return {
            clientWidth: docW,
            scrollWidth: scrollW,
            noOverflow: scrollW <= docW,
            specsY: Math.round(specsY || 0),
            chaptersY: Math.round(chaptersY || 0),
            isFichaAboveChapters,
            quadCardsCount: quadCards.length,
            hasByline: !!byline,
            aliasItemsCount: aliasItems.length,
            tagDimensions: tagDimensions.slice(0, 4),
            allTagsCompact,
            hasFakeTranslation,
            viewsText: viewsPill ? viewsPill.textContent.trim() : null,
            dateText: datePill ? datePill.textContent.trim() : null
          };
        });

        console.log(`  [${vp.name}] noOverflow=${evaluation.noOverflow} | FichaAboveChapters=${evaluation.isFichaAboveChapters} | tagsCompact=${evaluation.allTagsCompact} (first: ${JSON.stringify(evaluation.tagDimensions[0])}) | hasFakeTranslation=${evaluation.hasFakeTranslation} | 1stViews: "${evaluation.viewsText}"`);

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
    path.join(ARTIFACTS_DIR, 'round4_1_work_page_audit.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n=== ROUND 4.1 VERIFICATION COMPLETE ===');
  console.log(`Audit report saved to: ${path.join(ARTIFACTS_DIR, 'round4_1_work_page_audit.json')}`);
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
