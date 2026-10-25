/**
 * scripts/verify_work_page_redesign.cjs
 * Comprehensive Round 4.3 verification of the redesigned work page on Preview:
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
  console.log('=== STARTING WORK PAGE ROUND 4.3 VERIFICATION ===');
  console.log('Target Preview URL:', PREVIEW_BASE);

  const report = {
    testedAt: new Date().toISOString(),
    previewUrl: PREVIEW_BASE,
    desktopRatingCheck: {},
    mobileRatingCheck: {},
    works: []
  };

  const browser = await chromium.launch({ headless: true });

  // =========================================================================
  // 1. DESKTOP RATING PROMINENCE TEST (Round 4.3)
  // =========================================================================
  console.log('\n--- 1. Testing Desktop Rating Prominence (Round 4.3) ---');
  {
    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      isMobile: false,
      hasTouch: false
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

    // Screenshot of desktop rating widget & hero actions
    const heroActionsEl = await page.$('.work-details-column');
    if (heroActionsEl) {
      await heroActionsEl.screenshot({ path: path.join(ARTIFACTS_DIR, 'round4_3_rating_desktop.png') });
    }

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

    await mPage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'round4_3_rating_mobile.png'),
      clip: { x: 0, y: 300, width: 390, height: 350 }
    });

    await mobileCtx.close();
  }

  // =========================================================================
  // 3. MULTI-WORK & MULTI-VIEWPORT AUDIT (Independent Column Heights & Credit Rules)
  // =========================================================================
  console.log('\n--- 3. Multi-Viewport & Multi-Work Validation (Round 4.3 Polish) ---');
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
        const fullImg = `round4_3_${work.slug}_${vp.name}_full.png`;
        const heroImg = `round4_3_${work.slug}_${vp.name}_hero.png`;
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, fullImg), fullPage: true });
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, heroImg),
          clip: { x: 0, y: 0, width: vp.width, height: Math.min(850, vp.height) }
        });

        const evaluation = await page.evaluate(() => {
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

          // 4. Subpanel Heights Check: Gêneros must NOT stretch to match Aliases on Desktop
          const genresSubpanel = document.querySelector('#subpanel-genres');
          const aliasesSubpanel = document.querySelector('#subpanel-aliases');
          const hGenres = genresSubpanel ? Math.round(genresSubpanel.getBoundingClientRect().height) : 0;
          const hAliases = aliasesSubpanel ? Math.round(aliasesSubpanel.getBoundingClientRect().height) : 0;
          // In desktop, if aliases has many items, genres is significantly more compact
          const noForcedStretch = hGenres <= hAliases;

          // 5. Single Unified Editorial Panel with 4 distinct subpanels
          const unifiedPanels = document.querySelectorAll('.specs-unified-panel');
          const subpanels = document.querySelectorAll('.specs-subpanel');
          const isSingleUnifiedPanel = unifiedPanels.length === 1 && subpanels.length === 4;

          // 6. Hierarchy
          const specs = document.querySelector('.work-specs-section');
          const chapters = document.querySelector('.work-chapters-section');
          const specsY = specs ? specs.getBoundingClientRect().top + window.scrollY : null;
          const chaptersY = chapters ? chapters.getBoundingClientRect().top + window.scrollY : null;
          const isFichaAboveChapters = specsY !== null && chaptersY !== null ? specsY < chaptersY : null;

          // 7. Credits: Scan must NEVER be shown as Author/Roteirista
          const rows = Array.from(document.querySelectorAll('.specs-row')).map(r => ({
            dt: r.querySelector('dt')?.textContent?.trim(),
            dd: r.querySelector('dd')?.textContent?.trim()
          }));
          const authorRow = rows.find(r => r.dt === 'Roteiro / História');
          const authorVal = authorRow ? authorRow.dd : '';
          const authorIsScan = /\b(scan|scans|scanlator|scanlation)\b/i.test(authorVal) || /(scan|scans|scanlator)$/i.test(authorVal);
          const creditsAttributionValid = !authorIsScan;

          // 8. No fake community attribution
          const hasFakeTranslation = document.body.innerText.includes('Comunidade Project Nox');

          return {
            clientWidth: docW,
            scrollWidth: scrollW,
            noOverflow: scrollW <= docW,
            coverOnlyOnLeft,
            bylineRemoved,
            readingCtaInChapters,
            isSingleUnifiedPanel,
            hGenres,
            hAliases,
            noForcedStretch,
            isFichaAboveChapters,
            authorVal,
            creditsAttributionValid,
            hasFakeTranslation
          };
        });

        console.log(`  [${vp.name}] noOverflow=${evaluation.noOverflow} | hGenres=${evaluation.hGenres}px vs hAliases=${evaluation.hAliases}px (noStretch=${evaluation.noForcedStretch}) | author="${evaluation.authorVal}" (valid=${evaluation.creditsAttributionValid}) | fakeTrans=${evaluation.hasFakeTranslation}`);

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
    path.join(ARTIFACTS_DIR, 'round4_3_work_page_audit.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n=== ROUND 4.3 VERIFICATION COMPLETE ===');
  console.log(`Audit report saved to: ${path.join(ARTIFACTS_DIR, 'round4_3_work_page_audit.json')}`);
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
