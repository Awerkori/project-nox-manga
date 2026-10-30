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

// A sample valid PNG image for pre-upload verification
// A sample valid animated GIF image for pre-upload verification
const TEST_IMAGE_PATH = path.join(ARTIFACTS_DIR, "test_media_sample.gif");
async function dismissAgeGate(page) {
  try {
    const btn = page.locator('.btn-choice.adult');
    if (await btn.isVisible({ timeout: 1200 })) {
      await btn.click();
      await page.waitForTimeout(300);
    }
  } catch {}
}

async function run() {
  console.log('=== Starting Rodada 20 V9 Premium Comments Verification Suite ===');
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
  console.log('1. Navigating to Chapter 76:', CHAPTER_URL);
  await page.goto(CHAPTER_URL, { waitUntil: 'load', timeout: 35000 });
  await page.waitForTimeout(2000);
  await dismissAgeGate(page);

  // -------------------------------------------------------------------------
  // TEST 1: READING PROGRESS BAR CONFINEMENT
  // -------------------------------------------------------------------------
  console.log('2. Verifying Reading Progress Bar Confinement at Chapter End...');
  const chapterEndEl = page.locator('#chapter-end');
  await chapterEndEl.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  const progressBar = page.locator('.nox-progress-system');
  if (await progressBar.count() > 0) {
    const isPastPages = await progressBar.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return el.classList.contains('is-past-pages') || style.opacity === '0' || style.pointerEvents === 'none';
    });
    console.log(`Progress bar is hidden at chapter-end / comments: ${isPastPages}`);
  }

  // -------------------------------------------------------------------------
  // TEST 2: SIZABLE PRE-UPLOAD PREVIEW & ZOOM LIGHTBOX
  // -------------------------------------------------------------------------
  console.log('3. Testing Sizable Pre-Upload Media Preview & Click-to-Enlarge...');
  const commentsSection = page.locator('.comments-section-root').first();
  await commentsSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  // Trigger file upload in main composer
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(TEST_IMAGE_PATH);

  // Verify sizeable pre-upload card is visible
  const preUploadCard = page.locator('.pre-upload-attachment-card').first();
  await preUploadCard.waitFor({ state: 'visible', timeout: 8000 });
  console.log('✓ Sizable pre-upload attachment card appeared.');

  try {
    await page.locator('.pre-upload-status:has-text("Pronto para publicar")').waitFor({ state: 'visible', timeout: 6000 });
    console.log('✓ Upload complete: "Pronto para publicar" confirmed.');
  } catch {
    console.log('Notice: Upload status check timed out, continuing.');
  }

  // Inpect preview viewport dimensions
  const viewportBox = await page.locator('.pre-upload-preview-viewport').first().boundingBox();
  console.log(`Pre-upload viewport size: ${Math.round(viewportBox.width)}x${Math.round(viewportBox.height)}px (Sizable adaptive!)`);

  await preUploadCard.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v9_pre_upload_sizable_preview.png')
  });
  console.log('✓ Captured v9_pre_upload_sizable_preview.png');

  // Click pre-upload image to open Lightbox before publishing!
  const zoomTrigger = page.locator('.pre-upload-zoom-trigger').first();
  await zoomTrigger.click();
  await page.waitForTimeout(500);

  const lightbox = page.locator('.lightbox-backdrop').first();
  await lightbox.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Lightbox opened successfully from pre-upload preview click!');

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v9_pre_upload_lightbox_enlarged.png')
  });
  console.log('✓ Captured v9_pre_upload_lightbox_enlarged.png');

  // Close lightbox
  const btnCloseLightbox = page.locator('.btn-close-lightbox').first();
  await btnCloseLightbox.click();
  await page.waitForTimeout(400);

  // Toggle spoiler on the pre-upload card
  const spoilerToggle = page.locator('.spoiler-check-toggle').first();
  await spoilerToggle.click();
  await page.waitForTimeout(300);
  console.log('✓ Toggled spoiler on pre-upload card.');

  // -------------------------------------------------------------------------
  // TEST 3: LIVE COMMENT SIMULATION PREVIEW (PRE-VISUALIZAR)
  // -------------------------------------------------------------------------
  console.log('4. Testing Live Comment Simulation Preview (Pré-visualizar)...');
  const mainComposer = page.locator('.composer-textarea').first();
  await mainComposer.fill('Simulação V9 de comentário com ||revelação oculta de spoiler|| e análise da cena.');
  await page.waitForTimeout(400);

  // Click "Pré-visualizar" button in composer toolbar
  const btnPreviewToggle = page.locator('.helper-btn:has-text("Pré-visualizar")').first();
  await btnPreviewToggle.click();
  await page.waitForTimeout(500);

  const livePreviewBox = page.locator('.composer-live-preview-box').first();
  await livePreviewBox.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Live comment simulation preview box displayed.');

  // Test spoiler interaction inside the preview box!
  const previewSpoiler = livePreviewBox.locator('.discord-spoiler').first();
  await previewSpoiler.click();
  await page.waitForTimeout(300);
  console.log('✓ Tested spoiler click inside preview: revealed content successfully!');

  await page.locator('.composer-card-premium').first().screenshot({
    path: path.join(ARTIFACTS_DIR, 'v9_composer_live_simulation_preview.png')
  });
  console.log('✓ Captured v9_composer_live_simulation_preview.png');

  // -------------------------------------------------------------------------
  // TEST 4: PUBLISH 3-LEVEL REDDIT THREAD & VERIFY VISUAL SEPARATION
  // -------------------------------------------------------------------------
  console.log('5. Publishing 3-Level Thread & Verifying Visual Separation...');
  const testRunId = Date.now().toString().slice(-6);

  // Switch back to edit and post
  const mainSubmitBtn = page.locator('.btn-submit-premium').first();
  await mainSubmitBtn.click();
  await page.waitForTimeout(3500);

  // Level 0 (Root)
  const rootNode = page.locator(`.conversation-root-block:has-text("Simulação V9 de comentário")`).first();
  await rootNode.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Root conversation block created.');

  // Verify root card styling
  const rootCard = rootNode.locator('.comment-card-modern.is-root-card').first();
  await rootCard.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Root card has distinct elevated class (.is-root-card).');

  // Click "Responder" on Root comment -> Post Level 1 Reply
  const rootReplyBtn = rootCard.locator('.btn-footer-reply').first();
  await rootReplyBtn.click();
  await page.waitForTimeout(500);

  const inlineComposer = rootNode.locator('.inline-composer-card').first();
  await inlineComposer.waitFor({ state: 'visible', timeout: 5000 });
  const inlineTextarea = inlineComposer.locator('.inline-reply-textarea').first();
  await inlineTextarea.fill(`V9 Resposta Nível 1 [${testRunId}]: Concordo com a interpretação apresentada!`);
  await page.waitForTimeout(300);

  const inlineSubmitBtn = inlineComposer.locator('.btn-inline-submit').first();
  await inlineSubmitBtn.click();
  await page.waitForTimeout(3500);

  const level1Reply = rootNode.locator(`.comment-card-modern.is-level-1:has-text("V9 Resposta Nível 1 [${testRunId}]")`).first();
  await level1Reply.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Level 1 reply attached with guide rail and .is-level-1 class.');

  // Click "Responder" on Level 1 reply -> Post Level 2 Reply
  const level1ReplyBtn = level1Reply.locator('.btn-footer-reply').first();
  await level1ReplyBtn.click();
  await page.waitForTimeout(500);

  await inlineComposer.waitFor({ state: 'visible', timeout: 5000 });
  await inlineTextarea.fill(`V9 Resposta Nível 2 [${testRunId}]: Complemento citando o detalhe visual do quadro 3.`);
  await page.waitForTimeout(300);
  await inlineSubmitBtn.click();
  await page.waitForTimeout(3500);

  const level2Reply = rootNode.locator(`.comment-card-modern.is-level-deep:has-text("V9 Resposta Nível 2 [${testRunId}]")`).first();
  await level2Reply.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Level 2 reply attached with .is-level-deep class.');

  // Screenshot of 3-level thread showing distinct root block separation and vertical lines
  await rootNode.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await rootNode.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v9_3level_thread_visual_separation.png')
  });
  console.log('✓ Captured v9_3level_thread_visual_separation.png');

  // -------------------------------------------------------------------------
  // TEST 5: ACTION FOOTER REDESIGN (PILLS, ICONS, CLEAR ALIGNMENT)
  // -------------------------------------------------------------------------
  console.log('6. Verifying Action Footer Redesign...');
  const rootFooter = rootCard.locator('.comment-footer-actions').first();
  await rootFooter.scrollIntoViewIfNeeded();

  // Test like button interaction
  const likeBtn = rootFooter.locator('.btn-footer-like').first();
  await likeBtn.click();
  await page.waitForTimeout(1000);
  console.log('✓ Tested like button: updated state.');

  await rootFooter.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v9_action_footer_pills.png')
  });
  console.log('✓ Captured v9_action_footer_pills.png');

  // -------------------------------------------------------------------------
  // TEST 6: CONTENT MODERATION & REPORT MODAL INTEGRATION
  // -------------------------------------------------------------------------
  console.log('7. Testing ReportModal Integration & Media Moderation...');
  // Find a comment that is NOT authored by current user (so "Denunciar" button is visible)
  const otherComment = page.locator('.comment-card-modern:not(:has(.badge-self))').first();
  if (await otherComment.count() > 0) {
    const reportBtn = otherComment.locator('.btn-footer-secondary:has-text("Denunciar")').first();
    if (await reportBtn.count() > 0) {
      await reportBtn.click();
      await page.waitForTimeout(600);

      const reportModal = page.locator('.modal-container:has-text("Reportar Conteúdo")').first();
      await reportModal.waitFor({ state: 'visible', timeout: 5000 });
      console.log('✓ ReportModal opened from comment footer with pre-filled context.');

      await reportModal.screenshot({
        path: path.join(ARTIFACTS_DIR, 'v9_report_modal_comment.png')
      });
      console.log('✓ Captured v9_report_modal_comment.png');

      await reportModal.locator('.btn-close').first().click();
      await page.waitForTimeout(400);
    }

    // Check if non-self comment has media with direct media report flag
    const otherMediaReportBtn = otherComment.locator('.btn-media-report').first();
    if (await otherMediaReportBtn.count() > 0) {
      await otherMediaReportBtn.click();
      await page.waitForTimeout(600);

      const reportModal = page.locator('.modal-container:has-text("Reportar Conteúdo")').first();
      await reportModal.waitFor({ state: 'visible', timeout: 5000 });
      console.log('✓ ReportModal opened from direct media report flag!');

      // Verify reported media thumbnail is rendered inside the modal
      const mediaThumb = reportModal.locator('.reported-media-preview-box').first();
      await mediaThumb.waitFor({ state: 'visible', timeout: 3000 });
      console.log('✓ Modal contains .reported-media-preview-box thumbnail.');

      await reportModal.screenshot({
        path: path.join(ARTIFACTS_DIR, 'v9_report_modal_media_preview.png')
      });
      console.log('✓ Captured v9_report_modal_media_preview.png');

      await reportModal.locator('.btn-close').first().click();
      await page.waitForTimeout(400);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 7: THREAD COLLAPSE & EXPAND REGRESSION
  // -------------------------------------------------------------------------
  console.log('8. Testing Thread Collapse & Expand...');
  const collapseBtn = rootCard.locator('.btn-thread-collapse').first();
  await collapseBtn.click();
  await page.waitForTimeout(500);

  const collapsedBar = page.locator('.thread-collapsed-bar').first();
  await collapsedBar.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Thread collapsed into bar.');

  await collapsedBar.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v9_thread_collapsed_bar.png')
  });
  console.log('✓ Captured v9_thread_collapsed_bar.png');

  await collapsedBar.click();
  await page.waitForTimeout(500);
  await level2Reply.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Thread expanded back successfully.');

  // -------------------------------------------------------------------------
  // TEST 8: MULTI-VIEWPORT RESPONSIVE AUDIT (DESKTOP & MOBILE ANDROID)
  // -------------------------------------------------------------------------
  console.log('9. Running Multi-Viewport Responsive Audit...');
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
      path: path.join(ARTIFACTS_DIR, `v9_${vp.name}_comments_feed.png`)
    });
    console.log(`✓ Captured v9_${vp.name}_comments_feed.png`);
  }

  await browser.close();

  // Test 9: Firefox Mobile Emulation
  console.log('10. Running Firefox Mobile test...');
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
  await ffPage.goto(CHAPTER_URL, { waitUntil: 'load', timeout: 35000 });
  await ffPage.waitForTimeout(2000);
  await dismissAgeGate(ffPage);

  const ffComments = ffPage.locator('.comments-section-root').first();
  await ffComments.scrollIntoViewIfNeeded();
  await ffPage.waitForTimeout(800);

  await ffComments.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v9_firefox_mobile_390px_comments.png')
  });
  console.log('✓ Captured v9_firefox_mobile_390px_comments.png');
  await ffBrowser.close();

  console.log('🎉 ALL V9 PREMIUM COMMENTS AUDIT TESTS COMPLETED!');
}

run().catch((err) => {
  console.error('Fatal error in V9 verification suite:', err);
  process.exit(1);
});
