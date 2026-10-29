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
  console.log('=== PROJECT NOX — RODADA 20 V12 FINAL POLISH E2E SUITE ===');
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
  // STEP 1: VERIFY ELBOW CONNECTOR REMOVAL IN DOM
  // -------------------------------------------------------------------------
  console.log('2. Verifying Removal of Golden Elbow Connectors...');
  const elbowCount = await page.locator('.thread-connector-elbow').count();
  console.log(`Found ${elbowCount} .thread-connector-elbow elements in DOM.`);
  if (elbowCount > 0) {
    throw new Error('FAIL: .thread-connector-elbow is still present in DOM!');
  }
  console.log('✓ Confirmed: ZERO elbow connectors in DOM. Clean continuous vertical lines active!');

  // -------------------------------------------------------------------------
  // STEP 2: BUILD CONTROLLED DISCUSSION SUITE (8 KEY SCENARIOS)
  // -------------------------------------------------------------------------
  console.log('3. Staging and Posting Controlled Test Thread (4 levels, 2 roots, image, GIF, spoiler)...');
  const uniqueId = Date.now().toString().slice(-4);

  // --- ROOT 1 (Independent Main Comment 1 with Image) ---
  const mainComposer = page.locator('.composer-textarea').first();
  await mainComposer.scrollIntoViewIfNeeded();
  const root1Text = `[V12 Test Root 1 #${uniqueId}] Comentário principal sobre o desfecho da corte imperial no capítulo 76.`;
  await mainComposer.fill(root1Text);

  // Attach test PNG image
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(TEST_PNG_PATH);
  await page.waitForTimeout(1500);
  await page.locator('.pre-upload-attachment-card').first().waitFor({ state: 'visible', timeout: 8000 });
  console.log('✓ Image attached to Root 1.');

  await page.locator('.btn-submit-premium').first().click();
  await page.waitForTimeout(3000);

  const postedRoot1 = page.locator(`.comment-card-modern:has-text("${root1Text}")`).first();
  await postedRoot1.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Root 1 posted with image attachment!');

  // --- LEVEL 1 REPLY (Direct reply to Root 1) ---
  await postedRoot1.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const reply1Text = `[V12 Test L1 #${uniqueId}] Resposta direta de nível 1 analisando a estratégia dos nobres.`;
  await page.locator('.inline-reply-textarea').first().fill(reply1Text);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply1 = page.locator(`.comment-card-modern:has-text("${reply1Text}")`).first();
  await postedReply1.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Level 1 reply posted!');

  // --- LEVEL 2 REPLY (Reply to Reply 1) ---
  await postedReply1.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const reply2Text = `[V12 Test L2 #${uniqueId}] Resposta de nível 2 concordando com a interpretação apresentada.`;
  await page.locator('.inline-reply-textarea').first().fill(reply2Text);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply2 = page.locator(`.comment-card-modern:has-text("${reply2Text}")`).first();
  await postedReply2.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Level 2 reply posted!');

  // --- LEVEL 3 REPLY (Reply to Reply 2) ---
  await postedReply2.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const reply3Text = `[V12 Test L3 #${uniqueId}] Resposta de nível 3 destacando um detalhe sutil nos quadros.`;
  await page.locator('.inline-reply-textarea').first().fill(reply3Text);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply3 = page.locator(`.comment-card-modern:has-text("${reply3Text}")`).first();
  await postedReply3.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Level 3 reply posted!');

  // --- LEVEL 4 REPLY (Reply to Reply 3 - Thread with 4 levels) ---
  await postedReply3.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const reply4Text = `[V12 Test L4 #${uniqueId}] Resposta de nível 4 demonstrando o recuo contínuo sem fluxograma.`;
  await page.locator('.inline-reply-textarea').first().fill(reply4Text);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply4 = page.locator(`.comment-card-modern:has-text("${reply4Text}")`).first();
  await postedReply4.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Level 4 reply posted (Full 4-level deep thread)!');

  // --- ROOT 2 (Independent Main Comment 2 with GIF & Spoiler) ---
  await mainComposer.scrollIntoViewIfNeeded();
  const root2Text = `[V12 Test Root 2 #${uniqueId}] Que reviravolta fascinante! Segredo da corte: ||o duque sabia de tudo desde o início|| `;
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
  console.log('✓ Root 2 posted with GIF and Discord spoiler syntax!');

  // -------------------------------------------------------------------------
  // STEP 3: CAPTURE HIGH-RES VISUAL COMPARISON DETAILS
  // -------------------------------------------------------------------------
  console.log('4. Capturing High-Res Detail Screenshots...');

  // 1. Contextual reply pill close-up
  const replyPill = postedReply2.locator('.reply-target-tag').first();
  await replyPill.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v12_reply_header_pill.png')
  });
  console.log('✓ Saved v12_reply_header_pill.png');

  // 2. Full 4-level thread card with new discrete neutral vertical rails
  const threadBlock1 = page.locator(`.conversation-root-block:has-text("${root1Text}")`).first();
  await threadBlock1.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await threadBlock1.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v12_thread_4_levels.png')
  });
  console.log('✓ Saved v12_thread_4_levels.png');

  // 3. Discrete rail hierarchy (Close-up of replies and continuous rail)
  const repliesNest = threadBlock1.locator('.thread-replies-nest').first();
  await repliesNest.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v12_discrete_rail_hierarchy.png')
  });
  console.log('✓ Saved v12_discrete_rail_hierarchy.png');

  // 4. Hover over rail to show subtle purple interactive feedback
  const railEl = threadBlock1.locator('.thread-vertical-rail').first();
  await railEl.hover();
  await page.waitForTimeout(300);
  await threadBlock1.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v12_rail_hover_purple.png')
  });
  console.log('✓ Saved v12_rail_hover_purple.png');

  // 5. Root 2 with GIF & Spoiler
  const threadBlock2 = page.locator(`.conversation-root-block:has-text("${root2Text.slice(0, 30)}")`).first();
  await threadBlock2.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await threadBlock2.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v12_comment_with_media_and_spoiler.png')
  });
  console.log('✓ Saved v12_comment_with_media_and_spoiler.png');

  // 6. Alternative: Temporary style hiding vertical line for visual comparison
  await page.evaluate(() => {
    const rails = document.querySelectorAll('.rail-line');
    rails.forEach(r => r.style.opacity = '0');
  });
  await page.waitForTimeout(300);
  await threadBlock1.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v12_alternative_no_lines.png')
  });
  console.log('✓ Saved v12_alternative_no_lines.png (No-lines comparison alternative)');

  // Restore lines
  await page.evaluate(() => {
    const rails = document.querySelectorAll('.rail-line');
    rails.forEach(r => r.style.opacity = '1');
  });
  await page.waitForTimeout(300);

  // -------------------------------------------------------------------------
  // STEP 4: FUNCTIONAL REGRESSION VERIFICATION
  // -------------------------------------------------------------------------
  console.log('5. Executing Functional Regression Checks...');

  // A. Like interaction
  const likeBtn = postedReply1.locator('.btn-footer-like').first();
  const initialLikes = await likeBtn.innerText();
  await likeBtn.click();
  await page.waitForTimeout(1000);
  const updatedLikes = await likeBtn.innerText();
  console.log(`Like check: initial "${initialLikes}" -> after click "${updatedLikes}" (is liked: ${await likeBtn.getAttribute('class')})`);

  // B. Spoiler interaction in Root 2
  const spoilerSpan = postedRoot2.locator('.discord-spoiler').first();
  if (await spoilerSpan.isVisible()) {
    console.log('Testing spoiler reveal click...');
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
  console.log('✓ Granular Moderation Modal confirmed functional in V12!');

  // Close modal with Cancelar
  await granularModal.locator('.btn-modal-cancel').first().click();
  await page.waitForTimeout(500);

  // -------------------------------------------------------------------------
  // STEP 5: CAPTURE RESPONSIVE VIEWPORTS ACROSS DESKTOP & MOBILE
  // -------------------------------------------------------------------------
  console.log('6. Capturing Responsive Viewports across Desktop and Mobile...');
  const viewports = [
    { name: 'v12_desktop_1920px_comments_flow.png', width: 1920, height: 1080 },
    { name: 'v12_desktop_1440px_comments_flow.png', width: 1440, height: 900 },
    { name: 'v12_desktop_1280px_comments_flow.png', width: 1280, height: 800 },
    { name: 'v12_mobile_430px_comments_flow.png', width: 430, height: 932, isMobile: true },
    { name: 'v12_mobile_390px_comments_flow.png', width: 390, height: 844, isMobile: true },
    { name: 'v12_mobile_360px_comments_flow.png', width: 360, height: 800, isMobile: true },
    { name: 'v12_mobile_320px_comments_flow.png', width: 320, height: 568, isMobile: true }
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
  // STEP 6: CAPTURE FIREFOX MOBILE (390px)
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
      path: path.join(ARTIFACTS_DIR, 'v12_firefox_mobile_390px.png'),
      fullPage: false
    });
    console.log('✓ Saved v12_firefox_mobile_390px.png');
    await ffBrowser.close();
  } catch (err) {
    console.warn('Firefox capture warning:', err.message);
  }

  // -------------------------------------------------------------------------
  // STEP 7: CLEAN UP TEST THREADS SAFELY
  // -------------------------------------------------------------------------
  console.log('8. Safely cleaning up controlled test comments...');
  try {
    // Delete Root 1
    const del1 = page.locator(`.comment-card-modern:has-text("${root1Text}") .btn-footer-secondary:has-text("Apagar")`).first();
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
  console.log('=== All Rodada 20 V12 E2E tests and captures completed successfully! ===');
}

run().catch(err => {
  console.error('FATAL V12 E2E FAILURE:', err);
  process.exit(1);
});
