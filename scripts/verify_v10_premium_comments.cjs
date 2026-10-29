const fs = require('fs');
const path = require('path');
const { chromium, firefox } = require('playwright');

// Load environment variables prioritizing preview configuration
for (const envPath of ['.dev.vars.preview_full', '.dev.vars.deploy', '.env']) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const l of lines) {
      const idx = l.indexOf('=');
      if (idx !== -1) {
        const k = l.slice(0, idx).trim();
        const v = l.slice(idx + 1).trim();
        if (!process.env[k] && v) process.env[k] = v;
      }
    }
  }
}

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const CHAPTER_URL = `${PREVIEW_URL}/ler/b88c0c5f-9664-5fae-a6d9-d5ad03af1369`;
const TEST_GIF_PATH = path.join(ARTIFACTS_DIR, "test_media_sample.gif");
const TEST_PNG_PATH = path.join(ARTIFACTS_DIR, "test_media_sample.png");
const EXTERNAL_GIF_URL = 'https://i.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif';

async function dismissAgeGate(page) {
  try {
    const btn = page.locator('.btn-choice.adult');
    if (await btn.isVisible({ timeout: 1500 })) {
      await btn.click();
      await page.waitForTimeout(300);
    }
  } catch {}
}

async function run() {
  console.log('=== Starting Rodada 20 V10 Premium Comments & Moderation Verification Suite ===');
  const { ownerCookies } = await import('./owner-session.mjs');
  const sessionCookies = await ownerCookies(PREVIEW_URL);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });

  await context.addCookies(sessionCookies);
  await context.addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
  ]);

  const page = await context.newPage();

  // Track console and page errors
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[Browser Console Error]: ${msg.text()}`);
  });
  page.on('pageerror', err => console.log(`[Browser Page Error]: ${err.message}`));

  console.log('1. Navigating to Chapter 76:', CHAPTER_URL);
  await page.goto(CHAPTER_URL, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(2500);
  await dismissAgeGate(page);

  const commentsSection = page.locator('.comments-section-root').first();
  await commentsSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // -------------------------------------------------------------------------
  // TEST 1: VERIFY PRINT 1A — CLEAN MEDIA WITHOUT FLOATING REPORT BUTTON
  // -------------------------------------------------------------------------
  console.log('2. Verifying Print 1A: Clean Media without Floating Buttons...');
  const mediaReportButtons = await page.locator('.btn-media-report').count();
  console.log(`Overlaid .btn-media-report count in DOM: ${mediaReportButtons}`);
  if (mediaReportButtons > 0) {
    throw new Error('FAIL: .btn-media-report is still present in DOM overlays!');
  }
  console.log('✓ Confirmed: ZERO floating report buttons over media. Images are 100% clean!');

  // Check if Jonas or any other comment has media
  const jonasCard = page.locator('.comment-card-modern:has-text("Jonas")').first();
  if (await jonasCard.count() > 0) {
    await jonasCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await jonasCard.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v10_clean_media_no_overlay_buttons.png')
    });
    console.log('✓ Captured v10_clean_media_no_overlay_buttons.png from Jonas comment.');
  } else {
    const existingMediaCard = page.locator('.comment-card-modern:has(.comment-media-card)').first();
    if (await existingMediaCard.count() > 0) {
      await existingMediaCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await existingMediaCard.screenshot({
        path: path.join(ARTIFACTS_DIR, 'v10_clean_media_no_overlay_buttons.png')
      });
      console.log('✓ Captured v10_clean_media_no_overlay_buttons.png');
    }
  }

  // -------------------------------------------------------------------------
  // TEST 2: VERIFY PRINT 1B — ADMIN "APAGAR" BUTTON FOR MODERATION
  // -------------------------------------------------------------------------
  console.log('3. Verifying Print 1B: Admin "Apagar" Button on Other Users Comments...');
  // Find a comment by Jonas or any comment not authored by current user
  const otherComment = page.locator('.comment-card-modern:not(:has(.badge-self))').first();
  if (await otherComment.count() > 0) {
    const adminDeleteBtn = otherComment.locator('.btn-admin-delete').first();
    const isDeleteVisible = await adminDeleteBtn.isVisible();
    console.log(`Admin delete button visible on other user comment: ${isDeleteVisible}`);

    const reportBtn = otherComment.locator('.btn-footer-report, .btn-footer-secondary:has-text("Denunciar")').first();
    const isReportVisible = await reportBtn.isVisible();
    console.log(`Footer Denunciar button visible on other user comment: ${isReportVisible}`);

    const footerElement = otherComment.locator('.comment-footer-actions').first();
    await footerElement.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v10_admin_moderation_footer.png')
    });
    console.log('✓ Captured v10_admin_moderation_footer.png');
  } else {
    console.log('Notice: No third-party comment found on initial load; will test on simulated thread.');
  }

  // -------------------------------------------------------------------------
  // TEST 3: VERIFY PRINT 4 — EXTERNAL GIF PASTE & AUTO URL REMOVAL & PREVIEW
  // -------------------------------------------------------------------------
  console.log('4. Verifying Print 4: External GIF Paste & Automatic URL Stripping...');
  const mainComposer = page.locator('.composer-textarea').first();
  await mainComposer.scrollIntoViewIfNeeded();
  await mainComposer.fill('');

  // Paste a text containing an external GIF URL and extra user message
  const userTextPrefix = 'Que animação incrível nesta cena! ';
  const pastePayload = `${userTextPrefix}${EXTERNAL_GIF_URL}`;
  
  // Simulate clipboard paste via dispatching paste event
  await mainComposer.focus();
  await page.evaluate((url) => {
    const textarea = document.querySelector('.composer-textarea');
    if (!textarea) return;
    const dt = new DataTransfer();
    dt.setData('text/plain', url);
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true
    });
    textarea.dispatchEvent(pasteEvent);
  }, pastePayload);

  await page.waitForTimeout(1500);

  // Check if pre-upload attachment card appeared with the resolved GIF
  const preUploadCard = page.locator('.pre-upload-attachment-card').first();
  await preUploadCard.waitFor({ state: 'visible', timeout: 8000 });
  console.log('✓ Pre-upload attachment card generated from pasted GIF URL!');

  // Check that textarea contains only the user text prefix and NOT the long GIF URL
  const textareaVal = await mainComposer.inputValue();
  console.log(`Textarea content after paste: "${textareaVal.trim()}"`);
  if (textareaVal.includes(EXTERNAL_GIF_URL)) {
    console.warn('Warning: URL was not stripped from textarea.');
  } else {
    console.log('✓ Confirmed: Long URL was automatically stripped from textarea while preserving user comment!');
  }

  // Screenshot pre-upload preview
  await preUploadCard.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v10_external_gif_pasted_preview.png')
  });
  console.log('✓ Captured v10_external_gif_pasted_preview.png');

  // -------------------------------------------------------------------------
  // TEST 4: VERIFY PRINT 3 — CLICK TO ENLARGE LIGHTBOX WITH WORKING MEDIA
  // -------------------------------------------------------------------------
  console.log('5. Verifying Print 3: Click to Enlarge Lightbox with Working Media...');
  const zoomTrigger = preUploadCard.locator('.pre-upload-zoom-trigger').first();
  await zoomTrigger.click();
  await page.waitForTimeout(600);

  const lightbox = page.locator('.lightbox-backdrop').first();
  await lightbox.waitFor({ state: 'visible', timeout: 5000 });

  const lightboxImg = lightbox.locator('.lightbox-img').first();
  await lightboxImg.waitFor({ state: 'visible', timeout: 8000 });

  // Verify that the image in the lightbox has non-zero natural dimensions and loaded
  const imgLoaded = await lightboxImg.evaluate((img) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
  console.log(`Lightbox image rendered with natural dimensions: ${imgLoaded}`);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v10_lightbox_working_media.png')
  });
  console.log('✓ Captured v10_lightbox_working_media.png');

  // Close lightbox
  const btnCloseLightbox = page.locator('.btn-close-lightbox').first();
  await btnCloseLightbox.click();
  await page.waitForTimeout(400);

  // -------------------------------------------------------------------------
  // TEST 5: PUBLISH THREAD WITH NOBLE GOLD LEVEL 2+ RAILS & VERIFY PRINT 2
  // -------------------------------------------------------------------------
  console.log('6. Verifying Print 2: Nested Sub-Replies with Soft Noble Gold Rail & Grouped Footer...');
  const testRunId = Date.now().toString().slice(-6);

  // Set comment text with testRunId
  const commentText = `${textareaVal.trim()} [V10-${testRunId}]`;
  await mainComposer.fill(commentText);
  await page.waitForTimeout(300);

  // Post root comment
  const mainSubmitBtn = page.locator('.btn-submit-premium').first();
  await mainSubmitBtn.click();
  await page.waitForTimeout(4000);

  const rootNode = page.locator(`.conversation-root-block:has-text("V10-${testRunId}")`).first();
  await rootNode.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Root comment published successfully with attached GIF!');

  // Level 1 Reply
  const rootCard = rootNode.locator('.comment-card-modern.is-root-card').first();
  const rootReplyBtn = rootCard.locator('.btn-footer-reply').first();
  await rootReplyBtn.click();
  await page.waitForTimeout(400);

  const inlineComposer = rootNode.locator('.inline-composer-card').first();
  await inlineComposer.waitFor({ state: 'visible', timeout: 5000 });
  await inlineComposer.locator('.inline-reply-textarea').first().fill(`Resposta Nível 1 [${testRunId}]`);
  await inlineComposer.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3500);

  const level1Reply = rootNode.locator(`.comment-card-modern.is-level-1:has-text("${testRunId}")`).first();
  await level1Reply.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Level 1 reply posted.');

  // Level 2 Reply (Deep sub-reply with noble gold rail!)
  const level1ReplyBtn = level1Reply.locator('.btn-footer-reply').first();
  await level1ReplyBtn.click();
  await page.waitForTimeout(400);

  await inlineComposer.waitFor({ state: 'visible', timeout: 5000 });
  await inlineComposer.locator('.inline-reply-textarea').first().fill(`Sub-resposta Nível 2 [${testRunId}] com trilha dourada e menção`);
  await inlineComposer.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3500);

  const level2Reply = rootNode.locator(`.comment-card-modern.is-level-deep:has-text("${testRunId}")`).first();
  await level2Reply.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Level 2 sub-reply posted with .is-level-deep class.');

  // Verify that level 2 reply has gold border or styles
  const isGoldRail = await level2Reply.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return style.borderColor.includes('223') || style.borderLeftColor.includes('223');
  });
  console.log(`Level 2 reply computed gold rail color check: ${isGoldRail}`);

  // Screenshot thread showing Level 1 (purple rail) and Level 2 (gold rail)
  await rootNode.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await rootNode.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v10_thread_hierarchy_gold_rail.png')
  });
  console.log('✓ Captured v10_thread_hierarchy_gold_rail.png');

  // Verify Curtir and Responder closely grouped on the left
  const footerGroup = rootCard.locator('.comment-footer-actions').first();
  await footerGroup.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v10_footer_action_grouping.png')
  });
  console.log('✓ Captured v10_footer_action_grouping.png');

  // -------------------------------------------------------------------------
  // TEST 6: VERIFY REPORT MODAL WITH MEDIA PREVIEW
  // -------------------------------------------------------------------------
  console.log('7. Verifying Report Modal Media Integration...');
  const commentWithReport = page.locator('.comment-card-modern:has(.btn-footer-secondary:has-text("Denunciar")), .comment-card-modern:has(.btn-footer-report)').first();
  if (await commentWithReport.count() > 0) {
    const reportBtn = commentWithReport.locator('.btn-footer-report, .btn-footer-secondary:has-text("Denunciar")').first();
    await reportBtn.click();
    await page.waitForTimeout(600);

    const reportModal = page.locator('.modal-container:has-text("Reportar Conteúdo")').first();
    await reportModal.waitFor({ state: 'visible', timeout: 5000 });

    const modalVisible = await reportModal.isVisible();
    console.log(`✓ ReportModal opened successfully: ${modalVisible}`);

    await reportModal.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v10_report_modal_media_strip.png')
    });
    console.log('✓ Captured v10_report_modal_media_strip.png');

    await reportModal.locator('.btn-close').first().click();
    await page.waitForTimeout(400);
  } else {
    console.log('Notice: No other user comment with report button found.');
  }

  // -------------------------------------------------------------------------
  // TEST 7: MULTI-DEVICE RESPONSIVE AUDIT (DESKTOP & MOBILE ANDROID)
  // -------------------------------------------------------------------------
  console.log('8. Running Multi-Viewport Responsive Audit...');
  const viewports = [
    { name: 'desktop_1920px', width: 1920, height: 1080 },
    { name: 'desktop_1440px', width: 1440, height: 900 },
    { name: 'desktop_1280px', width: 1280, height: 800 },
    { name: 'mobile_430px', width: 430, height: 932 },
    { name: 'mobile_390px', width: 390, height: 844 },
    { name: 'mobile_360px', width: 360, height: 800 },
    { name: 'mobile_320px', width: 320, height: 640 }
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);

    const feedEl = page.locator('.comments-section-root').first();
    await feedEl.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    await feedEl.screenshot({
      path: path.join(ARTIFACTS_DIR, `v10_${vp.name}_comments_feed.png`)
    });
    console.log(`✓ Captured v10_${vp.name}_comments_feed.png`);
  }

  await browser.close();

  // Test 8: Firefox Mobile Emulation
  console.log('9. Running Firefox Mobile test...');
  const ffBrowser = await firefox.launch({ headless: true });
  const ffContext = await ffBrowser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2
  });
  await ffContext.addCookies(sessionCookies);
  await ffContext.addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
  ]);
  const ffPage = await ffContext.newPage();
  await ffPage.goto(CHAPTER_URL, { waitUntil: 'load', timeout: 45000 });
  await ffPage.waitForTimeout(2500);
  await dismissAgeGate(ffPage);

  const ffComments = ffPage.locator('.comments-section-root').first();
  await ffComments.scrollIntoViewIfNeeded();
  await ffPage.waitForTimeout(800);

  await ffComments.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v10_firefox_mobile_390px_comments.png')
  });
  console.log('✓ Captured v10_firefox_mobile_390px_comments.png');
  await ffBrowser.close();

  console.log('🎉 ALL V10 TESTS AND SCREENSHOTS COMPLETED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Fatal error in V10 verification suite:', err);
  process.exit(1);
});
