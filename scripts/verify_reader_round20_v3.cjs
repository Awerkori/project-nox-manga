const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev/ler/b88c0c5f-9664-5fae-a6d9-d5ad03af1369';

const COOKIE_PREVIEW = {
  name: 'nox-age-status',
  value: 'ADULT',
  domain: 'home-preview-manga.project-nox-awerkori.workers.dev',
  path: '/'
};

async function dismissAgeGateIfPresent(p) {
  try {
    const ageGate = p.locator('.age-gate-backdrop');
    if (await ageGate.isVisible({ timeout: 1500 })) {
      const btn1 = p.locator('.btn-choice.adult');
      if (await btn1.isVisible()) {
        await btn1.click();
        await p.waitForTimeout(300);
      }
      const btn2 = p.locator('.btn-choice.adult');
      if (await btn2.isVisible()) {
        await btn2.click();
        await p.waitForTimeout(400);
      }
    }
  } catch {
    // Ignore if not present
  }
}

async function run() {
  console.log('🚀 Starting Project Nox Reader Round 20 Playwright Verification...');
  const browser = await chromium.launch({ headless: true });
  const results = {
    checks: {},
    screenshots: []
  };

  try {
    // ------------------------------------------------------------------------
    // 1. MOBILE 390px TEST (Android Galaxy / iPhone standard)
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Testing Mobile 390px (Clean session) ---');
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
    });
    await mobileCtx.addCookies([COOKIE_PREVIEW]);
    const page = await mobileCtx.newPage();
    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await dismissAgeGateIfPresent(page);

    // Check 1: Progress Bar disabled by default
    const progressBarCount = await page.locator('.nox-progress-system').count();
    results.checks.progressBarDisabledByDefault = (progressBarCount === 0);
    console.log(`[CHECK] Progress bar count on fresh load: ${progressBarCount} (Expected: 0) -> ${progressBarCount === 0 ? 'PASS ✅' : 'FAIL ❌'}`);

    // Check 2: Chapter Title has NO "pt-BR"
    const headerChapterText = await page.locator('.header-chapter-badge').innerText();
    const hasPtBrInHeader = headerChapterText.includes('pt-BR');
    results.checks.noPtBrInHeader = !hasPtBrInHeader;
    console.log(`[CHECK] Header chapter badge: "${headerChapterText}" (Contains pt-BR: ${hasPtBrInHeader}) -> ${!hasPtBrInHeader ? 'PASS ✅' : 'FAIL ❌'}`);

    // Screenshot 1: Mobile Reading Canvas (Top)
    const ss1 = path.join(ARTIFACTS_DIR, '01_mobile_390px_reader_top.png');
    await page.screenshot({ path: ss1, fullPage: false });
    results.screenshots.push('01_mobile_390px_reader_top.png');
    console.log(`[SCREENSHOT] Saved ${ss1}`);

    // Scroll to end of chapter
    console.log('\n--- Scrolling to End of Chapter ---');
    await page.locator('#chapter-end').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    // Check 3: Compact End of Chapter Elements
    const conclusionBadge = await page.locator('.conclusion-badge').innerText();
    const hasPtBrInConclusion = conclusionBadge.includes('pt-BR');
    results.checks.noPtBrInConclusion = !hasPtBrInConclusion;
    console.log(`[CHECK] Conclusion badge: "${conclusionBadge}" (Contains pt-BR: ${hasPtBrInConclusion}) -> ${!hasPtBrInConclusion ? 'PASS ✅' : 'FAIL ❌'}`);

    const hasNextBtn = await page.locator('.btn-primary-next').isVisible();
    results.checks.hasNextButton = hasNextBtn;
    console.log(`[CHECK] Next chapter CTA button visible: ${hasNextBtn} -> ${hasNextBtn ? 'PASS ✅' : 'FAIL ❌'}`);

    // Check 4: Report Problem Card preserved
    const hasReportCard = await page.locator('.report-problem-card').isVisible();
    results.checks.reportProblemCardVisible = hasReportCard;
    console.log(`[CHECK] Report problem card visible: ${hasReportCard} -> ${hasReportCard ? 'PASS ✅' : 'FAIL ❌'}`);

    // Check 5: Reactions Capsules (balanced, 5 items)
    const reactionCapsulesCount = await page.locator('.reaction-capsule').count();
    results.checks.reactionCapsulesCount = reactionCapsulesCount;
    console.log(`[CHECK] Reaction capsules count: ${reactionCapsulesCount} (Expected: 5) -> ${reactionCapsulesCount === 5 ? 'PASS ✅' : 'FAIL ❌'}`);

    // Screenshot 2: Mobile End of Chapter (Compact)
    const ss2 = path.join(ARTIFACTS_DIR, '02_mobile_390px_compact_end_of_chapter.png');
    await page.screenshot({ path: ss2, fullPage: false });
    results.screenshots.push('02_mobile_390px_compact_end_of_chapter.png');
    console.log(`[SCREENSHOT] Saved ${ss2}`);

    // Test Reaction interaction
    console.log('\n--- Testing Reaction Click ---');
    const firstCapsule = page.locator('.reaction-capsule').first();
    await firstCapsule.click();
    await page.waitForTimeout(400);

    const ss3 = path.join(ARTIFACTS_DIR, '03_mobile_390px_reaction_clicked.png');
    await page.screenshot({ path: ss3, fullPage: false });
    results.screenshots.push('03_mobile_390px_reaction_clicked.png');
    console.log(`[SCREENSHOT] Saved ${ss3}`);

    // Scroll further down to Comments
    console.log('\n--- Scrolling to Comments ---');
    await page.locator('.comments-section-root').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const ss4 = path.join(ARTIFACTS_DIR, '04_mobile_390px_comments.png');
    await page.screenshot({ path: ss4, fullPage: false });
    results.screenshots.push('04_mobile_390px_comments.png');
    console.log(`[SCREENSHOT] Saved ${ss4}`);

    // Scroll back to top & test Settings Modal
    console.log('\n--- Testing Settings Modal (Quick & Advanced) ---');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);

    // Open settings
    await page.locator('.btn-settings').click();
    await page.waitForSelector('.settings-sheet', { state: 'visible' });

    const ss5 = path.join(ARTIFACTS_DIR, '05_mobile_390px_settings_quick.png');
    await page.screenshot({ path: ss5, fullPage: false });
    results.screenshots.push('05_mobile_390px_settings_quick.png');
    console.log(`[SCREENSHOT] Saved ${ss5}`);

    // Switch to Advanced settings
    await page.locator('.view-switch-btn:has-text("Configurações Avançadas")').click();
    await page.waitForTimeout(300);

    const ss6 = path.join(ARTIFACTS_DIR, '06_mobile_390px_settings_advanced.png');
    await page.screenshot({ path: ss6, fullPage: false });
    results.screenshots.push('06_mobile_390px_settings_advanced.png');
    console.log(`[SCREENSHOT] Saved ${ss6}`);

    // Switch back to Quick and test activating progress bar (Inferior)
    await page.locator('.view-switch-btn:has-text("Ajustes Rápidos")').click();
    await page.waitForTimeout(200);
    await page.locator('.progress-pill-btn:has-text("Inferior")').click();
    await page.waitForTimeout(300);

    // Close settings
    await page.locator('.btn-close-sheet').click();
    await page.waitForTimeout(300);

    const bottomBarCount = await page.locator('.nox-progress-system.pos-bottom').count();
    console.log(`[CHECK] Progress bar active (bottom): ${bottomBarCount} -> ${bottomBarCount > 0 ? 'PASS ✅' : 'FAIL ❌'}`);
    results.checks.progressBarBottomActivated = (bottomBarCount > 0);

    const ss7 = path.join(ARTIFACTS_DIR, '07_mobile_390px_progressbar_bottom.png');
    await page.screenshot({ path: ss7, fullPage: false });
    results.screenshots.push('07_mobile_390px_progressbar_bottom.png');
    console.log(`[SCREENSHOT] Saved ${ss7}`);

    // Test XP Toast Appearance
    console.log('\n--- Testing XP Reward Toast Dispatch ---');
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('nox-xp-awarded', {
          detail: {
            amount: 150,
            title: 'Capítulo 76 concluído!',
            kind: 'CHAPTER_COMPLETION'
          }
        })
      );
    });
    await page.waitForSelector('.xp-toast-card', { state: 'visible', timeout: 5000 });
    const xpText = await page.locator('.xp-toast-card').innerText();
    console.log(`[CHECK] XP Toast displayed text: "${xpText.replace(/\n/g, ' ')}" -> PASS ✅`);
    results.checks.xpToastAppeared = true;

    const ss8 = path.join(ARTIFACTS_DIR, '08_mobile_390px_xp_toast_visible.png');
    await page.screenshot({ path: ss8, fullPage: false });
    results.screenshots.push('08_mobile_390px_xp_toast_visible.png');
    console.log(`[SCREENSHOT] Saved ${ss8}`);

    await mobileCtx.close();

    // ------------------------------------------------------------------------
    // 2. VIEWPORT RESPONSIVENESS MATRIX (320px, 360px, 430px)
    // ------------------------------------------------------------------------
    for (const w of [320, 360, 430]) {
      console.log(`\n--- Testing Mobile Viewport: ${w}px ---`);
      const ctx = await browser.newContext({ viewport: { width: w, height: 750 } });
      await ctx.addCookies([COOKIE_PREVIEW]);
      const p = await ctx.newPage();
      await p.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await dismissAgeGateIfPresent(p);
      await p.locator('#chapter-end').scrollIntoViewIfNeeded();
      await p.waitForTimeout(400);

      const ssFile = `mobile_${w}px_end_of_chapter.png`;
      const ssPath = path.join(ARTIFACTS_DIR, ssFile);
      await p.screenshot({ path: ssPath, fullPage: false });
      results.screenshots.push(ssFile);
      console.log(`[SCREENSHOT] Saved ${ssPath}`);
      await ctx.close();
    }

    // ------------------------------------------------------------------------
    // 3. DESKTOP VIEWPORTS (1280px, 1440px, 1920px)
    // ------------------------------------------------------------------------
    for (const w of [1280, 1440, 1920]) {
      console.log(`\n--- Testing Desktop Viewport: ${w}px ---`);
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      await ctx.addCookies([COOKIE_PREVIEW]);
      const p = await ctx.newPage();
      await p.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await dismissAgeGateIfPresent(p);

      // Screenshot desktop canvas top
      const ssTopFile = `desktop_${w}px_reader_top.png`;
      await p.screenshot({ path: path.join(ARTIFACTS_DIR, ssTopFile), fullPage: false });
      results.screenshots.push(ssTopFile);

      // Scroll to end of chapter
      await p.locator('#chapter-end').scrollIntoViewIfNeeded();
      await p.waitForTimeout(400);

      const ssEndFile = `desktop_${w}px_end_of_chapter.png`;
      await p.screenshot({ path: path.join(ARTIFACTS_DIR, ssEndFile), fullPage: false });
      results.screenshots.push(ssEndFile);
      console.log(`[SCREENSHOT] Saved ${ssTopFile} and ${ssEndFile}`);
      await ctx.close();
    }

    // Write audit results
    const auditFile = path.join(ARTIFACTS_DIR, 'reader_round20_v3_audit.json');
    fs.writeFileSync(auditFile, JSON.stringify(results, null, 2));
    console.log(`\n✅ Audit completed successfully! Saved results to ${auditFile}`);

  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
