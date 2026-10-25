const { chromium, firefox } = require('playwright');
const path = require('path');
const fs = require('fs');

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

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
      await page.waitForTimeout(600);
    }
  } catch (e) {}
}

async function run() {
  console.log('=== STARTING ROUND 6.2 COMPREHENSIVE VALIDATION ===');
  console.log('Target Preview URL:', PREVIEW_URL);

  const report = {
    alignment: {},
    flipAnimation: {},
    mobile: {},
    firefox: {},
    videoPath: null
  };

  // =========================================================================
  // 1. DESKTOP WITH REAL VIDEO RECORDING (1440x900)
  // =========================================================================
  console.log('\n--- 1. Desktop Recording & Real Page Turn with Physical Curvature ---');
  const desktopBrowser = await chromium.launch({ headless: true });
  const desktopCtx = await desktopBrowser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: ARTIFACTS_DIR,
      size: { width: 1440, height: 900 }
    }
  });
  await bypassAgeGate(desktopCtx);
  const desktopPage = await desktopCtx.newPage();

  console.log('Navigating to preview...');
  await desktopPage.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 35000 });
  await dismissModals(desktopPage);
  await desktopPage.waitForTimeout(2000); // Allow StPageFlip to initialize

  // Check StPageFlip presence & alignment
  const bookSection = await desktopPage.$('.nox-book-section');
  const bookShell = await desktopPage.$('.nox-book-shell-wrap');
  const homeContent = await desktopPage.$('.home-content');

  const sectionRect = bookSection ? await bookSection.boundingBox() : null;
  const shellRect = bookShell ? await bookShell.boundingBox() : null;
  const homeRect = homeContent ? await homeContent.boundingBox() : null;

  report.alignment = {
    bookSectionWidth: sectionRect ? sectionRect.width : 0,
    bookShellWidth: shellRect ? shellRect.width : 0,
    homeContentWidth: homeRect ? homeRect.width : 0,
    alignedWithinMargins: shellRect && homeRect ? Math.abs(shellRect.width - (homeRect.width - 64)) < 40 : false
  };

  console.log('Alignment Measurements:', report.alignment);

  // Capture Full Spread Rest Screenshot
  await desktopPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'preview_round6_2_desktop_rest.png'),
    fullPage: false
  });

  // Capture Full Page to prove alignment with Novas Obras / Mais Lidos
  await desktopPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'preview_round6_2_fullpage_alignment.png'),
    fullPage: true
  });

  // =========================================================================
  // 2. MULTI-FRAME FLIP CAPTURE (Frame-by-frame physical curl evidence)
  // =========================================================================
  console.log('\n--- 2. Capturing Multi-Frame True Page Curl Sequence ---');

  // Frame 1: Resting on Work 1
  await desktopPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round6_2_curl_frame1_rest.png'),
    clip: { x: sectionRect.x, y: sectionRect.y, width: sectionRect.width, height: sectionRect.height + 40 }
  });

  // Trigger flipNext
  console.log('Triggering page flip...');
  const nextBtn = await desktopPage.$('.book-nav-btn.next-btn');
  if (nextBtn) {
    await nextBtn.click();
  }

  // Frame 2: Initial corner peeling
  await desktopPage.waitForTimeout(160);
  await desktopPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round6_2_curl_frame2_peel.png'),
    clip: { x: sectionRect.x, y: sectionRect.y, width: sectionRect.width, height: sectionRect.height + 40 }
  });

  // Frame 3: Apex folding & convex curvature
  await desktopPage.waitForTimeout(200);
  await desktopPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round6_2_curl_frame3_apex.png'),
    clip: { x: sectionRect.x, y: sectionRect.y, width: sectionRect.width, height: sectionRect.height + 40 }
  });

  // Frame 4: Descending curl revealing verso
  await desktopPage.waitForTimeout(220);
  await desktopPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round6_2_curl_frame4_descend.png'),
    clip: { x: sectionRect.x, y: sectionRect.y, width: sectionRect.width, height: sectionRect.height + 40 }
  });

  // Frame 5: Fully settled on Work 2
  await desktopPage.waitForTimeout(400);
  await desktopPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round6_2_curl_frame5_settled.png'),
    clip: { x: sectionRect.x, y: sectionRect.y, width: sectionRect.width, height: sectionRect.height + 40 }
  });

  // Let video record one more flip for clear viewer satisfaction
  await desktopPage.waitForTimeout(1500);
  if (nextBtn) {
    await nextBtn.click();
    await desktopPage.waitForTimeout(1200);
  }

  // Get recorded video path before closing
  const video = desktopPage.video();
  const rawVideoPath = video ? await video.path() : null;

  await desktopCtx.close();
  await desktopBrowser.close();

  if (rawVideoPath && fs.existsSync(rawVideoPath)) {
    const finalVideoPath = path.join(ARTIFACTS_DIR, 'round6_2_page_flip_authentic.webm');
    fs.copyFileSync(rawVideoPath, finalVideoPath);
    report.videoPath = finalVideoPath;
    console.log('Video saved to artifact directory:', finalVideoPath);
  }

  // =========================================================================
  // 3. MOBILE VIEWPORT VERIFICATION (Pixel 5 - 393x851)
  // =========================================================================
  console.log('\n--- 3. Mobile Viewport Verification ---');
  const mobileBrowser = await chromium.launch({ headless: true });
  const mobileCtx = await mobileBrowser.newContext({
    viewport: { width: 393, height: 851 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
  });
  await bypassAgeGate(mobileCtx);
  const mobilePage = await mobileCtx.newPage();

  await mobilePage.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 35000 });
  await dismissModals(mobilePage);
  await mobilePage.waitForTimeout(1200);

  const mobileStage = await mobilePage.$('.mobile-stage');
  const mobileCard = await mobilePage.$('.mobile-card');
  const mobileCover = await mobilePage.$('.mobile-cover-image');
  const mobileTitle = await mobilePage.$('.mobile-title a');

  const cardRect = mobileCard ? await mobileCard.boundingBox() : null;
  const coverRect = mobileCover ? await mobileCover.boundingBox() : null;
  const mobileTitleText = mobileTitle ? (await mobileTitle.textContent()).trim() : '';

  report.mobile = {
    stageVisible: !!mobileStage,
    cardVisible: !!mobileCard,
    cardRect,
    coverRect,
    title: mobileTitleText
  };

  console.log('Mobile verification report:', report.mobile);

  await mobilePage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'preview_round6_2_mobile.png'),
    fullPage: false
  });

  await mobileCtx.close();
  await mobileBrowser.close();

  // =========================================================================
  // 4. FIREFOX GECKO DESKTOP VERIFICATION
  // =========================================================================
  console.log('\n--- 4. Firefox Gecko Desktop Verification ---');
  const ffBrowser = await firefox.launch({ headless: true });
  const ffCtx = await ffBrowser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await bypassAgeGate(ffCtx);
  const ffPage = await ffCtx.newPage();

  await ffPage.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 35000 });
  await dismissModals(ffPage);
  await ffPage.waitForTimeout(2000);

  const ffBookShell = await ffPage.$('.nox-book-shell-wrap');
  report.firefox = {
    bookVisible: !!ffBookShell,
    shellRect: ffBookShell ? await ffBookShell.boundingBox() : null
  };
  console.log('Firefox verification report:', report.firefox);

  await ffPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'preview_round6_2_firefox.png'),
    fullPage: false
  });

  await ffCtx.close();
  await ffBrowser.close();

  console.log('\n=== ROUND 6.2 VALIDATION COMPLETE ===');
  console.log('Final Summary:', JSON.stringify(report, null, 2));
}

run().catch(err => {
  console.error('Validation failure:', err);
  process.exit(1);
});
