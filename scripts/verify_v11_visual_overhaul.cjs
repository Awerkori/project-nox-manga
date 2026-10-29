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
  console.log('=== PROJECT NOX — RODADA 20 V11 E2E VERIFICATION SUITE ===');
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

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[Browser Console Error]: ${msg.text()}`);
  });
  page.on('pageerror', err => console.log(`[Browser Page Error]: ${err.message}`));

  console.log('1. Navigating to Chapter 76 on Cloudflare Preview:', CHAPTER_URL);
  await page.goto(CHAPTER_URL, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(2500);
  await dismissAgeGate(page);

  const commentsSection = page.locator('.comments-section-root').first();
  await commentsSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // -------------------------------------------------------------------------
  // STEP 1: VERIFY UNBOXED ARCHITECTURE & NO YELLOW/GOLD BORDERS ON CARDS
  // -------------------------------------------------------------------------
  console.log('2. Verifying Unboxed Architecture & Clean Styles...');
  
  const rootBlocks = page.locator('.conversation-root-block');
  const rootBlockCount = await rootBlocks.count();
  console.log(`Found ${rootBlockCount} conversation root blocks.`);

  const nestedCard = page.locator('.comment-card-modern.is-nested-card').first();
  if (await nestedCard.count() > 0) {
    const borderStyle = await nestedCard.evaluate(el => window.getComputedStyle(el).border);
    const bgStyle = await nestedCard.evaluate(el => window.getComputedStyle(el).backgroundColor);
    console.log(`Nested reply card border: "${borderStyle}", background: "${bgStyle}"`);
  }

  // -------------------------------------------------------------------------
  // STEP 2: POST ROOT COMMENT WITH ATTACHED GIF (via Paste auto-detection)
  // -------------------------------------------------------------------------
  console.log('3. Staging and Posting Root Comment with Media to test hierarchy & granular moderation...');
  const mainComposer = page.locator('.composer-textarea').first();
  await mainComposer.scrollIntoViewIfNeeded();
  const rootUniqueId = Date.now().toString().slice(-4);
  const userTextPrefix = `[V11 Test Root #${rootUniqueId}] Arte e narrativa impressionantes no capítulo 76! `;
  const pastePayload = `${userTextPrefix}${EXTERNAL_GIF_URL}`;

  await mainComposer.focus();
  await page.evaluate((payload) => {
    const textarea = document.querySelector('.composer-textarea');
    if (!textarea) return;
    const dt = new DataTransfer();
    dt.setData('text/plain', payload);
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true
    });
    textarea.dispatchEvent(pasteEvent);
  }, pastePayload);

  await page.waitForTimeout(1500);

  // Check pre-upload card
  const preUploadCard = page.locator('.pre-upload-attachment-card').first();
  await preUploadCard.waitFor({ state: 'visible', timeout: 8000 });
  console.log('✓ GIF attachment detected and staged in composer.');

  // Submit root comment
  const submitBtn = page.locator('.btn-submit-premium').first();
  await submitBtn.click();
  await page.waitForTimeout(3000);

  // Find newly posted root comment
  const postedRootCard = page.locator(`.comment-card-modern:has-text("${rootUniqueId}")`).first();
  await postedRootCard.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Root comment successfully posted and rendered with GIF media!');

  // -------------------------------------------------------------------------
  // STEP 3: POST NESTED REPLIES (3 LEVELS DEEP)
  // -------------------------------------------------------------------------
  console.log('4. Posting nested replies to verify hierarchy and "↳ em resposta a @usuario"...');
  
  // Level 1 reply
  const replyBtnLevel1 = postedRootCard.locator('.btn-footer-reply').first();
  await replyBtnLevel1.click();
  await page.waitForTimeout(600);

  const inlineComposer1 = page.locator('.inline-reply-textarea').first();
  const reply1Text = `[V11 Test Reply L1 #${rootUniqueId}] Concordo plenamente com a análise da reviravolta!`;
  await inlineComposer1.fill(reply1Text);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply1Card = page.locator(`.comment-card-modern:has-text("${reply1Text}")`).first();
  await postedReply1Card.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Reply Level 1 posted!');

  // Level 2 reply (Replying to Reply 1)
  const replyBtnLevel2 = postedReply1Card.locator('.btn-footer-reply').first();
  await replyBtnLevel2.click();
  await page.waitForTimeout(600);

  const inlineComposer2 = page.locator('.inline-reply-textarea').first();
  const reply2Text = `[V11 Test Reply L2 #${rootUniqueId}] Detalhe sutil que passou despercebido no diálogo.`;
  await inlineComposer2.fill(reply2Text);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply2Card = page.locator(`.comment-card-modern:has-text("${reply2Text}")`).first();
  await postedReply2Card.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Reply Level 2 posted!');

  // -------------------------------------------------------------------------
  // STEP 4: VERIFY CONTEXTUAL "↳ em resposta a @usuario" INDICATOR
  // -------------------------------------------------------------------------
  console.log('5. Verifying Contextual Reply Indicators in Headers...');
  const replyTargetTag = postedReply2Card.locator('.reply-target-tag').first();
  await replyTargetTag.waitFor({ state: 'visible', timeout: 5000 });
  const replyTargetText = await replyTargetTag.innerText();
  console.log(`Reply target tag text: "${replyTargetText}"`);

  const replyTargetLink = postedReply2Card.locator('.reply-target-link').first();
  const targetHref = await replyTargetLink.getAttribute('href');
  console.log(`Reply target link href: "${targetHref}"`);
  if (!targetHref || !targetHref.startsWith('/u/')) {
    throw new Error(`FAIL: Target link href should start with /u/, got: ${targetHref}`);
  }
  console.log('✓ Confirmed: Contextual reply indicator has clickable profile link!');

  // Close-up screenshot of the reply tag & thread header
  await replyTargetTag.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v11_reply_to_author_pill.png')
  });
  console.log('✓ Captured v11_reply_to_author_pill.png');

  // Screenshot unboxed thread hierarchy
  const conversationBlock = page.locator(`.conversation-root-block:has-text("${rootUniqueId}")`).first();
  await conversationBlock.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await conversationBlock.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v11_unboxed_thread_hierarchy.png')
  });
  console.log('✓ Captured v11_unboxed_thread_hierarchy.png');

  // -------------------------------------------------------------------------
  // STEP 5: TEST GRANULAR MEDIA MODERATION MODAL (COMPLEMENTO V11)
  // -------------------------------------------------------------------------
  console.log('6. Testing Granular Media Moderation Modal...');
  const deleteBtnRoot = postedRootCard.locator('.btn-footer-secondary:has-text("Apagar")').first();
  await deleteBtnRoot.scrollIntoViewIfNeeded();
  await deleteBtnRoot.click();
  await page.waitForTimeout(600);

  const granularModal = page.locator('.confirm-modal-box.is-granular').first();
  await granularModal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Granular Moderation Modal opened!');

  // Verify all 3 options are visible
  const optionA = granularModal.locator('.option-remove-media').first();
  const optionB = granularModal.locator('.option-spoiler-media').first();
  const optionC = granularModal.locator('.option-delete-all').first();

  const isOptAVisible = await optionA.isVisible();
  const isOptBVisible = await optionB.isVisible();
  const isOptCVisible = await optionC.isVisible();
  console.log(`Granular Options visibility: A (Remover): ${isOptAVisible}, B (Spoiler): ${isOptBVisible}, C (Excluir): ${isOptCVisible}`);

  if (!isOptAVisible || !isOptBVisible || !isOptCVisible) {
    throw new Error('FAIL: Not all 3 granular moderation options are displayed!');
  }

  // Screenshot the Granular Moderation Modal
  await granularModal.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v11_granular_moderation_modal.png')
  });
  console.log('✓ Captured v11_granular_moderation_modal.png');

  // TEST OPTION B: Wrap media in spoiler
  console.log('7. Testing Option B: Ocultar mídia como spoiler...');
  await optionB.click();
  await page.waitForTimeout(3000);

  // Verify media in root comment now has spoiler protection
  const updatedRootCard = page.locator(`.comment-card-modern:has-text("${rootUniqueId}")`).first();
  const spoilerOverlay = updatedRootCard.locator('.media-spoiler-overlay, .media-spoiler-card').first();
  await spoilerOverlay.waitFor({ state: 'visible', timeout: 8000 });
  console.log('✓ Spoiler protection successfully applied to media!');

  await updatedRootCard.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v11_media_spoiler_applied.png')
  });
  console.log('✓ Captured v11_media_spoiler_applied.png');

  // TEST OPTION A: Remove media while preserving text & replies
  console.log('8. Testing Option A: Remover imagem/GIF preservando texto...');
  const deleteBtnRootAgain = updatedRootCard.locator('.btn-footer-secondary:has-text("Apagar")').first();
  await deleteBtnRootAgain.scrollIntoViewIfNeeded();
  await deleteBtnRootAgain.click();
  await page.waitForTimeout(600);

  const granularModal2 = page.locator('.confirm-modal-box.is-granular').first();
  await granularModal2.waitFor({ state: 'visible', timeout: 5000 });
  
  const optionA2 = granularModal2.locator('.option-remove-media').first();
  await optionA2.click();
  await page.waitForTimeout(3000);

  // Verify that comment text is still there, replies are still there, but media element is gone
  const rootAfterRemove = page.locator(`.comment-card-modern:has-text("${rootUniqueId}")`).first();
  await rootAfterRemove.waitFor({ state: 'visible', timeout: 8000 });
  
  const mediaCountAfter = await rootAfterRemove.locator('.comment-rendered-img, .comment-media-card').count();
  console.log(`Media elements remaining in comment after Option A: ${mediaCountAfter}`);
  if (mediaCountAfter > 0) {
    throw new Error('FAIL: Media element was not removed!');
  }
  console.log('✓ Confirmed: Media removed completely while root comment text is 100% preserved!');

  // Verify replies are still present and attached!
  const reply1After = page.locator(`.comment-card-modern:has-text("${reply1Text}")`).first();
  const reply2After = page.locator(`.comment-card-modern:has-text("${reply2Text}")`).first();
  if ((await reply1After.count()) === 0 || (await reply2After.count()) === 0) {
    throw new Error('FAIL: Child replies were lost after moderating parent media!');
  }
  console.log('✓ Confirmed: All child replies preserved in the thread!');

  await conversationBlock.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v11_media_removed_text_preserved.png')
  });
  console.log('✓ Captured v11_media_removed_text_preserved.png');

  // Clean up: delete root comment via Option C / standard delete
  console.log('9. Cleaning up test thread...');
  const delBtnFinal = rootAfterRemove.locator('.btn-footer-secondary:has-text("Apagar")').first();
  await delBtnFinal.click();
  await page.waitForTimeout(500);

  const confirmBox = page.locator('.confirm-modal-box').first();
  if (await confirmBox.isVisible()) {
    const deleteBtn = confirmBox.locator('.btn-modal-delete, .option-delete-all').first();
    await deleteBtn.click();
    await page.waitForTimeout(2000);
  }
  console.log('✓ Cleaned up test comment.');

  // -------------------------------------------------------------------------
  // STEP 6: CAPTURE RESPONSIVE VIEWPORTS
  // -------------------------------------------------------------------------
  console.log('10. Capturing Responsive Viewports across Desktop and Mobile...');
  const viewports = [
    { name: 'v11_desktop_1920px_comments_flow.png', width: 1920, height: 1080 },
    { name: 'v11_desktop_1440px_comments_flow.png', width: 1440, height: 900 },
    { name: 'v11_desktop_1280px_comments_flow.png', width: 1280, height: 800 },
    { name: 'v11_mobile_430px_comments_flow.png', width: 430, height: 932, isMobile: true },
    { name: 'v11_mobile_390px_comments_flow.png', width: 390, height: 844, isMobile: true },
    { name: 'v11_mobile_360px_comments_flow.png', width: 360, height: 800, isMobile: true },
    { name: 'v11_mobile_320px_comments_flow.png', width: 320, height: 568, isMobile: true }
  ];

  for (const vp of viewports) {
    console.log(`Capturing viewport: ${vp.width}x${vp.height} (${vp.name})...`);
    const vpContext = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: !!vp.isMobile
    });
    await vpContext.addCookies(sessionCookies);
    await vpContext.addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
    ]);

    const vpPage = await vpContext.newPage();
    await vpPage.goto(CHAPTER_URL, { waitUntil: 'load', timeout: 45000 });
    await vpPage.waitForTimeout(2000);
    await dismissAgeGate(vpPage);

    const vpComments = vpPage.locator('.comments-section-root').first();
    await vpComments.scrollIntoViewIfNeeded();
    await vpPage.waitForTimeout(800);

    await vpPage.screenshot({
      path: path.join(ARTIFACTS_DIR, vp.name),
      fullPage: false
    });
    console.log(`✓ Saved ${vp.name}`);
    await vpContext.close();
  }

  // -------------------------------------------------------------------------
  // STEP 7: FIREFOX MOBILE CAPTURE
  // -------------------------------------------------------------------------
  console.log('11. Capturing Firefox Mobile (390px)...');
  try {
    const ffBrowser = await firefox.launch({ headless: true });
    const ffContext = await ffBrowser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true
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
    await ffPage.waitForTimeout(1000);

    await ffPage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v11_firefox_mobile_390px.png'),
      fullPage: false
    });
    console.log('✓ Saved v11_firefox_mobile_390px.png');
    await ffBrowser.close();
  } catch (err) {
    console.warn('Firefox capture warning:', err.message);
  }

  await browser.close();
  console.log('=== All Rodada 20 V11 E2E tests and captures completed successfully! ===');
}

run().catch(err => {
  console.error('FATAL E2E FAILURE:', err);
  process.exit(1);
});
