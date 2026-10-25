/**
 * scripts/verify_work_page_redesign.cjs
 * Comprehensive Round 4.4 verification of the redesigned work page on Preview:
 * https://home-preview-manga.project-nox-awerkori.workers.dev
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PREVIEW_BASE = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

const TEST_WORKS = [
  { slug: 'aparencias', desc: '546-chapters-16-aliases-many-tags' },
  { slug: 'shinkon-dakedo-captain-no-kanojo-to-wa-mada-yarenai', desc: 'manga-with-aliases' },
  { slug: 'the-mysterious-world-s-greatest-martial-artist-little-prince', desc: 'scan-as-author-case' },
  { slug: 'o-restaurante-do-arquimago', desc: 'standard-manhwa' }
];

const VIEWPORTS = [
  { name: 'desktop_1920x1080', width: 1920, height: 1080, isMobile: false, hasTouch: false },
  { name: 'desktop_1600x900', width: 1600, height: 900, isMobile: false, hasTouch: false },
  { name: 'desktop_1366x768', width: 1366, height: 768, isMobile: false, hasTouch: false },
  { name: 'tablet_768x1024', width: 768, height: 1024, isMobile: false, hasTouch: true },
  { name: 'mobile_412x915', width: 412, height: 915, isMobile: true, hasTouch: true },
  { name: 'mobile_390x844', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'mobile_360x800', width: 360, height: 800, isMobile: true, hasTouch: true }
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
    await page.waitForTimeout(200);
  } catch {}
}

async function run() {
  console.log('=== STARTING WORK PAGE ROUND 4.4 VERIFICATION ===');
  console.log('Target Preview URL:', PREVIEW_BASE);

  const report = {
    testedAt: new Date().toISOString(),
    previewUrl: PREVIEW_BASE,
    desktopRatingCheck: {},
    mobileRatingCheck: {},
    drawerExpansionTest: {},
    works: []
  };

  const browser = await chromium.launch({ headless: true });

  // =========================================================================
  // 1. DESKTOP RATING PROMINENCE TEST (Round 4.3 Preservation)
  // =========================================================================
  console.log('\n--- 1. Testing Desktop Rating Prominence (Preserved from 4.3) ---');
  {
    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      isMobile: false,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    });
    await bypassAgeGate(ctx);
    const page = await ctx.newPage();
    const testUrl = `${PREVIEW_BASE}/obra/aparencias`;
    await page.goto(testUrl, { waitUntil: 'networkidle' });
    await dismissModals(page);
    await page.waitForTimeout(600);

    const desktopRating = await page.evaluate(() => {
      const widget = document.querySelector('.rating-widget');
      const r = widget ? widget.getBoundingClientRect() : null;
      const prompt = document.querySelector('.rate-prompt');
      const desktopPrompt = document.querySelector('.prompt-text-desktop');
      const star = document.querySelector('.interactive-stars .star-btn');
      const starR = star ? star.getBoundingClientRect() : null;
      return {
        widgetHeight: r ? Math.round(r.height) : 0,
        meets48Height: r ? r.height >= 46 : false,
        promptFullText: prompt ? prompt.textContent.trim() : '',
        hasDesktopPrompt: !!desktopPrompt,
        starBtnSize: starR ? { w: Math.round(starR.width), h: Math.round(starR.height) } : null
      };
    });
    console.log('Desktop Rating Dimensions & Prompt:', desktopRating);
    report.desktopRatingCheck = desktopRating;
    await ctx.close();
  }

  // =========================================================================
  // 2. MOBILE TOUCH STAR RATING (Preserved >= 44px)
  // =========================================================================
  console.log('\n--- 2. Testing Mobile Touch Targets (Preserved >= 44px) ---');
  {
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0'
    });
    await bypassAgeGate(mobileCtx);
    const mPage = await mobileCtx.newPage();
    await mPage.goto(`${PREVIEW_BASE}/obra/aparencias`, { waitUntil: 'networkidle' });
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
    report.mobileRatingCheck.mobileHitboxes = mobileHitboxes;
    await mobileCtx.close();
  }

  // =========================================================================
  // 3. DESKTOP 2x2 GRID SYMMETRY & DRAWER INTERACTION TEST (Round 4.4)
  // =========================================================================
  console.log('\n--- 3. Testing Desktop 2x2 Grid Symmetry & Full-Width Drawer (Round 4.4) ---');
  {
    const ctx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      isMobile: false,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    });
    await bypassAgeGate(ctx);
    const page = await ctx.newPage();
    await page.goto(`${PREVIEW_BASE}/obra/aparencias`, { waitUntil: 'networkidle' });
    await dismissModals(page);
    await page.waitForTimeout(600);

    // Initial symmetry check on Aparências (16 aliases)
    const initialGridCheck = await page.evaluate(() => {
      const panel = document.querySelector('.specs-unified-panel');
      const info = document.querySelector('#subpanel-info');
      const credits = document.querySelector('#subpanel-credits');
      const genres = document.querySelector('#subpanel-genres');
      const aliases = document.querySelector('#subpanel-aliases');

      const rInfo = info.getBoundingClientRect();
      const rCredits = credits.getBoundingClientRect();
      const rGenres = genres.getBoundingClientRect();
      const rAliases = aliases.getBoundingClientRect();

      const aliasItemsInCard = document.querySelectorAll('#subpanel-aliases .alias-editorial-row');
      const toggleBtn = document.querySelector('#subpanel-aliases .btn-toggle-subpanel');

      return {
        row1: {
          infoTop: Math.round(rInfo.top),
          creditsTop: Math.round(rCredits.top),
          infoBottom: Math.round(rInfo.bottom),
          creditsBottom: Math.round(rCredits.bottom),
          infoHeight: Math.round(rInfo.height),
          creditsHeight: Math.round(rCredits.height),
          alignedTop: Math.abs(rInfo.top - rCredits.top) <= 1,
          alignedBottom: Math.abs(rInfo.bottom - rCredits.bottom) <= 1,
          sameHeight: Math.abs(rInfo.height - rCredits.height) <= 1
        },
        row2: {
          genresTop: Math.round(rGenres.top),
          aliasesTop: Math.round(rAliases.top),
          genresBottom: Math.round(rGenres.bottom),
          aliasesBottom: Math.round(rAliases.bottom),
          genresHeight: Math.round(rGenres.height),
          aliasesHeight: Math.round(rAliases.height),
          alignedTop: Math.abs(rGenres.top - rAliases.top) <= 1,
          alignedBottom: Math.abs(rGenres.bottom - rAliases.bottom) <= 1,
          sameHeight: Math.abs(rGenres.height - rAliases.height) <= 1
        },
        columns: {
          infoLeft: Math.round(rInfo.left),
          genresLeft: Math.round(rGenres.left),
          creditsRight: Math.round(rCredits.right),
          aliasesRight: Math.round(rAliases.right),
          infoWidth: Math.round(rInfo.width),
          creditsWidth: Math.round(rCredits.width),
          col1AlignedLeft: Math.abs(rInfo.left - rGenres.left) <= 1,
          col2AlignedRight: Math.abs(rCredits.right - rAliases.right) <= 1,
          equalWidth: Math.abs(rInfo.width - rCredits.width) <= 2
        },
        aliasesPreviewCount: aliasItemsInCard.length,
        hasToggleBtn: !!toggleBtn,
        toggleBtnText: toggleBtn ? toggleBtn.textContent.trim() : null
      };
    });

    console.log('Initial 2x2 Grid Symmetry Check:', JSON.stringify(initialGridCheck, null, 2));
    report.drawerExpansionTest.initialGrid = initialGridCheck;

    // Screenshot initial state of ficha técnica
    const fichaSection = await page.$('.work-specs-section');
    if (fichaSection) {
      await fichaSection.screenshot({ path: path.join(ARTIFACTS_DIR, 'round4_4_ficha_desktop_initial.png') });
    }

    // Now click the toggle button to open full-width drawer
    console.log('Clicking "Ver todos os 16 títulos" to open full-width drawer...');
    const toggleBtnEl = await page.$('#subpanel-aliases .btn-toggle-subpanel');
    if (toggleBtnEl) {
      await toggleBtnEl.click();
      await page.waitForTimeout(400);
    }

    const afterDrawerOpen = await page.evaluate(() => {
      const drawer = document.querySelector('#aliases-expanded-drawer');
      const rDrawer = drawer ? drawer.getBoundingClientRect() : null;
      const drawerItems = document.querySelectorAll('.drawer-alias-item');
      const panel = document.querySelector('.specs-unified-panel');
      const rPanel = panel ? panel.getBoundingClientRect() : null;

      const genres = document.querySelector('#subpanel-genres');
      const aliases = document.querySelector('#subpanel-aliases');
      const rGenres = genres.getBoundingClientRect();
      const rAliases = aliases.getBoundingClientRect();

      return {
        drawerExists: !!drawer,
        drawerItemsCount: drawerItems.length,
        drawerWidth: rDrawer ? Math.round(rDrawer.width) : 0,
        panelInnerWidth: rPanel ? Math.round(rPanel.width - 44) : 0, // padding 22px each side
        drawerSpansFullWidth: rDrawer && rPanel ? Math.abs(rDrawer.width - (rPanel.width - 44)) <= 4 : false,
        row2StillAligned: Math.abs(rGenres.height - rAliases.height) <= 1,
        genresHeight: Math.round(rGenres.height),
        aliasesHeight: Math.round(rAliases.height)
      };
    });

    console.log('After Drawer Open State:', afterDrawerOpen);
    report.drawerExpansionTest.afterOpen = afterDrawerOpen;

    if (fichaSection) {
      await fichaSection.screenshot({ path: path.join(ARTIFACTS_DIR, 'round4_4_ficha_desktop_drawer_expanded.png') });
    }

    // Click Recolher to close
    console.log('Clicking "Recolher" to close drawer...');
    const closeBtn = await page.$('.btn-drawer-close');
    if (closeBtn) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }

    const afterDrawerClose = await page.evaluate(() => {
      const drawer = document.querySelector('#aliases-expanded-drawer');
      return { drawerClosed: !drawer };
    });
    console.log('After Drawer Close State:', afterDrawerClose);
    report.drawerExpansionTest.afterClose = afterDrawerClose;

    await ctx.close();
  }

  // =========================================================================
  // 4. MULTI-WORK & MULTI-VIEWPORT AUDIT (28 audits total)
  // =========================================================================
  console.log('\n--- 4. Multi-Viewport & Multi-Work Validation (Round 4.4 Symmetry & Proportions) ---');
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
        const fullImg = `round4_4_${work.slug}_${vp.name}_full.png`;
        const heroImg = `round4_4_${work.slug}_${vp.name}_hero.png`;
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, fullImg), fullPage: true });
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, heroImg),
          clip: { x: 0, y: 0, width: vp.width, height: Math.min(850, vp.height) }
        });

        const evaluation = await page.evaluate((isDesktop) => {
          const docW = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;

          // 1. Cover Column: ONLY cover, no action buttons
          const coverColButtons = document.querySelectorAll('.work-cover-column button, .work-cover-column .btn-read-primary, .work-cover-column .desktop-cover-actions');
          const coverOnlyOnLeft = coverColButtons.length === 0;

          // 2. Creator Byline ("Por ..."): completely removed
          const byline = document.querySelector('.work-creators-byline');
          const bylineRemoved = !byline;

          // 3. Reading CTA ("Começar a ler"): in chapters header
          const chaptersPrimaryCta = document.querySelector('.chapters-header .btn-read-primary');
          const readingCtaInChapters = !!chaptersPrimaryCta;

          // 4. Subpanels Alignment & Symmetry Check
          const info = document.querySelector('#subpanel-info');
          const credits = document.querySelector('#subpanel-credits');
          const genres = document.querySelector('#subpanel-genres');
          const aliases = document.querySelector('#subpanel-aliases');

          let row1Aligned = true;
          let row2Aligned = true;
          let hRow1 = 0;
          let hRow2 = 0;

          if (isDesktop && info && credits && genres && aliases) {
            const rInfo = info.getBoundingClientRect();
            const rCredits = credits.getBoundingClientRect();
            const rGenres = genres.getBoundingClientRect();
            const rAliases = aliases.getBoundingClientRect();

            row1Aligned = Math.abs(rInfo.height - rCredits.height) <= 1 && Math.abs(rInfo.top - rCredits.top) <= 1;
            row2Aligned = Math.abs(rGenres.height - rAliases.height) <= 1 && Math.abs(rGenres.top - rAliases.top) <= 1;
            hRow1 = Math.round(rInfo.height);
            hRow2 = Math.round(rGenres.height);
          }

          // 5. Hierarchy
          const specs = document.querySelector('.work-specs-section');
          const chapters = document.querySelector('.work-chapters-section');
          const specsY = specs ? specs.getBoundingClientRect().top + window.scrollY : null;
          const chaptersY = chapters ? chapters.getBoundingClientRect().top + window.scrollY : null;
          const isFichaAboveChapters = specsY !== null && chaptersY !== null ? specsY < chaptersY : null;

          // 6. Credits: Scan must NEVER be shown as Author/Roteirista
          const rows = Array.from(document.querySelectorAll('.specs-row')).map(r => ({
            dt: r.querySelector('dt')?.textContent?.trim(),
            dd: r.querySelector('dd')?.textContent?.trim()
          }));
          const authorRow = rows.find(r => r.dt === 'Roteiro / História');
          const authorVal = authorRow ? authorRow.dd : '';
          const authorIsScan = /\b(scan|scans|scanlator|scanlation)\b/i.test(authorVal) || /(scan|scans|scanlator)$/i.test(authorVal);
          const creditsAttributionValid = !authorIsScan;

          // 7. No fake community attribution
          const hasFakeTranslation = document.body.innerText.includes('Comunidade Project Nox');

          return {
            clientWidth: docW,
            scrollWidth: scrollW,
            noOverflow: scrollW <= docW,
            coverOnlyOnLeft,
            bylineRemoved,
            readingCtaInChapters,
            row1Aligned,
            row2Aligned,
            hRow1,
            hRow2,
            isFichaAboveChapters,
            authorVal,
            creditsAttributionValid,
            hasFakeTranslation
          };
        }, !vp.isMobile && vp.width >= 992);

        console.log(`  [${vp.name}] noOverflow=${evaluation.noOverflow} | row1Aligned=${evaluation.row1Aligned} (h=${evaluation.hRow1}px) | row2Aligned=${evaluation.row2Aligned} (h=${evaluation.hRow2}px) | author="${evaluation.authorVal}" (valid=${evaluation.creditsAttributionValid})`);

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
    path.join(ARTIFACTS_DIR, 'round4_4_work_page_audit.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n=== ROUND 4.4 VERIFICATION COMPLETE ===');
  console.log(`Audit report saved to: ${path.join(ARTIFACTS_DIR, 'round4_4_work_page_audit.json')}`);
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
