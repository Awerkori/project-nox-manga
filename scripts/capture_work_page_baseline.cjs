/**
 * scripts/capture_work_page_baseline.cjs
 * Captures comprehensive visual baselines of the CURRENT work page in production
 * across Desktop (1920x1080, 1366x768), Tablet (768x1024), and Mobile (360x800, 390x844, 412x915).
 */

const { chromium, firefox } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROD_BASE = 'https://manga.project-nox-awerkori.workers.dev';
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
        domain: 'manga.project-nox-awerkori.workers.dev',
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
  console.log('=== CAPTURING BASELINE SCREENSHOTS OF CURRENT WORK PAGE ===');

  const browser = await chromium.launch({ headless: true });
  const auditReport = {
    capturedAt: new Date().toISOString(),
    works: []
  };

  for (const work of TEST_WORKS) {
    const workUrl = `${PROD_BASE}/obra/${work.slug}`;
    console.log(`\nAuditing Work: ${work.slug} (${work.desc}) -> ${workUrl}`);
    const workAudit = {
      slug: work.slug,
      desc: work.desc,
      url: workUrl,
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
        const resp = await page.goto(workUrl, { waitUntil: 'networkidle', timeout: 35000 });
        await dismissModals(page);
        await page.waitForTimeout(800);

        // Capture full page
        const fullImgName = `baseline_${work.slug}_${vp.name}_full.png`;
        const fullImgPath = path.join(ARTIFACTS_DIR, fullImgName);
        await page.screenshot({ path: fullImgPath, fullPage: true });

        // Capture Hero / Presentation area (top section)
        const heroImgName = `baseline_${work.slug}_${vp.name}_hero.png`;
        const heroImgPath = path.join(ARTIFACTS_DIR, heroImgName);
        await page.screenshot({
          path: heroImgPath,
          clip: { x: 0, y: 0, width: vp.width, height: Math.min(850, vp.height) }
        });

        // Collect visual element metrics
        const metrics = await page.evaluate(() => {
          const docW = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;
          const hero = document.querySelector('.work-hero');
          const heroRect = hero ? hero.getBoundingClientRect() : null;
          const cover = document.querySelector('.work-cover-frame, .work-cover-image');
          const coverRect = cover ? cover.getBoundingClientRect() : null;
          const title = document.querySelector('#work-title, h1');
          const titleRect = title ? title.getBoundingClientRect() : null;
          const chapterRows = document.querySelectorAll('.chapter-row');
          const firstRow = chapterRows[0] ? chapterRows[0].getBoundingClientRect() : null;
          const actionButtons = Array.from(document.querySelectorAll('.work-primary-actions button, .work-primary-actions a, .read-work-button')).map(b => ({
            text: b.textContent.trim(),
            w: Math.round(b.getBoundingClientRect().width),
            h: Math.round(b.getBoundingClientRect().height)
          }));

          return {
            clientWidth: docW,
            scrollWidth: scrollW,
            hasHorizontalOverflow: scrollW > docW,
            hero: heroRect ? { width: Math.round(heroRect.width), height: Math.round(heroRect.height) } : null,
            cover: coverRect ? { width: Math.round(coverRect.width), height: Math.round(coverRect.height) } : null,
            title: titleRect ? { width: Math.round(titleRect.width), height: Math.round(titleRect.height), text: title?.textContent?.trim() } : null,
            totalChaptersInDOM: chapterRows.length,
            firstChapterRowHeight: firstRow ? Math.round(firstRow.height) : 0,
            actionButtons
          };
        });

        console.log(`  [${vp.name}] status=${resp.status()} noOverflow=${!metrics.hasHorizontalOverflow} cover=${metrics.cover?.width}x${metrics.cover?.height} title="${metrics.title?.text?.substring(0, 20)}..."`);
        workAudit.viewports[vp.name] = {
          fullImg: fullImgName,
          heroImg: heroImgName,
          metrics
        };
      } catch (err) {
        console.error(`  Error capturing ${work.slug} on ${vp.name}:`, err.message);
      } finally {
        await ctx.close();
      }
    }

    auditReport.works.push(workAudit);
  }

  await browser.close();

  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'baseline_work_page_audit.json'),
    JSON.stringify(auditReport, null, 2)
  );

  console.log('\n=== BASELINE CAPTURE COMPLETED ===');
  console.log(`Saved audit report to: ${path.join(ARTIFACTS_DIR, 'baseline_work_page_audit.json')}`);
}

run().catch(err => {
  console.error('Baseline capture failed:', err);
  process.exit(1);
});
