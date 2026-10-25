/**
 * scripts/verify_work_page_redesign.cjs
 * Comprehensive Round 4.5 verification of the redesigned work page on Preview:
 * https://home-preview-manga.project-nox-awerkori.workers.dev
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PREVIEW_BASE = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

const TEST_WORKS = [
  { slug: 'aparencias', desc: '546-chapters-many-tags-long-synopsis' },
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
  console.log('=== STARTING WORK PAGE ROUND 4.5 VERIFICATION ===');
  console.log('Target Preview URL:', PREVIEW_BASE);

  const report = {
    testedAt: new Date().toISOString(),
    previewUrl: PREVIEW_BASE,
    synopsisCheck: {},
    genresDistributionCheck: {},
    gridSymmetryCheck: {},
    works: []
  };

  const browser = await chromium.launch({ headless: true });

  // =========================================================================
  // 1. SYNOPSIS CARD PROMINENCE & TYPOGRAPHY TEST (Round 4.5)
  // =========================================================================
  console.log('\n--- 1. Testing Synopsis Card Visual Prominence & Typography (Round 4.5) ---');
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

    const synopsisEval = await page.evaluate(() => {
      const card = document.querySelector('.work-synopsis-card');
      const p = document.querySelector('.synopsis-paragraph');
      const heading = document.querySelector('.synopsis-heading');
      const icon = document.querySelector('.synopsis-header-icon');
      const btn = document.querySelector('.btn-expand-synopsis');

      const cardStyle = card ? window.getComputedStyle(card) : null;
      const pStyle = p ? window.getComputedStyle(p) : null;
      const rCard = card ? card.getBoundingClientRect() : null;

      return {
        hasCard: !!card,
        cardHeight: rCard ? Math.round(rCard.height) : 0,
        backgroundColor: cardStyle ? cardStyle.backgroundColor : null,
        borderColor: cardStyle ? cardStyle.borderColor : null,
        borderRadius: cardStyle ? cardStyle.borderRadius : null,
        fontSizePx: pStyle ? parseFloat(pStyle.fontSize) : 0,
        lineHeight: pStyle ? pStyle.lineHeight : null,
        color: pStyle ? pStyle.color : null,
        hasHeading: !!heading,
        hasIcon: !!icon,
        hasExpandBtn: !!btn,
        isClampedInitial: p ? p.classList.contains('clamped') : false
      };
    });

    console.log('Desktop Synopsis Card Metrics:', synopsisEval);
    report.synopsisCheck.desktop = synopsisEval;

    // Screenshot of the synopsis card
    const synopsisCardEl = await page.$('.work-synopsis-card');
    if (synopsisCardEl) {
      await synopsisCardEl.screenshot({ path: path.join(ARTIFACTS_DIR, 'round4_5_synopsis_desktop.png') });
    }

    // Test expand synopsis
    if (synopsisEval.hasExpandBtn) {
      console.log('Testing Synopsis Expand/Collapse...');
      const expandBtn = await page.$('.btn-expand-synopsis');
      await expandBtn.click();
      await page.waitForTimeout(300);

      const afterExpand = await page.evaluate(() => {
        const p = document.querySelector('.synopsis-paragraph');
        const btn = document.querySelector('.btn-expand-synopsis');
        return {
          isClamped: p ? p.classList.contains('clamped') : true,
          btnText: btn ? btn.textContent.trim() : null
        };
      });
      console.log('Synopsis After Expand:', afterExpand);
      report.synopsisCheck.afterExpand = afterExpand;

      // Click to collapse again
      await expandBtn.click();
      await page.waitForTimeout(200);
    }

    await ctx.close();
  }

  // =========================================================================
  // 2. MOBILE SYNOPSIS PROMINENCE TEST
  // =========================================================================
  console.log('\n--- 2. Testing Mobile Synopsis Presentation (390x844) ---');
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

    const mSynopsisEval = await pageEvaluateSynopsis(mPage);
    console.log('Mobile Synopsis Metrics:', mSynopsisEval);
    report.synopsisCheck.mobile = mSynopsisEval;

    const mSynopsisCardEl = await mPage.$('.work-synopsis-card');
    if (mSynopsisCardEl) {
      await mSynopsisCardEl.screenshot({ path: path.join(ARTIFACTS_DIR, 'round4_5_synopsis_mobile.png') });
    }

    await mobileCtx.close();
  }

  // =========================================================================
  // 3. GENRES & TEMAS TAGS DISTRIBUTION TEST (Round 4.5)
  // =========================================================================
  console.log('\n--- 3. Testing Genres & Temas Tags Distribution (Round 4.5) ---');
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

    const genresDistribution = await page.evaluate(() => {
      const genresCard = document.querySelector('#subpanel-genres');
      const tagsWrap = document.querySelector('.editorial-tags-wrap');
      const pills = Array.from(document.querySelectorAll('.editorial-tag-pill'));
      const aliasesCard = document.querySelector('#subpanel-aliases');

      const rCard = genresCard ? genresCard.getBoundingClientRect() : null;
      const rAliases = aliasesCard ? aliasesCard.getBoundingClientRect() : null;
      const rWrap = tagsWrap ? tagsWrap.getBoundingClientRect() : null;

      // Calculate row groups by comparing pill top coordinates
      const rowTops = [...new Set(pills.map(p => Math.round(p.getBoundingClientRect().top)))];
      const rowsCount = rowTops.length;

      // Distance from bottom of last pill to bottom of card
      let bottomSpace = 0;
      if (pills.length > 0 && rCard) {
        const lastPill = pills[pills.length - 1];
        bottomSpace = Math.round(rCard.bottom - lastPill.getBoundingClientRect().bottom);
      }

      return {
        cardHeight: rCard ? Math.round(rCard.height) : 0,
        aliasesCardHeight: rAliases ? Math.round(rAliases.height) : 0,
        heightDifferenceWithAliases: rCard && rAliases ? Math.abs(Math.round(rCard.height - rAliases.height)) : 0,
        tagsCount: pills.length,
        rowsCount,
        bottomPaddingAndSpace: bottomSpace,
        wrapHeight: rWrap ? Math.round(rWrap.height) : 0
      };
    });

    console.log('Genres Distribution in Card 3:', genresDistribution);
    report.genresDistributionCheck = genresDistribution;

    // Screenshot of the 2x2 Ficha Técnica showing the balanced tags
    const fichaSection = await page.$('.work-specs-section');
    if (fichaSection) {
      await fichaSection.screenshot({ path: path.join(ARTIFACTS_DIR, 'round4_5_ficha_desktop.png') });
    }

    await ctx.close();
  }

  // =========================================================================
  // 4. MULTI-WORK & MULTI-VIEWPORT AUDIT (28 audits total)
  // =========================================================================
  console.log('\n--- 4. Multi-Viewport & Multi-Work Validation (Round 4.5) ---');
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
        const fullImg = `round4_5_${work.slug}_${vp.name}_full.png`;
        const heroImg = `round4_5_${work.slug}_${vp.name}_hero.png`;
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, fullImg), fullPage: true });
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, heroImg),
          clip: { x: 0, y: 0, width: vp.width, height: Math.min(850, vp.height) }
        });

        const evaluation = await page.evaluate((isDesktop) => {
          const docW = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;

          // Synopsis
          const synopsisCard = document.querySelector('.work-synopsis-card');
          const p = document.querySelector('.synopsis-paragraph');
          const pStyle = p ? window.getComputedStyle(p) : null;
          const synopsisFontSize = pStyle ? parseFloat(pStyle.fontSize) : 0;

          // Ficha 2x2
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

          // Credits check
          const rows = Array.from(document.querySelectorAll('.specs-row')).map(r => ({
            dt: r.querySelector('dt')?.textContent?.trim(),
            dd: r.querySelector('dd')?.textContent?.trim()
          }));
          const authorRow = rows.find(r => r.dt === 'Roteiro / História');
          const authorVal = authorRow ? authorRow.dd : '';
          const authorIsScan = /\b(scan|scans|scanlator|scanlation)\b/i.test(authorVal) || /(scan|scans|scanlator)$/i.test(authorVal);
          const creditsAttributionValid = !authorIsScan;

          return {
            clientWidth: docW,
            scrollWidth: scrollW,
            noOverflow: scrollW <= docW,
            hasSynopsisCard: !!synopsisCard,
            synopsisFontSize,
            row1Aligned,
            row2Aligned,
            hRow1,
            hRow2,
            authorVal,
            creditsAttributionValid
          };
        }, !vp.isMobile && vp.width >= 992);

        console.log(`  [${vp.name}] noOverflow=${evaluation.noOverflow} | synopsisCard=${evaluation.hasSynopsisCard} (font=${evaluation.synopsisFontSize}px) | row1Aligned=${evaluation.row1Aligned} (h=${evaluation.hRow1}px) | row2Aligned=${evaluation.row2Aligned} (h=${evaluation.hRow2}px) | author="${evaluation.authorVal}"`);

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
    path.join(ARTIFACTS_DIR, 'round4_5_work_page_audit.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n=== ROUND 4.5 VERIFICATION COMPLETE ===');
  console.log(`Audit report saved to: ${path.join(ARTIFACTS_DIR, 'round4_5_work_page_audit.json')}`);
}

async function pageEvaluateSynopsis(page) {
  return await page.evaluate(() => {
    const card = document.querySelector('.work-synopsis-card');
    const p = document.querySelector('.synopsis-paragraph');
    const pStyle = p ? window.getComputedStyle(p) : null;
    const rCard = card ? card.getBoundingClientRect() : null;

    return {
      hasCard: !!card,
      cardHeight: rCard ? Math.round(rCard.height) : 0,
      fontSizePx: pStyle ? parseFloat(pStyle.fontSize) : 0,
      lineHeight: pStyle ? pStyle.lineHeight : null,
      color: pStyle ? pStyle.color : null
    };
  });
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
