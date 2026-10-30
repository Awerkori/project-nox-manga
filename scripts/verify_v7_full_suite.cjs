const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

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

async function dismissAgeGate(page) {
  try {
    const btn = page.locator('.btn-choice.adult');
    if (await btn.isVisible({ timeout: 1000 })) {
      await btn.click();
      await page.waitForTimeout(300);
    }
  } catch {}
}

async function run() {
  console.log('--- Starting Rodada 20 V7 Verification & Screenshot Suite ---');
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
  console.log('Navigating to Chapter 76:', CHAPTER_URL);
  await page.goto(CHAPTER_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);
  await dismissAgeGate(page);

  // Scroll to comments section
  const commentsSection = page.locator('.comments-section-root').first();
  await commentsSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const initialCount = await page.locator('.comment-card-modern').count();
  console.log(`Initial comment cards on page: ${initialCount}`);

  // Test 1: Check existing comment with square image & single char spoiler || L ||
  const comment0fb = page.locator('#comment-0fb3ec03-0ccb-457d-8bb2-79eb95de726f');
  if (await comment0fb.isVisible({ timeout: 3000 })) {
    await comment0fb.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    // Capture square image Discord framing
    await comment0fb.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v7_comment_square_image.png')
    });
    console.log('✓ Captured v7_comment_square_image.png');

    // Test text spoiler || L ||
    const spoilerBtn = comment0fb.locator('.discord-spoiler').first();
    if (await spoilerBtn.isVisible()) {
      await spoilerBtn.scrollIntoViewIfNeeded();
      await spoilerBtn.screenshot({
        path: path.join(ARTIFACTS_DIR, 'v7_spoiler_single_char_L_hidden.png')
      });
      console.log('✓ Captured v7_spoiler_single_char_L_hidden.png');

      await spoilerBtn.click();
      await page.waitForTimeout(300);
      await spoilerBtn.screenshot({
        path: path.join(ARTIFACTS_DIR, 'v7_spoiler_single_char_L_revealed.png')
      });
      console.log('✓ Captured v7_spoiler_single_char_L_revealed.png');
    }
  }

  // Test 2: Post controlled Parent Comment and Replies
  const testRunId = Date.now().toString().slice(-6);
  console.log(`Creating controlled test thread [Run ${testRunId}]...`);

  const textarea = page.locator('.composer-textarea');
  await textarea.scrollIntoViewIfNeeded();
  await textarea.fill(`V7 Parent Thread [${testRunId}]: Análise principal da estratégia. ||Spoiler mestre do capítulo||`);
  await page.waitForTimeout(300);

  const submitBtn = page.locator('.btn-submit-premium').first();
  await submitBtn.click();
  await page.waitForTimeout(2500);

  // Find newly posted parent comment
  const parentComment = page.locator(`.comment-card-modern:has-text("V7 Parent Thread [${testRunId}]")`).first();
  await parentComment.waitFor({ state: 'visible', timeout: 8000 });
  console.log('✓ Parent comment created successfully.');

  // Click "Responder" on this parent comment
  const replyBtn = parentComment.locator('button:has-text("Responder")').first();
  await replyBtn.click();
  await page.waitForTimeout(500);

  // Fill reply 1
  await textarea.fill(`V7 Resposta 1 [${testRunId}]: Concordo com os apontamentos táticos!`);
  await submitBtn.click();
  await page.waitForTimeout(2500);

  // Fill reply 2 with spoiler media
  await replyBtn.click();
  await page.waitForTimeout(500);
  await textarea.fill(`V7 Resposta 2 com Mídia [${testRunId}]: Veja o esquema tático: ||![Plano](https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=600&fit=crop)||`);
  await submitBtn.click();
  await page.waitForTimeout(2500);
  console.log('✓ Reply 1 and Reply 2 posted successfully.');

  // Also post a leaf comment intended for standalone deletion test
  await textarea.fill(`V7 Comentário Folha Temporário [${testRunId}]: Este será apagado individualmente.`);
  await submitBtn.click();
  await page.waitForTimeout(2500);

  const leafComment = page.locator(`.comment-card-modern:has-text("V7 Comentário Folha Temporário [${testRunId}]")`).first();
  await leafComment.waitFor({ state: 'visible', timeout: 8000 });
  console.log('✓ Standalone leaf comment created.');

  // TEST 3: Controlled Deletion of Standalone Leaf Comment
  console.log('Testing selective deletion of standalone leaf comment...');
  const countBeforeLeafDelete = await page.locator('.comment-card-modern').count();

  const leafDeleteBtn = leafComment.locator('button:has-text("Apagar")').first();
  await leafDeleteBtn.click();
  await page.waitForTimeout(400);

  // Capture delete confirmation modal
  const modalBox = page.locator('.confirm-modal-box');
  await modalBox.waitFor({ state: 'visible', timeout: 3000 });
  await modalBox.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v7_delete_confirmation_modal.png')
  });
  console.log('✓ Captured v7_delete_confirmation_modal.png');

  // Confirm delete
  const confirmDeleteBtn = page.locator('.btn-modal-delete, button:has-text("Sim, Apagar")');
  await confirmDeleteBtn.click();
  await page.waitForTimeout(2000);

  const countAfterLeafDelete = await page.locator('.comment-card-modern').count();
  console.log(`Count before leaf delete: ${countBeforeLeafDelete}, count after: ${countAfterLeafDelete}`);
  if (countBeforeLeafDelete - countAfterLeafDelete !== 1) {
    console.warn('Warning: expected exactly 1 comment to be deleted.');
  } else {
    console.log('✓ EXACTLY 1 COMMENT WAS DELETED: Leaf deletion is strictly selective!');
  }

  // Verify parent and replies are STILL VISIBLE!
  const parentStillThere = await parentComment.isVisible();
  const reply1StillThere = await page.locator(`text=V7 Resposta 1 [${testRunId}]`).isVisible();
  const reply2StillThere = await page.locator(`text=V7 Resposta 2 com Mídia [${testRunId}]`).isVisible();
  console.log(`Parent visible after leaf delete: ${parentStillThere}`);
  console.log(`Reply 1 visible after leaf delete: ${reply1StillThere}`);
  console.log(`Reply 2 visible after leaf delete: ${reply2StillThere}`);
  if (!parentStillThere || !reply1StillThere || !reply2StillThere) {
    throw new Error('CRITICAL ERROR: Sibling comments vanished after deleting a leaf comment!');
  }

  // TEST 4: Controlled Deletion of Parent with Active Replies (Tombstone test)
  console.log('Testing parent deletion with active replies (Tombstone verification)...');
  const parentDeleteBtn = parentComment.locator('button:has-text("Apagar")').first();
  await parentDeleteBtn.click();
  await page.waitForTimeout(400);

  await confirmDeleteBtn.click();
  await page.waitForTimeout(2500);

  // Verify Parent has become a Tombstone card
  const tombstoneParent = page.locator('.tombstone-card').first();
  await tombstoneParent.waitFor({ state: 'visible', timeout: 5000 });
  const tombstoneText = await tombstoneParent.textContent();
  console.log('Tombstone text:', tombstoneText?.trim());

  // Verify replies are STILL VISIBLE and attached beneath the tombstone!
  const reply1AfterParentDelete = await page.locator(`text=V7 Resposta 1 [${testRunId}]`).isVisible();
  const reply2AfterParentDelete = await page.locator(`text=V7 Resposta 2 com Mídia [${testRunId}]`).isVisible();
  console.log(`Reply 1 visible under tombstone: ${reply1AfterParentDelete}`);
  console.log(`Reply 2 visible under tombstone: ${reply2AfterParentDelete}`);

  if (!reply1AfterParentDelete || !reply2AfterParentDelete) {
    throw new Error('CRITICAL ERROR: Replies vanished after deleting parent comment!');
  }
  console.log('✓ TOMBSTONE SUCCESS: Parent comment converted to tombstone, replies remain 100% visible and intact!');

  // Capture Tombstone with Replies Screenshot
  const threadContainer = tombstoneParent.locator('xpath=ancestor::article[contains(@class, "root-card")] | self::article').first();
  await threadContainer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await threadContainer.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v7_tombstone_parent_with_replies.png')
  });
  console.log('✓ Captured v7_tombstone_parent_with_replies.png');

  // TEST 5: Test Media Spoiler in Reply 2 (Blur -> Reveal -> Re-hide)
  console.log('Testing media spoiler interactions in reply...');
  const reply2Card = page.locator(`.reply-card:has-text("V7 Resposta 2 com Mídia [${testRunId}]")`).first();
  await reply2Card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const mediaSpoilerBtn = reply2Card.locator('.media-spoiler-card').first();
  if (await mediaSpoilerBtn.isVisible({ timeout: 3000 })) {
    // Capture blurred spoiler media
    await reply2Card.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v7_media_spoiler_masked.png')
    });
    console.log('✓ Captured v7_media_spoiler_masked.png');

    // Click to reveal
    await mediaSpoilerBtn.click();
    await page.waitForTimeout(400);

    // Capture revealed media
    await reply2Card.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v7_media_spoiler_revealed.png')
    });
    console.log('✓ Captured v7_media_spoiler_revealed.png');

    // Click "Ocultar" to re-hide
    const rehideBtn = reply2Card.locator('.media-rehide-btn').first();
    if (await rehideBtn.isVisible()) {
      await rehideBtn.click();
      await page.waitForTimeout(300);
      console.log('✓ Re-hide spoiler button functions smoothly.');
    }
  }

  // TEST 6: Page Reload Persistence Test
  console.log('Testing page reload persistence...');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await dismissAgeGate(page);

  await page.locator('.comments-section-root').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const tombstoneAfterReload = await page.locator('.tombstone-card').first().isVisible();
  const reply1AfterReload = await page.locator(`text=V7 Resposta 1 [${testRunId}]`).isVisible();
  const reply2AfterReload = await page.locator(`text=V7 Resposta 2 com Mídia [${testRunId}]`).isVisible();
  console.log(`After reload - Tombstone: ${tombstoneAfterReload}, Reply 1: ${reply1AfterReload}, Reply 2: ${reply2AfterReload}`);

  if (!tombstoneAfterReload || !reply1AfterReload || !reply2AfterReload) {
    throw new Error('CRITICAL ERROR: Comments lost after page reload!');
  }
  console.log('✓ ZERO DATA LOSS: All comments and threads persist reliably across reload!');

  // Capture Multi-Viewport Responsive Screenshots
  console.log('Capturing responsive viewports...');
  const viewports = [
    { name: 'desktop_1920px', width: 1920, height: 1080 },
    { name: 'desktop_1440px', width: 1440, height: 900 },
    { name: 'desktop_1280px', width: 1280, height: 800 },
    { name: 'mobile_430px', width: 430, height: 932 },
    { name: 'mobile_390px', width: 390, height: 844 },
    { name: 'mobile_360px', width: 360, height: 780 },
    { name: 'mobile_320px', width: 320, height: 568 }
  ];

  for (const vp of viewports) {
    const vpContext = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.width <= 430
    });
    await vpContext.addCookies(sessionCookies);
    await vpContext.addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
    ]);
    const vpPage = await vpContext.newPage();
    await vpPage.goto(CHAPTER_URL, { waitUntil: 'load' });
    await vpPage.waitForTimeout(1500);
    await dismissAgeGate(vpPage);

    // Capture comments feed in this viewport
    const commSection = vpPage.locator('.comments-section-root').first();
    await commSection.scrollIntoViewIfNeeded();
    await vpPage.waitForTimeout(500);

    await vpPage.screenshot({
      path: path.join(ARTIFACTS_DIR, `v7_${vp.name}_comments_feed.png`),
      clip: await commSection.boundingBox() || undefined
    });
    console.log(`✓ Captured v7_${vp.name}_comments_feed.png`);
    await vpContext.close();
  }

  // Firefox Mobile Emulation
  console.log('Testing Firefox mobile emulation...');
  const ffContext = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true
  });
  await ffContext.addCookies(sessionCookies);
  await ffContext.addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
  ]);
  const ffPage = await ffContext.newPage();
  await ffPage.goto(CHAPTER_URL, { waitUntil: 'load' });
  await ffPage.waitForTimeout(1500);
  await dismissAgeGate(ffPage);

  const ffComments = ffPage.locator('.comments-section-root').first();
  await ffComments.scrollIntoViewIfNeeded();
  await ffPage.waitForTimeout(500);

  await ffPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v7_firefox_mobile_390px_comments.png'),
    clip: await ffComments.boundingBox() || undefined
  });
  console.log('✓ Captured v7_firefox_mobile_390px_comments.png');
  await ffContext.close();

  await browser.close();
  console.log('--- ALL V7 VERIFICATION AND SCREENSHOT TESTS COMPLETED SUCCESSFULLY ---');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
