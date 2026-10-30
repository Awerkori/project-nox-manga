const fs = require('fs');
const path = require('path');
const { chromium, firefox } = require('playwright');

for (const envPath of ['.dev.vars.preview_full', '.env']) {
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

// Minimal valid PNG buffer (1x1 red)
const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

// Minimal valid GIF89a buffer (1x1 transparent animated GIF)
const VALID_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// Minimal valid WebP buffer
const VALID_WEBP = Buffer.from(
  'UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=',
  'base64'
);

async function runTest() {
  console.log('=== PROJECT NOX: RODADA 20 V5 COMPREHENSIVE E2E & POLISH VERIFICATION ===\n');

  const { ownerCookies } = await import('./owner-session.mjs');
  const sessionCookies = await ownerCookies(PREVIEW_URL);

  const results = {
    chapterId: 'b88c0c5f-9664-5fae-a6d9-d5ad03af1369',
    workSlug: 'a-dupla-vida-da-princesa',
    uploads: {},
    comments: {},
    mentions: {},
    viewports: {}
  };

  // =========================================================================
  // 1. DIRECT API TESTS FOR MULTIMEDIA UPLOAD (/api/comments/upload)
  // =========================================================================
  console.log('--- 1. Testing Multimedia Uploads via API ---');

  // Convert cookies to Cookie header
  const cookieHeader = sessionCookies.map(c => `${c.name}=${c.value}`).join('; ');

  // Test PNG Upload
  try {
    const fd = new FormData();
    fd.append('file', new Blob([VALID_PNG], { type: 'image/png' }), 'test-sample.png');
    const res = await fetch(`${PREVIEW_URL}/api/comments/upload`, {
      method: 'POST',
      headers: {
        'Cookie': cookieHeader,
        'Origin': PREVIEW_URL
      },
      body: fd
    });
    const json = await res.json();
    console.log('[UPLOAD PNG]', res.status, json);
    results.uploads.png = { status: res.status, ok: res.ok, json };
  } catch (err) {
    console.error('[UPLOAD PNG ERROR]', err.message);
    results.uploads.png = { error: err.message };
  }

  // Test GIF Upload
  try {
    const fd = new FormData();
    fd.append('file', new Blob([VALID_GIF], { type: 'image/gif' }), 'animation.gif');
    const res = await fetch(`${PREVIEW_URL}/api/comments/upload`, {
      method: 'POST',
      headers: {
        'Cookie': cookieHeader,
        'Origin': PREVIEW_URL
      },
      body: fd
    });
    const json = await res.json();
    console.log('[UPLOAD GIF]', res.status, json);
    results.uploads.gif = { status: res.status, ok: res.ok, json };
  } catch (err) {
    console.error('[UPLOAD GIF ERROR]', err.message);
    results.uploads.gif = { error: err.message };
  }

  // Test WebP Upload
  try {
    const fd = new FormData();
    fd.append('file', new Blob([VALID_WEBP], { type: 'image/webp' }), 'sample.webp');
    const res = await fetch(`${PREVIEW_URL}/api/comments/upload`, {
      method: 'POST',
      headers: {
        'Cookie': cookieHeader,
        'Origin': PREVIEW_URL
      },
      body: fd
    });
    const json = await res.json();
    console.log('[UPLOAD WEBP]', res.status, json);
    results.uploads.webp = { status: res.status, ok: res.ok, json };
  } catch (err) {
    console.error('[UPLOAD WEBP ERROR]', err.message);
    results.uploads.webp = { error: err.message };
  }

  // =========================================================================
  // 2. PLAYWRIGHT INTERACTIVE VERIFICATION IN BROWSER
  // =========================================================================
  console.log('\n--- 2. Launching Playwright on Chapter 76 ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await context.addCookies(sessionCookies);
  await context.addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
  ]);

  const page = await context.newPage();
  console.log(`Navigating to ${CHAPTER_URL}...`);
  await page.goto(CHAPTER_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  // Check end-of-chapter element order
  const endOrder = await page.evaluate(() => {
    const sec = document.getElementById('chapter-end');
    if (!sec) return [];
    return Array.from(sec.children).map(c => {
      if (c.classList.contains('compact-completion-card')) return 'CONCLUSION_HERO';
      if (c.classList.contains('reactions-dock-card')) return 'REACTIONS';
      if (c.classList.contains('report-problem-card')) return 'REPORT_PROBLEM';
      if (c.classList.contains('reader-comments-wrap')) return 'COMMENTS';
      return c.className;
    });
  });
  console.log('[END OF CHAPTER ORDER]', endOrder);
  results.endOrder = endOrder;

  // Scroll to comments
  await page.locator('.reader-comments-wrap').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // 2.1 Post a Real Text + Mention Comment
  const uniqueToken = Date.now();
  const testCommentText = `QA V5 Teste Real de Comentário: Excelente capítulo 76! @inacioireno veja essa cena. ||Spoiler test ${uniqueToken}||`;
  console.log('Posting comment:', testCommentText);

  await page.locator('.composer-input-area textarea').fill(testCommentText);
  await page.waitForTimeout(500);
  await page.locator('.btn-submit-premium').click();
  await page.waitForTimeout(3000);

  // Check if error notice appeared
  const notice = await page.locator('.notice-alert').textContent().catch(() => null);
  console.log('[POST NOTICE]', notice);
  results.comments.postNotice = notice;

  // Verify that the comment rendered in the list
  const commentRendered = await page.evaluate((token) => {
    return Array.from(document.querySelectorAll('.comment-text-body')).some(el => el.textContent.includes(token));
  }, String(uniqueToken));
  console.log('[COMMENT RENDERED IN DOM]', commentRendered);
  results.comments.renderedInDom = commentRendered;

  // Verify Mention is clickable
  const mentionLink = await page.locator(`.comment-text-body a.mention-chip[href="/u/inacioireno"]`).first().isVisible().catch(() => false);
  console.log('[MENTION CLICKABLE /u/inacioireno]', mentionLink);
  results.mentions.clickable = mentionLink;

  // Verify Discord Spoiler Pill is present and works on click
  const spoilerPill = page.locator('.spoiler-tag-box').first();
  const spoilerVisible = await spoilerPill.isVisible().catch(() => false);
  if (spoilerVisible) {
    const isRevealedBefore = await spoilerPill.evaluate(el => el.classList.contains('revealed'));
    await spoilerPill.click();
    await page.waitForTimeout(300);
    const isRevealedAfter = await spoilerPill.evaluate(el => el.classList.contains('revealed'));
    console.log('[SPOILER TOGGLE]', { isRevealedBefore, isRevealedAfter });
    results.comments.spoilerToggle = { isRevealedBefore, isRevealedAfter };
  }

  // 2.2 Post a Comment with Attached Media
  console.log('\n--- 2.2 Testing Comment with Attached Media via UI ---');
  const mediaUrl = results.uploads.gif?.json?.url || results.uploads.png?.json?.url;
  if (mediaUrl) {
    const mediaToken = Date.now();
    const mediaComment = `QA V5 Comentário com Imagem/GIF: ![Mídia Anexa](${mediaUrl}) #${mediaToken}`;
    await page.locator('.composer-input-area textarea').fill(mediaComment);
    await page.waitForTimeout(500);
    await page.locator('.btn-submit-premium').click();
    await page.waitForTimeout(3000);

    const mediaRendered = await page.locator(`img.comment-rendered-img[src="${mediaUrl}"]`).first().isVisible().catch(() => false);
    console.log('[MEDIA RENDERED IN DOM]', mediaRendered);
    results.comments.mediaRendered = mediaRendered;
  }

  // Reload page to verify persistence after reload!
  console.log('\n--- 2.3 Verifying Persistence After Page Reload ---');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('.reader-comments-wrap').scrollIntoViewIfNeeded();

  const persistedAfterReload = await page.evaluate((token) => {
    return Array.from(document.querySelectorAll('.comment-text-body')).some(el => el.textContent.includes(token));
  }, String(uniqueToken));
  console.log('[PERSISTENCE AFTER RELOAD]', persistedAfterReload);
  results.comments.persistedAfterReload = persistedAfterReload;

  // Capture Screenshots of the New End-of-Chapter Navigation & Comments
  console.log('\n--- 3. Capturing Responsive Screenshots ---');

  // Desktop 1440px
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#chapter-end').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const p1440 = path.join(ARTIFACTS_DIR, 'v5_desktop_1440px_navigation.png');
  await page.screenshot({ path: p1440 });
  results.viewports.desktop_1440px = p1440;

  // Desktop 1920px
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('#chapter-end').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const p1920 = path.join(ARTIFACTS_DIR, 'v5_desktop_1920px_navigation.png');
  await page.screenshot({ path: p1920 });
  results.viewports.desktop_1920px = p1920;

  // Desktop 1280px
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('#chapter-end').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const p1280 = path.join(ARTIFACTS_DIR, 'v5_desktop_1280px_navigation.png');
  await page.screenshot({ path: p1280 });
  results.viewports.desktop_1280px = p1280;

  // Mobile 430px (iPhone 14/15 Pro Max)
  await page.setViewportSize({ width: 430, height: 932 });
  await page.locator('#chapter-end').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const p430 = path.join(ARTIFACTS_DIR, 'v5_mobile_430px_navigation.png');
  await page.screenshot({ path: p430 });
  results.viewports.mobile_430px = p430;

  // Mobile 390px (iPhone 13/14)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#chapter-end').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const p390 = path.join(ARTIFACTS_DIR, 'v5_mobile_390px_navigation.png');
  await page.screenshot({ path: p390 });
  results.viewports.mobile_390px = p390;

  // Mobile 360px (Standard Android)
  await page.setViewportSize({ width: 360, height: 780 });
  await page.locator('#chapter-end').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const p360 = path.join(ARTIFACTS_DIR, 'v5_mobile_360px_navigation.png');
  await page.screenshot({ path: p360 });
  results.viewports.mobile_360px = p360;

  // Mobile 320px (Compact)
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator('#chapter-end').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const p320 = path.join(ARTIFACTS_DIR, 'v5_mobile_320px_navigation.png');
  await page.screenshot({ path: p320 });
  results.viewports.mobile_320px = p320;

  // Comments feed screenshot
  await page.locator('.reader-comments-wrap').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const pComments = path.join(ARTIFACTS_DIR, 'v5_comments_feed_live.png');
  await page.screenshot({ path: pComments });
  results.viewports.commentsFeed = pComments;

  await browser.close();

  // Test in Firefox
  console.log('\n--- 4. Testing in Firefox Mobile 390px ---');
  try {
    const ffBrowser = await firefox.launch({ headless: true });
    const ffContext = await ffBrowser.newContext({ viewport: { width: 390, height: 844 } });
    await ffContext.addCookies(sessionCookies);
    await ffContext.addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
    ]);
    const ffPage = await ffContext.newPage();
    await ffPage.goto(CHAPTER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await ffPage.waitForTimeout(1500);
    await ffPage.locator('#chapter-end').scrollIntoViewIfNeeded();
    await ffPage.waitForTimeout(500);
    const pFF = path.join(ARTIFACTS_DIR, 'v5_firefox_mobile_390px.png');
    await ffPage.screenshot({ path: pFF });
    results.viewports.firefox_390px = pFF;
    await ffBrowser.close();
    console.log('[FIREFOX VERIFIED] Screenshot saved');
  } catch (ffErr) {
    console.warn('[FIREFOX WARNING]', ffErr.message);
  }

  // Write Audit Results JSON
  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'round20_v5_audit_results.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log('\n=== AUDIT COMPLETE ===');
  console.log(JSON.stringify(results, null, 2));
}

runTest().catch((e) => {
  console.error('[FATAL]', e);
  process.exit(1);
});
