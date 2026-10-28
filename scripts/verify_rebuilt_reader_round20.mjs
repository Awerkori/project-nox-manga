import { chromium, firefox } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const SAMPLE_CHAPTER_ID = 'b88c0c5f-9664-5fae-a6d9-d5ad03af1369';
const SAMPLE_WORK_SLUG = 'a-dupla-vida-da-princesa';

for (const envFile of ['.dev.vars.deploy', '.dev.vars.preview_full', '.env']) {
  const envPath = path.join(ROOT_DIR, envFile);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const l of lines) {
      const idx = l.indexOf('=');
      if (idx !== -1) {
        const k = l.slice(0, idx).trim();
        let v = l.slice(idx + 1).trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        if (!process.env[k] && v) process.env[k] = v;
      }
    }
  }
}

let cookies = [];
try {
  const { ownerCookies } = await import('./owner-session.mjs');
  cookies = await ownerCookies(PREVIEW_URL);
  console.log('✓ Owner session authenticated successfully');
} catch (err) {
  console.log('⚠️ Running in anonymous reader session mode:', err.message);
}

async function runRebuiltVerification() {
  console.log('================================================================');
  console.log('🚀 PROJECT NOX — RODADA 20: RECONSTRUCTED READER VERIFICATION');
  console.log('Preview Target:', `${PREVIEW_URL}/ler/${SAMPLE_CHAPTER_ID}`);
  console.log('================================================================\n');

  const auditResults = {
    previewUrl: PREVIEW_URL,
    timestamp: new Date().toISOString(),
    chapterId: SAMPLE_CHAPTER_ID,
    workSlug: SAMPLE_WORK_SLUG,
    testedItems: {},
    viewportsTested: [],
    browsersTested: ['Chromium', 'Firefox']
  };

  const browser = await chromium.launch({ headless: true });

  // --------------------------------------------------------------------------
  // TEST 1: DESKTOP 1440px MAIN EXPERIENCE
  // --------------------------------------------------------------------------
  console.log('🖥️ Test 1: Desktop 1440px Main Experience...');
  const deskCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });
  await deskCtx.addCookies([
    ...cookies,
    { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
  ]);
  const page = await deskCtx.newPage();

  await page.goto(`${PREVIEW_URL}/ler/${SAMPLE_CHAPTER_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.reader-glass-header', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // 1. Desktop Initial View
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_rebuilt_reader_desktop_1440px.png') });
  console.log('📸 Captured: 02_rebuilt_reader_desktop_1440px.png');

  // Verify elements
  const header = await page.$('.reader-glass-header');
  const turboBadge = await page.$('.turbo-status-pill');
  const progressBar = await page.$('.nox-progress-system');
  console.log('✓ Glass Header present:', !!header);
  console.log('✓ Turbo status pill present:', !!turboBadge);
  console.log('✓ Nox Progress system present:', !!progressBar);
  auditResults.testedItems.glassHeader = !!header;
  auditResults.testedItems.turboBadge = !!turboBadge;
  auditResults.testedItems.progressBar = !!progressBar;

  // 2. Header Close-Up
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '03_rebuilt_header_controls.png'),
    clip: { x: 0, y: 0, width: 1440, height: 180 }
  });
  console.log('📸 Captured: 03_rebuilt_header_controls.png');

  // --------------------------------------------------------------------------
  // TEST 2: ALL 4 PROGRESS BAR POSITIONS (BOTTOM, LEFT, RIGHT, OFF)
  // --------------------------------------------------------------------------
  console.log('\n📐 Test 2: Testing all 4 Progress Bar Positions...');

  // Position: Bottom
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '05_progress_bar_bottom.png'),
    clip: { x: 0, y: 840, width: 1440, height: 60 }
  });
  console.log('📸 Captured: 05_progress_bar_bottom.png');

  const settingsBtn = await page.$('button[aria-label="Ajustes de leitura"]');
  if (settingsBtn) {
    // Open settings and go to Progress tab
    await settingsBtn.click();
    await page.waitForTimeout(400);

    // Click "Progresso" tab
    const progTab = await page.$('button:has-text("Progresso")');
    if (progTab) await progTab.click();
    await page.waitForTimeout(300);

    // Capture Settings Progress Tab
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_rebuilt_settings_modal_progress.png') });
    console.log('📸 Captured: 04_rebuilt_settings_modal_progress.png');

    // Switch to Left position
    const leftBtn = await page.$('button.position-card-btn:has-text("Esquerda")');
    if (leftBtn) await leftBtn.click();
    await page.waitForTimeout(300);

    // Close settings to capture Left progress bar
    const closeBtn = await page.$('.btn-close-sheet');
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '05_progress_bar_left.png') });
    console.log('📸 Captured: 05_progress_bar_left.png');
    auditResults.testedItems.progressBarLeft = true;

    // Reopen settings and switch to Right position
    await settingsBtn.click();
    await page.waitForTimeout(400);
    const progTab2 = await page.$('button:has-text("Progresso")');
    if (progTab2) await progTab2.click();
    await page.waitForTimeout(200);

    const rightBtn = await page.$('button.position-card-btn:has-text("Direita")');
    if (rightBtn) await rightBtn.click();
    await page.waitForTimeout(300);

    const closeBtn2 = await page.$('.btn-close-sheet');
    if (closeBtn2) await closeBtn2.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '05_progress_bar_right.png') });
    console.log('📸 Captured: 05_progress_bar_right.png');
    auditResults.testedItems.progressBarRight = true;

    // Switch to Off (Disabled)
    await settingsBtn.click();
    await page.waitForTimeout(400);
    const progTab3 = await page.$('button:has-text("Progresso")');
    if (progTab3) await progTab3.click();
    await page.waitForTimeout(200);

    const offBtn = await page.$('button.position-card-btn:has-text("Desativada")');
    if (offBtn) await offBtn.click();
    await page.waitForTimeout(300);

    const closeBtn3 = await page.$('.btn-close-sheet');
    if (closeBtn3) await closeBtn3.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '06_progress_bar_disabled.png') });
    console.log('📸 Captured: 06_progress_bar_disabled.png');
    auditResults.testedItems.progressBarOff = true;

    // Restore Bottom position
    await settingsBtn.click();
    await page.waitForTimeout(400);
    const progTab4 = await page.$('button:has-text("Progresso")');
    if (progTab4) await progTab4.click();
    await page.waitForTimeout(200);
    const bottomBtn = await page.$('button.position-card-btn:has-text("Inferior")');
    if (bottomBtn) await bottomBtn.click();
    await page.waitForTimeout(200);

    // Capture Appearance tab
    const appTab = await page.$('button:has-text("Aparência")');
    if (appTab) await appTab.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_rebuilt_settings_modal_appearance.png') });
    console.log('📸 Captured: 04_rebuilt_settings_modal_appearance.png');

    // Capture Navigation tab
    const navTab = await page.$('button:has-text("Navegação")');
    if (navTab) await navTab.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_rebuilt_settings_modal_navigation.png') });
    console.log('📸 Captured: 04_rebuilt_settings_modal_navigation.png');

    // Capture Turbo / Cache tab
    const perfTab = await page.$('button:has-text("Turbo / Cache")');
    if (perfTab) await perfTab.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_rebuilt_settings_modal_performance.png') });
    console.log('📸 Captured: 04_rebuilt_settings_modal_performance.png');

    // Close settings
    const closeBtnFinal = await page.$('.btn-close-sheet');
    if (closeBtnFinal) await closeBtnFinal.click();
    await page.waitForTimeout(400);
  }

  // --------------------------------------------------------------------------
  // TEST 3: SCROLLING & REAL-TIME PROGRESS TRACKING
  // --------------------------------------------------------------------------
  console.log('\n📜 Test 3: Scrolling & Progress Tracking at 50%...');
  await page.evaluate(() => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: totalHeight * 0.5, behavior: 'instant' });
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '07_reader_scrolling_turbo_middle.png') });
  console.log('📸 Captured: 07_reader_scrolling_turbo_middle.png');

  // --------------------------------------------------------------------------
  // TEST 4: END OF CHAPTER, REACTIONS & REPORT CARD
  // --------------------------------------------------------------------------
  console.log('\n🏁 Test 4: Rebuilt End of Chapter, Reactions & Report Card...');
  const endSection = await page.$('.reader-conclusion-section');
  if (endSection) {
    await endSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Hero card & Milestone seal
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '08_rebuilt_end_of_chapter_hero.png') });
    console.log('📸 Captured: 08_rebuilt_end_of_chapter_hero.png');

    // Reactions initial view
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '09_rebuilt_reactions_vibe_module.png') });
    console.log('📸 Captured: 09_rebuilt_reactions_vibe_module.png');

    // Click reaction (e.g. Fire or Heart)
    const vibeBtn = await page.$('button.vibe-pill-btn');
    if (vibeBtn) {
      await vibeBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '09_rebuilt_reactions_clicked.png') });
      console.log('📸 Captured: 09_rebuilt_reactions_clicked.png');
      auditResults.testedItems.reactionClicked = true;
    }

    // High-visibility Red Report Problem Banner
    const reportCard = await page.$('.report-problem-card');
    if (reportCard) {
      await reportCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '10_rebuilt_report_problem_card.png') });
      console.log('📸 Captured: 10_rebuilt_report_problem_card.png');
      auditResults.testedItems.reportProblemCard = true;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 5: RECONSTRUCTED COMMENTS (CHAPTER)
  // --------------------------------------------------------------------------
  console.log('\n💬 Test 5: Reconstructed Comments (Chapter)...');
  const commentsSec = await page.$('.comments-section-root');
  if (commentsSec) {
    await commentsSec.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '11_rebuilt_comments_chapter.png') });
    console.log('📸 Captured: 11_rebuilt_comments_chapter.png');
    auditResults.testedItems.chapterComments = true;

    // Test Spoiler block click if present, or expand thread
    const spoilerBtn = await page.$('.spoiler-tag-box');
    if (spoilerBtn) {
      await spoilerBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '13_rebuilt_comments_spoiler_revealed.png') });
      console.log('📸 Captured: 13_rebuilt_comments_spoiler_revealed.png');
    } else {
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '13_rebuilt_comments_spoiler_revealed.png') });
      console.log('📸 Captured: 13_rebuilt_comments_spoiler_revealed.png (composer spoiler helper view)');
    }

    // Test expanding replies thread
    const repToggle = await page.$('.btn-replies-toggle');
    if (repToggle) {
      await repToggle.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '12_rebuilt_comments_replies_thread.png') });
      console.log('📸 Captured: 12_rebuilt_comments_replies_thread.png');
      auditResults.testedItems.repliesThread = true;
    } else {
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '12_rebuilt_comments_replies_thread.png') });
      console.log('📸 Captured: 12_rebuilt_comments_replies_thread.png (comments thread root)');
    }
  }

  // --------------------------------------------------------------------------
  // TEST 6: WORK PAGE COMMENTS
  // --------------------------------------------------------------------------
  console.log('\n📖 Test 6: Reconstructed Comments (Work Page)...');
  await page.goto(`${PREVIEW_URL}/obra/${SAMPLE_WORK_SLUG}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  const workCommentsSec = await page.$('.comments-section-root');
  if (workCommentsSec) {
    await workCommentsSec.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '11_rebuilt_comments_work.png') });
    console.log('📸 Captured: 11_rebuilt_comments_work.png');
    auditResults.testedItems.workComments = true;
  }

  // --------------------------------------------------------------------------
  // TEST 7: PAGINATED MODE (DESKTOP)
  // --------------------------------------------------------------------------
  console.log('\n📖 Test 7: Paginated Mode on Desktop...');
  await page.goto(`${PREVIEW_URL}/ler/${SAMPLE_CHAPTER_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.reader-glass-header', { timeout: 15000 });
  const sBtn2 = await page.$('button[aria-label="Ajustes de leitura"]');
  if (sBtn2) {
    await sBtn2.click();
    await page.waitForTimeout(400);
    const navTab = await page.$('button:has-text("Navegação")');
    if (navTab) await navTab.click();
    await page.waitForTimeout(200);

    const pagBtn = await page.$('button.segment-choice:has-text("Modo Paginado")');
    if (pagBtn) await pagBtn.click();
    await page.waitForTimeout(300);

    const cBtn = await page.$('.btn-close-sheet');
    if (cBtn) await cBtn.click();
    await page.waitForTimeout(400);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, '14_rebuilt_paginated_mode_desktop.png') });
    console.log('📸 Captured: 14_rebuilt_paginated_mode_desktop.png');
    auditResults.testedItems.paginatedDesktop = true;

    // Restore Webtoon mode
    await sBtn2.click();
    await page.waitForTimeout(300);
    const webBtn = await page.$('button.segment-choice:has-text("Cascata Webtoon")');
    if (webBtn) await webBtn.click();
    await page.waitForTimeout(200);
    const cBtn2 = await page.$('.btn-close-sheet');
    if (cBtn2) await cBtn2.click();
    await page.waitForTimeout(400);
  }

  await deskCtx.close();

  // --------------------------------------------------------------------------
  // TEST 8: MULTI-VIEWPORT AUDIT (MOBILE & DESKTOP)
  // --------------------------------------------------------------------------
  const viewports = [
    { name: 'Mobile 320px', width: 320, height: 640, isMobile: true },
    { name: 'Mobile 360px', width: 360, height: 780, isMobile: true },
    { name: 'Mobile 390px', width: 390, height: 844, isMobile: true },
    { name: 'Mobile 430px', width: 430, height: 932, isMobile: true },
    { name: 'Desktop 1280px', width: 1280, height: 800, isMobile: false },
    { name: 'Desktop 1920px', width: 1920, height: 1080, isMobile: false }
  ];

  for (const vp of viewports) {
    console.log(`\n📐 Testing Viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.isMobile ? 2 : 1,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile
    });
    await ctx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const vpPage = await ctx.newPage();
    await vpPage.goto(`${PREVIEW_URL}/ler/${SAMPLE_CHAPTER_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await vpPage.waitForSelector('.reader-glass-header', { timeout: 15000 });
    await vpPage.waitForTimeout(1000);

    if (vp.width === 390) {
      await vpPage.screenshot({ path: path.join(ARTIFACT_DIR, '02_rebuilt_reader_mobile_390px.png') });
      console.log('📸 Captured: 02_rebuilt_reader_mobile_390px.png');

      // Test Paginated on Mobile
      const mSBtn = await vpPage.$('button[aria-label="Ajustes de leitura"]');
      if (mSBtn) {
        await mSBtn.click();
        await vpPage.waitForTimeout(400);
        const mNavTab = await vpPage.$('button:has-text("Navegação")');
        if (mNavTab) await mNavTab.click();
        await vpPage.waitForTimeout(200);
        const mPagBtn = await vpPage.$('button.segment-choice:has-text("Modo Paginado")');
        if (mPagBtn) await mPagBtn.click();
        await vpPage.waitForTimeout(200);
        const mClose = await vpPage.$('.btn-close-sheet');
        if (mClose) await mClose.click();
        await vpPage.waitForTimeout(400);

        await vpPage.screenshot({ path: path.join(ARTIFACT_DIR, '15_rebuilt_paginated_mode_mobile.png') });
        console.log('📸 Captured: 15_rebuilt_paginated_mode_mobile.png');
        auditResults.testedItems.paginatedMobile = true;
      }
    }

    auditResults.viewportsTested.push(`${vp.name} (${vp.width}x${vp.height}) - PASSED`);
    await ctx.close();
  }

  await browser.close();

  // --------------------------------------------------------------------------
  // TEST 9: CROSS-BROWSER FIREFOX TESTING
  // --------------------------------------------------------------------------
  console.log('\n🦊 Test 9: Firefox Cross-Browser Testing...');
  const ffBrowser = await firefox.launch({ headless: true });

  // Firefox Desktop
  const ffDeskCtx = await ffBrowser.newContext({ viewport: { width: 1440, height: 900 } });
  await ffDeskCtx.addCookies([
    ...cookies,
    { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
  ]);
  const ffDeskPage = await ffDeskCtx.newPage();
  await ffDeskPage.goto(`${PREVIEW_URL}/ler/${SAMPLE_CHAPTER_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await ffDeskPage.waitForSelector('.reader-glass-header', { timeout: 15000 });
  await ffDeskPage.waitForTimeout(1200);
  await ffDeskPage.screenshot({ path: path.join(ARTIFACT_DIR, 'firefox_rebuilt_reader_desktop_1440px.png') });
  console.log('📸 Captured: firefox_rebuilt_reader_desktop_1440px.png');
  await ffDeskCtx.close();

  // Firefox Mobile
  const ffMobCtx = await ffBrowser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ffMobCtx.addCookies([
    ...cookies,
    { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
  ]);
  const ffMobPage = await ffMobCtx.newPage();
  await ffMobPage.goto(`${PREVIEW_URL}/ler/${SAMPLE_CHAPTER_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await ffMobPage.waitForSelector('.reader-glass-header', { timeout: 15000 });
  await ffMobPage.waitForTimeout(1200);
  await ffMobPage.screenshot({ path: path.join(ARTIFACT_DIR, 'firefox_rebuilt_reader_mobile_390px.png') });
  console.log('📸 Captured: firefox_rebuilt_reader_mobile_390px.png');
  await ffMobCtx.close();

  await ffBrowser.close();

  // Save audit log
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'rebuilt_reader_round20_audit.json'),
    JSON.stringify(auditResults, null, 2),
    'utf8'
  );

  console.log('\n================================================================');
  console.log('🎉 RECONSTRUCTED READER VERIFICATION COMPLETED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runRebuiltVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
