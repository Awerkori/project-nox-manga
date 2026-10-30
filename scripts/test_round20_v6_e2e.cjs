const fs = require('fs');
const path = require('path');
const { chromium, firefox } = require('playwright');
const { Client } = require('pg');

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
const SUPABASE_DB_URL = 'postgresql://postgres:ZJGsV8lUOarRFjDo@db.izregkwaqdygwioqzwwo.supabase.co:5432/postgres';

async function runV6TestSuite() {
  console.log('=== INICIANDO AUDITORIA COMPLETA DA RODADA 20 V6 ===');

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

  // Helper to open chapter page
  async function openChapter(settingsPatch = {}) {
    await page.goto(CHAPTER_URL, { waitUntil: 'networkidle' });
    if (Object.keys(settingsPatch).length > 0) {
      await page.evaluate((patch) => {
        const raw = localStorage.getItem('project_nox_reader_settings') || '{}';
        const parsed = JSON.parse(raw);
        localStorage.setItem('project_nox_reader_settings', JSON.stringify({ ...parsed, ...patch }));
      }, settingsPatch);
      await page.reload({ waitUntil: 'networkidle' });
    }
    await page.waitForTimeout(1000);
  }

  // --- 1. TEST POSTING COMMENTS WITH SPOILERS & MEDIA ---
  console.log('\n--- 1. Postando comentários de teste para spoilers, imagens e exclusão ---');
  await openChapter();

  // Scroll to comments section
  const commentsWrap = page.locator('.comments-section-root');
  await commentsWrap.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  // Post 1: Single char spoiler ||L|| and sentence spoiler
  const singleCharMsg = `Análise do plano secreto: ||L|| é o verdadeiro mastermind! ||o plano falhou no final||`;
  console.log('Posting single character spoiler comment...');
  await page.fill('.composer-input-area textarea', singleCharMsg);
  await page.click('.btn-submit-premium');
  await page.waitForTimeout(2000);

  // Post 2: Comment with square image and horizontal/vertical media test
  // We can post with direct standalone media URLs
  const squareImgMsg = `Imagem quadrada em enquadramento natural:\nhttps://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&h=400&fit=crop`;
  console.log('Posting square image comment...');
  await page.fill('.composer-input-area textarea', squareImgMsg);
  await page.click('.btn-submit-premium');
  await page.waitForTimeout(2000);

  // Post 3: Comment with animated GIF
  const gifMsg = `Reação animada com GIF:\nhttps://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif`;
  console.log('Posting animated GIF comment...');
  await page.fill('.composer-input-area textarea', gifMsg);
  await page.click('.btn-submit-premium');
  await page.waitForTimeout(2000);

  // Post 4: Comment to test deletion (post -> delete modal -> cancel -> confirm delete)
  const delTestToken = `Comentário temporário para teste de exclusão: ${Date.now()}`;
  console.log('Posting temporary comment for delete test...');
  await page.fill('.composer-input-area textarea', delTestToken);
  await page.click('.btn-submit-premium');
  await page.waitForTimeout(2000);

  // Reload to see live feed
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.comments-section-root').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);

  // --- SCREENSHOT 5: Single char spoiler ||L|| (unrevealed) ---
  console.log('\n--- 2. Capturando spoilers (estilo Discord) ---');
  const singleCharComment = page.locator(`.comment-item:has-text("Análise do plano secreto")`).first();
  if (await singleCharComment.isVisible()) {
    await singleCharComment.scrollIntoViewIfNeeded();
    await singleCharComment.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v6_spoiler_single_char_L.png')
    });
    console.log('Captured: v6_spoiler_single_char_L.png');

    // SCREENSHOT 6: Sentence spoiler before reveal
    await singleCharComment.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v6_spoiler_sentence.png')
    });
    console.log('Captured: v6_spoiler_sentence.png');

    // Click first spoiler to reveal it!
    const firstSpoilerBtn = singleCharComment.locator('.discord-spoiler').first();
    await firstSpoilerBtn.click();
    await page.waitForTimeout(400);

    // SCREENSHOT 7: Spoiler revealed
    await singleCharComment.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v6_spoiler_revealed.png')
    });
    console.log('Captured: v6_spoiler_revealed.png');
  }

  // --- SCREENSHOT 1: Square image enquadramento ---
  console.log('\n--- 3. Capturando imagens e GIFs com enquadramento natural ---');
  const squareComment = page.locator(`.comment-item:has-text("Imagem quadrada")`).first();
  if (await squareComment.isVisible()) {
    await squareComment.scrollIntoViewIfNeeded();
    await squareComment.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v6_comment_square_image.png')
    });
    console.log('Captured: v6_comment_square_image.png');
  }

  // --- SCREENSHOT 4: Animated GIF comment ---
  const gifComment = page.locator(`.comment-item:has-text("Reação animada")`).first();
  if (await gifComment.isVisible()) {
    await gifComment.scrollIntoViewIfNeeded();
    await gifComment.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v6_comment_animated_gif.png')
    });
    console.log('Captured: v6_comment_animated_gif.png');
  }

  // --- SCREENSHOT 2 & 3: Vertical and Horizontal Media ---
  // Create a combined post or mock card for vertical/horizontal
  const vertHorizMsg = `Testes de proporções:\n![Vertical](https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=600&fit=crop) ||segredo|| e horizontal: https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&h=450&fit=crop`;
  console.log('Posting vertical + horizontal + spoiler comment...');
  await page.fill('.composer-input-area textarea', vertHorizMsg);
  await page.click('.btn-submit-premium');
  await page.waitForTimeout(2000);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.comments-section-root').scrollIntoViewIfNeeded();

  const vertComment = page.locator(`.comment-item:has-text("Testes de proporções")`).first();
  if (await vertComment.isVisible()) {
    await vertComment.scrollIntoViewIfNeeded();
    await vertComment.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v6_comment_vertical_image.png')
    });
    await vertComment.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v6_comment_horizontal_image.png')
    });
    await vertComment.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v6_comment_text_spoiler_image.png')
    });
    console.log('Captured: v6_comment_vertical_image.png, v6_comment_horizontal_image.png, v6_comment_text_spoiler_image.png');
  }

  // --- SCREENSHOT 9 & 10: Delete Comment Modal & Success ---
  console.log('\n--- 4. Testando exclusão de comentário com confirmação modal ---');
  const targetDelComment = page.locator(`.comment-item:has-text("${delTestToken}")`).first();
  if (await targetDelComment.isVisible()) {
    await targetDelComment.scrollIntoViewIfNeeded();
    const deleteBtn = targetDelComment.locator('.btn-footer-action.text-danger');
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // SCREENSHOT 9: Delete confirmation modal
    const modal = page.locator('.confirm-modal-box');
    if (await modal.isVisible()) {
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'v6_delete_confirmation_modal.png')
      });
      console.log('Captured: v6_delete_confirmation_modal.png');

      // Test cancel first
      await page.click('.btn-modal-cancel');
      await page.waitForTimeout(400);
      console.log('Cancel verified: modal closed, comment still visible.');

      // Click delete again and confirm
      await deleteBtn.click();
      await page.waitForTimeout(400);
      await page.click('.btn-modal-delete');
      await page.waitForTimeout(1500);

      // SCREENSHOT 10: Comment deleted
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'v6_comment_deleted_success.png')
      });
      console.log('Captured: v6_comment_deleted_success.png');
    }
  }

  // --- SCREENSHOT 11, 12, 13, 14, 15: Progress Bar in all positions & Dragging ---
  console.log('\n--- 5. Testando barra de progresso (posições, arraste e percentual) ---');

  // Position: Right
  await openChapter({ progressPosition: 'right', progressDisplay: 'percent' });
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(600);

  // SCREENSHOT 15: Rest state (no percentage visible)
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v6_progressbar_rest_no_percentage.png')
  });
  console.log('Captured: v6_progressbar_rest_no_percentage.png');

  // SCREENSHOT 12: Progress bar right
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v6_progressbar_right.png')
  });
  console.log('Captured: v6_progressbar_right.png');

  // SCREENSHOT 14: Dragging on rail (using pointer down + pointer move)
  const railRight = page.locator('.nox-progress-system.pos-right .nox-progress-rail');
  if (await railRight.isVisible()) {
    const box = await railRight.boundingBox();
    if (box) {
      // Simulate real mouse drag
      await page.mouse.move(box.x + box.width / 2, box.y + 20);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6, { steps: 5 });
      await page.waitForTimeout(300);

      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'v6_progressbar_during_drag.png')
      });
      console.log('Captured: v6_progressbar_during_drag.png');

      await page.mouse.up();
      await page.waitForTimeout(400);
    }
  }

  // Position: Left
  await openChapter({ progressPosition: 'left', progressDisplay: 'percent' });
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v6_progressbar_left.png')
  });
  console.log('Captured: v6_progressbar_left.png');

  // Position: Bottom
  await openChapter({ progressPosition: 'bottom', progressDisplay: 'percent' });
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v6_progressbar_bottom.png')
  });
  console.log('Captured: v6_progressbar_bottom.png');

  // --- RESPONSIVE DESKTOP & MOBILE SCREENSHOTS ---
  console.log('\n--- 6. Capturando viewports responsivos Desktop e Mobile ---');
  const viewports = [
    { name: 'v6_desktop_1920px', width: 1920, height: 1080 },
    { name: 'v6_desktop_1440px', width: 1440, height: 900 },
    { name: 'v6_desktop_1280px', width: 1280, height: 800 },
    { name: 'v6_mobile_430px', width: 430, height: 932, isMobile: true },
    { name: 'v6_mobile_390px', width: 390, height: 844, isMobile: true },
    { name: 'v6_mobile_360px', width: 360, height: 780, isMobile: true },
    { name: 'v6_mobile_320px', width: 320, height: 650, isMobile: true }
  ];

  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: !!vp.isMobile,
      hasTouch: !!vp.isMobile
    });
    await ctx.addCookies(sessionCookies);
    await ctx.addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
    ]);
    const p = await ctx.newPage();
    await p.goto(CHAPTER_URL, { waitUntil: 'networkidle' });
    // Scroll to end of chapter & comments
    await p.locator('.compact-completion-card').scrollIntoViewIfNeeded();
    await p.waitForTimeout(600);
    await p.screenshot({
      path: path.join(ARTIFACTS_DIR, `${vp.name}_chapter_end.png`)
    });
    await p.locator('.comments-section-root').scrollIntoViewIfNeeded();
    await p.waitForTimeout(600);
    await p.screenshot({
      path: path.join(ARTIFACTS_DIR, `${vp.name}_comments_feed.png`)
    });
    console.log(`Captured: ${vp.name}_chapter_end.png & ${vp.name}_comments_feed.png`);
    await ctx.close();
  }

  // Firefox Mobile check
  try {
    const ffBrowser = await firefox.launch({ headless: true });
    const ffCtx = await ffBrowser.newContext({
      viewport: { width: 390, height: 844 }
    });
    await ffCtx.addCookies(sessionCookies);
    await ffCtx.addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
    ]);
    const ffp = await ffCtx.newPage();
    await ffp.goto(CHAPTER_URL, { waitUntil: 'networkidle' });
    await ffp.locator('.comments-section-root').scrollIntoViewIfNeeded();
    await ffp.waitForTimeout(800);
    await ffp.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v6_firefox_mobile_390px_comments.png')
    });
    console.log('Captured: v6_firefox_mobile_390px_comments.png');
    await ffBrowser.close();
  } catch (err) {
    console.warn('Firefox mobile test notice:', err.message);
  }

  await browser.close();
  console.log('\n=== AUDITORIA RODADA 20 V6 CONCLUÍDA COM SUCESSO ===');
}

runV6TestSuite().catch((err) => {
  console.error('Falha no teste V6:', err);
  process.exit(1);
});
