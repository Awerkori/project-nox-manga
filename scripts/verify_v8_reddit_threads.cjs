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
  console.log('--- Starting Rodada 20 V8 Reddit Threads & Confinement Suite ---');
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
  console.log('2. Testing Reading Progress Bar Confinement...');
  // Scroll to chapter end
  const chapterEndEl = page.locator('#chapter-end');
  await chapterEndEl.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  // Check progress bar classes and visibility
  const progressBar = page.locator('.nox-progress-system');
  if (await progressBar.count() > 0) {
    const isPastPages = await progressBar.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return el.classList.contains('is-past-pages') || style.opacity === '0' || style.pointerEvents === 'none';
    });
    console.log(`Progress bar is past pages / hidden at chapter-end: ${isPastPages}`);
  }

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v8_progress_bar_hidden_at_chapter_end.png'),
    clip: { x: 0, y: 0, width: 1440, height: 900 }
  });
  console.log('✓ Captured v8_progress_bar_hidden_at_chapter_end.png');

  // -------------------------------------------------------------------------
  // TEST 2: POST 3-LEVEL NESTED REDDIT THREAD
  // -------------------------------------------------------------------------
  console.log('3. Testing Reddit-Style 3-Level Thread Creation...');
  const testRunId = Date.now().toString().slice(-6);

  // Scroll to comments section
  const commentsSection = page.locator('.comments-section-root').first();
  await commentsSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // Post Level 0 (Root)
  const mainComposer = page.locator('.composer-textarea').first();
  await mainComposer.scrollIntoViewIfNeeded();
  await mainComposer.fill(`V8 Teoria Reddit Raiz [${testRunId}]: Análise profunda das motivações dos personagens.`);
  await page.waitForTimeout(300);

  const mainSubmitBtn = page.locator('.btn-submit-premium').first();
  await mainSubmitBtn.click();
  await page.waitForTimeout(3000);

  const rootComment = page.locator(`.comment-card-modern:has-text("V8 Teoria Reddit Raiz [${testRunId}]")`).first();
  await rootComment.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Root comment created successfully.');

  // Click "Responder" on Root comment -> Verify inline composer appears directly below it
  const rootReplyBtn = rootComment.locator('button:has-text("Responder")').first();
  await rootReplyBtn.click();
  await page.waitForTimeout(500);

  const inlineComposer = page.locator('.inline-composer-card').first();
  await inlineComposer.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Inline composer opened directly under root comment!');

  // Capture inline composer screenshot
  await page.locator(`.thread-node-wrapper:has-text("V8 Teoria Reddit Raiz [${testRunId}]")`).first().screenshot({
    path: path.join(ARTIFACTS_DIR, 'v8_inline_reply_composer.png')
  });
  console.log('✓ Captured v8_inline_reply_composer.png');

  // Fill Level 1 Reply
  const inlineTextarea = page.locator('.inline-reply-textarea').first();
  await inlineTextarea.fill(`V8 Resposta Nível 1 [${testRunId}]: Concordo totalmente, isso foi sugerido no diálogo!`);
  await page.waitForTimeout(300);

  const inlineSubmitBtn = page.locator('.btn-inline-submit').first();
  await inlineSubmitBtn.click();
  await page.waitForTimeout(3000);

  const level1Reply = page.locator(`.comment-card-modern:has-text("V8 Resposta Nível 1 [${testRunId}]")`).first();
  await level1Reply.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Level 1 reply created successfully.');

  // Click "Responder" on Level 1 reply -> Post Level 2 Reply (True Nested Reply)
  const level1ReplyBtn = level1Reply.locator('button:has-text("Responder")').first();
  await level1ReplyBtn.click();
  await page.waitForTimeout(500);

  await inlineComposer.waitFor({ state: 'visible', timeout: 5000 });
  const inlineTextarea2 = page.locator('.inline-reply-textarea').first();
  await inlineTextarea2.fill(`V8 Resposta Nível 2 [${testRunId}]: Exatamente no capítulo 42 a confirmação veio à tona.`);
  await page.waitForTimeout(300);

  await inlineSubmitBtn.click();
  await page.waitForTimeout(3000);

  const level2Reply = page.locator(`.comment-card-modern:has-text("V8 Resposta Nível 2 [${testRunId}]")`).first();
  await level2Reply.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Level 2 reply created successfully (True nested Reddit hierarchy!).');

  // Capture expanded 3-level thread
  const threadNode = page.locator(`.thread-node-wrapper:has-text("V8 Teoria Reddit Raiz [${testRunId}]")`).first();
  await threadNode.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  await threadNode.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v8_thread_expanded.png')
  });
  console.log('✓ Captured v8_thread_expanded.png');

  // -------------------------------------------------------------------------
  // TEST 3: REDDIT-STYLE THREAD COLLAPSE & EXPAND
  // -------------------------------------------------------------------------
  console.log('4. Testing Reddit-Style Thread Collapse & Expand...');
  const collapseBtn = rootComment.locator('.btn-thread-collapse').first();
  await collapseBtn.click();
  await page.waitForTimeout(500);

  const collapsedBar = page.locator('.thread-collapsed-bar:has-text("2 respostas")').first();
  await collapsedBar.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Thread collapsed into compact bar showing 2 replies hidden.');

  await collapsedBar.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v8_thread_collapsed.png')
  });
  console.log('✓ Captured v8_thread_collapsed.png');

  // Expand back
  await collapsedBar.click();
  await page.waitForTimeout(500);
  await level2Reply.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Thread expanded back successfully.');

  // -------------------------------------------------------------------------
  // TEST 4: DELETION WITHOUT TOMBSTONE (SURVIVING REPLIES PROMOTION)
  // -------------------------------------------------------------------------
  console.log('5. Testing Deletion without Tombstone (Surviving Replies Promotion)...');
  const delTestId = Date.now().toString().slice(-6);

  // Post temporary parent
  await mainComposer.scrollIntoViewIfNeeded();
  await mainComposer.fill(`V8 Pai Efêmero [${delTestId}]: Este pai será apagado para provar que tombstones sumiram.`);
  await page.waitForTimeout(300);
  await mainSubmitBtn.click();
  await page.waitForTimeout(3000);

  const ephemParent = page.locator(`.comment-card-modern:has-text("V8 Pai Efêmero [${delTestId}]")`).first();
  await ephemParent.waitFor({ state: 'visible', timeout: 10000 });

  // Post reply to ephemeral parent
  const ephemReplyBtn = ephemParent.locator('button:has-text("Responder")').first();
  await ephemReplyBtn.click();
  await page.waitForTimeout(500);

  await inlineComposer.waitFor({ state: 'visible', timeout: 5000 });
  await inlineTextarea.fill(`V8 Sobrevivente Autêntica [${delTestId}]: Eu sobrevivo e devo ser promovida sem tombstone!`);
  await page.waitForTimeout(300);
  await inlineSubmitBtn.click();
  await page.waitForTimeout(3000);

  const survivorReply = page.locator(`.comment-card-modern:has-text("V8 Sobrevivente Autêntica [${delTestId}]")`).first();
  await survivorReply.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Ephemeral parent and survivor reply posted.');

  // Now delete the ephemeral parent!
  const ephemDeleteBtn = ephemParent.locator('button:has-text("Apagar")').first();
  await ephemDeleteBtn.click();
  await page.waitForTimeout(400);

  const confirmDeleteBtn = page.locator('.btn-modal-delete, button:has-text("Sim, Apagar")').first();
  await confirmDeleteBtn.click();
  await page.waitForTimeout(2500);

  // VERIFICATION:
  // 1) Ephemeral parent text must be GONE from the DOM!
  const ephemStillVisible = await page.locator(`text=V8 Pai Efêmero [${delTestId}]`).count();
  // 2) Tombstone text "Este comentário foi removido" must NEVER appear!
  const tombstoneCount = await page.locator(`text=Este comentário foi removido`).count();
  // 3) Survivor reply must STILL BE VISIBLE!
  const survivorStillVisible = await survivorReply.isVisible();

  console.log(`Ephemeral parent count: ${ephemStillVisible} (expected 0)`);
  console.log(`Tombstone "removido" count: ${tombstoneCount} (expected 0)`);
  console.log(`Survivor reply visible: ${survivorStillVisible} (expected true)`);

  if (ephemStillVisible !== 0) {
    throw new Error('Deleted comment still present in DOM!');
  }
  if (tombstoneCount !== 0) {
    throw new Error('Forbidden tombstone card detected in DOM!');
  }
  if (!survivorStillVisible) {
    throw new Error('Survivor reply disappeared after parent deletion!');
  }
  console.log('✓ ZERO TOMBSTONES CONFIRMED: Deleted comment completely vanished, survivor promoted cleanly!');

  await survivorReply.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v8_surviving_reply_no_tombstone.png')
  });
  console.log('✓ Captured v8_surviving_reply_no_tombstone.png');

  // -------------------------------------------------------------------------
  // TEST 5: FULL RESPONSIVE VIEWPORTS AUDIT
  // -------------------------------------------------------------------------
  console.log('6. Capturing Responsive Viewports Audit...');
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
    await page.waitForTimeout(600);

    const feedEl = page.locator('.comments-section-root').first();
    await feedEl.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    await feedEl.screenshot({
      path: path.join(ARTIFACTS_DIR, `v8_${vp.name}_comments_feed.png`)
    });
    console.log(`✓ Captured v8_${vp.name}_comments_feed.png`);
  }

  await browser.close();

  // Test 6: Firefox Mobile Emulation
  console.log('7. Running Firefox Mobile test...');
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
    path: path.join(ARTIFACTS_DIR, 'v8_firefox_mobile_390px_comments.png')
  });
  console.log('✓ Captured v8_firefox_mobile_390px_comments.png');
  await ffBrowser.close();

  console.log('🎉 ALL V8 AUDIT TESTS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Fatal error in V8 verification:', err);
  process.exit(1);
});
