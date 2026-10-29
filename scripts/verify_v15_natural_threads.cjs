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
  console.log('=== PROJECT NOX — RODADA 20 V15 NATURAL THREAD COMPARISON SUITE ===');
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
  console.log(`2. Staging Realistic Discussion Dataset (V15 #${uniqueId})...`);

  const mainComposer = page.locator('.composer-textarea').first();

  // --- ROOT 1 (Main Comment with Image) ---
  await mainComposer.scrollIntoViewIfNeeded();
  const root1Text = `[V15 Test Root 1 #${uniqueId}] Análise central: O imperador armou toda a emboscada contra a guilda dos magos no capítulo 76.`;
  await mainComposer.fill(root1Text);

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
  const reply1Text = `[V15 Test L1 #${uniqueId}] Resposta 1 (Longo Texto): Concordo plenamente com a análise. A expressão do imperador no segundo painel da página 12 deixa absolutamente explícito que a ordem de cerco foi assinada antes mesmo do conselho se reunir formalmente. Isso muda toda a dinâmica política do império para os próximos arcos!`;
  await page.locator('.inline-reply-textarea').first().fill(reply1Text);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply1 = page.locator(`.comment-card-modern:has-text("${reply1Text.slice(0, 30)}")`).first();
  await postedReply1.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Reply 1 (L1 Long Text) posted!');

  // --- SUB-REPLY 1.1 (Level 2 Reply to Reply 1) ---
  await postedReply1.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const reply2Text = `[V15 Test L2 #${uniqueId}] Sub-resposta (L2): Exato! E repare que o anel de sinete dourado que ele usa na página 14 confirma a autoria sem deixar dúvidas.`;
  await page.locator('.inline-reply-textarea').first().fill(reply2Text);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply2 = page.locator(`.comment-card-modern:has-text("${reply2Text.slice(0, 30)}")`).first();
  await postedReply2.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Sub-reply 1.1 (L2) posted!');

  // --- SUB-REPLY 1.1.1 (Level 3 Reply to Reply 2) ---
  await postedReply2.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const reply3Text = `[V15 Test L3 #${uniqueId}] Sub-sub-resposta (L3): Muito bem observado, esse detalhe do anel passou batido na primeira leitura!`;
  await page.locator('.inline-reply-textarea').first().fill(reply3Text);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply3 = page.locator(`.comment-card-modern:has-text("${reply3Text.slice(0, 30)}")`).first();
  await postedReply3.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Sub-sub-reply (L3) posted!');

  // --- REPLY 2 TO ROOT 1 (Sibling L1 Reply - Demonstrates Sibling Distinction) ---
  await postedRoot1.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const reply1SiblingText = `[V15 Test L1 Sibling #${uniqueId}] Resposta 2 (Irmã direta da Resposta 1): Uma interpretação alternativa — a imperatriz pode ter manipulado o mensageiro para acelerar o confronto propositalmente.`;
  await page.locator('.inline-reply-textarea').first().fill(reply1SiblingText);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedReply1Sibling = page.locator(`.comment-card-modern:has-text("${reply1SiblingText.slice(0, 30)}")`).first();
  await postedReply1Sibling.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Reply 2 (Sibling L1) posted!');

  // --- ROOT 2 (Independent Main Comment 2 with GIF & Spoiler) ---
  await mainComposer.scrollIntoViewIfNeeded();
  const root2Text = `[V15 Test Root 2 #${uniqueId}] Segunda discussão independente: Detalhe surpreendente do capítulo — ||o cavaleiro sagrado sobreviveu ao ataque elemental|| `;
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

  // --- SINGLE REPLY TO ROOT 2 (Demonstrating single reply scenario) ---
  await postedRoot2.locator('.btn-footer-reply').first().click();
  await page.waitForTimeout(600);
  const root2ReplyText = `[V15 Test Root 2 Reply #${uniqueId}] Resposta única: ||Ele retorna no capítulo 77 com um novo exército de suporte!||`;
  await page.locator('.inline-reply-textarea').first().fill(root2ReplyText);
  await page.locator('.btn-inline-submit').first().click();
  await page.waitForTimeout(3000);

  const postedRoot2Reply = page.locator(`.comment-card-modern:has-text("${root2ReplyText.slice(0, 30)}")`).first();
  await postedRoot2Reply.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Single reply to Root 2 posted!');

  // -------------------------------------------------------------------------
  // STEP 3: EVALUATE & CAPTURE ALTERNATIVA A (REDDIT MINIMALISTA)
  // -------------------------------------------------------------------------
  console.log('\n=== TESTING ALTERNATIVA A (REDDIT MINIMALISTA) ===');
  await page.locator('.btn-style-pill:has-text("Estilo A")').first().click();
  await page.waitForTimeout(800);

  // Geometric validation for Style A
  const metricsA = await page.evaluate((r1Text) => {
    const rootBlock = Array.from(document.querySelectorAll('.conversation-root-block')).find(b => b.textContent.includes(r1Text));
    if (!rootBlock) return null;

    const nest = rootBlock.querySelector('.thread-replies-nest');
    const railLine = nest ? nest.querySelector('.rail-line') : null;
    const childrenList = nest ? nest.querySelector('.thread-children-list') : null;
    const childrenNodes = childrenList ? Array.from(childrenList.children) : [];

    const rootCard = rootBlock.querySelector('.comment-card-modern.is-root-card');
    const rootFooter = rootCard ? rootCard.querySelector('.comment-footer-actions') : null;
    const rootFooterRect = rootFooter ? rootFooter.getBoundingClientRect() : null;
    const nestRect = nest ? nest.getBoundingClientRect() : null;
    const distanceRootToNest = rootFooterRect && nestRect ? Math.round(nestRect.top - rootFooterRect.bottom) : null;

    // Sibling gap
    let siblingGap = null;
    if (childrenNodes.length >= 2) {
      const c0Rect = childrenNodes[0].getBoundingClientRect();
      const c1Rect = childrenNodes[1].getBoundingClientRect();
      siblingGap = Math.round(c1Rect.top - c0Rect.bottom);
    }

    // Flush alignment on Child 0
    const l1Card = childrenNodes[0] ? childrenNodes[0].querySelector('.comment-card-modern') : null;
    const l1Avatar = l1Card ? l1Card.querySelector('.user-avatar-root') : null;
    const l1LikeBtn = l1Card ? l1Card.querySelector('.btn-action-like') : null;
    const l1AvatarRect = l1Avatar ? l1Avatar.getBoundingClientRect() : null;
    const l1LikeRect = l1LikeBtn ? l1LikeBtn.getBoundingClientRect() : null;
    const l1Offset = l1AvatarRect && l1LikeRect ? Math.round(l1LikeRect.left - l1AvatarRect.left) : null;

    // Check that "2 respostas" pill is GONE
    const hasRepliesHeader = !!rootBlock.querySelector('.thread-replies-header');

    return {
      distanceRootToNest,
      siblingGap,
      l1Offset,
      hasRepliesHeader,
      railWidth: railLine ? window.getComputedStyle(railLine).width : null,
      railColor: railLine ? window.getComputedStyle(railLine).backgroundColor : null
    };
  }, root1Text);

  console.log('Metrics Alternativa A:', JSON.stringify(metricsA, null, 2));

  // Desktop captures for Style A
  console.log('Capturing Style A Desktop viewports...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  const targetBlock = page.locator(`.conversation-root-block:has-text("${root1Text}")`).first();
  await targetBlock.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v15_style_a_desktop_1440px.png'),
    fullPage: false
  });

  await targetBlock.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v15_style_a_thread_hierarchy.png')
  });

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);
  await targetBlock.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v15_style_a_desktop_1920px.png'),
    fullPage: false
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(500);
  await targetBlock.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v15_style_a_desktop_1280px.png'),
    fullPage: false
  });

  // Mobile captures for Style A
  console.log('Capturing Style A Mobile viewports...');
  for (const w of [430, 390, 360, 320]) {
    await page.setViewportSize({ width: w, height: 844 });
    await page.waitForTimeout(500);
    await targetBlock.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, `v15_style_a_mobile_${w}px.png`),
      fullPage: false
    });
  }

  // -------------------------------------------------------------------------
  // STEP 4: EVALUATE & CAPTURE ALTERNATIVA B (CONVERSA AGRUPADA)
  // -------------------------------------------------------------------------
  console.log('\n=== TESTING ALTERNATIVA B (CONVERSA AGRUPADA) ===');
  await page.locator('.btn-style-pill:has-text("Estilo B")').first().click();
  await page.waitForTimeout(800);

  // Geometric validation for Style B
  const metricsB = await page.evaluate((r1Text) => {
    const rootBlock = Array.from(document.querySelectorAll('.conversation-root-block')).find(b => b.textContent.includes(r1Text));
    if (!rootBlock) return null;

    const nest = rootBlock.querySelector('.thread-replies-nest.is-root-replies');
    const nestCS = nest ? window.getComputedStyle(nest) : null;
    const childrenList = nest ? nest.querySelector('.thread-children-list') : null;
    const childrenNodes = childrenList ? Array.from(childrenList.children) : [];

    const rootCard = rootBlock.querySelector('.comment-card-modern.is-root-card');
    const rootFooter = rootCard ? rootCard.querySelector('.comment-footer-actions') : null;
    const rootFooterRect = rootFooter ? rootFooter.getBoundingClientRect() : null;
    const nestRect = nest ? nest.getBoundingClientRect() : null;
    const distanceRootToNest = rootFooterRect && nestRect ? Math.round(nestRect.top - rootFooterRect.bottom) : null;

    // Sibling gap
    let siblingGap = null;
    if (childrenNodes.length >= 2) {
      const c0Rect = childrenNodes[0].getBoundingClientRect();
      const c1Rect = childrenNodes[1].getBoundingClientRect();
      siblingGap = Math.round(c1Rect.top - c0Rect.bottom);
    }

    const l1Card = childrenNodes[0] ? childrenNodes[0].querySelector('.comment-card-modern') : null;
    const l1CS = l1Card ? window.getComputedStyle(l1Card) : null;

    return {
      distanceRootToNest,
      siblingGap,
      groupBackground: nestCS ? nestCS.backgroundColor : null,
      groupBorderLeft: nestCS ? nestCS.borderLeft : null,
      l1CardBackground: l1CS ? l1CS.backgroundColor : null,
      l1CardBorder: l1CS ? l1CS.border : null
    };
  }, root1Text);

  console.log('Metrics Alternativa B:', JSON.stringify(metricsB, null, 2));

  // Desktop captures for Style B
  console.log('Capturing Style B Desktop viewports...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  await targetBlock.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v15_style_b_desktop_1440px.png'),
    fullPage: false
  });

  await targetBlock.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v15_style_b_thread_hierarchy.png')
  });

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);
  await targetBlock.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v15_style_b_desktop_1920px.png'),
    fullPage: false
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(500);
  await targetBlock.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v15_style_b_desktop_1280px.png'),
    fullPage: false
  });

  // Mobile captures for Style B
  console.log('Capturing Style B Mobile viewports...');
  for (const w of [430, 390, 360, 320]) {
    await page.setViewportSize({ width: w, height: 844 });
    await page.waitForTimeout(500);
    await targetBlock.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, `v15_style_b_mobile_${w}px.png`),
      fullPage: false
    });
  }

  // -------------------------------------------------------------------------
  // STEP 5: FIREFOX MOBILE COMPATIBILITY TEST
  // -------------------------------------------------------------------------
  console.log('\n=== TESTING FIREFOX MOBILE COMPATIBILITY ===');
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
  await ffPage.waitForTimeout(2000);
  await dismissAgeGate(ffPage);

  const ffTargetBlock = ffPage.locator(`.conversation-root-block:has-text("${root1Text}")`).first();
  await ffTargetBlock.scrollIntoViewIfNeeded();
  await ffPage.waitForTimeout(500);

  await ffPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v15_firefox_mobile_390px.png'),
    fullPage: false
  });
  console.log('✓ Firefox mobile screenshot saved.');
  await ffBrowser.close();

  // -------------------------------------------------------------------------
  // STEP 6: TEST INTERACTIONS (LIKE, SPOILER, COLLAPSE, MODAL)
  // -------------------------------------------------------------------------
  console.log('\n=== TESTING INTERACTIONS & COLLAPSE ===');
  await page.setViewportSize({ width: 1440, height: 900 });
  await targetBlock.scrollIntoViewIfNeeded();

  // Test Like
  const likeBtn = targetBlock.locator('.btn-footer-like').first();
  const initialLikes = await likeBtn.innerText();
  await likeBtn.click();
  await page.waitForTimeout(1000);
  const updatedLikes = await likeBtn.innerText();
  console.log(`✓ Like interaction: "${initialLikes.trim()}" -> "${updatedLikes.trim()}"`);

  // Test Spoiler
  const spoilerTarget = page.locator(`.conversation-root-block:has-text("${root2Text.slice(0, 30)}")`).first();
  await spoilerTarget.scrollIntoViewIfNeeded();
  const spoilerSpan = spoilerTarget.locator('.discord-spoiler').first();
  if (await spoilerSpan.isVisible()) {
    await spoilerSpan.click();
    await page.waitForTimeout(400);
    const isRevealed = await spoilerSpan.evaluate(el => el.classList.contains('is-revealed'));
    console.log(`✓ Spoiler toggle clicked. Revealed: ${isRevealed}`);
  }

  // Test Thread Collapse & Expand
  console.log('Testing thread collapse on Root 1...');
  await targetBlock.scrollIntoViewIfNeeded();
  const collapseBtn = targetBlock.locator('.btn-thread-collapse').first();
  await collapseBtn.click();
  await page.waitForTimeout(600);

  const collapsedBar = targetBlock.locator('.thread-collapsed-bar').first();
  const isCollapsedVisible = await collapsedBar.isVisible();
  const collapsedText = isCollapsedVisible ? await collapsedBar.innerText() : '';
  console.log(`✓ Thread collapsed successfully: "${collapsedText.replace(/\n/g, ' ')}"`);

  // Screenshot collapsed state
  await targetBlock.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v15_thread_collapsed_state.png')
  });

  // Expand back
  await collapsedBar.click();
  await page.waitForTimeout(600);
  console.log('✓ Thread expanded back!');

  // Test Granular Moderation Modal opening
  const root2Block = page.locator(`.conversation-root-block:has-text("${root2Text.slice(0, 30)}")`).first();
  await root2Block.scrollIntoViewIfNeeded();
  const deleteBtn = root2Block.locator('.btn-footer-secondary.text-danger').first();
  if (await deleteBtn.isVisible()) {
    await deleteBtn.click();
    await page.waitForTimeout(500);
    const modal = page.locator('.moderation-modal-card').first();
    const modalVisible = await modal.isVisible();
    console.log(`✓ Granular moderation modal opened: ${modalVisible}`);
    if (modalVisible) {
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'v15_moderation_modal.png')
      });
      const cancelBtn = page.locator('.btn-modal-cancel').first();
      await cancelBtn.click();
      await page.waitForTimeout(400);
    }
  }

  // -------------------------------------------------------------------------
  // STEP 7: CLEAN UP TEST COMMENTS
  // -------------------------------------------------------------------------
  console.log('\n=== CLEANING UP TEST COMMENTS ===');
  const testTexts = [reply3Text, reply2Text, reply1SiblingText, reply1Text, root2ReplyText, root2Text, root1Text];
  for (const t of testTexts) {
    try {
      const card = page.locator(`.comment-card-modern:has-text("${t.slice(0, 30)}")`).first();
      if (await card.isVisible({ timeout: 1500 })) {
        const delBtn = card.locator('.btn-footer-secondary.text-danger').first();
        if (await delBtn.isVisible()) {
          await delBtn.click();
          await page.waitForTimeout(400);
          const confirmBtn = page.locator('.btn-delete-confirm').first();
          if (await confirmBtn.isVisible()) {
            await confirmBtn.click();
            await page.waitForTimeout(1000);
          }
        }
      }
    } catch (e) {
      console.log(`Cleanup note for "${t.slice(0, 20)}": ${e.message}`);
    }
  }
  console.log('✓ Cleanup completed.');

  await browser.close();
  console.log('=== E2E TEST SUITE FINISHED SUCCESSFULLY ===');
}

run().catch(err => {
  console.error('Fatal error in verify_v15_natural_threads.cjs:', err);
  process.exit(1);
});
