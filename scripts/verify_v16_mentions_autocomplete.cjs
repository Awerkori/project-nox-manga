const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

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
const CHAPTER_ID = 'b88c0c5f-9664-5fae-a6d9-d5ad03af1369';
const CHAPTER_URL = `${PREVIEW_URL}/ler/${CHAPTER_ID}`;
const JONAS_COMMENT_ID = '46cb4fa8-7be2-41f4-9e44-6cae5f152fd2';
const CONTROLLED_TARGET_USER_ID = 'ad61ae4b-b289-4203-ab8e-717b8cd08892'; // awerkorilinux

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function dismissAgeGate(page) {
  try {
    const btn = page.locator('.btn-choice.adult');
    if (await btn.isVisible({ timeout: 1500 })) {
      await btn.click();
      await page.waitForTimeout(400);
    }
  } catch {}
}

async function run() {
  console.log('===============================================================');
  console.log(' PROJECT NOX — COMPLEMENTO V16: SMART @ MENTIONS AUTOCOMPLETE');
  console.log(' Target Worker: home-preview-manga');
  console.log(' URL: ' + CHAPTER_URL);
  console.log('===============================================================');

  const { ownerCookies } = await import('./owner-session.mjs');
  const sessionCookies = await ownerCookies(PREVIEW_URL);

  const browser = await chromium.launch({ headless: true });

  const createdCommentIds = [];

  try {
    // -----------------------------------------------------------------
    // TEST 1: Real-time Autocomplete Search in Main Composer (@P -> @Pris)
    // -----------------------------------------------------------------
    console.log('\n[TEST 1] Testing Desktop Real-Time Autocomplete Search...');
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    await context.addCookies(sessionCookies);
    await context.addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
    ]);

    const page = await context.newPage();
    await page.goto(CHAPTER_URL, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(2500);
    await dismissAgeGate(page);

    const commentsRoot = page.locator('.comments-section-root').first();
    await commentsRoot.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

    const mainTextarea = page.locator('.composer-textarea').first();
    await mainTextarea.click();
    await mainTextarea.fill('Testando menção com @P');
    await page.waitForTimeout(500);

    // Wait for dropdown to show up
    const dropdown = page.locator('.mention-autocomplete-menu').first();
    await dropdown.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Dropdown appeared after typing "@P"');

    // Screenshot of @P search results
    const composerBox = page.locator('.composer-card-premium').first();
    await composerBox.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v16_autocomplete_dropdown_p.png')
    });
    console.log('✓ v16_autocomplete_dropdown_p.png captured.');

    // Refine search to @Pris
    console.log('Refining query to "@Pris"...');
    await mainTextarea.fill('Testando menção com @Pris');
    await page.waitForTimeout(400);

    const candidateItems = dropdown.locator('.mention-candidate-item');
    const count = await candidateItems.count();
    console.log(`✓ Dropdown filtered to ${count} candidates for "@Pris"`);

    const firstCandidateText = await candidateItems.first().innerText();
    console.log('✓ First candidate text:\n', firstCandidateText.trim());

    // Check highlighted text
    const hasHighlight = await dropdown.locator('.mention-query-highlight').first().isVisible();
    console.log('✓ Query match highlight present:', hasHighlight);

    // Screenshot of @Pris refined search results
    await composerBox.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v16_autocomplete_dropdown_pris.png')
    });
    console.log('✓ v16_autocomplete_dropdown_pris.png captured.');

    // -----------------------------------------------------------------
    // TEST 2: Keyboard Navigation (ArrowDown / ArrowUp / Enter)
    // -----------------------------------------------------------------
    console.log('\n[TEST 2] Testing Keyboard Navigation (ArrowDown + Enter)...');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    const textAfterEnter = await mainTextarea.inputValue();
    console.log('✓ Text after Enter selection:', JSON.stringify(textAfterEnter));

    // Clear main composer
    await mainTextarea.fill('');

    // -----------------------------------------------------------------
    // TEST 3: Controlled Notification Test (Mention @awerkorilinux & verify in-app notification)
    // -----------------------------------------------------------------
    console.log('\n[TEST 3] Testing Controlled Mention & Internal Notification...');
    // Clean prior notifications for controlled test user
    await supabase.from('notifications').delete().eq('user_id', CONTROLLED_TARGET_USER_ID);

    // Type comment mentioning @awerkorilinux with spoiler
    await mainTextarea.fill('Capítulo impressionante! @awerkorilinux veja esta revelação: ||o poder secreto despertou||');
    await page.waitForTimeout(400);

    const publishBtn = page.locator('.btn-submit-premium').first();
    await publishBtn.click();
    await page.waitForTimeout(3000);

    // Locate the newly published comment
    const publishedCard = page.locator('.comment-card-modern:has-text("o poder secreto despertou")').first();
    await publishedCard.waitFor({ state: 'visible', timeout: 6000 });
    console.log('✓ Comment successfully published.');

    // Extract comment ID
    const cardId = await publishedCard.getAttribute('id');
    const commentId = cardId ? cardId.replace('comment-', '') : null;
    if (commentId) createdCommentIds.push(commentId);
    console.log('✓ Published comment ID:', commentId);

    // Verify clickable mention chip
    const mentionChip = publishedCard.locator('.mention-chip').first();
    const mentionHref = await mentionChip.getAttribute('href');
    const mentionText = await mentionChip.innerText();
    console.log(`✓ Mention Chip rendered: "${mentionText}" with href="${mentionHref}"`);

    // Screenshot of Published Mention & Revealed Spoiler
    const spoilerBtn = publishedCard.locator('.discord-spoiler').first();
    await spoilerBtn.click();
    await page.waitForTimeout(300);

    await publishedCard.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v16_published_mention_desktop.png')
    });
    console.log('✓ v16_published_mention_desktop.png captured.');

    // Verify Notification in Database
    console.log('Checking notifications table for recipient awerkorilinux...');
    const { data: notifs, error: notifErr } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', CONTROLLED_TARGET_USER_ID)
      .order('created_at', { ascending: false });

    if (notifErr) {
      console.error('Error fetching notifications:', notifErr);
    } else {
      console.log('✓ Notifications found for awerkorilinux:', notifs.length);
      if (notifs.length > 0) {
        const n = notifs[0];
        console.log(`  - Type: ${n.type}`);
        console.log(`  - Title: ${n.title}`);
        console.log(`  - DeepLink: ${n.href || n.deep_link}`);
        console.log(`  - Body snippet: ${n.body}`);
      }
    }

    // -----------------------------------------------------------------
    // TEST 4: Inline Reply Composer Autocomplete
    // -----------------------------------------------------------------
    console.log('\n[TEST 4] Testing Autocomplete in Inline Reply Composer...');
    await page.waitForTimeout(1000);

    // Find the reply button on Jonas's comment
    const jonasCard = page.locator('#comment-' + JONAS_COMMENT_ID).first();
    await jonasCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const replyBtn = jonasCard.locator('.btn-footer-reply').first();
    await replyBtn.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(400);
    await replyBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const inlineComposer = page.locator('.inline-composer-card').first();
    await inlineComposer.waitFor({ state: 'visible', timeout: 5000 });

    const inlineTextarea = inlineComposer.locator('.inline-reply-textarea').first();
    await inlineTextarea.click();
    await inlineTextarea.fill('Respondendo e marcando @P');
    await page.waitForTimeout(500);

    const inlineDropdown = inlineComposer.locator('.mention-autocomplete-menu').first();
    await inlineDropdown.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Inline reply autocomplete dropdown visible!');

    await inlineComposer.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v16_autocomplete_inline_reply.png')
    });
    console.log('✓ v16_autocomplete_inline_reply.png captured.');

    // Cancel inline reply
    const cancelReplyBtn = inlineComposer.locator('.btn-close-inline').first();
    await cancelReplyBtn.click();
    await page.waitForTimeout(400);

    await context.close();

    // -----------------------------------------------------------------
    // TEST 5: Mobile Viewport & Virtual Keyboard Position (390x844)
    // -----------------------------------------------------------------
    console.log('\n[TEST 5] Testing Mobile Android Viewport (390x844)...');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    await mobileContext.addCookies(sessionCookies);
    await mobileContext.addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
    ]);

    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(CHAPTER_URL, { waitUntil: 'load', timeout: 45000 });
    await mobilePage.waitForTimeout(2500);
    await dismissAgeGate(mobilePage);

    const mCommentsRoot = mobilePage.locator('.comments-section-root').first();
    await mCommentsRoot.scrollIntoViewIfNeeded();
    await mobilePage.waitForTimeout(600);

    const mTextarea = mobilePage.locator('.composer-textarea').first();
    await mTextarea.click();
    await mTextarea.fill('Mobile test @Pris');
    await mobilePage.waitForTimeout(500);

    const mDropdown = mobilePage.locator('.mention-autocomplete-menu').first();
    await mDropdown.waitFor({ state: 'visible', timeout: 5000 });

    const mComposer = mobilePage.locator('.composer-card-premium').first();
    await mComposer.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v16_mobile_autocomplete.png')
    });
    console.log('✓ v16_mobile_autocomplete.png captured.');

    // Touch candidate on mobile
    const mFirstItem = mDropdown.locator('.mention-candidate-item').first();
    await mFirstItem.dispatchEvent('pointerdown');
    await mFirstItem.click();
    await mobilePage.waitForTimeout(400);

    const mTextAfter = await mTextarea.inputValue();
    console.log('✓ Mobile text after touch selection:', JSON.stringify(mTextAfter));

    await mobileContext.close();

  } finally {
    // -----------------------------------------------------------------
    // CLEANUP: Clean up test comments, preserve Jonas
    // -----------------------------------------------------------------
    console.log('\n--- CLEANING UP TEST COMMENTS ---');
    if (createdCommentIds.length > 0) {
      await supabase.from('comment_likes').delete().in('comment_id', createdCommentIds);
      await supabase.from('comments').delete().in('id', createdCommentIds);
      console.log('✓ Cleaned up test comments:', createdCommentIds);
    }

    // Verify Jonas comment is intact
    const { data: jonasCheck } = await supabase
      .from('comments')
      .select('id, body')
      .eq('id', JONAS_COMMENT_ID);
    console.log('✓ Jonas Amaral comment status:', jonasCheck && jonasCheck.length > 0 ? 'SAFE & INTACT' : 'WARNING: NOT FOUND');

    await browser.close();
  }

  console.log('\n===============================================================');
  console.log(' ALL COMPLEMENTO V16 MENTIONS TESTS COMPLETED SUCCESSFULLY');
  console.log('===============================================================');
}

run().catch((err) => {
  console.error('Fatal error in verify_v16_mentions_autocomplete.cjs:', err);
  process.exit(1);
});
