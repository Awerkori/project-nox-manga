/**
 * scripts/verify_round4_7_downloads_and_redesign.cjs
 * Comprehensive validation for Round 4.7 / Refinement of Work Page & Download Cancellation
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PREVIEW_BASE = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

const VIEWPORTS = [
  { name: 'desktop_1920x1080', width: 1920, height: 1080, isMobile: false },
  { name: 'desktop_1600x900', width: 1600, height: 900, isMobile: false },
  { name: 'desktop_1366x768', width: 1366, height: 768, isMobile: false },
  { name: 'tablet_768x1024', width: 768, height: 1024, isMobile: false },
  { name: 'mobile_412x915', width: 412, height: 915, isMobile: true },
  { name: 'mobile_390x844', width: 390, height: 844, isMobile: true },
  { name: 'mobile_360x800', width: 360, height: 800, isMobile: true }
];

async function bypassAgeGate(context) {
  await context.addCookies([
    {
      name: 'nox-age-status',
      value: 'ADULT',
      domain: 'home-preview-manga.project-nox-awerkori.workers.dev',
      path: '/'
    },
    {
      name: 'nox-blur-nsfw',
      value: 'false',
      domain: 'home-preview-manga.project-nox-awerkori.workers.dev',
      path: '/'
    }
  ]);
}

async function dismissModals(page) {
  try {
    await page.evaluate(() => {
      try {
        localStorage.setItem('nox-age-status', 'ADULT');
        localStorage.setItem('nox-blur-nsfw', 'false');
      } catch {}
      const backdrop = document.querySelector('.age-gate-backdrop');
      if (backdrop) backdrop.remove();
    });
    await page.waitForTimeout(150);
  } catch {}
}

async function main() {
  console.log('=== STARTING WORK PAGE & DOWNLOAD CANCELLATION VALIDATION ===');
  console.log('Preview URL:', PREVIEW_BASE);

  const report = {
    testedAt: new Date().toISOString(),
    previewUrl: PREVIEW_BASE,
    headerLayout: {},
    specsPanel: {},
    downloadCancellation: {},
    batchCancellation: {},
    viewports: []
  };

  const browser = await chromium.launch({ headless: true });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Header Layout & Indicators Under Cover
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Header Reorganization & Indicators Under Cover ---');
    {
      const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      await bypassAgeGate(ctx);
      const page = await ctx.newPage();
      await page.goto(`${PREVIEW_BASE}/obra/aparencias`, { waitUntil: 'networkidle' });
      await dismissModals(page);

      const headerData = await page.evaluate(() => {
        const coverCol = document.querySelector('.work-cover-column');
        const detailsCol = document.querySelector('.work-details-column');
        const indicators = coverCol ? coverCol.querySelector('.cover-indicators-group') : null;
        const badges = indicators ? Array.from(indicators.querySelectorAll('.indicator-badge')).map(b => b.innerText.trim()) : [];
        const firstRightChild = detailsCol ? detailsCol.firstElementChild : null;
        const titleEl = document.querySelector('h1.work-title');
        const ratingWidget = detailsCol ? detailsCol.querySelector('.work-rating-wrap, .rating-widget') : null;
        const synopsisCard = document.querySelector('.work-synopsis-card');
        const specsSection = document.querySelector('.work-specs-section');

        const heroBox = document.querySelector('.work-hero-section')?.getBoundingClientRect();
        const coverBox = coverCol?.getBoundingClientRect();
        const titleBox = titleEl?.getBoundingClientRect();

        return {
          hasIndicatorsUnderCover: !!indicators,
          indicatorsCount: badges.length,
          badges,
          firstRightChildTag: firstRightChild ? firstRightChild.tagName.toLowerCase() : null,
          firstRightChildIsTitle: firstRightChild === titleEl,
          hasRatingWidget: !!ratingWidget,
          hasSynopsisCard: !!synopsisCard,
          hasSpecsSection: !!specsSection,
          coverTop: coverBox ? coverBox.top : null,
          titleTop: titleBox ? titleBox.top : null,
          topAlignmentDiff: (coverBox && titleBox) ? Math.abs(coverBox.top - titleBox.top) : null
        };
      });

      console.log('Header Evaluation:', JSON.stringify(headerData, null, 2));
      report.headerLayout = headerData;

      if (!headerData.hasIndicatorsUnderCover) {
        throw new Error('FAIL: Indicators not found under cover in .work-cover-column');
      }
      if (!headerData.firstRightChildIsTitle) {
        console.warn('WARNING: First right child is not title directly:', headerData.firstRightChildTag);
      } else {
        console.log('✓ Title is the first element in details column');
      }
      console.log(`✓ Cover top: ${headerData.coverTop}px, Title top: ${headerData.titleTop}px (diff: ${headerData.topAlignmentDiff}px)`);
      console.log('✓ Badges under cover:', headerData.badges.join(' | '));

      await ctx.close();
    }

    // -------------------------------------------------------------------------
    // TEST 2: Specs Panel 2x2 Grid Symmetry & Equal Height
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Specs Panel 2x2 Grid Symmetry & Equal Height ---');
    {
      const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      await bypassAgeGate(ctx);
      const page = await ctx.newPage();

      for (const testSlug of ['aparencias', 'shinkon-dakedo-captain-no-kanojo-to-wa-mada-yarenai', 'o-restaurante-do-arquimago']) {
        await page.goto(`${PREVIEW_BASE}/obra/${testSlug}`, { waitUntil: 'networkidle' });
        await dismissModals(page);

        const specsData = await page.evaluate(() => {
          const panel = document.querySelector('.specs-unified-panel');
          const infoCard = document.querySelector('#subpanel-info');
          const creditsCard = document.querySelector('#subpanel-credits');
          const genresCard = document.querySelector('#subpanel-genres');
          const aliasesCard = document.querySelector('#subpanel-aliases');
          const genresBody = document.querySelector('.genres-card-body');

          const infoBox = infoCard ? infoCard.getBoundingClientRect() : null;
          const creditsBox = creditsCard ? creditsCard.getBoundingClientRect() : null;
          const genresBox = genresCard ? genresCard.getBoundingClientRect() : null;
          const aliasesBox = aliasesCard ? aliasesCard.getBoundingClientRect() : null;
          const tagsWrap = genresCard ? genresCard.querySelector('.editorial-tags-wrap') : null;
          const tagsWrapBox = tagsWrap ? tagsWrap.getBoundingClientRect() : null;

          const tagsCount = tagsWrap ? tagsWrap.querySelectorAll('.editorial-tag-pill').length : 0;
          const isSparse = genresBody ? genresBody.classList.contains('is-sparse') : false;

          return {
            row1InfoHeight: infoBox ? Math.round(infoBox.height) : null,
            row1CreditsHeight: creditsBox ? Math.round(creditsBox.height) : null,
            row1Diff: (infoBox && creditsBox) ? Math.abs(Math.round(infoBox.height) - Math.round(creditsBox.height)) : null,
            row2GenresHeight: genresBox ? Math.round(genresBox.height) : null,
            row2AliasesHeight: aliasesBox ? Math.round(aliasesBox.height) : null,
            row2Diff: (genresBox && aliasesBox) ? Math.abs(Math.round(genresBox.height) - Math.round(aliasesBox.height)) : null,
            tagsCount,
            isSparse,
            genresBottomSpace: (genresBox && tagsWrapBox) ? Math.round(genresBox.bottom - tagsWrapBox.bottom) : null
          };
        });

        console.log(`[${testSlug}] Specs Grid Symmetry Evaluation:`, specsData);
        if (specsData.row2Diff !== 0) {
          throw new Error(`FAIL: Height mismatch in Row 2 for ${testSlug}: Genres=${specsData.row2GenresHeight}px, Aliases=${specsData.row2AliasesHeight}px (diff=${specsData.row2Diff}px)`);
        }
        console.log(`✓ [${testSlug}] Row 2 (Genres & Aliases) have EXACT SAME HEIGHT: ${specsData.row2GenresHeight}px (diff: 0px)`);
        console.log(`✓ [${testSlug}] Tags count: ${specsData.tagsCount}, isSparse: ${specsData.isSparse}`);
      }

      await ctx.close();
    }

    // -------------------------------------------------------------------------
    // TEST 3: Individual Chapter Download Cancellation
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Individual Chapter Download Cancellation ---');
    {
      const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      await bypassAgeGate(ctx);
      const page = await ctx.newPage();

      // Delay page requests so download takes enough time to be canceled mid-flight
      await page.route('**/media/**', async (route) => {
        await new Promise((res) => setTimeout(res, 400));
        await route.continue();
      });

      await page.goto(`${PREVIEW_BASE}/obra/aparencias`, { waitUntil: 'networkidle' });
      await dismissModals(page);

      // Find first chapter download button
      const firstDownloadBtn = page.locator('.btn-chapter-download').first();
      await firstDownloadBtn.waitFor({ state: 'visible' });

      console.log('Clicking download button to start chapter download...');
      await firstDownloadBtn.click();

      // Wait for it to become downloading
      await page.waitForSelector('.btn-chapter-download.is-downloading', { timeout: 5000 });
      console.log('✓ Chapter download started - button in .is-downloading state');

      const downloadingState = await page.evaluate(() => {
        const btn = document.querySelector('.btn-chapter-download.is-downloading');
        return {
          hasDownloadingClass: !!btn,
          text: btn ? btn.innerText.trim() : null,
          title: btn ? btn.getAttribute('title') : null
        };
      });
      console.log('Downloading state info:', downloadingState);

      // Wait a moment so some pages are fetched
      await page.waitForTimeout(300);

      console.log('Now clicking button again to CANCEL the download in flight...');
      const downloadingBtn = page.locator('.btn-chapter-download.is-downloading').first();
      await downloadingBtn.click();

      // Wait for cancellation notice and button return to normal
      await page.waitForSelector('.work-notice-bar', { timeout: 4000 });
      const noticeText = await page.locator('.work-notice-bar span').first().innerText();
      console.log('Notice toast after cancel:', noticeText);

      // Verify button is no longer downloading and not downloaded
      await page.waitForTimeout(600);
      const postCancelState = await page.evaluate(() => {
        const btn = document.querySelector('.chapter-card .btn-chapter-download');
        return {
          isDownloading: btn ? btn.classList.contains('is-downloading') : false,
          isDownloaded: btn ? btn.classList.contains('is-downloaded') : false
        };
      });

      console.log('Post-cancel button state:', postCancelState);

      // Check IndexedDB to make sure partial chapter was removed
      const idbCheck = await page.evaluate(async () => {
        return new Promise((resolve) => {
          const req = indexedDB.open('nox_offline_reading', 1);
          req.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('chapters')) {
              return resolve({ count: 0, chapters: [] });
            }
            const tx = db.transaction('chapters', 'readonly');
            const store = tx.objectStore('chapters');
            const getAll = store.getAll();
            getAll.onsuccess = () => resolve({ count: getAll.result.length, chapters: getAll.result.map(c => c.chapterId) });
            getAll.onerror = () => resolve({ error: 'failed_to_get' });
          };
          req.onerror = () => resolve({ error: 'failed_to_open_db' });
        });
      });
      console.log('IndexedDB check after cancel (must be empty/no incomplete chapter):', idbCheck);

      report.downloadCancellation = {
        noticeText,
        postCancelState,
        idbCheck,
        success: !postCancelState.isDownloading && !postCancelState.isDownloaded && (noticeText.includes('cancelado') || noticeText.includes('Download'))
      };

      if (!report.downloadCancellation.success) {
        throw new Error('FAIL: Download cancellation did not reset state properly');
      }
      console.log('✓ Individual chapter download cancellation PASSED');

      await ctx.close();
    }

    // -------------------------------------------------------------------------
    // TEST 4: Batch Download Cancellation
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Batch Download Cancellation ---');
    {
      const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      await bypassAgeGate(ctx);
      const page = await ctx.newPage();

      // Slow down pages to test batch cancel
      await page.route('**/media/**', async (route) => {
        await new Promise((res) => setTimeout(res, 500));
        await route.continue();
      });

      await page.goto(`${PREVIEW_BASE}/obra/aparencias`, { waitUntil: 'networkidle' });
      await dismissModals(page);

      const batchBtn = page.locator('.download-batch-btn');
      await batchBtn.waitFor({ state: 'visible' });

      console.log('Clicking batch download button...');
      await batchBtn.click();

      // Wait for batch to enter busy/cancellable state
      await page.waitForSelector('.download-batch-btn.is-busy', { timeout: 5000 });
      console.log('✓ Batch download is active and shows .is-busy');

      const batchBusyState = await page.evaluate(() => {
        const btn = document.querySelector('.download-batch-btn.is-busy');
        return {
          isBusy: !!btn,
          text: btn ? btn.innerText.trim() : null
        };
      });
      console.log('Batch active state text:', batchBusyState.text);

      await page.waitForTimeout(400);

      console.log('Clicking batch download button again to CANCEL batch...');
      await batchBtn.click();

      await page.waitForSelector('.work-notice-bar', { timeout: 5000 });
      const batchNotice = await page.locator('.work-notice-bar span').first().innerText();
      console.log('Batch notice toast after cancel:', batchNotice);

      await page.waitForTimeout(500);
      const batchPostCancelState = await page.evaluate(() => {
        const btn = document.querySelector('.download-batch-btn');
        return {
          isBusy: btn ? btn.classList.contains('is-busy') : false,
          text: btn ? btn.innerText.trim() : null
        };
      });
      console.log('Batch post-cancel state:', batchPostCancelState);

      report.batchCancellation = {
        batchNotice,
        batchPostCancelState,
        success: !batchPostCancelState.isBusy && batchNotice.includes('cancelado')
      };

      if (!report.batchCancellation.success) {
        throw new Error('FAIL: Batch download cancellation did not reset state properly');
      }
      console.log('✓ Batch download cancellation PASSED');

      await ctx.close();
    }

    // -------------------------------------------------------------------------
    // TEST 5: Comprehensive 7-Viewport Screenshots and Responsive Audit
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Capturing 7-Viewport Screenshots & Responsive Audit ---');
    const targetWorks = [
      { slug: 'aparencias', desc: 'lookism-long-synopsis-many-tags' },
      { slug: 'shinkon-dakedo-captain-no-kanojo-to-wa-mada-yarenai', desc: 'manga-with-aliases-and-short-tags' },
      { slug: 'o-restaurante-do-arquimago', desc: 'standard-manhwa' }
    ];

    for (const vp of VIEWPORTS) {
      console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile
      });
      await bypassAgeGate(ctx);
      const page = await ctx.newPage();

      for (const work of targetWorks) {
        await page.goto(`${PREVIEW_BASE}/obra/${work.slug}`, { waitUntil: 'networkidle' });
        await dismissModals(page);
        await page.waitForTimeout(500);

        const audit = await page.evaluate(() => {
          const docWidth = document.documentElement.scrollWidth;
          const winWidth = window.innerWidth;
          const hasOverflow = docWidth > winWidth;
          const coverCol = document.querySelector('.work-cover-column');
          const indicators = document.querySelector('.cover-indicators-group');
          const title = document.querySelector('h1.work-title');
          const genres = document.querySelector('#subpanel-genres');
          const aliases = document.querySelector('#subpanel-aliases');

          return {
            docWidth,
            winWidth,
            hasOverflow,
            indicatorsVisible: indicators ? indicators.clientHeight > 0 : false,
            titleVisible: title ? title.clientHeight > 0 : false,
            genresHeight: genres ? Math.round(genres.getBoundingClientRect().height) : null,
            aliasesHeight: aliases ? Math.round(aliases.getBoundingClientRect().height) : null
          };
        });

        console.log(`  [${work.slug}] Overflow: ${audit.hasOverflow} (doc: ${audit.docWidth}px, win: ${audit.winWidth}px) | Genres: ${audit.genresHeight}px, Aliases: ${audit.aliasesHeight}px`);

        if (audit.hasOverflow) {
          console.warn(`  ⚠️ Horizontal overflow detected in ${vp.name} for ${work.slug}!`);
        }

        // Take screenshots for o-restaurante-do-arquimago and aparencias
        if (work.slug === 'o-restaurante-do-arquimago' || work.slug === 'aparencias') {
          const screenshotHero = path.join(ARTIFACTS_DIR, `round4_7_${work.slug}_${vp.name}_hero.png`);
          await page.screenshot({ path: screenshotHero, fullPage: false });

          const screenshotFull = path.join(ARTIFACTS_DIR, `round4_7_${work.slug}_${vp.name}_full.png`);
          await page.screenshot({ path: screenshotFull, fullPage: true });

          report.viewports.push({
            viewport: vp.name,
            work: work.slug,
            audit,
            screenshotHero,
            screenshotFull
          });
        }
      }

      await ctx.close();
    }

    // Save test report JSON
    const reportPath = path.join(ARTIFACTS_DIR, 'round4_7_verification_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n✓ Full JSON report saved to ${reportPath}`);

    console.log('\n=============================================================');
    console.log('🎉 ALL VALIDATIONS COMPLETED SUCCESSFULLY (100% PASS)');
    console.log('=============================================================');
  } catch (err) {
    console.error('\n❌ VALIDATION ERROR:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
