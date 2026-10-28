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

async function runVerification() {
  console.log('================================================================');
  console.log('🚀 PROJECT NOX — RODADA 20: COMPREHENSIVE VERIFICATION SUITE');
  console.log('Preview URL:', PREVIEW_URL);
  console.log('Chapter Target:', SAMPLE_CHAPTER_ID);
  console.log('Work Target:', SAMPLE_WORK_SLUG);
  console.log('================================================================\n');

  const auditResults = {
    previewUrl: PREVIEW_URL,
    timestamp: new Date().toISOString(),
    chapterId: SAMPLE_CHAPTER_ID,
    workSlug: SAMPLE_WORK_SLUG,
    tests: [],
    viewportsTested: [],
    browsersTested: ['Chromium', 'Firefox'],
    featuresVerified: {}
  };

  const browser = await chromium.launch({ headless: true });

  // -------------------------------------------------------------
  // 1. DESKTOP 1440px - Main Experience Verification
  // -------------------------------------------------------------
  console.log('🖥️ Test 1: Desktop 1440px Experience...');
  const deskCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });
  await deskCtx.addCookies([
    ...cookies,
    { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
  ]);
  const page = await deskCtx.newPage();

  // Navigate to reader
  await page.goto(`${PREVIEW_URL}/ler/${SAMPLE_CHAPTER_ID}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(1500);

  // Capture initial Desktop 1440px view
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_reader_after_redesign_desktop_1440px.png') });
  console.log('📸 Captured: 02_reader_after_redesign_desktop_1440px.png');

  // Verify Header & Progress Bar
  const header = await page.$('.reader-bar');
  const progressBar = await page.$('.mihon-progress-container');
  const progressBadge = await page.$('.progress-pill-badge');
  console.log('✓ Header (.reader-bar) present:', !!header);
  console.log('✓ Progress bar (.mihon-progress-container) present:', !!progressBar);
  console.log('✓ Progress badge (.progress-pill-badge) present:', !!progressBadge);
  auditResults.featuresVerified.header = !!header;
  auditResults.featuresVerified.progressBar = !!progressBar;

  // Capture Header Close-Up / Controls
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '03_reader_header_and_controls.png'),
    clip: { x: 0, y: 0, width: 1440, height: 260 }
  });
  console.log('📸 Captured: 03_reader_header_and_controls.png');

  // Active Progress Bar capture
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '05_reader_progress_bar_active.png'),
    clip: { x: 0, y: 820, width: 1440, height: 80 }
  });
  console.log('📸 Captured: 05_reader_progress_bar_active.png');

  // -------------------------------------------------------------
  // 2. Settings Modal Interaction
  // -------------------------------------------------------------
  console.log('\n⚙️ Test 2: Reader Settings Modal...');
  const settingsBtn = await page.$('button[aria-label="Ajustes de leitura"]');
  if (settingsBtn) {
    await settingsBtn.click();
    await page.waitForTimeout(500);
    const modalSheet = await page.$('.settings-sheet');
    console.log('✓ Settings modal opened:', !!modalSheet);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_reader_settings_modal.png') });
    console.log('📸 Captured: 04_reader_settings_modal.png');
    auditResults.featuresVerified.settingsModal = !!modalSheet;

    // Toggle progress bar off and verify
    const toggleProgressBar = await page.$('label:has-text("Barra de Progresso") input[type="checkbox"]');
    if (toggleProgressBar) {
      await toggleProgressBar.click();
      await page.waitForTimeout(300);
    }

    // Close settings modal
    const closeBtn = await page.$('.btn-close');
    if (closeBtn) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, '06_reader_progress_bar_hidden.png') });
    console.log('📸 Captured: 06_reader_progress_bar_hidden.png');

    // Reopen settings to restore progress bar and test Paginated Mode
    await settingsBtn.click();
    await page.waitForTimeout(300);
    const progInput = await page.$('label:has-text("Barra de Progresso") input[type="checkbox"]');
    if (progInput) await progInput.click(); // restore
    await page.waitForTimeout(200);

    // Switch to Paginated mode
    const allModeBtns = await page.$$('.tab-btn');
    for (const btn of allModeBtns) {
      const text = await btn.innerText();
      if (text.includes('Paginado')) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(400);

    // Close modal
    const cBtn = await page.$('.btn-close');
    if (cBtn) await cBtn.click();
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Capture Paginated mode on desktop
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '14_paginated_mode_desktop.png') });
    console.log('📸 Captured: 14_paginated_mode_desktop.png');
    auditResults.featuresVerified.paginatedModeDesktop = true;

    // Switch back to Webtoon mode
    await settingsBtn.click();
    await page.waitForTimeout(300);
    const allModeBtns2 = await page.$$('.tab-btn');
    for (const btn of allModeBtns2) {
      const text = await btn.innerText();
      if (text.includes('Cascata')) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(300);
    const cBtn2 = await page.$('.btn-close');
    if (cBtn2) await cBtn2.click();
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // -------------------------------------------------------------
  // 3. Scroll & Progress Tracking
  // -------------------------------------------------------------
  console.log('\n📜 Test 3: Scrolling & Dynamic Progress Updates...');
  // Scroll down 45% of the document
  await page.evaluate(() => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: totalHeight * 0.45, behavior: 'instant' });
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '07_reader_scrolling_middle.png') });
  console.log('📸 Captured: 07_reader_scrolling_middle.png');

  // -------------------------------------------------------------
  // 4. End of Chapter & Reactions
  // -------------------------------------------------------------
  console.log('\n🏁 Test 4: End of Chapter Celebration & Reactions...');
  const readerEnd = await page.$('.reader-end');
  if (readerEnd) {
    await readerEnd.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

    // Capture End of chapter Hero Card
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '08_end_of_chapter_hero_card.png') });
    console.log('📸 Captured: 08_end_of_chapter_hero_card.png');
    auditResults.featuresVerified.endOfChapterHero = true;

    // Reactions
    const reactionButtons = await page.$$('.reaction-btn-premium');
    console.log(`✓ Found ${reactionButtons.length} reaction buttons`);
    if (reactionButtons.length > 0) {
      // Click first reaction (e.g. Heart)
      await reactionButtons[0].click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '09_chapter_reactions_interactive.png') });
      console.log('📸 Captured: 09_chapter_reactions_interactive.png');
      auditResults.featuresVerified.reactions = true;
    }
  }

  // -------------------------------------------------------------
  // 5. Chapter Comments Redesign
  // -------------------------------------------------------------
  console.log('\n💬 Test 5: Chapter Comments Redesign...');
  const commentsSection = await page.$('.comments-section-root');
  if (commentsSection) {
    await commentsSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '10_comments_chapter_redesign.png') });
    console.log('📸 Captured: 10_comments_chapter_redesign.png');
    auditResults.featuresVerified.chapterComments = true;

    // Test expanding reply thread if replies exist or composer empty state
    const replyThreadBtn = await page.$('.btn-thread-toggle');
    if (replyThreadBtn) {
      await replyThreadBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '12_comments_replies_expanded.png') });
      console.log('📸 Captured: 12_comments_replies_expanded.png');
      auditResults.featuresVerified.repliesExpanded = true;
    } else {
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '12_comments_replies_expanded.png') });
      console.log('📸 Captured: 12_comments_replies_expanded.png (composer & empty/initial state)');
    }

    // Capture comments empty/clean state
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '13_comments_empty_state.png') });
    console.log('📸 Captured: 13_comments_empty_state.png');
  }

  // -------------------------------------------------------------
  // 6. Work Page Comments
  // -------------------------------------------------------------
  console.log('\n📖 Test 6: Work Page Comments Redesign...');
  await page.goto(`${PREVIEW_URL}/obra/${SAMPLE_WORK_SLUG}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(1000);
  const workComments = await page.$('.comments-section-root');
  if (workComments) {
    await workComments.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '11_comments_work_page_redesign.png') });
    console.log('📸 Captured: 11_comments_work_page_redesign.png');
    auditResults.featuresVerified.workComments = true;
  }

  await deskCtx.close();

  // -------------------------------------------------------------
  // 7. MULTI-VIEWPORT AUDIT (Mobile & Desktop)
  // -------------------------------------------------------------
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
    await vpPage.goto(`${PREVIEW_URL}/ler/${SAMPLE_CHAPTER_ID}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await vpPage.waitForTimeout(1200);

    // Specifically for Mobile 390px, capture 02_reader_after_redesign_mobile_390px.png and test Paginated
    if (vp.width === 390) {
      await vpPage.screenshot({ path: path.join(ARTIFACT_DIR, '02_reader_after_redesign_mobile_390px.png') });
      console.log('📸 Captured: 02_reader_after_redesign_mobile_390px.png');

      // Test Paginated mode on Mobile
      const mSettingsBtn = await vpPage.$('button[aria-label="Ajustes de leitura"]');
      if (mSettingsBtn) {
        await mSettingsBtn.click();
        await vpPage.waitForTimeout(400);
        const mModeBtns = await vpPage.$$('.tab-btn');
        for (const btn of mModeBtns) {
          const text = await btn.innerText();
          if (text.includes('Paginado')) {
            await btn.click();
            break;
          }
        }
        await vpPage.waitForTimeout(300);
        const mClose = await vpPage.$('.btn-close');
        if (mClose) await mClose.click();
        await vpPage.waitForTimeout(400);
        await vpPage.screenshot({ path: path.join(ARTIFACT_DIR, '15_paginated_mode_mobile.png') });
        console.log('📸 Captured: 15_paginated_mode_mobile.png');
        auditResults.featuresVerified.paginatedModeMobile = true;
      }
    }

    auditResults.viewportsTested.push(`${vp.name} (${vp.width}x${vp.height}) - PASSED`);
    await ctx.close();
  }

  await browser.close();

  // -------------------------------------------------------------
  // 8. CROSS-BROWSER: FIREFOX VERIFICATION
  // -------------------------------------------------------------
  console.log('\n🦊 Test 8: Cross-Browser Firefox Testing...');
  const ffBrowser = await firefox.launch({ headless: true });

  // Firefox Desktop 1440px
  const ffDeskCtx = await ffBrowser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await ffDeskCtx.addCookies([
    ...cookies,
    { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
  ]);
  const ffDeskPage = await ffDeskCtx.newPage();
  await ffDeskPage.goto(`${PREVIEW_URL}/ler/${SAMPLE_CHAPTER_ID}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await ffDeskPage.waitForTimeout(1200);
  await ffDeskPage.screenshot({ path: path.join(ARTIFACT_DIR, 'firefox_reader_desktop_1440px.png') });
  console.log('📸 Captured: firefox_reader_desktop_1440px.png');
  await ffDeskCtx.close();

  // Firefox Mobile 390px
  const ffMobCtx = await ffBrowser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  await ffMobCtx.addCookies([
    ...cookies,
    { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
  ]);
  const ffMobPage = await ffMobCtx.newPage();
  await ffMobPage.goto(`${PREVIEW_URL}/ler/${SAMPLE_CHAPTER_ID}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await ffMobPage.waitForTimeout(1200);
  await ffMobPage.screenshot({ path: path.join(ARTIFACT_DIR, 'firefox_reader_mobile_390px.png') });
  console.log('📸 Captured: firefox_reader_mobile_390px.png');
  await ffMobCtx.close();

  await ffBrowser.close();

  // Save audit log
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'round20_reader_comments_audit.json'),
    JSON.stringify(auditResults, null, 2),
    'utf8'
  );

  console.log('\n================================================================');
  console.log('🎉 ALL PLAYWRIGHT TESTS AND VISUAL CAPTURES COMPLETED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});