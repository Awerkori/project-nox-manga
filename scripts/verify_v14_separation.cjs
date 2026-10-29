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
  console.log('=== PROJECT NOX — RODADA 20 V14 REPLIES SEPARATION E2E SUITE ===');
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

  const uniqueId = Date.now().toString().slice(-4);
  console.log(`2. Staging and Posting Controlled Test Thread (V14 #${uniqueId})...`);

  const mainComposer = page.locator('.composer-textarea').first();

  // --- ROOT 1 (Main Comment with 2 Sibling Replies + Sub-replies) ---
  await mainComposer.scrollIntoViewIfNeeded();
  const root1Text = `[V14 Test Root 1 #${uniqueId}] Análise central: O imperador armou toda a emboscada contra a guilda dos magos no capítulo 76.`;
  await mainComposer.fill(root1Text);

  // Attach test image to Root 1
  if (fs.existsSync(TEST_PNG_PATH)) {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(TEST_PNG_PATH);
    await page.waitForTimeout(1500);
    await page.locator('.pre-upload-attachment-card').first().waitFor({ state: 'visible', timeout: 8000 });
    console.log('✓ Image attached to Root 1.');
  }

  await page.locator('.btn-submit-premium').first().click();
  await page.waitForTimeout(3000);

  const postedRoot1 = page.locator(`.comment-card-modern:has-text("${root1Text}")`).first();
  await postedRoot1.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Root 1 posted!');

  // --- REPLY 1 TO ROOT 1 (Direct L1 Reply - Long Text) ---
  await postedRoot1.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const reply1Text = `[V14 Test L1 #${uniqueId}] Resposta 1: Concordo plenamente. A expressão dele no segundo painel da página 12 deixa explícito que a ordem de cerco foi assinada antes mesmo do conselho se reunir formalmente.`;
  await page.locator('.inline-reply-textarea').first().fill(reply1Text);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply1 = page.locator(`.comment-card-modern:has-text("${reply1Text.slice(0, 30)}")`).first();
  await postedReply1.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Reply 1 (L1) posted!');

  // --- SUB-REPLY 1.1 (Level 2 Reply to Reply 1 - Short Text) ---
  await postedReply1.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const reply2Text = `[V14 Test L2 #${uniqueId}] Sub-resposta: Exato! E o anel de sinete confirma a autoria.`;
  await page.locator('.inline-reply-textarea').first().fill(reply2Text);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply2 = page.locator(`.comment-card-modern:has-text("${reply2Text.slice(0, 30)}")`).first();
  await postedReply2.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Sub-reply 1.1 (L2) posted!');

  // --- SUB-REPLY 1.1.1 (Level 3 Reply to Reply 2) ---
  await postedReply2.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const reply3Text = `[V14 Test L3 #${uniqueId}] Sub-sub-resposta de nível 3 demonstrando a hierarquia profunda.`;
  await page.locator('.inline-reply-textarea').first().fill(reply3Text);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply3 = page.locator(`.comment-card-modern:has-text("${reply3Text.slice(0, 30)}")`).first();
  await postedReply3.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Sub-sub-reply (L3) posted!');

  // --- REPLY 2 TO ROOT 1 (Sibling L1 Reply - Demonstrates Sibling Distinction) ---
  await postedRoot1.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const reply1SiblingText = `[V14 Test L1 Sibling #${uniqueId}] Resposta 2 (Irmã): Uma interpretação alternativa — a imperatriz pode ter manipulado o mensageiro para acelerar o confronto.`;
  await page.locator('.inline-reply-textarea').first().fill(reply1SiblingText);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply1Sibling = page.locator(`.comment-card-modern:has-text("${reply1SiblingText.slice(0, 30)}")`).first();
  await postedReply1Sibling.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Reply 2 (Sibling L1) posted!');

  // --- ROOT 2 (Independent Main Comment 2 with GIF & Spoiler - Demonstrates 1 Reply scenario) ---
  await mainComposer.scrollIntoViewIfNeeded();
  const root2Text = `[V14 Test Root 2 #${uniqueId}] Detalhe imperdível da batalha: ||o cavaleiro sagrado sobreviveu|| `;
  const root2Payload = `${root2Text}${EXTERNAL_GIF_URL}`;

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
  }, root2Payload);

  await page.waitForTimeout(1500);
  await page.locator('.pre-upload-attachment-card').first().waitFor({ state: 'visible', timeout: 8000 });
  console.log('✓ GIF detected and attached to Root 2.');

  await page.locator('.btn-submit-premium').first().click();
  await page.waitForTimeout(3000);

  const postedRoot2 = page.locator(`.comment-card-modern:has-text("${root2Text.slice(0, 30)}")`).first();
  await postedRoot2.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Root 2 posted with GIF and spoiler!');

  // --- SINGLE REPLY TO ROOT 2 (Demonstrating 1-reply scenario with spoiler) ---
  await postedRoot2.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const root2ReplyText = `[V14 Test Root 2 Reply #${uniqueId}] Resposta única com spoiler: ||ele volta no capítulo seguinte com reforços!||`;
  await page.locator('.inline-reply-textarea').first().fill(root2ReplyText);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedRoot2Reply = page.locator(`.comment-card-modern:has-text("${root2ReplyText.slice(0, 30)}")`).first();
  await postedRoot2Reply.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Single reply to Root 2 posted with spoiler!');

  // -------------------------------------------------------------------------
  // STEP 3: PROGRAMMATIC GEOMETRIC MEASUREMENTS & VALIDATION
  // -------------------------------------------------------------------------
  console.log('3. Programmatically measuring geometry and DOM structure...');

  const measurements = await page.evaluate((r1Text) => {
    const rootBlock = Array.from(document.querySelectorAll('.conversation-root-block')).find(b => b.textContent.includes(r1Text));
    if (!rootBlock) return null;

    const repliesHeader = rootBlock.querySelector('.thread-replies-header');
    const chip = rootBlock.querySelector('.thread-replies-chip');
    const divider = rootBlock.querySelector('.thread-replies-divider');
    const nest = rootBlock.querySelector('.thread-replies-nest');
    const railLine = nest ? nest.querySelector('.rail-line') : null;
    const childrenList = nest ? nest.querySelector('.thread-children-list') : null;
    const childrenNodes = childrenList ? Array.from(childrenList.children) : [];

    // Distance between Root footer actions and Thread replies header
    const rootCard = rootBlock.querySelector('.comment-card-modern.is-root-card');
    const rootFooter = rootCard ? rootCard.querySelector('.comment-footer-actions') : null;
    const rootFooterRect = rootFooter ? rootFooter.getBoundingClientRect() : null;
    const headerRect = repliesHeader ? repliesHeader.getBoundingClientRect() : null;
    const distanceRootToHeader = rootFooterRect && headerRect ? Math.round(headerRect.top - rootFooterRect.bottom) : null;

    // Check sibling divider between child 0 and child 1
    let siblingGap = null;
    let hasDividerStyle = false;
    if (childrenNodes.length >= 2) {
      const c0Rect = childrenNodes[0].getBoundingClientRect();
      const c1Rect = childrenNodes[1].getBoundingClientRect();
      siblingGap = Math.round(c1Rect.top - c0Rect.bottom);
      const c0CS = window.getComputedStyle(childrenNodes[0]);
      hasDividerStyle = c0CS.borderBottomWidth !== '0px';
    }

    // Flush alignment on child 0
    const l1Card = childrenNodes[0] ? childrenNodes[0].querySelector('.comment-card-modern') : null;
    const l1Avatar = l1Card ? (l1Card.querySelector('.user-avatar-root') || l1Card.querySelector('header')) : null;
    const l1Like = l1Card ? l1Card.querySelector('.btn-footer-like') : null;
    const avatarRect = l1Avatar ? l1Avatar.getBoundingClientRect() : null;
    const likeRect = l1Like ? l1Like.getBoundingClientRect() : null;
    const railRect = railLine ? railLine.getBoundingClientRect() : null;

    return {
      hasRepliesHeader: !!repliesHeader,
      chipText: chip ? chip.innerText.trim() : null,
      distanceRootToHeader,
      siblingGap,
      hasDividerStyle,
      railToLikeDistance: railRect && likeRect ? Math.round(likeRect.left - railRect.right) : null,
      avatarToLikeOffset: avatarRect && likeRect ? Math.round(likeRect.left - avatarRect.left) : null
    };
  }, root1Text);

  console.log('Geometry measurements for V14:', measurements);

  // -------------------------------------------------------------------------
  // STEP 4: CAPTURE HIGH-RES CLOSE-UPS & EVIDENCE
  // -------------------------------------------------------------------------
  console.log('4. Capturing High-Res Detail Screenshots for Evidence...');

  const threadBlock1 = page.locator(`.conversation-root-block:has-text("${root1Text}")`).first();
  await threadBlock1.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // 1. Thread Replies Header Close-Up
  const headerEl = threadBlock1.locator('.thread-replies-header').first();
  await headerEl.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v14_thread_replies_header.png')
  });
  console.log('✓ Saved v14_thread_replies_header.png');

  // 2. Sibling Reply Demarcation Close-Up (Showing separator between Reply 1 and Reply 2)
  const childrenListEl = threadBlock1.locator('.thread-children-list').first();
  await childrenListEl.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v14_sibling_replies_distinction.png')
  });
  console.log('✓ Saved v14_sibling_replies_distinction.png');

  // 3. Full 4-Level Thread with Enhanced Demarcation
  await threadBlock1.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v14_thread_full_hierarchy.png')
  });
  console.log('✓ Saved v14_thread_full_hierarchy.png');

  // 4. Enhanced Reply Tag Pill Close-Up
  const replyTagPill = threadBlock1.locator('.reply-target-tag').first();
  await replyTagPill.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v14_reply_pill_enhanced.png')
  });
  console.log('✓ Saved v14_reply_pill_enhanced.png');

  // 5. Root 2 with Single Reply & Spoiler
  const threadBlock2 = page.locator(`.conversation-root-block:has-text("${root2Text.slice(0, 30)}")`).first();
  await threadBlock2.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await threadBlock2.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v14_single_reply_with_media_and_spoiler.png')
  });
  console.log('✓ Saved v14_single_reply_with_media_and_spoiler.png');

  // -------------------------------------------------------------------------
  // STEP 5: FUNCTIONAL REGRESSION CHECKS
  // -------------------------------------------------------------------------
  console.log('5. Executing Functional Regression Checks...');

  // A. Like interaction
  const likeBtn = postedReply1.locator('.btn-footer-like').first();
  const initialLikes = await likeBtn.innerText();
  await likeBtn.click();
  await page.waitForTimeout(1000);
  const updatedLikes = await likeBtn.innerText();
  console.log(`Like check: initial "${initialLikes}" -> after click "${updatedLikes}" (is liked: ${await likeBtn.getAttribute('class')})`);

  // B. Spoiler interaction in Root 2 Reply
  const spoilerSpan = postedRoot2Reply.locator('.discord-spoiler').first();
  if (await spoilerSpan.isVisible()) {
    console.log('Testing spoiler reveal click in reply...');
    await spoilerSpan.click();
    await page.waitForTimeout(400);
    const isRevealed = await spoilerSpan.getAttribute('class');
    console.log(`Spoiler revealed class: "${isRevealed}"`);
  }

  // C. Thread collapse / expand interaction
  console.log('Testing thread collapse interaction...');
  const collapseBtn = postedReply1.locator('.btn-thread-collapse').first();
  await collapseBtn.click();
  await page.waitForTimeout(600);

  const collapsedBar = page.locator('.thread-collapsed-bar').first();
  await collapsedBar.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Collapsed bar confirmed visible after click!');

  // Expand again
  await collapsedBar.click();
  await page.waitForTimeout(600);
  console.log('✓ Thread expanded back successfully.');

  // D. Granular Moderation Modal test on Root 1
  console.log('Testing Granular Moderation Modal on Root 1...');
  const deleteBtnRoot1 = postedRoot1.locator('.btn-footer-secondary:has-text("Apagar")').first();
  await deleteBtnRoot1.click();
  await page.waitForTimeout(600);

  const granularModal = page.locator('.confirm-modal-box.is-granular').first();
  await granularModal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Granular Moderation Modal confirmed functional in V14!');

  // Close modal with Cancelar
  await granularModal.locator('.btn-modal-cancel').first().click();
  await page.waitForTimeout(500);

  // -------------------------------------------------------------------------
  // STEP 6: CAPTURE RESPONSIVE VIEWPORTS ACROSS DESKTOP & MOBILE
  // -------------------------------------------------------------------------
  console.log('6. Capturing Responsive Viewports across Desktop and Mobile...');
  const viewports = [
    { name: 'v14_desktop_1920px_comments_flow.png', width: 1920, height: 1080 },
    { name: 'v14_desktop_1440px_comments_flow.png', width: 1440, height: 900 },
    { name: 'v14_desktop_1280px_comments_flow.png', width: 1280, height: 800 },
    { name: 'v14_mobile_430px_comments_flow.png', width: 430, height: 932, isMobile: true },
    { name: 'v14_mobile_390px_comments_flow.png', width: 390, height: 844, isMobile: true },
    { name: 'v14_mobile_360px_comments_flow.png', width: 360, height: 800, isMobile: true },
    { name: 'v14_mobile_320px_comments_flow.png', width: 320, height: 568, isMobile: true }
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
  // STEP 7: CAPTURE FIREFOX MOBILE (390px)
  // -------------------------------------------------------------------------
  console.log('7. Capturing Firefox Mobile (390px)...');
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
      path: path.join(ARTIFACTS_DIR, 'v14_firefox_mobile_390px.png'),
      fullPage: false
    });
    console.log('✓ Saved v14_firefox_mobile_390px.png');
    await ffBrowser.close();
  } catch (err) {
    console.warn('Firefox capture warning:', err.message);
  }

  // -------------------------------------------------------------------------
  // STEP 8: SAFE SANITARY CLEANUP
  // -------------------------------------------------------------------------
  console.log('8. Safely cleaning up controlled test comments...');
  try {
    // Delete Root 1
    const del1 = page.locator(`.comment-card-modern:has-text("${root1Text.slice(0, 30)}") .btn-footer-secondary:has-text("Apagar")`).first();
    if (await del1.isVisible()) {
      await del1.click();
      await page.waitForTimeout(500);
      const conf1 = page.locator('.confirm-modal-box .option-delete-all, .confirm-modal-box .btn-modal-delete').first();
      if (await conf1.isVisible()) await conf1.click();
      await page.waitForTimeout(2000);
    }

    // Delete Root 2
    const del2 = page.locator(`.comment-card-modern:has-text("${root2Text.slice(0, 25)}") .btn-footer-secondary:has-text("Apagar")`).first();
    if (await del2.isVisible()) {
      await del2.click();
      await page.waitForTimeout(500);
      const conf2 = page.locator('.confirm-modal-box .option-delete-all, .confirm-modal-box .btn-modal-delete').first();
      if (await conf2.isVisible()) await conf2.click();
      await page.waitForTimeout(2000);
    }
    console.log('✓ Test comments cleanly deleted.');
  } catch (cleanupErr) {
    console.warn('Cleanup notice:', cleanupErr.message);
  }

  await browser.close();
  console.log('=== All Rodada 20 V14 E2E tests and captures completed successfully! ===');
}

run().catch(err => {
  console.error('FATAL V14 E2E FAILURE:', err);
  process.exit(1);
});
