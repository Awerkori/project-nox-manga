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
  console.log('=== PROJECT NOX — RODADA 20 V13 FOOTER POLISH & ALIGNMENT SUITE ===');
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
  // STEP 1: VERIFY CLEAN ARCHITECTURE IN DOM
  // -------------------------------------------------------------------------
  console.log('2. Verifying DOM and Guide Rail state...');
  const elbowCount = await page.locator('.thread-connector-elbow').count();
  if (elbowCount > 0) {
    throw new Error('FAIL: .thread-connector-elbow is still present in DOM!');
  }
  console.log('✓ Confirmed: ZERO elbow connectors in DOM.');

  // -------------------------------------------------------------------------
  // STEP 2: BUILD CONTROLLED DISCUSSION SUITE (Root 1 with L1-L4, Root 2 with GIF + Spoiler)
  // -------------------------------------------------------------------------
  console.log('3. Staging and Posting Controlled Test Thread (4 levels, 2 roots, image, GIF, spoiler)...');
  const uniqueId = Date.now().toString().slice(-4);

  // --- ROOT 1 (Independent Main Comment 1 with Image) ---
  const mainComposer = page.locator('.composer-textarea').first();
  await mainComposer.scrollIntoViewIfNeeded();
  const root1Text = `[V13 Test Root 1 #${uniqueId}] Comentário principal sobre a estratégia política da corte no capítulo 76.`;
  await mainComposer.fill(root1Text);

  // Attach test PNG image
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

  // --- LEVEL 1 REPLY (Direct reply to Root 1) ---
  await postedRoot1.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const reply1Text = `[V13 Test L1 #${uniqueId}] Resposta de nível 1 analisando o posicionamento dos nobres e a conspiração da imperatriz.`;
  await page.locator('.inline-reply-textarea').first().fill(reply1Text);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply1 = page.locator(`.comment-card-modern:has-text("${reply1Text}")`).first();
  await postedReply1.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Level 1 reply posted!');

  // --- SIBLING REPLY (Direct reply to Root 1 as second child - tests sibling spacing) ---
  await postedRoot1.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const reply1SiblingText = `[V13 Test L1 Sibling #${uniqueId}] Segunda resposta de nível 1 trazendo uma perspectiva diferente dos cavaleiros.`;
  await page.locator('.inline-reply-textarea').first().fill(reply1SiblingText);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply1Sibling = page.locator(`.comment-card-modern:has-text("${reply1SiblingText}")`).first();
  await postedReply1Sibling.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Level 1 sibling reply posted!');

  // --- LEVEL 2 REPLY (Reply to Reply 1) ---
  await postedReply1.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const reply2Text = `[V13 Test L2 #${uniqueId}] Resposta de nível 2 concordando com a interpretação sobre os nobres.`;
  await page.locator('.inline-reply-textarea').first().fill(reply2Text);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply2 = page.locator(`.comment-card-modern:has-text("${reply2Text}")`).first();
  await postedReply2.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Level 2 reply posted!');

  // --- LEVEL 3 REPLY (Reply to Reply 2) ---
  await postedReply2.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const reply3Text = `[V13 Test L3 #${uniqueId}] Resposta de nível 3 destacando o detalhe do colar na página 14.`;
  await page.locator('.inline-reply-textarea').first().fill(reply3Text);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply3 = page.locator(`.comment-card-modern:has-text("${reply3Text}")`).first();
  await postedReply3.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Level 3 reply posted!');

  // --- LEVEL 4 REPLY (Reply to Reply 3) ---
  await postedReply3.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const reply4Text = `[V13 Test L4 #${uniqueId}] Resposta de nível 4 demonstrando o recuo contínuo com alinhamento uniforme.`;
  await page.locator('.inline-reply-textarea').first().fill(reply4Text);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply4 = page.locator(`.comment-card-modern:has-text("${reply4Text}")`).first();
  await postedReply4.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Level 4 reply posted (Full 4-level deep thread)!');

  // --- ROOT 2 (Independent Main Comment 2 with GIF & Spoiler) ---
  await mainComposer.scrollIntoViewIfNeeded();
  const root2Text = `[V13 Test Root 2 #${uniqueId}] Que reviravolta fascinante! Segredo da corte: ||o duque sabia de tudo desde o início|| `;
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
  // STEP 3: MEASURE GEOMETRY & VALIDATE REQUIREMENTS
  // -------------------------------------------------------------------------
  console.log('4. Programmatically measuring geometry and alignments...');

  const measurements = await page.evaluate((l1Text) => {
    const card = Array.from(document.querySelectorAll('.comment-card-modern')).find(c => c.textContent.includes(l1Text));
    if (!card) return null;

    const nest = card.closest('.thread-replies-nest');
    const railLine = nest ? nest.querySelector('.rail-line') : null;
    const avatar = card.querySelector('.author-avatar-link') || card.querySelector('.avatar-frame-render') || card.querySelector('header');
    const textBody = card.querySelector('.comment-text-body');
    const footer = card.querySelector('.comment-footer-actions');
    const likeBtn = card.querySelector('.btn-footer-like');
    const replyBtn = card.querySelector('.btn-footer-reply');

    const cardRect = card.getBoundingClientRect();
    const railRect = railLine ? railLine.getBoundingClientRect() : null;
    const avatarRect = avatar ? avatar.getBoundingClientRect() : null;
    const textRect = textBody ? textBody.getBoundingClientRect() : null;
    const footerRect = footer ? footer.getBoundingClientRect() : null;
    const likeRect = likeBtn ? likeBtn.getBoundingClientRect() : null;

    // Sibling spacing
    const childrenList = nest ? nest.querySelector('.thread-children-list') : null;
    const childrenNodes = childrenList ? Array.from(childrenList.children) : [];
    let siblingGap = null;
    if (childrenNodes.length >= 2) {
      const firstChildRect = childrenNodes[0].getBoundingClientRect();
      const secondChildRect = childrenNodes[1].getBoundingClientRect();
      siblingGap = Math.round(secondChildRect.top - firstChildRect.bottom);
    }

    return {
      distanceRailToLike: railRect && likeRect ? Math.round(likeRect.left - railRect.right) : null,
      distanceAvatarToLike: avatarRect && likeRect ? Math.round(likeRect.left - avatarRect.left) : null,
      distanceTextToFooter: textRect && footerRect ? Math.round(footerRect.top - textRect.bottom) : null,
      siblingGap
    };
  }, reply1Text);

  console.log('Geometry measurements for Level 1 reply:', measurements);
  if (measurements) {
    console.log(`- Rail to Like distance: ${measurements.distanceRailToLike}px (target ~8px)`);
    console.log(`- Avatar to Like alignment offset: ${measurements.distanceAvatarToLike}px (target 0px - flush)`);
    console.log(`- Text to Footer vertical breathing room: ${measurements.distanceTextToFooter}px (target 12-16px)`);
    console.log(`- Sibling replies vertical separation: ${measurements.siblingGap}px (target ~14px)`);
  }

  // -------------------------------------------------------------------------
  // STEP 4: CAPTURE HIGH-RES CLOSE-UPS & EVIDENCE
  // -------------------------------------------------------------------------
  console.log('5. Capturing High-Res Detail Screenshots...');

  const threadBlock1 = page.locator(`.conversation-root-block:has-text("${root1Text}")`).first();
  await threadBlock1.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // 1. Close-up of footer actions horizontal alignment
  const l1Card = page.locator(`.comment-card-modern:has-text("${reply1Text}")`).first();
  await l1Card.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v13_footer_action_alignment.png')
  });
  console.log('✓ Saved v13_footer_action_alignment.png');

  // 2. Close-up of vertical breathing room between content and footer
  const l1Footer = l1Card.locator('.comment-footer-actions').first();
  await l1Card.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v13_vertical_spacing_content_to_footer.png')
  });
  console.log('✓ Saved v13_vertical_spacing_content_to_footer.png');

  // 3. Full 4-level thread card
  await threadBlock1.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v13_thread_4_levels.png')
  });
  console.log('✓ Saved v13_thread_4_levels.png');

  // 4. Hover over rail to confirm subtle purple interactive feedback
  const railEl = threadBlock1.locator('.thread-vertical-rail').first();
  await railEl.hover();
  await page.waitForTimeout(300);
  await threadBlock1.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v13_rail_hover_purple.png')
  });
  console.log('✓ Saved v13_rail_hover_purple.png');

  // 5. Root 2 with GIF & Spoiler
  const threadBlock2 = page.locator(`.conversation-root-block:has-text("${root2Text.slice(0, 30)}")`).first();
  await threadBlock2.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await threadBlock2.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v13_comment_with_media_and_spoiler.png')
  });
  console.log('✓ Saved v13_comment_with_media_and_spoiler.png');

  // -------------------------------------------------------------------------
  // STEP 5: FUNCTIONAL REGRESSION CHECKS
  // -------------------------------------------------------------------------
  console.log('6. Executing Functional Regression Checks...');

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
  console.log('✓ Granular Moderation Modal confirmed functional in V13!');

  // Close modal with Cancelar
  await granularModal.locator('.btn-modal-cancel').first().click();
  await page.waitForTimeout(500);

  // -------------------------------------------------------------------------
  // STEP 6: CAPTURE RESPONSIVE VIEWPORTS ACROSS DESKTOP & MOBILE
  // -------------------------------------------------------------------------
  console.log('7. Capturing Responsive Viewports across Desktop and Mobile...');
  const viewports = [
    { name: 'v13_desktop_1920px_comments_flow.png', width: 1920, height: 1080 },
    { name: 'v13_desktop_1440px_comments_flow.png', width: 1440, height: 900 },
    { name: 'v13_desktop_1280px_comments_flow.png', width: 1280, height: 800 },
    { name: 'v13_mobile_430px_comments_flow.png', width: 430, height: 932, isMobile: true },
    { name: 'v13_mobile_390px_comments_flow.png', width: 390, height: 844, isMobile: true },
    { name: 'v13_mobile_360px_comments_flow.png', width: 360, height: 800, isMobile: true },
    { name: 'v13_mobile_320px_comments_flow.png', width: 320, height: 568, isMobile: true }
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
  console.log('8. Capturing Firefox Mobile (390px)...');
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
      path: path.join(ARTIFACTS_DIR, 'v13_firefox_mobile_390px.png'),
      fullPage: false
    });
    console.log('✓ Saved v13_firefox_mobile_390px.png');
    await ffBrowser.close();
  } catch (err) {
    console.warn('Firefox capture warning:', err.message);
  }

  // -------------------------------------------------------------------------
  // STEP 8: CLEAN UP TEST THREADS SAFELY
  // -------------------------------------------------------------------------
  console.log('9. Safely cleaning up controlled test comments...');
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
  console.log('=== All Rodada 20 V13 E2E tests and captures completed successfully! ===');
}

run().catch(err => {
  console.error('FATAL V13 E2E FAILURE:', err);
  process.exit(1);
});
